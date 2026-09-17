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
import android.os.Bundle
import android.util.Base64
import android.util.Log
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.ninestar.printer.bean.DeviceType
import com.ninestar.printer.bean.PrinterDevices
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
import java.io.FileOutputStream
import java.util.Vector
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class Td404LabelPrinterModule : Module() {

  companion object {
    private const val TAG = "Td404Printer"
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

      pendingConnectPromise?.let {
        it.resolve(true)
        pendingConnectPromise = null
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

      pendingConnectPromise?.let {
        it.reject(CodedException("ERR_TD404_CONNECT", failure ?: "Failed to connect to printer", null))
        pendingConnectPromise = null
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
          portManager?.closePort()
          portManager = null
          Thread.sleep(200)
        }

        lastState = "connecting"
        sendEvent("onPrinterStateChange", bundleOf("state" to "connecting", "address" to address, "name" to (name ?: address)))

        pendingConnectPromise = promise

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
            pendingConnectPromise?.let {
              it.reject(CodedException("ERR_TD404_CONNECT_OPEN", t.message ?: "Failed to open port", t))
              pendingConnectPromise = null
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
     * Print TSPL Bitmap Label (Supports 50x30, 50x25, 40x30, 38x28, 30x20, 80mm labels)
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
        val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Could not decode label bitmap from base64")

        val tsc = LabelCommand()
        tsc.addUserCommand("\r\n")
        tsc.addSize(widthMm.toInt(), heightMm.toInt())
        tsc.addGap(gapMm.toInt())
        tsc.addDirection(LabelCommand.DIRECTION.FORWARD, LabelCommand.MIRROR.NORMAL)
        tsc.addReference(0, 0)
        tsc.addDensity(LabelCommand.DENSITY.DNESITY15)
        tsc.addQueryPrinterStatus(LabelCommand.RESPONSE_MODE.ON)
        tsc.addCls()

        // Write bitmap
        tsc.addBitmap(0, 0, LabelCommand.BITMAP_MODE.OVERWRITE, bitmap.width, bitmap)
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
     * Print Standard Thermal Receipt (continuous paper, 80mm or 58mm)
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
        val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Could not decode receipt bitmap")

        // Convert bitmap to monochrome raster ESC/POS bytes (GS v 0)
        val escBytes = convertBitmapToEscPosRaster(bitmap)
        pm.writeDataImmediately(escBytes, false)
        bitmap.recycle()
        promise.resolve(true)
      } catch (e: Throwable) {
        Log.e(TAG, "printReceiptBitmap failed: ${e.message}", e)
        promise.reject(CodedException("ERR_TD404_PRINT_RECEIPT", e.message ?: "Print receipt failed", e))
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

  /**
   * Helper to convert an Android Bitmap into standard ESC/POS GS v 0 raster graphics bytes.
   */
  private fun convertBitmapToEscPosRaster(src: Bitmap): ByteArray {
    val width = src.width
    val height = src.height
    val widthBytes = (width + 7) / 8

    val output = ByteArrayOutputStream()

    // ESC @ (Initialize)
    output.write(byteArrayOf(0x1B, 0x40))

    // GS v 0 m xL xH yL yH
    // m = 0 (Normal mode)
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
            // Standard luminance threshold (128)
            val luminance = (r * 299 + g * 587 + b * 114) / 1000
            if (luminance < 128) {
              byteVal = byteVal or (1 shl (7 - bit))
            }
          }
        }
        output.write(byteVal)
      }
    }

    // Feed and Cut (ESC d 3, GS V 66 0)
    output.write(byteArrayOf(0x1B, 0x64, 0x03)) // 3 lines feed
    output.write(byteArrayOf(0x1D, 0x56, 0x42, 0x00)) // Cut

    return output.toByteArray()
  }
}
