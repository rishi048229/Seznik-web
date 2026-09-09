package com.test.demo.ui;

import android.os.Bundle;
import android.view.View;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.print.base.bean.DeviceItem;
import com.print.base.bean.PrinterConstantPool;
import com.print.base.bean.TaskCallBean;
import com.print.base.listen.UpdateCallback;
import com.print.printer.Command;
import com.print.printer.Printer;
import com.print.printer.PrinterManage;
import com.test.demo.R;

public class UpdateActivity extends AppCompatActivity {
    public static DeviceItem item;
    public final Printer printer = PrinterManage.getInstance().getPrinter(PrinterConstantPool.SocketType.SPP);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_update);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

    }

    public void test(View view) {

    }


    /**
     * update dialog
     */
    public void showUpdateDialog() {
//        Command update = Command.update(PrinterConstantPool.Command.UPDATE_1_YC3121, readResources());
//        showProgress(0, "bin_ge288_106_250221_000001.BIN");
//        printer.addTask(update, "", false, new UpdateCallback() {
//            @Override
//            public void sendStatus(TaskCallBean bean) {
//                logView.log(bean.msg);
//            }
//
//            @Override
//            public void onProgress(int progress) {
//                showProgress(progress, null);
//            }
//        });
    }

//    private void showProgress(int progress, String fileName) {
//        if (progress == 0) {
//            String s1 = "正在使用升级文件《" + fileName + "》对打印机进行升级。\n注意: 升级过程中请勿以任何形式中断升级操作，否则打印机可能无法开机。";
//            pbMsg.setText(s1);
//            pbBG.setVisibility(View.VISIBLE);
//        } else if (progress == 100) {
//            pbBG.postDelayed(new Runnable() {
//                @Override
//                public void run() {
//                    pbBG.setVisibility(View.GONE);
//                }
//            }, 500);
//        }
//        pb.setProgress(progress);
//        String s = progress + "%";
//        pbNum.setText(s);
//    }
//
//    private byte[] readResources() {
//        try {
//            InputStream in = getResources().openRawResource(R.raw.bin_ge288_106_250221_000001);
//            int length = in.available();
//            byte[] buffer = new byte[length];
//            in.read(buffer);
//            in.close();
//            return buffer;
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//        return null;
//    }
}