package com.seznik.joshlabelprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import com.dothantech.lpapi.LPAPI
import com.dothantech.printer.IDzPrinter
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Bridge for DothanTech/Josh LPAPI Bluetooth label printers.
 *
 * Implements Approach A (Direct Flattened Bitmap Path via api.printBitmap):
 * Renders the entire label canvas (text, barcode, QR code, images, shapes) onto
 * a 1-bit-friendly ARGB_8888 software Bitmap with solid white background,
 * eliminating coordinate mismatch, text clipping, and font size incompatibilities.
 */
class JoshLabelPrinterModule : Module() {

  private var api: LPAPI? = null

  /** Discovered printers, keyed by MAC, so connect() can reuse the exact address object. */
  private val discovered = ConcurrentHashMap<String, IDzPrinter.PrinterAddress>()

  @Volatile private var lastState: String = "disconnected"

  private class PendingPrint {
    val latch = CountDownLatch(1)
    @Volatile var success = false
    @Volatile var failReason: String? = null
  }

  @Volatile private var pendingPrint: PendingPrint? = null

  private val callback = object : LPAPI.Callback {
    override fun onProgressInfo(info: IDzPrinter.ProgressInfo?, arg: Any?) {}

    override fun onStateChange(address: IDzPrinter.PrinterAddress?, state: IDzPrinter.PrinterState?) {
      val name = when (state) {
        IDzPrinter.PrinterState.Connecting -> "connecting"
        IDzPrinter.PrinterState.Connected,
        IDzPrinter.PrinterState.Connected2,
        IDzPrinter.PrinterState.Working -> "connected"
        IDzPrinter.PrinterState.Printing -> "printing"
        else -> "disconnected"
      }
      lastState = name
      if (name == "disconnected") {
        pendingPrint?.let {
          it.failReason = "The label printer disconnected while printing."
          it.latch.countDown()
        }
      }
      sendEvent(
        "onPrinterStateChange",
        bundleOf(
          "state" to name,
          "address" to (address?.macAddress ?: ""),
          "name" to (address?.shownName ?: "")
        )
      )
    }

    override fun onPrintProgress(
      address: IDzPrinter.PrinterAddress?,
      data: IDzPrinter.PrintData?,
      progress: IDzPrinter.PrintProgress?,
      arg: Any?
    ) {
      when (progress) {
        IDzPrinter.PrintProgress.Success -> {
          pendingPrint?.let {
            it.success = true
            it.latch.countDown()
          }
        }
        IDzPrinter.PrintProgress.Failed -> {
          pendingPrint?.let {
            it.failReason = describeFailReason(arg)
            it.latch.countDown()
          }
        }
        else -> {
          // Intermediate steps, keep waiting.
        }
      }
    }

    override fun onPrinterDiscovery(address: IDzPrinter.PrinterAddress?, arg: Any?) {
      val mac = address?.macAddress ?: return
      val name = address.shownName ?: address.device?.name ?: mac
      discovered[mac] = address
      sendEvent("onPrinterFound", bundleOf("address" to mac, "name" to name))
    }
  }

  private fun describeFailReason(arg: Any?): String {
    val reason = arg as? IDzPrinter.PrintFailReason ?: return "Printing failed (unspecified error)."
    return when (reason) {
      IDzPrinter.PrintFailReason.OK -> "Success"
      IDzPrinter.PrintFailReason.No_Paper -> "Printer is out of paper."
      IDzPrinter.PrintFailReason.No_Label -> "Printer detected no label in feed."
      IDzPrinter.PrintFailReason.CoverOpened -> "Printer cover is open. Please close it and retry."
      IDzPrinter.PrintFailReason.VolTooLow -> "Printer battery is too low to print."
      IDzPrinter.PrintFailReason.TphTooHot -> "Print head is too hot. Let the printer cool down."
      IDzPrinter.PrintFailReason.Disconnected -> "Printer disconnected during print."
      IDzPrinter.PrintFailReason.Timeout -> "Printer timed out while printing."
      else -> "The printer reported a print failure (${reason.name})."
    }
  }

