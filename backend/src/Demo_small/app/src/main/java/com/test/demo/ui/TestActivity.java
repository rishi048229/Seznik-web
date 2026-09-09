package com.test.demo.ui;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.TextView;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.print.base.bean.DeviceItem;
import com.print.base.bean.PrinterConstantPool;
import com.print.base.bean.TaskCallBean;
import com.print.base.listen.ConnectListener;
import com.print.base.listen.ScanListener;
import com.print.base.listen.TaskCallback;
import com.print.base.utils.BluetoothUtil;
import com.print.myprinter.ScannerBase;
import com.print.printer.Command;
import com.print.printer.PrinterManage;
import com.test.demo.R;
import com.test.demo.base.CommonUtil;
import com.test.demo.base.CustomProgress;
import com.test.demo.base.LogView;
import com.test.demo.print.PrintCallBack;
import com.test.demo.print.Printer_Y50;
import com.test.demo.print.YXSDK;

import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.List;


public class TestActivity extends AppCompatActivity implements View.OnClickListener {

    public EditText et;
    private EditText imgWEt;
    private EditText imgHEt;
    private EditText paperWEt;
    private EditText paperHEt;
    private int paperType= PrinterConstantPool.PaperType.BLACK;
    private static LogView logView;
    private View devC;
    private Printer_Y50 printerUtil;
    private BluetoothUtil bluetoothUtil;
    private ScannerBase scanner;
    private ListAdapter adapter;
    private TextView titleTv;


