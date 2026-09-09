package com.test.demo.ui;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.TextView;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.print.base.bean.PrinterConstantPool;
import com.print.base.bean.TaskCallBean;
import com.print.base.listen.ConnectListener;
import com.print.base.listen.TaskCallback;
import com.print.printer.Command;
import com.test.demo.R;
import com.test.demo.base.CommonUtil;
import com.test.demo.base.CustomProgress;
import com.test.demo.base.LogView;
import com.test.demo.print.PrintCallBack;
import com.test.demo.print.YXSDK;

import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.List;


public class PrintActivity extends AppCompatActivity implements View.OnClickListener {

    public Switch sv;
    public EditText et;
    private EditText imgWEt;
    private EditText imgHEt;
    private EditText paperWEt;
    private EditText paperHEt;
    private YXSDK yxsdk;
    private int paperType;
    private static LogView logView;

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
        setContentView(R.layout.activity_print);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        initView();
        if (!isFinishing()) {
            initListen();
        }
        if (isFinishing()) {
            return;
        }
        yxsdk = YXSDK.newInstance();
        if (yxsdk==null){
            finish();
            return;
        }
//        findViewById(R.id.paper_content).setVisibility(YXSDK.item.name.startsWith("380")?View.VISIBLE:View.GONE);
        yxsdk.setListen(connectListener, taskCallback, new PrintCallBack() {
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
        if (YXSDK.item == null) {
            finish();
            return;
        }

        TextView textView = findViewById(R.id.name_tv);
        textView.setText(YXSDK.item.name);

        logView = findViewById(R.id.log_content);
        logView.init();
        sv = findViewById(R.id.sv);

        et = findViewById(R.id.et);
        imgWEt = findViewById(R.id.img_width);
        imgHEt = findViewById(R.id.img_height);
        paperWEt = findViewById(R.id.paper_width);
        paperHEt = findViewById(R.id.paper_height);
    }

    public void initListen() {
        findViewById(R.id.back).setOnClickListener(this);
        findViewById(R.id.btn1).setOnClickListener(this);
        findViewById(R.id.btn2).setOnClickListener(this);
        findViewById(R.id.btn3).setOnClickListener(this);
        findViewById(R.id.add).setOnClickListener(this);
        findViewById(R.id.reduce).setOnClickListener(this);
        sv.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) {
                CustomProgress.showPD(this, "连接中...");
                yxsdk.connect();
            } else {
                yxsdk.disconnect();
            }
        });
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

    private int getEtValue(EditText et, int i) {
        try {
            int i1 = Integer.parseInt(et.getText().toString().trim());
            return i1;
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

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.back) {
            finish();
            return;
        }
        if (id == R.id.btn1) {
            getInfo();
        } else if (id == R.id.btn2) {
            addTask(Command.print_SELFTEST());
        } else if (id == R.id.add) {
            setEt(1);
        } else if (id == R.id.reduce) {
            setEt(-1);
        } else if (id == R.id.btn3) {
            //打印前获取打印机状态
            yxsdk.printer.addTask(Command.get_status(), "", false, statusCall);
        }
    }

    @Override
    protected void onDestroy() {
        logView = null;
        yxsdk.release();
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
        if (!yxsdk.printer.isConnect()) {
            return;
        }

        addTask(Command.get_deviceName());
        addTask(Command.get_btName());
        addTask(Command.get_version());
        addTask(Command.get_DENSITY());
        addTask(Command.get_SPEED());
        addTask(Command.get_shutTime());
        addTask(Command.get_btMAC());
        addTask(Command.get_SN());
        addTask(Command.get_status());
//        addTask(Command.get_battervol());
//        addTask(Command.get_paperType());//TSPL不用调用这个接口，否则会导致机器异常
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
        yxsdk.printer.addTask(command, "", true, null);

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
            sv.setChecked(true);
            CustomProgress.dismissPD();
        }

        @Override
        public void onConnetFailed(String s) {
            sv.setChecked(false);
            log("连接回调： onConnetFailed : " + s);
            CustomProgress.dismissPD();
        }

        @Override
        public void closed() {
            sv.setChecked(false);
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
                yxsdk.proactivelyReport(bean);  //系统主动上传,有主动上报的设备才需要处理
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
                    case PrinterConstantPool.Command.GET_SPEED:
                        try {
                            s = new String(bean.data, "gb2312");
                        } catch (UnsupportedEncodingException e) {
                            s = "未知";
                        }
                        System.out.println("速度："+s);
                        try {
                            int LID = bean.data[3] & 0xff;
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
                yxsdk.printer.addTask(Command.set_Density(yxsdk.density), true);//设置浓度
                // yxsdk.printer.addTask(Command.set_Speed(yxsdk.speed),true);//设置速度，部分设备可以设置速度

                int count = getEtValue(et, 1);

                yxsdk.paperW = getEtValue(paperWEt, 48);
                yxsdk.paperH = getEtValue(paperHEt, 30);

                boolean isSingle = true;//测试条件
                if (isSingle) {
                    //打印单图
                    yxsdk.print(getBitmap(R.raw.test1), count, paperType);
                } else {
                    //打印多张不同图片
                    List<Bitmap> list = new ArrayList<>();
                    list.add(getBitmap(R.raw.test1));
                    list.add(getBitmap(R.raw.test3));
                    list.add(getBitmap(R.raw.yuan));
                    yxsdk.print(list, count, paperType);
                }


            } catch (Exception e) {
                log(e.getMessage());
            }
        }

    };

    @NonNull
    private Bitmap getBitmap(int resId) {
        Bitmap bitmap = CommonUtil.getBitmap(resId);
        bitmap = CommonUtil.zoomImg(bitmap, getEtValue(imgWEt, 48) * yxsdk.dpi, getEtValue(imgHEt, 30) * yxsdk.dpi);//不加这一行，就是原图打印，加了就是缩放
        return bitmap;
    }
}
