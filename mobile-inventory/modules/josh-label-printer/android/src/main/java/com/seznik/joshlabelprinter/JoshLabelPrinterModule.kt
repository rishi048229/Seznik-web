package com.seznik.joshlabelprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import com.dothantech.lpapi.LPAPI
import com.dothantech.printer.IDzPrinter
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
 * Deliberately NOT routed through the app's existing ESC/POS-over-socket printer
 * path: LPAPI owns its own Bluetooth connection and exposes a drawing API
 * (startJob / drawText / draw1DBarcode / commitJob) rather than accepting raw TSPL
 * bytes, so the two cannot share a transport. Everything here is measured in
 * millimetres, matching how LabelTemplate already stores element geometry.
 */
class JoshLabelPrinterModule : Module() {

  private var api: LPAPI? = null

  /** Discovered printers, keyed by MAC, so connect() can reuse the exact address object. */
  private val discovered = ConcurrentHashMap<String, IDzPrinter.PrinterAddress>()

  @Volatile private var lastState: String = "disconnected"

  /**
   * commitJob() only means "label data submitted over Bluetooth" — whether paper
   * actually came out arrives later through onPrintProgress. Each print waits on
   * one of these so the JS promise reflects the real outcome instead of reporting
   * success while the printer sits there with its cover open.
   */
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
      // A drop mid-print would otherwise leave printLabel blocked until its timeout.
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
          // Connected / StartCopy / DataEnded — intermediate steps, keep waiting.
        }
      }
    }

    override fun onPrinterDiscovery(address: IDzPrinter.PrinterAddress?, arg: Any?) {
      if (address == null) return
      discovered[address.macAddress] = address
      sendEvent(
        "onPrinterFound",
        bundleOf(
          "address" to address.macAddress,
          "name" to (address.shownName ?: address.macAddress)
        )
      )
    }
  }

  /** Turns LPAPI's PrintFailReason into a message a cashier can act on. */
  private fun describeFailReason(arg: Any?): String {
    val reason = arg as? IDzPrinter.PrintFailReason
      ?: return "The printer reported a print failure."
    return when (reason) {
      IDzPrinter.PrintFailReason.CoverOpened,
      IDzPrinter.PrintFailReason.TphOpened,
      IDzPrinter.PrintFailReason.LabelCanOpend -> "The printer cover is open. Close it and try again."
      IDzPrinter.PrintFailReason.No_Paper,
      IDzPrinter.PrintFailReason.No_Label,
      IDzPrinter.PrintFailReason.Usedup_Label -> "The printer is out of labels. Load a new roll and try again."
      IDzPrinter.PrintFailReason.Unmatched_Label -> "The loaded label roll does not match the label size. Check the roll."
      IDzPrinter.PrintFailReason.VolTooLow -> "The printer battery is too low to print. Charge it and try again."
      IDzPrinter.PrintFailReason.VolTooHigh -> "The printer supply voltage is too high. Check the power adapter."
      IDzPrinter.PrintFailReason.TphTooHot -> "The print head is too hot. Wait a moment and try again."
      IDzPrinter.PrintFailReason.TphTooCold -> "The print head is too cold. Wait a moment and try again."
      IDzPrinter.PrintFailReason.TphNotFound -> "The printer reported a print head fault."
      IDzPrinter.PrintFailReason.No_Ribbon,
      IDzPrinter.PrintFailReason.No_Ribbon2,
      IDzPrinter.PrintFailReason.Usedup_Ribbon,
      IDzPrinter.PrintFailReason.Usedup_Ribbon2 -> "The printer is out of ribbon."
      IDzPrinter.PrintFailReason.Unmatched_Ribbon,
      IDzPrinter.PrintFailReason.Unmatched_Ribbon2 -> "The loaded ribbon does not match. Check the ribbon."
      IDzPrinter.PrintFailReason.Disconnected -> "The label printer disconnected while printing."
      IDzPrinter.PrintFailReason.Timeout -> "The printer did not respond in time."
      IDzPrinter.PrintFailReason.Cancelled -> "The print was cancelled."
      IDzPrinter.PrintFailReason.IsPrinting -> "The printer is busy with another job. Try again in a moment."
      else -> "The printer reported: ${reason.name}"
    }
  }

  private fun bundleOf(vararg pairs: Pair<String, Any?>): Bundle {
    val b = Bundle()
    pairs.forEach { (k, v) ->
      when (v) {
        is String -> b.putString(k, v)
        is Int -> b.putInt(k, v)
        is Double -> b.putDouble(k, v)
        is Boolean -> b.putBoolean(k, v)
        else -> b.putString(k, v?.toString() ?: "")
      }
    }
    return b
  }

  /**
   * The connected printer's physical printable width in mm, derived from its reported
   * head width and DPI (e.g. LD0801: 384px / 203dpi * 25.4 = 48mm). 0 when unknown.
   */
  private fun printableWidthMm(): Double {
    val info = api?.printerInfo ?: return 0.0
    val px = info.deviceWidth
    val dpi = info.deviceDPI
    if (px <= 0 || dpi <= 0) return 0.0
    return px.toDouble() / dpi.toDouble() * 25.4
  }

  /** LPAPI must exist before any other call; created lazily so the app can boot without it. */
  private fun requireApi(): LPAPI {
    val existing = api
    if (existing != null) return existing
    val created = LPAPI.Factory.createInstance(callback)
      ?: throw CodedException("ERR_JOSH_INIT", "Could not initialise the label printer SDK.", null)
    api = created
    return created
  }

  // ---------------------------------------------------------------------------
  // Numeric coercion
  //
  // Values arrive from JS as arbitrary Numbers: a template that round-tripped
  // through the backend with a missing mm value shows up here as NaN, and LPAPI
  // happily accepts NaN coordinates and then produces a blank or failed job with
  // no error. Every number read below goes through these guards, which is the
  // same fix the TSPL path already received (PrinterService.safeInt).
  // ---------------------------------------------------------------------------

  private fun finite(value: Any?, fallback: Double): Double {
    val n = (value as? Number)?.toDouble() ?: return fallback
    return if (n.isFinite()) n else fallback
  }

  private fun finiteOrNull(value: Any?): Double? {
    val n = (value as? Number)?.toDouble() ?: return null
    return if (n.isFinite()) n else null
  }

  private fun finiteInt(value: Any?, fallback: Int): Int {
    val n = (value as? Number)?.toDouble() ?: return fallback
    return if (n.isFinite()) n.toInt() else fallback
  }

  override fun definition() = ModuleDefinition {
    Name("JoshLabelPrinter")

    Events("onPrinterFound", "onPrinterStateChange")

    /** True on any build where the vendored SDK actually linked. */
    Function("isAvailable") {
      try {
        Class.forName("com.dothantech.lpapi.LPAPI")
        true
      } catch (e: Throwable) {
        false
      }
    }

    Function("getState") { lastState }

    AsyncFunction("startDiscovery") { promise: Promise ->
      try {
        discovered.clear()
        promise.resolve(requireApi().discovery())
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_DISCOVERY", e.message ?: "Discovery failed", e))
      }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      try {
        api?.stopDiscovery()
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_DISCOVERY", e.message ?: "Could not stop discovery", e))
      }
    }

    /** Bonded/known printers, so the UI can offer them without a scan. */
    AsyncFunction("getPairedPrinters") { promise: Promise ->
      try {
        val list = requireApi().getAllPrinterAddresses(null) ?: emptyList()
        promise.resolve(list.map { addr ->
          discovered[addr.macAddress] = addr
          mapOf("address" to addr.macAddress, "name" to (addr.shownName ?: addr.macAddress))
        })
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_LIST", e.message ?: "Could not list printers", e))
      }
    }

    /**
     * Synchronous open, run off the JS thread by AsyncFunction. Falls back to
     * opening by raw MAC when the address was never seen through discovery
     * (e.g. reconnecting to a saved printer after an app restart).
     */
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

    AsyncFunction("isConnected") { promise: Promise ->
      promise.resolve(api?.isPrinterOpened ?: false)
    }

    AsyncFunction("getPrinterInfo") { promise: Promise ->
      try {
        val info = api?.printerInfo
        if (info == null) {
          promise.resolve(null)
        } else {
          promise.resolve(
            mapOf(
              "name" to (info.deviceName ?: ""),
              "address" to (info.deviceAddress ?: ""),
              "dpi" to info.deviceDPI,
              "widthPx" to info.deviceWidth,
              // e.g. LD0801: 384px at 203dpi = 48mm printable width.
              "widthMm" to printableWidthMm()
            )
          )
        }
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_INFO", e.message ?: "Could not read printer info", e))
      }
    }

    /**
     * Renders one label described as a list of elements, all in millimetres.
     *
     * Pipeline matches the official LPAPIDemo (MainActivity.printText /
     * printLabelOnClick / print2dBarcode): startJob → draw* → commitJobWithParam.
     * Rasterising via endJob()+printBitmap is only for pre-made pictures in that
     * demo; using it for composed labels (text + barcode + gallery images) is
     * what produced a blank feed, then a printer that stopped ejecting paper.
     *
     * Resolves only after the printer confirms the job via onPrintProgress.
     */
    AsyncFunction("printLabel") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val instance = requireApi()
        if (!instance.isPrinterOpened) {
          throw CodedException("ERR_JOSH_NOT_CONNECTED", "No label printer is connected.", null)
        }

        val widthMm = finite(spec["widthMm"], Double.NaN)
        val heightMm = finite(spec["heightMm"], Double.NaN)
        if (!widthMm.isFinite() || !heightMm.isFinite() || widthMm <= 0 || heightMm <= 0) {
          throw CodedException(
            "ERR_JOSH_SIZE",
            "This label has an invalid size (${spec["widthMm"]} x ${spec["heightMm"]} mm). Re-save the template with a real width and height.",
            null
          )
        }
        val rotation = when (finiteInt(spec["rotation"], 0)) {
          90 -> 90
          180 -> 180
          270 -> 270
          else -> 0
        }
        val copies = finiteInt(spec["copies"], 1).coerceAtLeast(1)

        finiteOrNull(spec["gapType"])?.let { instance.setPrintPageGapType(it.toInt()) }
        finiteOrNull(spec["gapMm"])?.let { gap ->
          val gapInt = gap.toInt().coerceAtLeast(0)
          instance.setPrintPageGapLength(gapInt)
        }
        finiteOrNull(spec["darkness"])?.let { instance.setPrintDarkness(it.toInt()) }
        finiteOrNull(spec["speed"])?.let { instance.setPrintSpeed(it.toInt()) }

        @Suppress("UNCHECKED_CAST")
        val elements = (spec["elements"] as? List<Map<String, Any?>>) ?: emptyList()
        if (elements.isEmpty()) {
          throw CodedException("ERR_JOSH_EMPTY", "This label has nothing printable on it.", null)
        }

        // Drop any half-finished job left by a previous failed print
        runCatching { instance.abortJob() }

        // Official demo starts jobs with the specified label width and height.
        if (!instance.startJob(widthMm, heightMm, rotation)) {
          throw CodedException("ERR_JOSH_JOB", "Printer rejected the label job (${widthMm}x${heightMm}mm).", null)
        }

        val heldBitmaps = mutableListOf<Bitmap>()
        try {
          elements.forEach { el ->
            try {
              drawElement(instance, el, heldBitmaps)
            } catch (elErr: Throwable) {
              android.util.Log.w("JoshLabel", "Skipping element ${(el["type"] as? String)}: ${elErr.message}")
            }
          }

          val pending = PendingPrint()
          pendingPrint = pending

          val committed = instance.commitJob()
          if (!committed) {
            pendingPrint = null
            runCatching { instance.abortJob() }
            throw CodedException("ERR_JOSH_COMMIT", "Printer rejected the label data. Check connection and paper roll.", null)
          }

          val reported = pending.latch.await(30, TimeUnit.SECONDS)
          pendingPrint = null
          if (!reported) {
            throw CodedException("ERR_JOSH_TIMEOUT", "The printer did not confirm the print. Check the printer and paper roll.", null)
          }
          if (!pending.success) {
            throw CodedException("ERR_JOSH_PRINT_FAILED", pending.failReason ?: "The printer reported a print failure.", null)
          }
        } catch (inner: Throwable) {
          if (inner !is CodedException) {
            instance.abortJob()
          }
          throw inner
        } finally {
          heldBitmaps.forEach { runCatching { it.recycle() } }
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

  private fun drawElement(instance: LPAPI, el: Map<String, Any?>, heldBitmaps: MutableList<Bitmap>) {
    val x = finite(el["x"], 0.0)
    val y = finite(el["y"], 0.0)

    // Alignment is per-item state on LPAPI, so set it before every draw rather
    // than assuming it carried over from the previous element.
    instance.itemHorizontalAlignment = finiteInt(el["align"], 0)

    when ((el["type"] as? String) ?: "") {
      "text" -> {
        val value = el["value"] as? String ?: return
        val w = finite(el["width"], 0.0)
        val h = finite(el["height"], 0.0)
        val rawFont = finite(el["fontHeight"], 3.0)
        val fontHeight = rawFont.coerceAtLeast(1.0)
        val bold = (el["bold"] as? Boolean) ?: false
        // drawTextRegular's trailing int is the style bitmask; 1 = bold.
        instance.drawTextRegular(value, x, y, w, h, fontHeight, if (bold) 1 else 0)
      }
      "barcode" -> {
        val value = el["value"] as? String ?: return
        val w = finite(el["width"], 30.0)
        val h = finite(el["height"], 10.0)
        val textHeight = finite(el["textHeight"], 3.0).coerceAtLeast(0.0)
        // Valid LPAPI 1D BarcodeType: AUTO=60, CODE128=28, EAN13=22, UPC_A=20, etc.
        var type = finiteInt(el["barcodeType"], 60)
        if (type <= 0 || (type < 20 && type != 0) || (type in 31..59) || type > 63) {
          type = 60
        }
        instance.draw1DBarcode(value, type, x, y, w, h, textHeight)
      }
      "qrcode" -> {
        val value = el["value"] as? String ?: return
        val size = finite(el["size"], 15.0)
        if (size <= 0) return
        instance.draw2DQRCode(value, x, y, size)
      }
      "image" -> {
        val w = finite(el["width"], 0.0)
        val h = finite(el["height"], 0.0)
        val raw = el["uri"] as? String ?: return
        if (w <= 0 || h <= 0) return

        val invert = (el["invert"] as? Boolean) == true
        val bitmap = decodeImageSource(raw, w, h, invert)
        if (bitmap != null) {
          heldBitmaps.add(bitmap)
          instance.drawBitmap(bitmap, x, y, w, h)
        } else {
          val plainPath = when {
            raw.startsWith("file://") -> raw.removePrefix("file://")
            else -> raw
          }
          if (File(plainPath).exists()) {
            instance.drawImage(plainPath, x, y, w, h)
          }
        }
      }
      "line" -> {
        val x2 = finite(el["x2"], x)
        val y2 = finite(el["y2"], y)
        val thickness = finite(el["thickness"], 0.3).coerceAtLeast(0.1)
        instance.drawLine(x, y, x2, y2, thickness)
      }
      "rectangle" -> {
        val w = finite(el["width"], 0.0)
        val h = finite(el["height"], 0.0)
        if (w <= 0 || h <= 0) return
        val thickness = finite(el["thickness"], 0.3).coerceAtLeast(0.1)
        val filled = (el["filled"] as? Boolean) == true
        val radius = finite(el["cornerRadius"], 0.0).coerceAtLeast(0.0)
        when {
          radius > 0 && filled -> instance.fillRoundRectangle(x, y, w, h, radius, radius)
          radius > 0 -> instance.drawRoundRectangle(x, y, w, h, radius, radius, thickness)
          filled -> instance.fillRectangle(x, y, w, h)
          else -> instance.drawRectangle(x, y, w, h, thickness)
        }
      }
      "ellipse" -> {
        val w = finite(el["width"], 0.0)
        val h = finite(el["height"], 0.0)
        if (w <= 0 || h <= 0) return
        val thickness = finite(el["thickness"], 0.3).coerceAtLeast(0.1)
        if ((el["filled"] as? Boolean) == true) instance.fillEllipse(x, y, w, h)
        else instance.drawEllipse(x, y, w, h, thickness)
      }
      else -> {
        // Unknown element types are skipped rather than failing the whole label.
      }
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

      // Flatten transparent PNG / transparent logos onto solid WHITE background
      val flattened = Bitmap.createBitmap(decoded.width, decoded.height, Bitmap.Config.ARGB_8888)
      val canvas = android.graphics.Canvas(flattened)
      canvas.drawColor(android.graphics.Color.WHITE)

      if (invert) {
        val paint = android.graphics.Paint()
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
