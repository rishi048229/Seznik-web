package com.ninestar.ninestarprinterdemo

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.widget.AdapterView.OnItemClickListener
import android.widget.ListView
import android.widget.Toast
import androidx.activity.ComponentActivity
import java.util.Collections

/**
 * @作者: 三三同学
 * @时间: 2024/9/24
 * @描述:
 */
@SuppressLint("MissingPermission")
class BlueListActivity : ComponentActivity() {

    private lateinit var blueList: ListView
    private var bluetoothDeviceAdapter: BluetoothDeviceAdapter? = null
    private val bluetoothAdapter: BluetoothAdapter by lazy {
        (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    }
    private val blueListDevices: ArrayList<BluetoothDevices> = ArrayList()

    companion object {
        val TAG: String = BlueListActivity::class.java.getSimpleName()
        const val REQUEST_ENABLE_BT = 1
        const val EXTRA_DEVICE_ADDRESS = "macAddress"
        const val EXTRA_BLUE_NAME = "bluetoothName"
    }

    private lateinit var mPrinterManager: PrinterManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blue_list)
        initView()
        initData()
        registerBroadcastReceivers()
        requestBluePermissions {
            initBluetooth()
        }
    }


    @SuppressLint("MissingPermission")
    private fun initView() {
        blueList = findViewById(R.id.blueList)
        bluetoothDeviceAdapter = BluetoothDeviceAdapter(blueListDevices, this)
        blueList.setAdapter(bluetoothDeviceAdapter)
        blueList.onItemClickListener =
            OnItemClickListener { parent, view, position, id -> //点击已配对设备、新设备title不响应
                if (blueListDevices.isNotEmpty()) {
                    val bluetoothDevices = blueListDevices[position]
                    bluetoothAdapter.cancelDiscovery()
                    Intent().run {
                        putExtra(EXTRA_DEVICE_ADDRESS, bluetoothDevices.bluetoothMacAddress)
                        putExtra(EXTRA_BLUE_NAME, bluetoothDevices.bluetoothName)
                        setResult(RESULT_OK, this)
                        finish()
                    }
                }
            }
    }

    private fun initData() {
        mPrinterManager = PrinterManager.getInstance()
        setTitle("蓝牙列表")
    }

    private fun initBluetooth() {
        if (bluetoothAdapter == null) {
            Toast.makeText(this, "Bluetooth is not supported by the device", Toast.LENGTH_LONG)
                .show()
            return
        }
        if (bluetoothAdapter.isEnabled) {
            //如果已经开启了搜索功能，把搜索给取消
            if (bluetoothAdapter.isDiscovering) {
                bluetoothAdapter.cancelDiscovery()
            }
            bluetoothAdapter.startDiscovery()
        } else {
            startActivityForResult(
                Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                REQUEST_ENABLE_BT
            )
        }
    }

    /**
     * Register for required broadcast receivers.
     */
    private fun registerBroadcastReceivers() {
        val filter = IntentFilter(BluetoothDevice.ACTION_FOUND)
        registerReceiver(mBluetoothSearchBroadcastReceiver, filter)
    }

    private val mBluetoothSearchBroadcastReceiver: BroadcastReceiver =
        object : BroadcastReceiver() {
            @SuppressLint("NotifyDataSetChanged", "MissingPermission")
            override fun onReceive(context: Context, intent: Intent) {

                if (BluetoothDevice.ACTION_FOUND == intent.action) {
                    //获取搜索到的蓝牙设备参数
                    val device =
                        intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                    if (device!=null &&  device.getType() == BluetoothDevice.DEVICE_TYPE_CLASSIC){
                        val parameter = BluetoothDevices()
                        //获取蓝牙设备信号强度
                        val rssi =
                            intent.extras!!.getShort(BluetoothDevice.EXTRA_RSSI).toInt() //获取蓝牙信号强度

                        if (device?.getName() != null) {
                            parameter.bluetoothName = device.getName()
                        } else {
                            parameter.bluetoothName = "unKnow"
                        }
                        parameter.bluetoothMacAddress = device!!.getAddress()
                        parameter.bluetoothRssi = rssi.toString() + ""
                        for (bluetoothDevices in blueListDevices) {
                            if (bluetoothDevices.bluetoothMacAddress == parameter.bluetoothMacAddress) {
                                return
                            }
                        }
                        blueListDevices.add(parameter)
                        Collections.sort(blueListDevices, CompareRssi())
                        bluetoothDeviceAdapter!!.notifyDataSetChanged()
                    }
                }
            }
        }

    // 自定义比较器：按信号强度排序
    internal class CompareRssi : Comparator<Any?> {
        override fun compare(object1: Any?, object2: Any?): Int { // 实现接口中的方法
            val p1: BluetoothDevices? = object1 as BluetoothDevices? // 强制转换
            val p2: BluetoothDevices? = object2 as BluetoothDevices?
            return p1!!.bluetoothRssi.compareTo(p2!!.bluetoothRssi)
        }
    }


    override fun onDestroy() {
        super.onDestroy()
        try {
            // Make sure we're not doing discovery anymore
            if (bluetoothAdapter != null) {
                bluetoothAdapter.cancelDiscovery()
            }
            // Unregister broadcast listeners
            if (mBluetoothSearchBroadcastReceiver != null) {
                unregisterReceiver(mBluetoothSearchBroadcastReceiver)
            }
        } catch (e: Exception) {
            Log.e(TAG, "onDestroy: >>>>>>>>>>>>>>>>>>>>>" + e.message)
        }
    }

}
