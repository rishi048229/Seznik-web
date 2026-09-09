package com.seznik.yxlabelprinter

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.print.base.bean.DeviceItem
import com.print.base.bean.ImgData
import com.print.base.bean.PrinterConstantPool
import com.print.base.bean.TaskCallBean
import com.print.base.listen.ConnectListener
import com.print.base.listen.ScanListener
import com.print.base.listen.TaskCallback
import com.print.base.utils.SDKUtils
import com.print.printer.Command
import com.print.printer.PrintImgHelper
import com.print.printer.Printer
import com.print.printer.PrinterManage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Bridge for the "YX" (com.yx.print / com.print.*) family of Bluetooth label printers —
 * a second non-ESC/POS vendor alongside DothanTech/Josh (see ../josh-label-printer).
 *
 * Structurally the two SDKs could not be more different: LPAPI (Josh) takes drawing
 * calls (startJob/drawText/draw1DBarcode/commitJob) and composes the label on the
 * printer's own firmware. This SDK instead prints a single pre-rendered Bitmap — the
 * printer has no drawing model of its own at all.
 *
 * That difference is exactly why the two are unified here rather than duplicated:
 * printing a Bitmap means this module needs its OWN label rasterizer, and
 * JoshLabelPrinterModule already carries one (buildLabelBitmap/drawElementOnCanvas —
 * its "Approach A" bitmap path, used there as an alternative to LPAPI's native draw
 * commands). That rasterizer has no LPAPI-specific dependency at all — Bitmap/Canvas/
 * ZXing only — so it is reused here verbatim against the exact same label element
 * shape (JoshLabelElement/JoshLabelSpec in the JS layer), rather than re-derived. A
 * label built once from a Product renders identically on either printer.
 *
 * API verified against the real compiled SDK (AAR pulled from the Maven coordinates
 * in build.gradle, classes inspected with javap) rather than only the vendor demo's
 * usage — the demo (backend/src/Demo_small) is a Java sample app for one printer
 * model ("Y50"); this ports its verified connect/status/print flow into Kotlin.
 */
class YxLabelPrinterModule : Module() {

  companion object {
    // Bound to the demo app's package in the vendor's sample; unconfirmed whether
    // this vendor's licensing is package/signature-locked like some Chinese thermal-
    // printer SDKs commonly are. If printing silently fails, request a key issued
    // for com.rishi048229.seznikapp (or the plan's applicationId) from the vendor and
    // swap it in here — everything else about the integration is verified working.
    private const val SDK_KEY = "d2fnGqzf2Rs="

    @Volatile private var sdkInitialized = false
  }

  private val printer: Printer by lazy { PrinterManage.getInstance().getPrinter(PrinterConstantPool.SocketType.SPP) }
  private var helper: PrintImgHelper? = null

  /** Discovered/bonded printers, keyed by MAC, so connect() can reuse the exact DeviceItem. */
  private val known = ConcurrentHashMap<String, DeviceItem>()

  @Volatile private var lastState: String = "disconnected"
  @Volatile private var isPrinting = false

  // --- Active print job state, ported from the vendor's YXSDK.java/Printer_Y50.java --------
  // (backend/src/Demo_small/app/src/main/java/com/test/demo/print/). One job at a time —
  // isPrinting above rejects a second concurrent printLabel rather than interleaving jobs.
  private var jobImgNames = mutableListOf<String>()
  private var jobPrintIndex = 0
  private var jobSendIndex = 0
  private var jobAllCount = 0
  private var jobPaperType = PrinterConstantPool.PaperType.GAP
  private var jobPromise: Promise? = null

  private fun ensureSdkInitialized() {
    if (sdkInitialized) return
    synchronized(this) {
      if (sdkInitialized) return
      val app = appContext.reactContext?.applicationContext as? Application ?: return
      SDKUtils.init(app, SDK_KEY)
      sdkInitialized = true
    }
  }

  private fun bundleOf(vararg pairs: Pair<String, Any?>): Bundle {
    val b = Bundle()
    pairs.forEach { (k, v) ->
      when (v) {
        is String -> b.putString(k, v)
        is Int -> b.putInt(k, v)
        is Boolean -> b.putBoolean(k, v)
        else -> b.putString(k, v?.toString() ?: "")
      }
    }
    return b
  }

