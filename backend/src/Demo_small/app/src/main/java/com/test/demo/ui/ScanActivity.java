package com.test.demo.ui;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.widget.CheckBox;

import com.print.base.bean.DeviceItem;
import com.print.base.listen.ScanListener;
import com.print.base.utils.BluetoothUtil;
import com.print.myprinter.ScannerBase;
import com.print.printer.PrinterManage;
import com.test.demo.R;
import com.test.demo.base.CustomProgress;
import com.test.demo.print.YXSDK;

public class ScanActivity extends AppCompatActivity {


    private BluetoothUtil bluetoothUtil;
    private ScannerBase scanner;
    private ListAdapter adapter;
    private CheckBox cb;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_scan);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        initScan();
        initRv();
    }

    private void initRv() {
        cb = findViewById(R.id.cb);
        RecyclerView rv = findViewById(R.id.rv);
        adapter = new ListAdapter(this, dev -> {
            YXSDK.item = dev;
            scanner.stopScan();
//            Class cls;
//            if (cb.isChecked()){
//                cls = UpdateActivity.class;
//            }else {
//                cls = PrintActivity.class;
//            }
            Intent intent = new Intent(getApplicationContext(), PrintActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        });
        rv.setLayoutManager(new LinearLayoutManager(this));
        rv.addItemDecoration(new DividerItemDecoration(this, 1));
        rv.setAdapter(adapter);
    }

    private void initScan() {
        bluetoothUtil = new BluetoothUtil();
        bluetoothUtil.init(this, (status, msg) -> {
            if (status == 0) {
                scanner.scan();
            }
        });
        scanner = PrinterManage.getInstance().getScanner(1);
        scanner.setListener(new ScanListener() {
            @Override
            public void onStart() {
            }

            @Override
            public void onFound(DeviceItem item) {
                if (item == null || isSpace(item.address) || isSpace(item.name) /*|| item.name.endsWith("LE")*/) {
                    return;
                }
                Log.e("item", "name: " + item.name + ", address: " + item.address);
                for (DeviceItem dev : adapter.devs) {
                    if (item.address.equals(dev.address)) {
                        return;
                    }
                }
                CustomProgress.dismissPD();
                adapter.addData(item);
                //TODO 如果不想使用SDK扫描获取蓝牙设备，那么可以根据自己扫描获取的BluetoothDevice，
                // 调用 DeviceItem build = DeviceItem.build(BluetoothDevice);
                // 调用 DeviceItem build = DeviceItem.build(macStr);
            }

            @Override
            public void onFinished() {
            }

            @Override
            public void onFailed(String msg) {
            }

            private boolean isSpace(String s) {
                return (s == null || s.trim().isEmpty());
            }
        });
    }

    public void scan(View view) {
        CustomProgress.showPD(this, "Scanning...");
        adapter.clear();
        bluetoothUtil.checkPermission();
    }

    @Override
    protected void onStop() {
        scanner.stopScan();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        scanner.release();
        super.onDestroy();
    }


    @SuppressLint("GestureBackNavigation")
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addCategory(Intent.CATEGORY_HOME);
            startActivity(intent);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

}