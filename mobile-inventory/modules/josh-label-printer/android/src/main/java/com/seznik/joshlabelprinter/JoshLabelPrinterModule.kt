package com.seznik.joshlabelprinter

import android.os.Bundle
import com.dothantech.lpapi.LPAPI
import com.dothantech.printer.IDzPrinter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import java.util.concurrent.ConcurrentHashMap

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
    ) {}

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

  /** LPAPI must exist before any other call; created lazily so the app can boot without it. */
  private fun requireApi(): LPAPI {
    val existing = api
    if (existing != null) return existing
    val created = LPAPI.Factory.createInstance(callback)
      ?: throw CodedException("ERR_JOSH_INIT", "Could not initialise the label printer SDK.", null)
    api = created
    return created
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
              "address" to (info.deviceAddress ?: "")
            )
          )
        }
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_JOSH_INFO", e.message ?: "Could not read printer info", e))
      }
    }

    /**
     * Renders one label described as a list of elements, all in millimetres.
     * gapMm maps to the printer's page-gap setting; darkness/speed are passed
     * through only when provided so the printer keeps its own defaults.
     */
    AsyncFunction("printLabel") { spec: Map<String, Any?>, promise: Promise ->
      try {
        val instance = requireApi()
        if (!instance.isPrinterOpened) {
          throw CodedException("ERR_JOSH_NOT_CONNECTED", "No label printer is connected.", null)
        }

        val widthMm = (spec["widthMm"] as? Number)?.toDouble() ?: 50.0
        val heightMm = (spec["heightMm"] as? Number)?.toDouble() ?: 30.0
        val rotation = (spec["rotation"] as? Number)?.toInt() ?: 0
        val copies = ((spec["copies"] as? Number)?.toInt() ?: 1).coerceAtLeast(1)

        (spec["gapMm"] as? Number)?.let { instance.setPrintPageGapLength(it.toInt()) }
        (spec["darkness"] as? Number)?.let { instance.setPrintDarkness(it.toInt()) }
        (spec["speed"] as? Number)?.let { instance.setPrintSpeed(it.toInt()) }

        @Suppress("UNCHECKED_CAST")
        val elements = (spec["elements"] as? List<Map<String, Any?>>) ?: emptyList()

        repeat(copies) {
          if (!instance.startJob(widthMm, heightMm, rotation)) {
            throw CodedException("ERR_JOSH_JOB", "Printer rejected the label job.", null)
          }
          try {
            elements.forEach { el -> drawElement(instance, el) }
          } catch (inner: Throwable) {
            instance.abortJob()
            throw inner
          }
          if (!instance.commitJob()) {
            throw CodedException("ERR_JOSH_COMMIT", "Printer rejected the label data.", null)
          }
        }

        promise.resolve(true)
      } catch (e: CodedException) {
        promise.reject(e)
      } catch (e: Throwable) {
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

  private fun drawElement(instance: LPAPI, el: Map<String, Any?>) {
    val x = (el["x"] as? Number)?.toDouble() ?: 0.0
    val y = (el["y"] as? Number)?.toDouble() ?: 0.0

    // Alignment is per-item state on LPAPI, so set it before every draw rather
    // than assuming it carried over from the previous element.
    instance.itemHorizontalAlignment = (el["align"] as? Number)?.toInt() ?: 0

    when ((el["type"] as? String) ?: "") {
      "text" -> {
        val value = el["value"] as? String ?: return
        val w = (el["width"] as? Number)?.toDouble() ?: 0.0
        val h = (el["height"] as? Number)?.toDouble() ?: 0.0
        val fontHeight = (el["fontHeight"] as? Number)?.toDouble() ?: 3.0
        val bold = (el["bold"] as? Boolean) ?: false
        // drawTextRegular's trailing int is the style bitmask; 1 = bold.
        instance.drawTextRegular(value, x, y, w, h, fontHeight, if (bold) 1 else 0)
      }
      "barcode" -> {
        val value = el["value"] as? String ?: return
        val w = (el["width"] as? Number)?.toDouble() ?: 30.0
        val h = (el["height"] as? Number)?.toDouble() ?: 10.0
        val textHeight = (el["textHeight"] as? Number)?.toDouble() ?: 3.0
        // BarcodeType.AUTO == 0: let the SDK pick a symbology that fits the data.
        val type = (el["barcodeType"] as? Number)?.toInt() ?: 0
        instance.draw1DBarcode(value, type, x, y, w, h, textHeight)
      }
      "qrcode" -> {
        val value = el["value"] as? String ?: return
        val size = (el["size"] as? Number)?.toDouble() ?: 15.0
        instance.draw2DQRCode(value, x, y, size)
      }
      "image" -> {
        // LPAPI takes a filesystem path, while the app stores label images as
        // content/file URIs, so strip the scheme before handing it over.
        val raw = el["uri"] as? String ?: return
        val path = when {
          raw.startsWith("file://") -> android.net.Uri.parse(raw).path ?: return
          else -> raw
        }
        if (!java.io.File(path).exists()) return
        val w = (el["width"] as? Number)?.toDouble() ?: 0.0
        val h = (el["height"] as? Number)?.toDouble() ?: 0.0
        val threshold = (el["threshold"] as? Number)?.toInt()
        // Thermal heads are 1-bit, so a grey logo prints as mud without a
        // threshold; the explicit variant is used whenever one is supplied.
        if (threshold != null) instance.drawImageWithThreshold(path, x, y, w, h, threshold)
        else instance.drawImage(path, x, y, w, h)
      }
      "line" -> {
        val x2 = (el["x2"] as? Number)?.toDouble() ?: x
        val y2 = (el["y2"] as? Number)?.toDouble() ?: y
        val thickness = (el["thickness"] as? Number)?.toDouble() ?: 0.3
        instance.drawLine(x, y, x2, y2, thickness)
      }
      "rectangle" -> {
        val w = (el["width"] as? Number)?.toDouble() ?: 0.0
        val h = (el["height"] as? Number)?.toDouble() ?: 0.0
        val thickness = (el["thickness"] as? Number)?.toDouble() ?: 0.3
        if ((el["filled"] as? Boolean) == true) instance.fillRectangle(x, y, w, h)
        else instance.drawRectangle(x, y, w, h, thickness)
      }
      else -> {
        // Unknown element types are skipped rather than failing the whole label.
      }
    }
  }
}