  private fun bundleOf(vararg pairs: Pair<String, Any?>): Bundle {
    val b = Bundle()
    for ((k, v) in pairs) {
      when (v) {
        null -> b.putString(k, null)
        is String -> b.putString(k, v)
        is Int -> b.putInt(k, v)
        is Long -> b.putLong(k, v)
        is Double -> b.putDouble(k, v)
        is Float -> b.putFloat(k, v)
        is Boolean -> b.putBoolean(k, v)
        is Bundle -> b.putBundle(k, v)
        else -> b.putString(k, v.toString())
      }
    }
    return b
  }

  private fun requireApi(): LPAPI {
    val existing = api
    if (existing != null) return existing
    val fresh = LPAPI.Factory.createInstance(callback)
      ?: throw CodedException("ERR_JOSH_INIT", "Failed to initialize label printer SDK.", null)
    api = fresh
    return fresh
  }

  private fun finite(v: Any?, fallback: Double): Double {
    val d = when (v) {
      is Number -> v.toDouble()
      is String -> v.toDoubleOrNull() ?: fallback
      else -> fallback
    }
    return if (d.isFinite()) d else fallback
  }

  private fun finiteOrNull(v: Any?): Double? {
    val d = when (v) {
      is Number -> v.toDouble()
      is String -> v.toDoubleOrNull()
      else -> null
    }
    return if (d != null && d.isFinite()) d else null
  }

  private fun finiteInt(v: Any?, fallback: Int): Int = finite(v, fallback.toDouble()).toInt()

  private fun printableWidthMm(): Double {
    val info = api?.printerInfo ?: return 0.0
    val w01mm = info.getInt(IDzPrinter.PrinterInfoName.PRINTABLE_WIDTH_01MM, 0)
    if (w01mm > 0) return w01mm / 10.0
    val wMm = info.getInt(IDzPrinter.PrinterInfoName.PRINTABLE_WIDTH, 0)
    if (wMm > 0) return wMm.toDouble()
    return 0.0
  }

