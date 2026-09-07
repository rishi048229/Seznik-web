package com.seznik.billocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class OfflineBillOcrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("ReactContext is unavailable")

  private val coroutineScope = CoroutineScope(Dispatchers.IO)
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun definition() = ModuleDefinition {
    Name("OfflineBillOcr")

    Function("isSupported") {
      true
    }

    AsyncFunction("recognizeFromImageUri") { uriString: String, promise: Promise ->
      coroutineScope.launch {
        try {
          val bitmap = loadBitmapFromUri(uriString)
            ?: throw IllegalArgumentException("Could not decode image from URI: $uriString")
          
          val inputImage = InputImage.fromBitmap(bitmap, 0)
          val result = Tasks.await(recognizer.process(inputImage))

          val blocksList = result.textBlocks.map { block ->
            mapOf(
              "text" to block.text,
              "lines" to block.lines.map { line ->
                mapOf(
                  "text" to line.text,
                  "confidence" to (line.confidence ?: 1.0f)
                )
              }
            )
          }

          promise.resolve(
            mapOf(
              "fullText" to result.text,
              "blocks" to blocksList,
              "previewImageUri" to uriString
            )
          )
        } catch (e: Exception) {
          promise.reject("OCR_ERROR", e.message ?: "Failed to recognize text from image", e)
        }
      }
    }

    AsyncFunction("recognizeFromPdfUri") { uriString: String, promise: Promise ->
      coroutineScope.launch {
        var pfd: ParcelFileDescriptor? = null
        var pdfRenderer: PdfRenderer? = null
        var tempPdfFile: File? = null

        try {
          val uri = Uri.parse(uriString)
          tempPdfFile = copyUriToTempFile(uri, "temp_bill_${System.currentTimeMillis()}.pdf")

          pfd = ParcelFileDescriptor.open(tempPdfFile, ParcelFileDescriptor.MODE_READ_ONLY)
          pdfRenderer = PdfRenderer(pfd)
          val pageCount = pdfRenderer.pageCount

          if (pageCount == 0) {
            throw IllegalArgumentException("PDF contains no pages")
          }

          // Render first page at high DPI (scale 2.5x for crystal clear OCR on fine receipt/bill fonts)
          val page = pdfRenderer.openPage(0)
          val scale = 2.5f
          val renderWidth = (page.width * scale).toInt()
          val renderHeight = (page.height * scale).toInt()

          val bitmap = Bitmap.createBitmap(renderWidth, renderHeight, Bitmap.Config.ARGB_8888)
          // Fill with clean white background before rendering PDF
          bitmap.eraseColor(Color.WHITE)
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
          page.close()

          // Save rendered bitmap to cache as JPEG so React Native UI can display the document preview
          val previewFile = File(context.cacheDir, "pdf_preview_${System.currentTimeMillis()}.jpg")
          FileOutputStream(previewFile).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
          }
          val previewUri = Uri.fromFile(previewFile).toString()

          // Run ML Kit OCR on the rendered high-res bitmap
          val inputImage = InputImage.fromBitmap(bitmap, 0)
          val result = Tasks.await(recognizer.process(inputImage))

          val blocksList = result.textBlocks.map { block ->
            mapOf(
              "text" to block.text,
              "lines" to block.lines.map { line ->
                mapOf(
                  "text" to line.text,
                  "confidence" to (line.confidence ?: 1.0f)
                )
              }
            )
          }

          promise.resolve(
            mapOf(
              "fullText" to result.text,
              "blocks" to blocksList,
              "pageCount" to pageCount,
              "previewImageUri" to previewUri
            )
          )
        } catch (e: Exception) {
          promise.reject("PDF_OCR_ERROR", e.message ?: "Failed to render or process PDF", e)
        } finally {
          runCatching { pdfRenderer?.close() }
          runCatching { pfd?.close() }
          runCatching { tempPdfFile?.delete() }
        }
      }
    }
  }

  private fun loadBitmapFromUri(uriString: String): Bitmap? {
    return try {
      val uri = Uri.parse(uriString)
      if (uri.scheme == "file") {
        BitmapFactory.decodeFile(uri.path)
      } else {
        context.contentResolver.openInputStream(uri)?.use { stream ->
          BitmapFactory.decodeStream(stream)
        }
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun copyUriToTempFile(uri: Uri, filename: String): File {
    val tempFile = File(context.cacheDir, filename)
    context.contentResolver.openInputStream(uri)?.use { input: InputStream ->
      FileOutputStream(tempFile).use { output ->
        input.copyTo(output)
      }
    } ?: throw IllegalStateException("Could not open input stream from URI: $uri")
    return tempFile
  }
}