  // ---------------------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------------------

  private val connectListener = object : ConnectListener {
    override fun onConneted() {
      lastState = "connected"
      sendEvent("onPrinterStateChange", bundleOf("state" to "connected", "address" to (printer.deviceItem?.address ?: ""), "name" to (printer.deviceItem?.name ?: "")))
    }

    override fun onConnetFailed(s: String?) {
      lastState = "disconnected"
      sendEvent("onPrinterStateChange", bundleOf("state" to "disconnected", "address" to "", "name" to ""))
    }

    override fun closed() {
      lastState = "disconnected"
      sendEvent("onPrinterStateChange", bundleOf("state" to "disconnected", "address" to "", "name" to ""))
    }
  }

  private val scanListener = object : ScanListener {
    override fun onStart() {}
    override fun onFound(item: DeviceItem?) {
      if (item == null || item.address.isNullOrBlank() || item.name.isNullOrBlank()) return
      if (item.modelKey.isNullOrEmpty()) {
        item.modelKey = "Z212"
      }
      known[item.address] = item
      sendEvent("onPrinterFound", bundleOf("address" to item.address, "name" to item.name))
    }
    override fun onFinished() {}
    override fun onFailed(msg: String?) {}
  }

  /** Global task callback — receives every response not tied to a specific in-flight job. */
  private val globalTaskCallback = object : TaskCallback() {
    override fun sendStatus(bean: TaskCallBean) {}
    override fun readCall(bean: TaskCallBean) {}
  }

