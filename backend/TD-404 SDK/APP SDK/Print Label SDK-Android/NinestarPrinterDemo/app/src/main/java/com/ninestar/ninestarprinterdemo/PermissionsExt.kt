package com.ninestar.ninestarprinterdemo

import android.util.Log
import android.widget.Toast
import com.hjq.permissions.OnPermissionCallback
import com.hjq.permissions.Permission
import com.hjq.permissions.XXPermissions


/**
 * @作者: 三三同学
 * @时间: 2024/3/20
 * @描述: 权限申请 扩展类
 */


/**
 * 申请蓝牙相关权限用于打印机连接传输数据等
 */
fun BlueListActivity.requestBluePermissions(positiveAction: () -> Unit = {}) {
    val activity = this
    XXPermissions.with(this)
        .permission(
            Permission.BLUETOOTH_SCAN,
            Permission.BLUETOOTH_CONNECT,
            Permission.BLUETOOTH_ADVERTISE
        )
        .request(object : OnPermissionCallback {
            override fun onGranted(permissions: MutableList<String>, allGranted: Boolean) {
                if (!allGranted) {
                    Log.e("BlueListActivity", "获取部分权限成功，但部分权限未正常授予 >>>>>>>>>>>>")
                    return
                }
                positiveAction.invoke()
            }

            override fun onDenied(
                permissions: MutableList<String>,
                doNotAskAgain: Boolean
            ) {
                Log.e("BlueListActivity", "被拒绝的权限$permissions >>>>>>>>>>>>>>")
                if (doNotAskAgain) {
                    Toast.makeText(
                        activity,
                        "被拒绝的权限$permissions",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Log.e("BlueListActivity", "获取权限失败")
                }
            }
        })
}