  override fun definition() = ModuleDefinition {
    Name("JoshLabelPrinter")

    Events("onPrinterFound", "onPrinterStateChange")

    Function("isSupported") { true }

    Function("isConnected") {
      val instance = api ?: return@Function false
      instance.isPrinterOpened && (
        lastState == "connected" ||
        instance.printerState == IDzPrinter.PrinterState.Connected ||
        instance.printerState == IDzPrinter.PrinterState.Connected2 ||
        instance.printerState == IDzPrinter.PrinterState.Working
      )
    }

    Function("getPrinterState") { lastState }

    Function("getPrinterInfo") {
      val instance = api ?: return@Function null
      if (!instance.isPrinterOpened) return@Function null
      val info = instance.printerInfo ?: Bundle()
      val mac = instance.printerAddress?.macAddress ?: ""
      val name = instance.printerAddress?.shownName ?: instance.printerAddress?.device?.name ?: ""
      val widthMm = printableWidthMm().takeIf { it > 0 } ?: 48.0
      bundleOf(
        "address" to mac,
        "name" to name,
        "widthMm" to widthMm,
        "state" to lastState
      )
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      try {
        val instance = requireApi()
        val ok = instance.discovery()
        promise.resolve(ok)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_DISCOVERY", e.message ?: "Discovery failed", e))
      }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      try {
        api?.stopDiscovery()
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_DISCOVERY", e.message ?: "Stop discovery failed", e))
      }
    }

    AsyncFunction("getPairedPrinters") { promise: Promise ->
      try {
        val btAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
        val paired = btAdapter?.bondedDevices?.map { dev ->
          mapOf("address" to (dev.address ?: ""), "name" to (dev.name ?: dev.address ?: ""))
        } ?: emptyList()
        promise.resolve(paired)
      } catch (e: Throwable) {
        promise.resolve(emptyList<Map<String, String>>())
      }
    }

    AsyncFunction("connect") { address: String, promise: Promise ->
      try {
        val instance = requireApi()
        val known = discovered[address]
        val ok = if (known != null) instance.openPrinterByAddressSync(known)
                 else instance.openPrinterSync(address)
        if (ok) lastState = "connected"
        promise.resolve(ok)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_CONNECT", e.message ?: "Could not connect", e))
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        api?.closePrinter()
        lastState = "disconnected"
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_DISCONNECT", e.message ?: "Could not disconnect", e))
      }
    }

    /**
     * Prints a label using Approach A (Direct Flattened Bitmap Path).
     *
     * Constructs an opaque, white-filled, software ARGB_8888 bitmap of the exact
     * label size (at 203 DPI = 8 dots/mm), renders all elements with Android Canvas,
     * and submits it via api.printBitmap(bmp, param).
     */
    AsyncFunction("printLabel") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val instance = requireApi()
        if (!instance.isPrinterOpened) {
          throw CodedException("ERR_JOSH_NOT_CONNECTED", "No label printer is connected.", null)
        }

        val widthMm = finite(spec["widthMm"], 50.0)
        val heightMm = finite(spec["heightMm"], 30.0)
        if (!widthMm.isFinite() || !heightMm.isFinite() || widthMm <= 0 || heightMm <= 0) {
          throw CodedException(
            "ERR_JOSH_SIZE",
            "This label has an invalid size (${spec["widthMm"]} x ${spec["heightMm"]} mm).",
            null
          )
        }
        val copies = finiteInt(spec["copies"], 1).coerceAtLeast(1)
        val headMm = printableWidthMm().takeIf { it > 1.0 } ?: 48.0

        val jobParam = Bundle()
        val gapType = finiteInt(spec["gapType"], 2) // 2 = die-cut label gap
        val gapMm = finiteInt(spec["gapMm"], 3) // 3mm gap
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_TYPE, gapType)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH, gapMm)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH_01MM, gapMm * 10)
        finiteOrNull(spec["darkness"])?.let { jobParam.putInt(IDzPrinter.PrintParamName.PRINT_DENSITY, it.toInt()) }
        finiteOrNull(spec["speed"])?.let { jobParam.putInt(IDzPrinter.PrintParamName.PRINT_SPEED, it.toInt()) }
        jobParam.putInt(IDzPrinter.PrintParamName.IMAGE_THRESHOLD, 192)
        if (copies > 1) {
          jobParam.putInt(IDzPrinter.PrintParamName.PRINT_COPIES, copies)
        }

        instance.setPrintPageGapType(gapType)
        instance.setPrintPageGapLength(gapMm)

        // Drop any half-finished job
        runCatching { instance.abortJob() }

        // Build composite label bitmap
        val labelBitmap = buildLabelBitmap(spec, widthMm, heightMm, headMm)

        val pending = PendingPrint()
        pendingPrint = pending

        val committed = instance.printBitmap(labelBitmap, jobParam)
        if (!committed) {
          pendingPrint = null
          labelBitmap.recycle()
          throw CodedException("ERR_JOSH_COMMIT", "Printer rejected the label data. Check connection and paper roll.", null)
        }

        val reported = pending.latch.await(30, TimeUnit.SECONDS)
        pendingPrint = null
        labelBitmap.recycle()

        if (!reported) {
          throw CodedException("ERR_JOSH_TIMEOUT", "The printer did not confirm the print. Check the printer and paper roll.", null)
        }
        if (!pending.success) {
          throw CodedException("ERR_JOSH_PRINT_FAILED", pending.failReason ?: "The printer reported a print failure.", null)
        }

        promise.resolve(true)
      } catch (e: CodedException) {
        pendingPrint = null
        promise.reject(e)
      } catch (e: Throwable) {
        pendingPrint = null
        promise.reject(CodedException("ERR_JOSH_PRINT", e.message ?: "Printing failed", e))
      }
    }

    OnDestroy {
      try {
        api?.quit()
      } catch (_: Throwable) {
      }
      api = null
    }
  }

  /**
   * Renders all label elements onto a single software ARGB_8888 Bitmap (Approach A).
   */
  private fun buildLabelBitmap(
    spec: Map<String, Any?>,
    widthMm: Double,
    heightMm: Double,
    headMm: Double
  ): Bitmap {
    val dotsPerMm = 8.0 // 203 DPI
    val printWmm = minOf(widthMm, headMm)
    val printHmm = heightMm
    val fit = if (widthMm > 0) printWmm / widthMm else 1.0

    val wPx = (printWmm * dotsPerMm).toInt().coerceAtLeast(64)
    val hPx = (printHmm * dotsPerMm).toInt().coerceAtLeast(64)

    val bmp = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(Color.WHITE)

    @Suppress("UNCHECKED_CAST")
    val elements = (spec["elements"] as? List<Map<String, Any?>>) ?: emptyList()

    elements.forEach { el ->
      try {
        drawElementOnCanvas(canvas, el, dotsPerMm, fit, wPx, hPx)
      } catch (e: Throwable) {
        android.util.Log.w("JoshLabel", "Skipping element on canvas: ${e.message}")
      }
    }

    return bmp
  }

  private fun drawElementOnCanvas(
    canvas: Canvas,
    el: Map<String, Any?>,
    dotsPerMm: Double,
    fit: Double,
    canvasWidthPx: Int,
    canvasHeightPx: Int
  ) {
    val xPx = (finite(el["x"], 0.0) * fit * dotsPerMm).toFloat()
    val yPx = (finite(el["y"], 0.0) * fit * dotsPerMm).toFloat()
    val wPx = (finite(el["width"], 0.0) * fit * dotsPerMm).toFloat()
    val hPx = (finite(el["height"], 0.0) * fit * dotsPerMm).toFloat()

    when ((el["type"] as? String) ?: "") {
      "text" -> {
        val value = el["value"] as? String ?: return
        if (value.isEmpty()) return
        val fontHeightMm = finite(el["fontHeight"], 3.5) * fit
        val fontSizePx = (fontHeightMm * dotsPerMm).toFloat().coerceAtLeast(14f)
        val bold = (el["bold"] as? Boolean) == true
        val align = finiteInt(el["align"], 0)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.BLACK
          textSize = fontSizePx
          typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
          textAlign = when (align) {
            1 -> Paint.Align.CENTER
            2 -> Paint.Align.RIGHT
            else -> Paint.Align.LEFT
          }
        }

        val drawX = when (align) {
          1 -> if (wPx > 0) xPx + wPx / 2f else xPx + (fontSizePx * value.length * 0.3f)
          2 -> if (wPx > 0) xPx + wPx else xPx + (fontSizePx * value.length * 0.6f)
          else -> xPx
        }

        val fontMetrics = paint.fontMetrics
        val baseline = yPx - fontMetrics.top
        canvas.drawText(value, drawX, baseline, paint)
      }
      "barcode" -> {
        val value = el["value"] as? String ?: return
        if (value.isEmpty()) return
        val barcodeW = if (wPx > 0) wPx.toInt() else (canvasWidthPx - xPx.toInt()).coerceAtLeast(100)
        val barcodeH = if (hPx > 0) hPx.toInt() else 80
        val type = finiteInt(el["barcodeType"], 60)
        val textHeight = (finite(el["textHeight"], 3.0) * fit * dotsPerMm).toFloat()

        val barOnlyHeight = if (textHeight > 0) (barcodeH - textHeight.toInt()).coerceAtLeast(30) else barcodeH
        val barcodeBmp = generateBarcodeBitmap(value, type, barcodeW, barOnlyHeight)

        if (barcodeBmp != null) {
          canvas.drawBitmap(barcodeBmp, xPx, yPx, null)
          barcodeBmp.recycle()

          if (textHeight > 0) {
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
              color = Color.BLACK
              textSize = textHeight.coerceAtLeast(12f)
              typeface = Typeface.DEFAULT
              textAlign = Paint.Align.CENTER
            }
            val textY = yPx + barOnlyHeight + textHeight
            canvas.drawText(value, xPx + barcodeW / 2f, textY, textPaint)
          }
        }
      }
      "qrcode" -> {
        val value = el["value"] as? String ?: return
        if (value.isEmpty()) return
        val rawSize = finite(el["size"], 15.0) * fit * dotsPerMm
        val sizePx = rawSize.toInt().coerceIn(32, minOf(canvasWidthPx, canvasHeightPx))
        val qrBmp = generateQrBitmap(value, sizePx)
        if (qrBmp != null) {
          canvas.drawBitmap(qrBmp, xPx, yPx, null)
          qrBmp.recycle()
        }
      }
      "image" -> {
        val raw = el["uri"] as? String ?: return
        if (wPx <= 0 || hPx <= 0) return
        val invert = (el["invert"] as? Boolean) == true
        val bitmap = decodeImageSource(raw, (wPx / dotsPerMm), (hPx / dotsPerMm), invert)
        if (bitmap != null) {
          val dstRect = RectF(xPx, yPx, xPx + wPx, yPx + hPx)
          val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
          canvas.drawBitmap(bitmap, null, dstRect, paint)
          bitmap.recycle()
        }
      }
      "line" -> {
        val x2 = (finite(el["x2"], el["x"] as? Double ?: 0.0) * fit * dotsPerMm).toFloat()
        val y2 = (finite(el["y2"], el["y"] as? Double ?: 0.0) * fit * dotsPerMm).toFloat()
        val thickness = (finite(el["thickness"], 0.3) * fit * dotsPerMm).toFloat().coerceAtLeast(1f)
        val paint = Paint().apply {
          color = Color.BLACK
          strokeWidth = thickness
          style = Paint.Style.STROKE
        }
        canvas.drawLine(xPx, yPx, x2, y2, paint)
      }
      "rectangle" -> {
        if (wPx <= 0 || hPx <= 0) return
        val thickness = (finite(el["thickness"], 0.3) * fit * dotsPerMm).toFloat().coerceAtLeast(1f)
        val filled = (el["filled"] as? Boolean) == true
        val radius = (finite(el["cornerRadius"], 0.0) * fit * dotsPerMm).toFloat()
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.BLACK
          strokeWidth = thickness
          style = if (filled) Paint.Style.FILL else Paint.Style.STROKE
        }
        val rect = RectF(xPx, yPx, xPx + wPx, yPx + hPx)
        if (radius > 0) canvas.drawRoundRect(rect, radius, radius, paint)
        else canvas.drawRect(rect, paint)
      }
      "ellipse" -> {
        if (wPx <= 0 || hPx <= 0) return
        val thickness = (finite(el["thickness"], 0.3) * fit * dotsPerMm).toFloat().coerceAtLeast(1f)
        val filled = (el["filled"] as? Boolean) == true
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.BLACK
          strokeWidth = thickness
          style = if (filled) Paint.Style.FILL else Paint.Style.STROKE
        }
        canvas.drawOval(RectF(xPx, yPx, xPx + wPx, yPx + hPx), paint)
      }
    }
  }

  private fun generateBarcodeBitmap(
    value: String,
    type: Int,
    widthPx: Int,
    heightPx: Int
  ): Bitmap? {
    return try {
      val digits = value.replace(Regex("[^0-9]"), "")
      val format = when {
        type == 22 || (digits.length == 12 || digits.length == 13) -> BarcodeFormat.EAN_13
        type == 20 -> BarcodeFormat.UPC_A
        else -> BarcodeFormat.CODE_128
      }
      val content = if (format == BarcodeFormat.EAN_13 && (digits.length == 12 || digits.length == 13)) digits else value
      val hints = mapOf(EncodeHintType.MARGIN to 0)
      val matrix = MultiFormatWriter().encode(content, format, widthPx, heightPx, hints)
      val bmp = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
      for (x in 0 until widthPx) {
        for (y in 0 until heightPx) {
          bmp.setPixel(x, y, if (matrix.get(x, y)) Color.BLACK else Color.WHITE)
        }
      }
      bmp
    } catch (e: Throwable) {
      android.util.Log.w("JoshLabel", "Barcode generation failed: ${e.message}")
      null
    }
  }

  private fun generateQrBitmap(
    value: String,
    sizePx: Int
  ): Bitmap? {
    return try {
      val hints = mapOf(EncodeHintType.MARGIN to 0)
      val matrix = MultiFormatWriter().encode(value, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
      val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
      for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
          bmp.setPixel(x, y, if (matrix.get(x, y)) Color.BLACK else Color.WHITE)
        }
      }
      bmp
    } catch (e: Throwable) {
      android.util.Log.w("JoshLabel", "QR generation failed: ${e.message}")
      null
    }
  }

  /** Opens any of the image source forms JS may hand over: content://, file://, data: URI, plain path. */
  private fun openImageStream(raw: String): java.io.InputStream? {
    return try {
      when {
        raw.startsWith("content://") ->
          appContext.reactContext?.contentResolver?.openInputStream(Uri.parse(raw))
        raw.startsWith("file://") -> {
          val path = Uri.parse(raw).path
          if (path != null && File(path).exists()) File(path).inputStream()
          else appContext.reactContext?.contentResolver?.openInputStream(Uri.parse(raw))
        }
        raw.startsWith("data:") -> {
          val base64 = raw.substringAfter("base64,")
          val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
          java.io.ByteArrayInputStream(bytes)
        }
        else -> File(raw).takeIf { it.exists() }?.inputStream()
      }
    } catch (e: Throwable) {
      android.util.Log.e("JoshLabel", "openImageStream error: ${e.message}", e)
      null
    }
  }

  /**
   * Decodes an image downsampled to print resolution (~8 dots/mm = 203dpi) and composites
   * transparent areas onto a pure WHITE background so thermal thresholding produces crisp output.
   */
  private fun decodeImageSource(raw: String, targetWmm: Double, targetHmm: Double, invert: Boolean = false): Bitmap? {
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      openImageStream(raw)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

      val targetW = (targetWmm.coerceAtLeast(1.0) * 8).toInt().coerceIn(16, 2048)
      val targetH = (targetHmm.coerceAtLeast(1.0) * 8).toInt().coerceIn(16, 2048)
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= targetW && bounds.outHeight / (sample * 2) >= targetH) {
        sample *= 2
      }

      val opts = BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = Bitmap.Config.ARGB_8888
        inMutable = true
      }
      val decoded = openImageStream(raw)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null

      val flattened = Bitmap.createBitmap(decoded.width, decoded.height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(flattened)
      canvas.drawColor(Color.WHITE)

      if (invert) {
        val paint = Paint()
        val matrix = floatArrayOf(
          -1f, 0f, 0f, 0f, 255f,
          0f, -1f, 0f, 0f, 255f,
          0f, 0f, -1f, 0f, 255f,
          0f, 0f, 0f, 1f, 0f
        )
        paint.colorFilter = android.graphics.ColorMatrixColorFilter(android.graphics.ColorMatrix(matrix))
        canvas.drawBitmap(decoded, 0f, 0f, paint)
      } else {
        canvas.drawBitmap(decoded, 0f, 0f, null)
      }

      if (decoded != flattened) {
        decoded.recycle()
      }

      flattened
    } catch (e: Throwable) {
      android.util.Log.e("JoshLabel", "decodeImageSource failed: ${e.message}", e)
      null
    }
  }
}
