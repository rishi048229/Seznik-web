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
  @Volatile private var pendingConnectLatch: CountDownLatch? = null

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
      if (name == "connected" || name == "disconnected") {
        pendingConnectLatch?.countDown()
      }
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
      val name = address.shownName?.takeIf { it.isNotEmpty() } ?: mac
      discovered[mac] = address
      sendEvent("onPrinterFound", bundleOf("address" to mac, "name" to name))
    }
  }

  private fun describeFailReason(arg: Any?): String {
    val reason = arg as? IDzPrinter.PrintFailReason ?: return "Printing failed (unspecified error)."
    return when (reason) {
      IDzPrinter.PrintFailReason.OK -> "Success"
      IDzPrinter.PrintFailReason.No_Paper -> "Printer is out of paper. Please insert a label roll."
      IDzPrinter.PrintFailReason.No_Label,
      IDzPrinter.PrintFailReason.Usedup_Label -> "Printer ran out of labels. Please load a new label roll."
      IDzPrinter.PrintFailReason.Unmatched_Label -> "Label roll size does not match the configured label dimensions."
      IDzPrinter.PrintFailReason.CoverOpened,
      IDzPrinter.PrintFailReason.LabelCanOpend -> "Printer cover is open or unlocked. Please close and latch the cover."
      IDzPrinter.PrintFailReason.VolTooLow -> "Printer battery is too low to print. Please connect the charger."
      IDzPrinter.PrintFailReason.VolTooHigh -> "Printer battery voltage is too high. Please disconnect charger and retry."
      IDzPrinter.PrintFailReason.TphTooHot -> "Print head is too hot. Please allow the printer to cool down."
      IDzPrinter.PrintFailReason.TphTooCold -> "Printer temperature is too low. Move to a warmer environment."
      IDzPrinter.PrintFailReason.TphNotFound,
      IDzPrinter.PrintFailReason.TphOpened -> "Print head not detected or latch is open. Please check the print head lock."
      IDzPrinter.PrintFailReason.No_Ribbon,
      IDzPrinter.PrintFailReason.No_Ribbon2 -> "Ribbon not detected. Please install or check the ribbon cartridge."
      IDzPrinter.PrintFailReason.Usedup_Ribbon,
      IDzPrinter.PrintFailReason.Usedup_Ribbon2 -> "Ribbon has run out. Please replace the ribbon cartridge."
      IDzPrinter.PrintFailReason.Unmatched_Ribbon,
      IDzPrinter.PrintFailReason.Unmatched_Ribbon2 -> "Installed ribbon does not match this printer."
      IDzPrinter.PrintFailReason.EnvNotReady -> "Printer is not ready. Please turn it off and on again."
      IDzPrinter.PrintFailReason.Disconnected -> "Printer disconnected during print."
      IDzPrinter.PrintFailReason.Timeout -> "Printer timed out while printing."
      IDzPrinter.PrintFailReason.Cancelled -> "Print job was cancelled."
      else -> "Printer error: ${reason.name.replace('_', ' ')}."
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

  /**
   * Real head density in dots/mm, straight from LPAPI. Falls back to 203 DPI (8 dots/mm)
   * when the printer has not reported yet — never assume, the two vendors we support do
   * not necessarily share a head, and the label geometry is computed from this.
   */
  private fun deviceDotsPerMm(): Double {
    val dpi = api?.printerInfo?.deviceDPI ?: return 8.0
    if (dpi <= 0) return 8.0
    return dpi.toDouble() / 25.4
  }

  private fun printableWidthMm(): Double {
    val info = api?.printerInfo ?: return 48.0
    val px = info.deviceWidth
    val dpi = info.deviceDPI
    if (px <= 0 || dpi <= 0) return 48.0
    return px.toDouble() / dpi.toDouble() * 25.4
  }

  override fun definition() = ModuleDefinition {
    Name("JoshLabelPrinter")

    Events("onPrinterFound", "onPrinterStateChange")

    Function("isAvailable") { true }
    Function("isSupported") { true }

    Function("getState") { lastState }
    Function("getPrinterState") { lastState }

    Function("isConnected") {
      val instance = api ?: return@Function false
      instance.isPrinterOpened && (
        lastState == "connected" ||
        instance.printerState == IDzPrinter.PrinterState.Connected ||
        instance.printerState == IDzPrinter.PrinterState.Connected2 ||
        instance.printerState == IDzPrinter.PrinterState.Working
      )
    }

    AsyncFunction("isConnected") { promise: Promise ->
      val instance = api
      val connected = instance != null && instance.isPrinterOpened && (
        lastState == "connected" ||
        instance.printerState == IDzPrinter.PrinterState.Connected ||
        instance.printerState == IDzPrinter.PrinterState.Connected2 ||
        instance.printerState == IDzPrinter.PrinterState.Working
      )
      promise.resolve(connected)
    }

    AsyncFunction("getPrinterInfo") { promise: Promise ->
      try {
        val instance = api
        if (instance == null || !instance.isPrinterOpened) {
          promise.resolve(null)
        } else {
          val info = instance.printerInfo
          val mac = info?.deviceAddress ?: ""
          val name = info?.deviceName ?: mac
          val dpi = info?.deviceDPI ?: 203
          val px = info?.deviceWidth ?: 384
          val widthMm = printableWidthMm().takeIf { it > 0 } ?: 48.0
          promise.resolve(
            mapOf(
              "address" to mac,
              "name" to name,
              "dpi" to dpi,
              "widthPx" to px,
              "widthMm" to widthMm,
              "state" to lastState
            )
          )
        }
      } catch (e: Throwable) {
        promise.resolve(null)
      }
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
          val addr = IDzPrinter.PrinterAddress(dev.address, dev.name ?: dev.address, IDzPrinter.AddressType.DUAL)
          discovered[dev.address] = addr
          if (dev.name != null) discovered[dev.name] = addr
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
        
        if (instance.isPrinterOpened && (
          lastState == "connected" ||
          instance.printerState == IDzPrinter.PrinterState.Connected ||
          instance.printerState == IDzPrinter.PrinterState.Connected2 ||
          instance.printerState == IDzPrinter.PrinterState.Working
        )) {
          lastState = "connected"
          promise.resolve(true)
          return@AsyncFunction
        }

        try {
          instance.stopDiscovery()
        } catch (e: Throwable) {}

        val known = discovered[address]
        val btAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
        val bondedDev = btAdapter?.bondedDevices?.find {
          it.address.equals(address, ignoreCase = true) || (it.name != null && it.name.equals(address, ignoreCase = true))
        }

        val mac = bondedDev?.address ?: known?.macAddress ?: address
        val name = bondedDev?.name ?: known?.shownName ?: address
        val addr = known ?: (bondedDev?.let { IDzPrinter.PrinterAddress(it.address, it.name ?: it.address, IDzPrinter.AddressType.DUAL) }) ?: IDzPrinter.PrinterAddress(mac, name, IDzPrinter.AddressType.DUAL)
        
        discovered[mac] = addr
        discovered[name] = addr
        discovered[address] = addr

        val latch = CountDownLatch(1)
        pendingConnectLatch = latch

        // Non-blocking connection initiation
        var initiated = instance.openPrinterByAddress(addr)
        if (!initiated && bondedDev != null) {
          initiated = instance.openPrinter(bondedDev)
        }
        if (!initiated) {
          initiated = instance.openPrinter(name) || instance.openPrinter(mac) || instance.openPrinterByAddressSync(addr)
        }

        if (initiated) {
          latch.await(4, TimeUnit.SECONDS)
        }

        pendingConnectLatch = null

        val isConnected = instance.isPrinterOpened && (
          lastState == "connected" ||
          instance.printerState == IDzPrinter.PrinterState.Connected ||
          instance.printerState == IDzPrinter.PrinterState.Connected2 ||
          instance.printerState == IDzPrinter.PrinterState.Working
        )

        if (isConnected) {
          lastState = "connected"
          promise.resolve(true)
        } else {
          promise.resolve(false)
        }
      } catch (e: Throwable) {
        pendingConnectLatch = null
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
        val printWmm = minOf(widthMm, headMm)
        val printHmm = heightMm

        val jobParam = Bundle()
        val gapType = finiteInt(spec["gapType"], 2) // 2 = die-cut label gap
        val gapMm = finiteInt(spec["gapMm"], 3) // 3mm gap
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_TYPE, gapType)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH, gapMm)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH_01MM, gapMm * 10)

        // Set speed: 5 is maximum speed in LPAPI (1=slowest, 3=normal, 5=fastest) to eliminate sluggish feed
        val speed = finiteInt(spec["speed"], 5).coerceIn(1, 5)
        jobParam.putInt(IDzPrinter.PrintParamName.PRINT_SPEED, speed)
        instance.setPrintSpeed(speed)

        // Set balanced darkness (7) so heating pulse is fast and doesn't induce head cooldown delays
        val density = finiteInt(spec["darkness"], 7).coerceIn(1, 20)
        jobParam.putInt(IDzPrinter.PrintParamName.PRINT_DENSITY, density)
        instance.setPrintDarkness(density)

        jobParam.putInt(IDzPrinter.PrintParamName.IMAGE_THRESHOLD, 192)

        instance.setPrintPageGapType(gapType)
        instance.setPrintPageGapLength(gapMm)

        // Build composite label bitmap once
        val labelBitmap = buildLabelBitmap(spec, widthMm, heightMm, headMm, deviceDotsPerMm())

        val pending = PendingPrint()
        pendingPrint = pending

        if (copies > 1) {
          jobParam.putInt(IDzPrinter.PrintParamName.PRINT_COPIES, copies)
        }
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

    /**
     * Batch print multiple distinct labels within ONE continuous print job.
     * Eliminates pauses between different labels.
     */
    AsyncFunction("printLabelBatch") { batchSpec: Map<String, Any?>, promise: Promise ->
      try {
        val instance = requireApi()
        if (!instance.isPrinterOpened) {
          throw CodedException("ERR_JOSH_NOT_CONNECTED", "No label printer is connected.", null)
        }
        val rawLabels = batchSpec["labels"] as? List<Map<String, Any?>> ?: emptyList()
        if (rawLabels.isEmpty()) {
          promise.resolve(true)
          return@AsyncFunction
        }
        val first = rawLabels.first()
        val widthMm = finite(batchSpec["widthMm"] ?: first["widthMm"], 50.0)
        val heightMm = finite(batchSpec["heightMm"] ?: first["heightMm"], 30.0)
        val headMm = printableWidthMm().takeIf { it > 1.0 } ?: 48.0
        val printWmm = minOf(widthMm, headMm)
        val printHmm = heightMm

        val jobParam = Bundle()
        val gapType = finiteInt(batchSpec["gapType"] ?: first["gapType"], 2)
        val gapMm = finiteInt(batchSpec["gapMm"] ?: first["gapMm"], 3)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_TYPE, gapType)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH, gapMm)
        jobParam.putInt(IDzPrinter.PrintParamName.GAP_LENGTH_01MM, gapMm * 10)
        val speed = finiteInt(batchSpec["speed"], 5).coerceIn(1, 5)
        jobParam.putInt(IDzPrinter.PrintParamName.PRINT_SPEED, speed)
        instance.setPrintSpeed(speed)
        val density = finiteInt(batchSpec["darkness"], 7).coerceIn(1, 20)
        jobParam.putInt(IDzPrinter.PrintParamName.PRINT_DENSITY, density)
        instance.setPrintDarkness(density)
        jobParam.putInt(IDzPrinter.PrintParamName.IMAGE_THRESHOLD, 192)

        instance.setPrintPageGapType(gapType)
        instance.setPrintPageGapLength(gapMm)

        val pending = PendingPrint()
        pendingPrint = pending

        var jobStarted = instance.startJob(printWmm, printHmm, 0)
        if (!jobStarted) {
          runCatching { instance.abortJob() }
          jobStarted = instance.startJob(printWmm, printHmm, 0)
        }
        if (!jobStarted) {
          throw CodedException("ERR_JOSH_START", "Failed to start batch print job.", null)
        }

        val bitmapsToRecycle = mutableListOf<Bitmap>()
        try {
          for ((index, labelSpec) in rawLabels.withIndex()) {
            val bmp = buildLabelBitmap(labelSpec, widthMm, heightMm, headMm, deviceDotsPerMm())
            bitmapsToRecycle.add(bmp)
            if (index > 0) instance.startPage()
            instance.drawBitmap(bmp, 0.0, 0.0, printWmm, printHmm)
            if (index > 0) instance.endPage()
          }
          val committed = instance.commitJobWithParam(jobParam)
          if (!committed) {
            pendingPrint = null
            throw CodedException("ERR_JOSH_COMMIT", "Printer rejected batch job.", null)
          }
          val reported = pending.latch.await(60, TimeUnit.SECONDS)
          pendingPrint = null
          if (!reported) {
            throw CodedException("ERR_JOSH_TIMEOUT", "Printer timeout during batch print.", null)
          }
          if (!pending.success) {
            throw CodedException("ERR_JOSH_PRINT_FAILED", pending.failReason ?: "Batch print failed.", null)
          }
          promise.resolve(true)
        } finally {
          for (b in bitmapsToRecycle) {
            b.recycle()
          }
        }
      } catch (e: CodedException) {
        pendingPrint = null
        promise.reject(e)
      } catch (e: Throwable) {
        pendingPrint = null
        promise.reject(CodedException("ERR_JOSH_BATCH", e.message ?: "Batch print error", e))
      }
    }

    AsyncFunction("rasterizeLabelBase64") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val widthMm = finite(spec["widthMm"], 50.0)
        val heightMm = finite(spec["heightMm"], 30.0)
        val headMm = (spec["headMm"] as? Number)?.toDouble() ?: 48.0
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
    headMm: Double,
    dotsPerMmOverride: Double = 0.0
  ): Bitmap {
    // 8 dots/mm = 203 DPI, the near-universal thermal head density. LPAPI can report the
    // real head via printerInfo.deviceDPI, so the native print path passes that in; the
    // ESC/POS raster path shares this same renderer for a different printer entirely and
    // keeps the 203 DPI default, which is why this is a parameter and not a constant.
    val dotsPerMm = if (dotsPerMmOverride > 0.0) dotsPerMmOverride else 8.0
    val printWmm = minOf(widthMm, headMm)
    val printHmm = heightMm
    val fit = if (widthMm > 0) printWmm / widthMm else 1.0

    val wPx = (printWmm * dotsPerMm).toInt().coerceAtLeast(64)
    val hPx = (printHmm * dotsPerMm).toInt().coerceAtLeast(64)

    val bmp = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(Color.WHITE)

    // Residual head/sensor phase trim. Only ever non-zero for the blind ESC/POS raster
    // path, which has no gap sensor to re-synchronise against; a printer whose firmware
    // positions at the sensed gap never needs it. Applied to the whole canvas so every
    // element moves together and the label's own dimensions stay exact.
    val offsetPx = (finite(spec["offsetMm"], 0.0) * dotsPerMm).toFloat()
    if (offsetPx != 0f) canvas.translate(0f, offsetPx)

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
        val baseline = yPx - fontMetrics.ascent
        canvas.drawText(value, drawX, baseline, paint)
      }
      "barcode" -> {
        val value = el["value"] as? String ?: return
        if (value.isEmpty()) return
        val barcodeW = if (wPx > 0) wPx.toInt() else (canvasWidthPx - xPx.toInt()).coerceAtLeast(100)
        val barcodeH = if (hPx > 0) hPx.toInt() else 80
        val type = finiteInt(el["barcodeType"], 60)
        val requestedTextHeight = (finite(el["textHeight"], 3.0) * fit * dotsPerMm).toFloat()
        // The human-readable digits have to fit inside this element's own box.
        val textHeight = if (requestedTextHeight > 0f) requestedTextHeight.coerceAtMost(barcodeH * 0.4f) else 0f
        val showText = textHeight >= 10f
        val barOnlyHeight = (if (showText) barcodeH - textHeight.toInt() else barcodeH).coerceAtLeast(1)
        val barcodeBmp = generateBarcodeBitmap(value, type, barcodeW, barOnlyHeight)

        if (barcodeBmp != null) {
          canvas.drawBitmap(barcodeBmp, xPx, yPx, null)
          barcodeBmp.recycle()

          if (showText) {
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
              color = Color.BLACK
              textSize = textHeight
              typeface = Typeface.DEFAULT
              textAlign = Paint.Align.CENTER
            }
            // Baseline sits on the box's bottom edge less the descent
            val textY = yPx + barcodeH - textPaint.fontMetrics.descent
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
      val pixels = IntArray(widthPx * heightPx)
      for (y in 0 until heightPx) {
        val offset = y * widthPx
        for (x in 0 until widthPx) {
          pixels[offset + x] = if (matrix.get(x, y)) Color.BLACK else Color.WHITE
        }
      }
      bmp.setPixels(pixels, 0, widthPx, 0, 0, widthPx, heightPx)
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
      val pixels = IntArray(sizePx * sizePx)
      for (y in 0 until sizePx) {
        val offset = y * sizePx
        for (x in 0 until sizePx) {
          pixels[offset + x] = if (matrix.get(x, y)) Color.BLACK else Color.WHITE
        }
      }
      bmp.setPixels(pixels, 0, sizePx, 0, 0, sizePx, sizePx)
      bmp
    } catch (e: Throwable) {
      android.util.Log.w("JoshLabel", "QR generation failed: ${e.message}")
      null
    }
  }

  /** Reads bytes from any image source (HTTP, HTTPS, content://, file://, data: URI, raw base64, or local path). */
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
      android.util.Log.e("JoshLabel", "openImageBytes failed for image: ${e.message}")
      null
    }
  }

  /**
   * Decodes an image downsampled to print resolution (~8 dots/mm = 203dpi), composites
   * transparent areas onto a pure WHITE background, and applies Floyd-Steinberg error-diffusion
   * dithering so that photos, logos, and colored artwork print crisp and visible on thermal paper.
   */
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
      android.util.Log.e("JoshLabel", "decodeImageSource failed: ${e.message}", e)
      null
    }
  }
}