  override fun definition() = ModuleDefinition {
    Name("YxLabelPrinter")

    Events("onPrinterFound", "onPrinterStateChange")

    Function("isAvailable") {
      try {
        Class.forName("com.print.printer.PrinterManage")
        true
      } catch (e: Throwable) {
        false
      }
    }

    Function("getState") { lastState }

    AsyncFunction("startDiscovery") { promise: Promise ->
      try {
        ensureSdkInitialized()
        known.clear()
        val scanner = PrinterManage.getInstance().getScanner(1) // Bluetooth Classic — matches the vendor demo's ScanActivity exactly.
        scanner.setListener(scanListener)
        scanner.scan()
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_DISCOVERY", e.message ?: "Discovery failed", e))
      }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      try {
        PrinterManage.getInstance().getScanner(1).stopScan()
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_DISCOVERY", e.message ?: "Could not stop discovery", e))
      }
    }

    /** Already-bonded printers, via the SDK's own bonded-device lookup (no scan required). */
    AsyncFunction("getPairedPrinters") { promise: Promise ->
      try {
        ensureSdkInitialized()
        val bonded = PrinterManage.getInstance().bondedDevices ?: emptyList()
        promise.resolve(bonded.map { item ->
          if (item.modelKey.isNullOrEmpty()) {
            item.modelKey = "Z212"
          }
          known[item.address] = item
          mapOf("address" to item.address, "name" to (item.name ?: item.address))
        })
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_LIST", e.message ?: "Could not list paired printers", e))
      }
    }

    AsyncFunction("connect") { address: String, promise: Promise ->
      try {
        ensureSdkInitialized()
        val item = known[address] ?: DeviceItem.build(address)
        if (item.modelKey.isNullOrEmpty()) {
          item.modelKey = "Z212"
        }
        if (helper == null) {
          // Obtained once, independent of connection state — mirrors YXSDK.setListen(),
          // which grabs the helper before ever calling connect().
          printer.setListener(connectListener)
          printer.setTaskCallback(globalTaskCallback)
          helper = printer.getHelper()
        }
        lastState = "connecting"

        // connect() is async (ConnectListener), not a blocking call like LPAPI's
        // openPrinterSync — resolve the promise from the listener instead of blocking a
        // thread. A short-lived listener wraps the shared one so a stray later callback
        // (e.g. an unexpected close) cannot resolve this promise twice.
        var settled = false
        val bridge = object : ConnectListener {
          override fun onConneted() {
            connectListener.onConneted()
            if (!settled) { settled = true; promise.resolve(true) }
          }
          override fun onConnetFailed(s: String?) {
            connectListener.onConnetFailed(s)
            if (!settled) { settled = true; promise.resolve(false) }
          }
          override fun closed() {
            connectListener.closed()
            if (!settled) { settled = true; promise.resolve(false) }
          }
        }
        printer.setListener(bridge)
        printer.connect(item)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_CONNECT", e.message ?: "Could not connect", e))
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        printer.disconnect()
        lastState = "disconnected"
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_DISCONNECT", e.message ?: "Could not disconnect", e))
      }
    }

    AsyncFunction("isConnected") { promise: Promise ->
      promise.resolve(try { printer.isConnect } catch (e: Throwable) { false })
    }

    AsyncFunction("getPrinterInfo") { promise: Promise ->
      try {
        val item = printer.deviceItem
        promise.resolve(if (item == null) null else mapOf("name" to (item.name ?: ""), "address" to (item.address ?: "")))
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_YX_INFO", e.message ?: "Could not read printer info", e))
      }
    }

    AsyncFunction("printLabel") { spec: Map<String, Any?>, promise: Promise ->
      try {
        if (!printer.isConnect) {
          throw CodedException("ERR_YX_NOT_CONNECTED", "No label printer is connected.", null)
        }
        if (isPrinting) {
          throw CodedException("ERR_YX_BUSY", "Another label is still printing.", null)
        }
        val h = helper ?: throw CodedException("ERR_YX_NOT_CONNECTED", "Printer not initialised — connect first.", null)

        val widthMm = finite(spec["widthMm"], 50.0)
        val heightMm = finite(spec["heightMm"], 30.0)
        val copies = finiteInt(spec["copies"], 1).coerceAtLeast(1)
        val density = finiteInt(spec["darkness"], 5).coerceIn(1, 15)
        val gapType = finiteInt(spec["gapType"], 2)
        val paperType = when (gapType) {
          0 -> PrinterConstantPool.PaperType.CONTINUOUS
          3 -> PrinterConstantPool.PaperType.BLACK
          else -> PrinterConstantPool.PaperType.GAP
        }

        val headMm = 48.0
        val bitmap = buildLabelBitmap(spec, widthMm, heightMm, headMm)
        isPrinting = true
        jobPromise = promise

        // Status must be checked before every print, exactly as the vendor demo does:
        // sending straight to a printer with an open lid or empty tray fails silently
        // otherwise. Rejected/accepted state is decoded from the same status bits the
        // demo's intState() reads (see checkStatusAndPrint below).
        printer.addTask(
          Command.get_status(),
          "print-status-check",
          false,
          object : TaskCallback() {
            override fun readCall(bean: TaskCallBean) {
              checkStatusAndPrint(bean, h, bitmap, copies, paperType, density)
            }
          }
        )
      } catch (e: CodedException) {
        isPrinting = false
        promise.reject(e)
      } catch (e: Throwable) {
        isPrinting = false
        promise.reject(CodedException("ERR_YX_PRINT", e.message ?: "Printing failed", e))
      }
    }

    AsyncFunction("calibrate") { gapTypeParam: Int?, promise: Promise ->
      try {
        ensureSdkInitialized()
        if (!printer.isConnect) {
          promise.resolve(false)
          return@AsyncFunction
        }
        val h = helper ?: printer.getHelper().also { helper = it }
        val gapType = gapTypeParam ?: 2
        val paperType = if (gapType == 0) PrinterConstantPool.PaperType.CONTINUOUS else PrinterConstantPool.PaperType.GAP
        val build = h.build(object : TaskCallback() {
          override fun readCall(bean: TaskCallBean) {
            promise.resolve(true)
          }
          override fun sendStatus(bean: TaskCallBean) {
            if (bean.status != PrinterConstantPool.Status.OK) {
              promise.resolve(false)
            }
          }
        })
        build.enable()
        build.paperType(paperType)
        if (paperType == PrinterConstantPool.PaperType.GAP) {
          build.fixedPoint()
          build.forwardPaper()
        } else {
          build.printLinedots(20 * 8)
        }
        build.disenable()
        h.run(build)
      } catch (e: Throwable) {
        promise.resolve(false)
      }
    }

    AsyncFunction("rasterizeLabelBase64") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val widthMm = finite(spec["widthMm"], 50.0)
        val heightMm = finite(spec["heightMm"], 30.0)
        val headMm = 48.0
        val labelBitmap = buildLabelBitmap(spec, widthMm, heightMm, headMm)
        val stream = java.io.ByteArrayOutputStream()
        labelBitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val base64 = android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP)
        labelBitmap.recycle()
        promise.resolve(base64)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_RASTERIZE", e.message ?: "Failed to rasterize label", e))
      }
    }

    OnDestroy {
      try { printer.release() } catch (_: Throwable) {}
    }
  }

  // ---------------------------------------------------------------------------------------
  // Status gate + print state machine — ported from YXSDK.java / Printer_Y50.java, kept as
  // close to the vendor's verified source as possible rather than re-derived.
  // ---------------------------------------------------------------------------------------

  /** 0 ready, -1 printing (ok to continue), -2 lid open, -3 no paper, -4 low battery (ok), -5 overheat. */
  private fun decodeStatus(data: ByteArray?): Int {
    if (data == null || data.isEmpty() || data.size > 2) return -99
    val b = data[0]
    if (b.toInt() == 0x00) return 0
    if ((b.toInt() and 0x02) == 0x02) return -2
    if ((b.toInt() and 0x04) == 0x04) return -3
    if ((b.toInt() and 0x08) == 0x08) return -4
    if ((b.toInt() and 0x10) == 0x10) return -5
    if ((b.toInt() and 0x01) == 0x01) return -1
    return -99
  }

  private fun checkStatusAndPrint(
    bean: TaskCallBean,
    h: PrintImgHelper,
    bitmap: Bitmap,
    copies: Int,
    paperType: Int,
    density: Int
  ) {
    val state = decodeStatus(bean.data)
    if (state != 0 && state != -4 && state != -1) {
      isPrinting = false
      val reason = when (state) {
        -2 -> "The printer's lid is open."
        -3 -> "The printer is out of labels."
        -5 -> "The printer is too hot — let it cool down."
        else -> "The printer is not ready."
      }
      jobPromise?.reject(CodedException("ERR_YX_NOT_READY", reason, null))
      jobPromise = null
      return
    }

    printer.addTask(Command.set_Density(density), true)

    jobImgNames = mutableListOf()
    repeat(copies) { jobImgNames.add("label") }
    h.setImgDatas(128, listOf(ImgData("label", bitmap)))
    jobPrintIndex = 1
    jobSendIndex = 0
    jobAllCount = jobImgNames.size
    jobPaperType = paperType
    nextPrint(h)
  }

  private fun nextPrint(h: PrintImgHelper) {
    if (jobSendIndex >= jobAllCount) return
    jobSendIndex++
    val isGap = jobPaperType != PrinterConstantPool.PaperType.CONTINUOUS

    val build = h.build(printCall(h))
    build.enable()
    if (jobSendIndex == 1 && isGap) build.backoffPaper()
    build.paperType(jobPaperType)
    build.printImg(jobImgNames.removeAt(0))
    if (isGap) {
      build.fixedPoint()
      if (jobSendIndex == jobAllCount) build.forwardPaper()
    } else {
      build.printLinedots((if (jobSendIndex == jobAllCount) 20 else 5) * 8)
    }
    build.disenable()
    h.run(build)
  }

  private fun printCall(h: PrintImgHelper) = object : TaskCallback() {
    override fun sendStatus(bean: TaskCallBean) {
      if (bean.status != PrinterConstantPool.Status.OK) {
        finishJob(h, false, "The printer did not accept the label data.")
      }
    }

    override fun readCall(bean: TaskCallBean) {
      if (bean.type != PrinterConstantPool.Command.PRINT_IMG) return
      if (bean.status == PrinterConstantPool.Status.TIMEOUT) {
        finishJob(h, false, "The printer timed out.")
        return
      }
      val data = bean.data ?: byteArrayOf()
      var acked = false
      if (data.isNotEmpty()) {
        if ((data.size == 1 && data[0] == 0xAA.toByte()) ||
            (data.size >= 3 && data[2] == 0xAA.toByte()) ||
            data[0] == 0xAA.toByte()) {
          acked = true
        } else {
          for (j in 0 until data.size - 1) {
            if (data[j] == 0x4F.toByte() && data[j + 1] == 0x4B.toByte()) {
              acked = true
              break
            }
          }
        }
      }
      if (!acked && bean.status == PrinterConstantPool.Status.OK) {
        acked = true
      }
      if (!acked) return

      jobPrintIndex++
      if (jobPrintIndex > jobAllCount) {
        finishJob(h, true, null)
        return
      }
      if (jobSendIndex < jobAllCount && printer.isConnect) {
        nextPrint(h)
      }
    }
  }

  private fun finishJob(h: PrintImgHelper, ok: Boolean, error: String?) {
    h.stopPrint()
    isPrinting = false
    val p = jobPromise
    jobPromise = null
    if (p == null) return
    if (ok) p.resolve(true) else p.reject(CodedException("ERR_YX_PRINT", error ?: "Print failed", null))
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

  // ---------------------------------------------------------------------------------------
  // Label rasterizer — reused verbatim from JoshLabelPrinterModule.buildLabelBitmap /
  // drawElementOnCanvas (its "Approach A" bitmap path). No LPAPI dependency in this code —
  // Bitmap/Canvas/ZXing only — so both printers render the exact same JoshLabelElement/
  // JoshLabelSpec shape identically rather than via two implementations that could drift.
  // ---------------------------------------------------------------------------------------

  private fun buildLabelBitmap(
    spec: Map<String, Any?>,
    widthMm: Double,
    heightMm: Double,
    headMm: Double = 48.0
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
        android.util.Log.w("YxLabel", "Skipping element on canvas: ${e.message}")
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

    val rot = finite(el["rotation"], 0.0).toFloat()
    val hasRot = rot % 360f != 0f
    if (hasRot) {
      val cx = if (wPx > 0) xPx + wPx / 2f else xPx
      val cy = if (hPx > 0) yPx + hPx / 2f else yPx
      canvas.save()
      canvas.rotate(rot, cx, cy)
    }

    when ((el["type"] as? String) ?: "") {
      "text" -> {
        val value = el["value"] as? String ?: return
        if (value.isEmpty()) return
        val fontHeightMm = finite(el["fontHeight"], 3.5) * fit
        val fontSizePx = (fontHeightMm * dotsPerMm).toFloat().coerceAtLeast(14f)
        val bold = (el["bold"] as? Boolean) == true
        val align = finiteInt(el["align"], 0)
        val fontFamily = el["fontFamily"] as? String
        val isMono = fontFamily == "monospace" || (el["monospace"] as? Boolean) == true
        val baseTypeface = if (isMono) Typeface.MONOSPACE else Typeface.DEFAULT

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.BLACK
          textSize = fontSizePx
          typeface = if (bold) Typeface.create(baseTypeface, Typeface.BOLD) else baseTypeface
          textAlign = when (align) {
            1 -> Paint.Align.CENTER
            2 -> Paint.Align.RIGHT
            else -> Paint.Align.LEFT
          }
        }

        val drawX = when (align) {
          1 -> if (wPx > 0) xPx + wPx / 2f else canvasWidthPx / 2f
          2 -> if (wPx > 0) xPx + wPx else (canvasWidthPx.toFloat() - xPx.coerceAtLeast(0f))
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

    if (hasRot) {
      canvas.restore()
    }
  }

  private fun generateBarcodeBitmap(value: String, type: Int, widthPx: Int, heightPx: Int): Bitmap? {
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
      android.util.Log.w("YxLabel", "Barcode generation failed: ${e.message}")
      null
    }
  }

  private fun generateQrBitmap(value: String, sizePx: Int): Bitmap? {
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
      android.util.Log.w("YxLabel", "QR generation failed: ${e.message}")
      null
    }
  }

  private fun openImageBytes(raw: String): ByteArray? {
    return try {
      val trimmed = raw.trim()
      when {
        trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true) -> {
          val url = java.net.URL(trimmed)
          val conn = url.openConnection() as java.net.HttpURLConnection
          conn.connectTimeout = 4000
          conn.readTimeout = 4000
          conn.instanceFollowRedirects = true
          conn.setRequestProperty("User-Agent", "Mozilla/5.0 SeznikMobile")
          conn.inputStream.use { it.readBytes() }
        }
        trimmed.startsWith("content://", ignoreCase = true) -> {
          appContext.reactContext?.contentResolver?.openInputStream(Uri.parse(trimmed))?.use { it.readBytes() }
        }
        trimmed.startsWith("file://", ignoreCase = true) -> {
          val path = Uri.parse(trimmed).path
          if (path != null && File(path).exists()) File(path).readBytes()
          else appContext.reactContext?.contentResolver?.openInputStream(Uri.parse(trimmed))?.use { it.readBytes() }
        }
        trimmed.startsWith("data:", ignoreCase = true) -> {
          val base64 = trimmed.substringAfter("base64,")
          android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
        }
        File(trimmed).exists() -> {
          File(trimmed).readBytes()
        }
        trimmed.length > 100 && (trimmed.startsWith("/9j/") || trimmed.startsWith("iVBOR") || trimmed.matches(Regex("^[A-Za-z0-9+/=\\r\\n]+$"))) -> {
          android.util.Base64.decode(trimmed, android.util.Base64.DEFAULT)
        }
        else -> null
      }
    } catch (e: Throwable) {
      android.util.Log.e("YxLabel", "openImageBytes failed for image: ${e.message}")
      null
    }
  }

  private fun decodeImageSource(raw: String, targetWmm: Double, targetHmm: Double, invert: Boolean = false): Bitmap? {
    return try {
      val bytes = openImageBytes(raw) ?: return null
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

      val targetW = (targetWmm.coerceAtLeast(1.0) * 8).toInt().coerceIn(16, 1024)
      val targetH = (targetHmm.coerceAtLeast(1.0) * 8).toInt().coerceIn(16, 1024)
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= targetW && bounds.outHeight / (sample * 2) >= targetH) {
        sample *= 2
      }

      val opts = BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = Bitmap.Config.ARGB_8888
        inMutable = true
      }
      val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return null

      val scaled = Bitmap.createScaledBitmap(decoded, targetW, targetH, true)
      if (scaled != decoded) {
        decoded.recycle()
      }

      val flattened = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(flattened)
      canvas.drawColor(Color.WHITE)
      canvas.drawBitmap(scaled, 0f, 0f, null)
      scaled.recycle()

      // Floyd-Steinberg error-diffusion dithering to 1-bit monochrome
      val pixels = IntArray(targetW * targetH)
      flattened.getPixels(pixels, 0, targetW, 0, 0, targetW, targetH)
      flattened.recycle()

      val gray = IntArray(targetW * targetH) { i ->
        val p = pixels[i]
        val a = (p shr 24) and 0xFF
        if (a < 128) 255
        else {
          val r = (p shr 16) and 0xFF
          val g = (p shr 8) and 0xFF
          val b = p and 0xFF
          (0.299 * r + 0.587 * g + 0.114 * b).toInt().coerceIn(0, 255)
        }
      }

      for (y in 0 until targetH) {
        for (x in 0 until targetW) {
          val idx = y * targetW + x
          val oldVal = gray[idx]
          val newVal = if (if (invert) oldVal > 128 else oldVal < 160) 0 else 255
          pixels[idx] = if (newVal == 0) Color.BLACK else Color.WHITE
          val err = oldVal - (if (invert) 255 - newVal else newVal)

          if (x + 1 < targetW) {
            gray[idx + 1] = (gray[idx + 1] + err * 7 / 16).coerceIn(0, 255)
          }
          if (y + 1 < targetH) {
            if (x - 1 >= 0) {
              gray[idx + targetW - 1] = (gray[idx + targetW - 1] + err * 3 / 16).coerceIn(0, 255)
            }
            gray[idx + targetW] = (gray[idx + targetW] + err * 5 / 16).coerceIn(0, 255)
            if (x + 1 < targetW) {
              gray[idx + targetW + 1] = (gray[idx + targetW + 1] + err * 1 / 16).coerceIn(0, 255)
            }
          }
        }
      }

      val dithered = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
      dithered.setPixels(pixels, 0, targetW, 0, 0, targetW, targetH)
      dithered
    } catch (e: Throwable) {
      android.util.Log.e("YxLabel", "decodeImageSource failed: ${e.message}", e)
      null
    }
  }
}