    public static void log(String txt) {
        if (logView == null) {
            return;
        }
        logView.log(txt);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_test);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        initView();
        initListen();
        initScan();
        initPrinter();
        initRv();
        bluetoothUtil.checkPermission();
    }

    private void initRv() {
        RecyclerView rv = findViewById(R.id.rv);
        adapter = new ListAdapter(this, dev -> {
            dev.modelKey = "TP3Z431";
            YXSDK.item = dev;
            printerUtil.connect();
            CustomProgress.showPD(this, "连接中...");
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
                if (item == null || isSpace(item.address) || isSpace(item.name) || item.name.endsWith("LE")) {
                    return;
                }
                Log.e("item", "name: " + item.name + ", address: " + item.address);
                if (!item.name.contains("GE920")){
                    return;
                }
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

    private void initPrinter() {
        printerUtil = new Printer_Y50();
        printerUtil.setListen(connectListener, taskCallback, new PrintCallBack() {
            @Override
            public void startPrint() {

            }

            @Override
            public void Printing(int i) {
                showPrintTips(i);
            }

            @Override
            public void success() {
                CustomProgress.dismissPD();
            }

            @Override
            public void stop(String msg) {
                CustomProgress.dismissPD();
            }
        });
    }

    public void initView() {
        devC = findViewById(R.id.dev_content);
        titleTv = findViewById(R.id.name_tv);

        logView = findViewById(R.id.log_content);
        logView.init();

        et = findViewById(R.id.et);
        imgWEt = findViewById(R.id.img_width);
        imgHEt = findViewById(R.id.img_height);
        paperWEt = findViewById(R.id.paper_width);
        paperHEt = findViewById(R.id.paper_height);
    }

    public void initListen() {
        devC.setOnClickListener(this);
        findViewById(R.id.back).setOnClickListener(this);
        findViewById(R.id.btn1).setOnClickListener(this);
        findViewById(R.id.btn2).setOnClickListener(this);
        findViewById(R.id.btn3).setOnClickListener(this);
        findViewById(R.id.add).setOnClickListener(this);
        findViewById(R.id.reduce).setOnClickListener(this);
        findViewById(R.id.connect).setOnClickListener(this);
        findViewById(R.id.refresh).setOnClickListener(this);
        ((RadioGroup) findViewById(R.id.paper_type_rg)).setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.gap_paper) {
                paperType = PrinterConstantPool.PaperType.GAP;
            } else if (checkedId == R.id.continuous_paper) {
                paperType = PrinterConstantPool.PaperType.CONTINUOUS;
            } else if (checkedId == R.id.black_paper) {
                paperType = PrinterConstantPool.PaperType.BLACK;
            } else if (checkedId == R.id.tattoo_paper) {
                paperType = PrinterConstantPool.PaperType.TATTOO;
            }
        });
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.back) {
            finish();
            return;
        }
        if (id == R.id.add) {
            setEt(1);
        } else if (id == R.id.reduce) {
            setEt(-1);
        } else if (id == R.id.refresh) {
            scan();
        } else if (id == R.id.connect) {
            printerUtil.disconnect();
            titleTv.setText("未连接");
            devC.setVisibility(View.VISIBLE);
            scan();
        } else if (id == R.id.dev_content) {
            devC.setVisibility(View.GONE);
            scanner.stopScan();
        } else {
            if (printerUtil.printer == null) {
                return;
            }
            if (id == R.id.btn1) {
                getInfo();
            } else if (id == R.id.btn2) {
                addTask(Command.print_SELFTEST());
            } else if (id == R.id.btn3) {
                //打印前获取打印机状态
                printerUtil.printer.addTask(Command.get_status(), "", false, statusCall);
            }
        }


    }

    private void scan() {
        adapter.clear();
        bluetoothUtil.checkPermission();
    }

    @Override
    protected void onDestroy() {
        logView = null;
        scanner.stopScan();
        scanner.release();
        printerUtil.release();
        super.onDestroy();
    }

    /**
     * 显示打印弹窗
     * Display print pop-up window
     */
    protected void showPrintTips(int printIndex) {
        String msg = "打印中，正在打印第" + printIndex + "张图片";
        if (CustomProgress.isShow()) {
            CustomProgress.updatePD(msg);
        } else {
            CustomProgress.showPD(this, msg);
        }
    }

    /**
     * 获取打印机信息
     * Get printer information
     */
    public void getInfo() {
        if (!printerUtil.printer.isConnect()) {
            return;
        }

        addTask(Command.get_deviceName());
        addTask(Command.get_btName());
        addTask(Command.get_version());
        addTask(Command.get_DENSITY());
        addTask(Command.get_shutTime());
        addTask(Command.get_battervol());
        addTask(Command.get_btMAC());
        addTask(Command.get_SN());
//        addTask(Command.get_paperType());//TSPL不用调用这个接口，否则会导致机器异常
        addTask(Command.get_status());
//        addTask(Command.get_RFID());
//        addTask(Command.get_RFID_UID());
//        addTask(Command.get_RFID_ENCRY());
//        addTask(Command.DPI());
//        addTask(Command.HARDWARE_VERSION());
//        addTask(Command.FACTORY_RESET());
    }

    /**
     * 添加任务
     * add task
     */
    public void addTask(Command command) {
        /*
         * 参数3设置为true，全局回调监听就能接收到
         * Parameter 3 is set to true, and global callback listening can receive it
         */
        printerUtil.printer.addTask(command, "", true, null);

        /*
         * 参数3设置为false，全局回调就无法接收
         * 参数3和4互不影响
         * If parameter 3 is set to false, the global callback cannot be received
         * Parameters 3 and 4 do not affect each other
         */
//        yxsdk.printer.addTask(command, "", false, call);

    }


    /**
     * 连接监听
     * Connection Listener
     */
    ConnectListener connectListener = new ConnectListener() {
        @Override
        public void onConneted() {
            log("连接回调： onConneted ");
            titleTv.setText(YXSDK.item.name);
            devC.setVisibility(View.GONE);
            scanner.stopScan();
            CustomProgress.dismissPD();
        }

        @Override
        public void onConnetFailed(String s) {
            log("连接回调： onConnetFailed : " + s);
            CustomProgress.dismissPD();
        }

        @Override
        public void closed() {
            log("连接回调： closed ");
            CustomProgress.dismissPD();
        }
    };


    /**
     * 全局回调
     * Global callback
     */
    TaskCallback taskCallback = new TaskCallback() {
        @Override
        public void sendStatus(TaskCallBean taskCallBean) {
            super.sendStatus(taskCallBean);
        }

        @Override
        public void readCall(TaskCallBean bean) {
            if (bean.data == null) {
                return;
            }
            if (bean.type == null || bean.type.isEmpty()) {
                //type为空的情况，一般不会出现，除非APP端特意设置
            } else if (bean.type.equals(PrinterConstantPool.ResultType.SYSTEM)) {
                printerUtil.proactivelyReport(bean);  //系统主动上传,有主动上报的设备才需要处理
            } else {
                //APP主动获取
                String s = "";
                switch (bean.type) {
                    case PrinterConstantPool.Command.GET_BT_MAC:
                        s = CommonUtil.byte2Hex(bean.data, "", ":");
                        break;

                    case PrinterConstantPool.Command.GET_DENSITY:
                        try {
                            int LID = bean.data[0] & 0xff;
                            s = String.valueOf(LID);
                        } catch (Exception e) {
                            s = "未知";
                        }
                        break;
                    case PrinterConstantPool.Command.GET_BATTERVOL:
                        byte aByte1 = bean.data[1];
                        s = String.valueOf(aByte1) + "%";
                        break;
                    case PrinterConstantPool.Command.GET_SHUT_TIME:
                        try {
                            int time = bean.data[0] & 0xff;
                            if (bean.data.length >= 2) {
                                int aByte = bean.data[1] & 0xff;
                                time = time * 256 + aByte;
                            }
                            s = time + " 分钟";
                        } catch (Exception e) {
                            s = "未知";
                        }
                        break;
                    case PrinterConstantPool.Command.GET_STATUS:
                        s = String.valueOf(intState(bean.data));
                        break;
                    default:
                        try {
                            s = new String(bean.data, "gb2312");
                        } catch (UnsupportedEncodingException e) {
                            s = "未知";
                        }
                        break;
                }
                try {
                    log("读取打印机信息：" +
                            "\ntype:[ " + bean.type + " ]" +
                            "\nmsg:[ " + bean.msg + " ]" +
                            "\nhex:[ " + CommonUtil.byte2Hex(bean.data, "0X", " ") + " ]" +
                            "\nstr:[ " + s + " ]");
                } catch (Exception e) {
                    log(e.getMessage());
                }
            }

        }
    };

    /**
     * 0x00 表示空闲状态，
     * 0x01 表示正在打印状态
     * 0x02表示纸仓打开状态，
     * 0x04 表示缺纸状态，
     * 0x08 表示电池缺电状态,
     * 0x10表示打印头过热状态
     *
     * @return 良好 0,正在打印中 -1, 开盖 -2, 缺纸 -3, 缺电 -4, 过热 -5
     */
    private int intState(byte[] data) {
        if (data == null || data.length == 0 || data.length > 2) {
            return -99;
        }
        if (data[0] == 0x00) {
            return 0;
        }
        if ((data[0] & 0x02) == 0x02) {
            return -2;
        }
        if ((data[0] & 0x04) == 0x04) {
            return -3;
        }
        if ((data[0] & 0x08) == 0x08) {
            return -4;
        }
        if ((data[0] & 0x10) == 0x10) {
            return -5;
        }
        if ((data[0] & 0x01) == 0x01) {
            return -1;
        }
        return -99;
    }

    /**
     * 打印机状态回调
     */
    TaskCallback statusCall = new TaskCallback() {
        @Override
        public void sendStatus(TaskCallBean bean) {
            if (bean.status != PrinterConstantPool.Status.OK) {
                log("打印机状态回调 ： 发送异常 >>> " + bean.msg);
            }
        }

        /**
         * 0x00 表示空闲状态，
         * 0x01 表示正在打印状态
         * 0x02表示纸仓打开状态，
         * 0x04 表示缺纸状态，
         * 0x08 表示电池缺电状态,
         * 0x10表示打印头过热状态
         * 0x00 indicates an idle state,
         * 0x01 indicates printing status
         * 0x02 represents the open state of the paper bin,
         * 0x04 indicates a paper shortage state,
         * 0x08 indicates a low battery state,
         * 0x10 indicates overheating of the print head
         */
        @Override
        public void readCall(TaskCallBean bean) {
            try {
                int state = intState(bean.data);
                if (state != 0 && state != -4 && state != -1) {
                    log("获取打印机状态异常 Get printer status exception");
                    return;
                }
                //准备就绪、低电量和打印中可以继续下发
                printerUtil.printer.addTask(Command.set_Density(printerUtil.density), true);//设置浓度
                // yxsdk.printer.addTask(Command.set_Speed(yxsdk.speed),true);//设置速度，部分设备可以设置速度

                int count = getEtValue(et, 1);

                printerUtil.paperW = getEtValue(paperWEt, 216);
                printerUtil.paperH = getEtValue(paperHEt, 279);

                boolean isSingle = true;//测试条件
                if (isSingle) {
                    //打印单图
                    printerUtil.print(getBitmap(R.raw.a4), count, paperType);
                } else {
                    //打印多张不同图片
                    List<Bitmap> list = new ArrayList<>();
                    list.add(getBitmap(R.raw.test1));
                    list.add(getBitmap(R.raw.test3));
                    list.add(getBitmap(R.raw.yuan));
                    printerUtil.print(list, count, paperType);
                }


            } catch (Exception e) {
                log(e.getMessage());
            }
        }

    };

    @NonNull
    private Bitmap getBitmap(int resId) {
        Bitmap bitmap = CommonUtil.getBitmap(resId);
//        bitmap = CommonUtil.zoomImg(bitmap, getEtValue(imgWEt, 12) * A80Util.dpi, getEtValue(imgHEt, 30) * A80Util.dpi);//不加这一行，就是原图打印，加了就是缩放
        return bitmap;
    }


    private int getEtValue(EditText et, int i) {
        try {
            return Integer.parseInt(et.getText().toString().trim());
        } catch (Exception e) {
            return i;
        }
    }

    private void setEt(int i) {
        try {
            String s = et.getText().toString().trim();
            int count = Integer.parseInt(s) + i;
            if (count < 1) {
                count = 1;
            }
            et.setText(String.valueOf(count));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
