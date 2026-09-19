package com.seznik.td404labelprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.ninestar.printer.bean.DeviceType
import com.ninestar.printer.bean.PrinterDevices
import com.ninestar.printer.command.EscCommand
import com.ninestar.printer.command.LabelCommand
import com.ninestar.printer.interf.PortCallbackListener
import com.ninestar.printer.io.PortManager
import com.ninestar.printer.io.SppBluetoothPort
import com.ninestar.printer.utils.UPThreadPoolManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.util.Vector
import kotlin.math.roundToInt

class Td404LabelPrinterModule : Module() {

  companion object {
    private const val TAG = "Td404Printer"
    private const val DOTS_PER_MM = 8.0 // Standard 203 DPI thermal print-head resolution
  }

  private var portManager: PortManager? = null
  private var currentDevice: PrinterDevices? = null

  @Volatile private var lastState: String = "disconnected"
  @Volatile private var pendingConnectPromise: Promise? = null

  private val bluetoothAdapter: BluetoothAdapter? by lazy {
    val ctx = appContext.reactContext ?: return@lazy null
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
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
        else -> b.putString(k, v.toString())
      }
    }
    return b
  }

  private val portCallbackListener = object : PortCallbackListener {
    override fun onSuccess(printerDevices: PrinterDevices?) {
      Log.i(TAG, "Connected successfully to ${printerDevices?.blueName ?: printerDevices?.macAddress}")
      lastState = "connected"
      currentDevice = printerDevices

      sendEvent(
        "onPrinterStateChange",
        bundleOf(
          "state" to "connected",
          "address" to (printerDevices?.macAddress ?: ""),
          "name" to (printerDevices?.blueName ?: "")
        )
      )

      synchronized(this@Td404LabelPrinterModule) {
        pendingConnectPromise?.let {
          it.resolve(true)
          pendingConnectPromise = null
        }
      }
    }

    override fun onFailure(failure: String?) {
      Log.w(TAG, "Connection failed: $failure")
      lastState = "disconnected"

      sendEvent(
        "onPrinterStateChange",
        bundleOf(
          "state" to "disconnected",
          "address" to (currentDevice?.macAddress ?: ""),
          "name" to (currentDevice?.blueName ?: "")
        )
      )

      synchronized(this@Td404LabelPrinterModule) {
        pendingConnectPromise?.let {
          it.reject(CodedException("ERR_TD404_CONNECT", failure ?: "Failed to connect to printer. Please check power and Bluetooth pairing.", null))
          pendingConnectPromise = null
        }
      }
    }

    override fun onDisconnect(printerDevices: PrinterDevices?) {
      Log.i(TAG, "Disconnected from ${printerDevices?.blueName ?: printerDevices?.macAddress}")
      lastState = "disconnected"

      sendEvent(
        "onPrinterStateChange",
        bundleOf(
          "state" to "disconnected",
          "address" to (printerDevices?.macAddress ?: ""),
          "name" to (printerDevices?.blueName ?: "")
        )
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("Td404LabelPrinter")

    Events("onPrinterFound", "onPrinterStateChange")

    Function("isAvailable") {
      try {
        Class.forName("com.ninestar.printer.command.LabelCommand")
        true
      } catch (e: Throwable) {
        false
      }
    }

    Function("getState") { lastState }

    Function("isConnected") {
      portManager != null && portManager?.isConnect == true
    }

    @SuppressLint("MissingPermission")
    AsyncFunction("getBondedDevices") { promise: Promise ->
      try {
        val adapter = bluetoothAdapter
        if (adapter == null) {
          promise.resolve(emptyList<Map<String, String>>())
          return@AsyncFunction
        }
        val bonded = adapter.bondedDevices ?: emptySet()
        val list = bonded.map { dev ->
          mapOf(
            "name" to (dev.name ?: dev.address),
            "address" to dev.address
          )
        }
        promise.resolve(list)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_TD404_BONDED", e.message ?: "Failed to get bonded devices", e))
      }
    }

    AsyncFunction("connect") { address: String, name: String?, promise: Promise ->
      try {
        if (portManager != null && portManager?.isConnect == true) {
          if (currentDevice?.macAddress.equals(address, ignoreCase = true)) {
            promise.resolve(true)
            return@AsyncFunction
          }
          try {
            portManager?.closePort()
          } catch (e: Throwable) {}
          portManager = null
          Thread.sleep(150)
        }

        lastState = "connecting"
        sendEvent("onPrinterStateChange", bundleOf("state" to "connecting", "address" to address, "name" to (name ?: address)))

        synchronized(this@Td404LabelPrinterModule) {
          pendingConnectPromise = promise
        }

        val dev = PrinterDevices.Build()
          .setDeviceType(DeviceType.BLUETOOTH)
          .setBlueName(name ?: address)
          .setMacAddress(address)
          .build()

        currentDevice = dev
        portManager = SppBluetoothPort(dev)
        portManager?.setCallbackListener(portCallbackListener)

        UPThreadPoolManager.getInstance().execute {
          try {
            portManager?.openPort()
          } catch (t: Throwable) {
            Log.e(TAG, "openPort error: ${t.message}")
            synchronized(this@Td404LabelPrinterModule) {
              pendingConnectPromise?.let {
                it.reject(CodedException("ERR_TD404_CONNECT_OPEN", t.message ?: "Failed to open Bluetooth port", t))
                pendingConnectPromise = null
              }
            }
          }
        }
      } catch (e: Throwable) {
        lastState = "disconnected"
        promise.reject(CodedException("ERR_TD404_CONNECT", e.message ?: "Connect exception", e))
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        if (portManager != null) {
          portManager?.closePort()
          portManager = null
        }
        lastState = "disconnected"
        sendEvent("onPrinterStateChange", bundleOf("state" to "disconnected", "address" to "", "name" to ""))
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_TD404_DISCONNECT", e.message ?: "Disconnect error", e))
      }
    }

    AsyncFunction("printRawBytes") { base64Data: String, promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        pm.writeDataImmediately(bytes, false)
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_TD404_PRINT_RAW", e.message ?: "Print raw bytes failed", e))
      }
    }

    /**
     * Print Label from Spec (Exact Millimeter Alignment for text, barcodes, QR codes, images)
     */
    AsyncFunction("printLabel") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }

        val widthMm = finite(spec["widthMm"], 50.0)
        val heightMm = finite(spec["heightMm"], 30.0)
        val gapMm = finite(spec["gapMm"], 2.0)
        val gapType = finiteInt(spec["gapType"], 2) // 0 = continuous, 2 = gap
        val copies = finiteInt(spec["copies"], 1).coerceAtLeast(1)

        val bmp = buildLabelBitmap(spec, widthMm, heightMm)
        val tsc = LabelCommand()
        tsc.addUserCommand("\r\n")
        val tscWidthMm = if (gapType == 0 && widthMm >= 75.0) 72 else if (gapType == 0 && widthMm >= 55.0) 48 else widthMm.toInt()
        tsc.addSize(tscWidthMm, heightMm.toInt())
        tsc.addGap(if (gapType == 0) 0 else gapMm.toInt().coerceAtLeast(2))
        // Default FORWARD orientation prints upright feed without 180-degree flipping
        val dir = if (finiteInt(spec["direction"], 0) == 1) LabelCommand.DIRECTION.BACKWARD else LabelCommand.DIRECTION.FORWARD
        tsc.addDirection(dir, LabelCommand.MIRROR.NORMAL)
        tsc.addReference(0, 0)
        tsc.addDensity(LabelCommand.DENSITY.DNESITY15)
        tsc.addQueryPrinterStatus(LabelCommand.RESPONSE_MODE.ON)
        tsc.addCls()

        tsc.addBitmap(0, 0, LabelCommand.BITMAP_MODE.OVERWRITE, bmp.width, bmp)
        tsc.addPrint(copies, 1)

        val cmdVector: Vector<Byte> = tsc.command
        val sendBytes = ByteArray(cmdVector.size)
        for (i in 0 until cmdVector.size) {
          sendBytes[i] = cmdVector[i]
        }

        pm.writeDataImmediately(sendBytes, false)
        bmp.recycle()
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e(TAG, "printLabel failed: ${e.message}", e)
        promise.reject(CodedException("ERR_TD404_PRINT_LABEL", e.message ?: "Print label failed", e))
      }
    }

    /**
     * Print TSPL Bitmap Label (Supports 50x30, 50x25, 40x30, 38x28, 30x20, 80mm labels)
     * Rescales and aligns input bitmap to exact dot dimensions (203 DPI = 8 dots/mm).
     */
    AsyncFunction("printLabelBitmap") { base64Png: String, widthMm: Double, heightMm: Double, gapMm: Double, copies: Int, promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }

        val cleanBase64 = if (base64Png.contains(",")) base64Png.substringAfter(",") else base64Png
        val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
        val rawBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Could not decode label bitmap from base64")

        // Exact target dot dimensions at 203 DPI (8 dots per mm)
        val targetWidthDots = (widthMm * DOTS_PER_MM).roundToInt().coerceAtLeast(64)
        val targetHeightDots = (heightMm * DOTS_PER_MM).roundToInt().coerceAtLeast(64)
        val alignedWidthDots = (targetWidthDots + 7) / 8 * 8

        val bitmap = if (rawBitmap.width != alignedWidthDots || rawBitmap.height != targetHeightDots) {
          val scaled = Bitmap.createScaledBitmap(rawBitmap, alignedWidthDots, targetHeightDots, true)
          if (scaled != rawBitmap) rawBitmap.recycle()
          scaled
        } else {
          rawBitmap
        }

        val tsc = LabelCommand()
        tsc.addUserCommand("\r\n")
        tsc.addSize(widthMm.toInt(), heightMm.toInt())
        tsc.addGap(if (gapMm > 0) gapMm.toInt() else 2)
        tsc.addDirection(LabelCommand.DIRECTION.FORWARD, LabelCommand.MIRROR.NORMAL)
        tsc.addReference(0, 0)
        tsc.addDensity(LabelCommand.DENSITY.DNESITY15)
        tsc.addQueryPrinterStatus(LabelCommand.RESPONSE_MODE.ON)
        tsc.addCls()

        tsc.addBitmap(0, 0, LabelCommand.BITMAP_MODE.OVERWRITE, alignedWidthDots, bitmap)
        tsc.addPrint(if (copies > 0) copies else 1, 1)

        val cmdVector: Vector<Byte> = tsc.command
        val sendBytes = ByteArray(cmdVector.size)
        for (i in 0 until cmdVector.size) {
          sendBytes[i] = cmdVector[i]
        }

        pm.writeDataImmediately(sendBytes, false)
        bitmap.recycle()
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e(TAG, "printLabelBitmap failed: ${e.message}", e)
        promise.reject(CodedException("ERR_TD404_PRINT_LABEL", e.message ?: "Print label failed", e))
      }
    }

    /**
     * Print Continuous Thermal Receipt (80mm or 58mm paper roll).
     * Enables continuous mode (GAP 0,0) so prints are fully visible and not cut off on roll paper.
     */
    AsyncFunction("printReceiptBitmap") { base64Png: String, paperWidthMm: Double, promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }

        val cleanBase64 = if (base64Png.contains(",")) base64Png.substringAfter(",") else base64Png
        val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
        val rawBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Could not decode receipt bitmap")

        // 80mm = 576 dots printable (72mm); 58mm = 384 dots printable (48mm)
        val targetWidthDots = if (paperWidthMm >= 75) 576 else 384
        val printWidthMm = if (paperWidthMm >= 75) 72 else 48
        val scale = targetWidthDots.toFloat() / rawBitmap.width.toFloat()
        val scaledHeightDots = (rawBitmap.height * scale).toInt().coerceAtLeast(64)
        val bitmap = Bitmap.createScaledBitmap(rawBitmap, targetWidthDots, scaledHeightDots, true)
        if (bitmap != rawBitmap) rawBitmap.recycle()

        // Calculate height in mm (dots / 8) + margin
        val calculatedHeightMm = ((scaledHeightDots + 7) / 8 + 6).coerceAtLeast(30)

        // 1. TSPL Continuous Mode (GAP 0,0 - Single-pass continuous receipt roll)
        val tsc = LabelCommand()
        tsc.addUserCommand("\r\n")
        tsc.addSize(printWidthMm, calculatedHeightMm)
        tsc.addGap(0) // GAP 0 = Continuous roll without gap search
        tsc.addDirection(LabelCommand.DIRECTION.FORWARD, LabelCommand.MIRROR.NORMAL)
        tsc.addReference(0, 0)
        tsc.addDensity(LabelCommand.DENSITY.DNESITY15)
        tsc.addCls()
        tsc.addBitmap(0, 0, LabelCommand.BITMAP_MODE.OVERWRITE, targetWidthDots, bitmap)
        tsc.addPrint(1, 1)
        tsc.addFeed(40) // Feed past tear bar

        val tscVector: Vector<Byte> = tsc.command
        val sendTsc = ByteArray(tscVector.size)
        for (i in 0 until tscVector.size) {
          sendTsc[i] = tscVector[i]
        }
        pm.writeDataImmediately(sendTsc, false)

        bitmap.recycle()
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e(TAG, "printReceiptBitmap failed: ${e.message}", e)
        promise.reject(CodedException("ERR_TD404_PRINT_RECEIPT", e.message ?: "Print receipt failed", e))
      }
    }

    /**
     * Print Formatted Receipt Text on continuous roll
     */
    AsyncFunction("printReceiptText") { text: String, is80mm: Boolean, promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }

        // Send standard ESC/POS initialization & text
        val esc = EscCommand()
        esc.addInitializePrinter()
        esc.addSelectDefualtLineSpacing()
        esc.addText(text)
        esc.addPrintAndFeedLines(4.toByte())
        esc.addCutPaper()

        val escVector: Vector<Byte> = esc.command
        val escBytes = ByteArray(escVector.size)
        for (i in 0 until escVector.size) {
          escBytes[i] = escVector[i]
        }
        pm.writeDataImmediately(escBytes, false)
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e(TAG, "printReceiptText failed: ${e.message}", e)
        promise.reject(CodedException("ERR_TD404_PRINT_TEXT", e.message ?: "Print receipt text failed", e))
      }
    }

    AsyncFunction("calibrate") { promise: Promise ->
      try {
        val pm = portManager
        if (pm == null || !pm.isConnect) {
          promise.reject(CodedException("ERR_TD404_NOT_CONNECTED", "Printer is not connected", null))
          return@AsyncFunction
        }
        val calibCommand = "GAPDETECT\r\nFORMFEED\r\n".toByteArray(Charsets.US_ASCII)
        pm.writeDataImmediately(calibCommand, false)
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_TD404_CALIBRATE", e.message ?: "Calibration failed", e))
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Helper: Convert Android Bitmap into ESC/POS GS v 0 raster bytes
  // ---------------------------------------------------------------------------------------
  private fun convertBitmapToEscPosRaster(src: Bitmap): ByteArray {
    val width = src.width
    val height = src.height
    val widthBytes = (width + 7) / 8

    val output = ByteArrayOutputStream()
    output.write(byteArrayOf(0x1B, 0x40)) // ESC @
    val xL = (widthBytes and 0xFF).toByte()
    val xH = ((widthBytes shr 8) and 0xFF).toByte()
    val yL = (height and 0xFF).toByte()
    val yH = ((height shr 8) and 0xFF).toByte()
    output.write(byteArrayOf(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH))

    val pixels = IntArray(width * height)
    src.getPixels(pixels, 0, width, 0, 0, width, height)

    for (y in 0 until height) {
      for (xByte in 0 until widthBytes) {
        var byteVal = 0
        for (bit in 0 until 8) {
          val x = xByte * 8 + bit
          if (x < width) {
            val pixel = pixels[y * width + x]
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            val luminance = (r * 299 + g * 587 + b * 114) / 1000
            if (luminance < 128) {
              byteVal = byteVal or (1 shl (7 - bit))
            }
          }
        }
        output.write(byteVal)
      }
    }

    output.write(byteArrayOf(0x1B, 0x64, 0x03)) // feed 3 lines
    output.write(byteArrayOf(0x1D, 0x56, 0x42, 0x00)) // cut
    return output.toByteArray()
  }

  // ---------------------------------------------------------------------------------------
  // Label Spec Canvas Rasterizer (Pixel-Perfect Alignment at 203 DPI)
  // ---------------------------------------------------------------------------------------
  private fun buildLabelBitmap(
    spec: Map<String, Any?>,
    widthMm: Double,
    heightMm: Double,
    headMm: Double = 80.0
  ): Bitmap {
    val isContinuous = finiteInt(spec["gapType"], 2) == 0
    val printWmm = if (isContinuous && widthMm >= 75.0) {
      72.0 // 576 dots active head for 80mm roll
    } else if (isContinuous && widthMm >= 55.0) {
      48.0 // 384 dots active head for 58mm roll
    } else {
      minOf(widthMm, headMm)
    }
    val printHmm = heightMm
    val fit = if (widthMm > 0 && !isContinuous) (minOf(widthMm, headMm) / widthMm) else 1.0

    val wPx = (printWmm * DOTS_PER_MM).toInt().coerceAtLeast(64)
    val alignedWPx = (wPx + 7) / 8 * 8
    val hPx = (printHmm * DOTS_PER_MM).toInt().coerceAtLeast(64)

    val bmp = Bitmap.createBitmap(alignedWPx, hPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(Color.WHITE)

    val offsetPx = (finite(spec["offsetMm"], 0.0) * DOTS_PER_MM).toFloat()
    if (offsetPx != 0f) canvas.translate(0f, offsetPx)

    @Suppress("UNCHECKED_CAST")
    val elements = (spec["elements"] as? List<Map<String, Any?>>) ?: emptyList()

    elements.forEach { el ->
      try {
        drawElementOnCanvas(canvas, el, DOTS_PER_MM, fit, alignedWPx, hPx)
      } catch (e: Throwable) {
        Log.w(TAG, "Skipping element on canvas: ${e.message}")
      }
    }

    return bmp
  }

  private fun drawElementOnCanvas(
    canvas: Canvas,
    el: Map<String, Any?>,
    dotsPerMm: Double,
    fit: Double,
    canvasW: Int,
    canvasH: Int
  ) {
    val type = el["type"] as? String ?: return
    val xMm = finite(el["x"], 0.0) * fit
    val yMm = finite(el["y"], 0.0) * fit
    val rawWMm = finite(el["width"], 0.0)
    val rawHMm = finite(el["height"], 0.0)
    val rawSizeMm = finite(el["size"], 0.0)
    val wMm = (if (rawWMm > 0.0) rawWMm else rawSizeMm) * fit
    val hMm = (if (rawHMm > 0.0) rawHMm else rawSizeMm) * fit

    val x = (xMm * dotsPerMm).toFloat()
    val y = (yMm * dotsPerMm).toFloat()
    val w = (wMm * dotsPerMm).toFloat()
    val h = (hMm * dotsPerMm).toFloat()
    val rotation = finiteInt(el["rotation"], 0)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.BLACK
    }

    canvas.save()
    if (rotation != 0) {
      canvas.rotate(rotation.toFloat(), x + w / 2f, y + h / 2f)
    }

    when (type) {
      "text" -> {
        val value = (el["value"] as? String) ?: ""
        if (value.isNotEmpty()) {
          val fontHeightMm = finite(el["fontHeight"], 3.2) * fit
          val textSizePx = (fontHeightMm * dotsPerMm).toFloat().coerceAtLeast(10f)
          val bold = el["bold"] == true
          val align = finiteInt(el["align"], 0) // 0 = left, 1 = center, 2 = right
          val monospace = el["monospace"] == true || (el["fontFamily"] as? String)?.lowercase() == "monospace"

          paint.textSize = textSizePx
          paint.typeface = if (monospace) {
            if (bold) Typeface.create(Typeface.MONOSPACE, Typeface.BOLD) else Typeface.MONOSPACE
          } else {
            if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
          }
          paint.textAlign = when (align) {
            1 -> Paint.Align.CENTER
            2 -> Paint.Align.RIGHT
            else -> Paint.Align.LEFT
          }

          val metrics = paint.fontMetrics
          val baseline = y - metrics.ascent
          val drawX = when (align) {
            1 -> if (w > 0f) x + w / 2f else x
            2 -> if (w > 0f) x + w else x
            else -> x
          }
          canvas.drawText(value, drawX, baseline, paint)
        }
      }

      "barcode" -> {
        val value = (el["value"] as? String) ?: ""
        if (value.isNotEmpty() && w > 0f && h > 0f) {
          val formatStr = (el["format"] as? String)?.lowercase() ?: "code128"
          val zxFormat = when (formatStr) {
            "ean13" -> BarcodeFormat.EAN_13
            "ean8" -> BarcodeFormat.EAN_8
            "upca", "upc_a" -> BarcodeFormat.UPC_A
            "code39" -> BarcodeFormat.CODE_39
            "itf" -> BarcodeFormat.ITF
            else -> BarcodeFormat.CODE_128
          }
          try {
            val writer = MultiFormatWriter()
            val hints = mapOf(EncodeHintType.MARGIN to 0)
            val matrix = writer.encode(value, zxFormat, w.toInt().coerceAtLeast(10), h.toInt().coerceAtLeast(10), hints)
            val bcBmp = Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888)
            for (bx in 0 until matrix.width) {
              for (by in 0 until matrix.height) {
                bcBmp.setPixel(bx, by, if (matrix[bx, by]) Color.BLACK else Color.TRANSPARENT)
              }
            }
            canvas.drawBitmap(bcBmp, x, y, paint)
            bcBmp.recycle()
          } catch (e: Throwable) {
            Log.w(TAG, "Barcode rendering error: ${e.message}")
          }
        }
      }

      "qrcode" -> {
        val value = (el["value"] as? String) ?: ""
        val targetW = if (w > 0f) w else (20f * dotsPerMm.toFloat())
        val targetH = if (h > 0f) h else (20f * dotsPerMm.toFloat())
        val side = minOf(targetW, targetH).toInt().coerceAtLeast(24)
        if (value.isNotEmpty()) {
          try {
            val writer = MultiFormatWriter()
            val hints = mapOf(EncodeHintType.MARGIN to 0)
            val matrix = writer.encode(value, BarcodeFormat.QR_CODE, side, side, hints)
            val qrBmp = Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888)
            for (bx in 0 until matrix.width) {
              for (by in 0 until matrix.height) {
                qrBmp.setPixel(bx, by, if (matrix[bx, by]) Color.BLACK else Color.TRANSPARENT)
              }
            }
            val drawX = x + (targetW - side) / 2f
            val drawY = y + (targetH - side) / 2f
            canvas.drawBitmap(qrBmp, drawX, drawY, paint)
            qrBmp.recycle()
          } catch (e: Throwable) {
            Log.w(TAG, "QR code rendering error: ${e.message}")
          }
        }
      }

      "line" -> {
        paint.strokeWidth = (finite(el["lineWidth"], 0.3) * dotsPerMm).toFloat().coerceAtLeast(1f)
        paint.style = Paint.Style.STROKE
        val x2 = (finite(el["x2"], xMm + wMm) * dotsPerMm).toFloat()
        val y2 = (finite(el["y2"], yMm + hMm) * dotsPerMm).toFloat()
        canvas.drawLine(x, y, x2, y2, paint)
      }

      "rect", "box" -> {
        paint.strokeWidth = (finite(el["lineWidth"], 0.3) * dotsPerMm).toFloat().coerceAtLeast(1f)
        paint.style = if (el["fill"] == true) Paint.Style.FILL else Paint.Style.STROKE
        canvas.drawRect(RectF(x, y, x + w, y + h), paint)
      }

      "image" -> {
        val uriStr = (el["uri"] as? String) ?: (el["url"] as? String) ?: ""
        if (uriStr.isNotEmpty()) {
          try {
            val imgBmp = loadBitmapFromUri(uriStr)
            if (imgBmp != null) {
              val dstRect = RectF(x, y, x + w, y + h)
              canvas.drawBitmap(imgBmp, null, dstRect, paint)
              imgBmp.recycle()
            }
          } catch (e: Throwable) {
            Log.w(TAG, "Image element rendering error: ${e.message}")
          }
        }
      }
    }

    canvas.restore()
  }

  private fun loadBitmapFromUri(uriStr: String): Bitmap? {
    val ctx = appContext.reactContext ?: return null
    return try {
      if (uriStr.startsWith("data:image")) {
        val base64 = uriStr.substringAfter(",")
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      } else if (uriStr.startsWith("file://") || uriStr.startsWith("/")) {
        val path = if (uriStr.startsWith("file://")) uriStr.substring(7) else uriStr
        BitmapFactory.decodeFile(path)
      } else if (uriStr.startsWith("content://")) {
        ctx.contentResolver.openInputStream(Uri.parse(uriStr))?.use {
          BitmapFactory.decodeStream(it)
        }
      } else {
        BitmapFactory.decodeFile(uriStr)
      }
    } catch (_: Throwable) {
      null
    }
  }

  private fun finite(v: Any?, fallback: Double): Double {
    val d = when (v) {
      is Number -> v.toDouble()
      is String -> v.toDoubleOrNull() ?: fallback
      else -> fallback
    }
    return if (d.isFinite()) d else fallback
  }

  private fun finiteInt(v: Any?, fallback: Int): Int = finite(v, fallback.toDouble()).toInt()
}
