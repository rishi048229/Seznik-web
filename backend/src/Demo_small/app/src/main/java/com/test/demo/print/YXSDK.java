package com.test.demo.print;

import android.app.Application;
import android.graphics.Bitmap;

import com.print.base.bean.DeviceItem;
import com.print.base.bean.ImgData;
import com.print.base.bean.PrinterConstantPool;
import com.print.base.bean.TaskCallBean;
import com.print.base.listen.ConnectListener;
import com.print.base.listen.TaskCallback;
import com.print.base.utils.SDKUtils;
import com.print.printer.PrintImgHelper;
import com.print.printer.Printer;
import com.print.printer.PrinterManage;
import com.test.demo.base.CommonUtil;
import com.test.demo.ui.PrintActivity;

import java.util.ArrayList;
import java.util.List;

public abstract class YXSDK {
    public static DeviceItem item;
    public final Printer printer = PrinterManage.getInstance().getPrinter(PrinterConstantPool.SocketType.SPP);
    protected PrintImgHelper helper;
    protected List<String> imgNames = new ArrayList<>();
    protected int printIndex;//当前打印下标 Current printing index
    protected int sendIndex;//当前发送下标 Current sending index
    protected int allCount;
    public int density= 5;
    public int speed = 3;


    public int paperW;
    public int paperH;
    public int dpi = 8;
    public int paperType = PrinterConstantPool.PaperType.GAP;//缝隙纸
//    public int paperType = PrinterConstantPool.PaperType.BLACK;//黑标纸
    //    public static int paperType = PrinterConstantPool.PaperType.CONTINUOUS;//连续纸
    protected PrintCallBack callBack;

    /**
     * 初始化SDK
     */
    public static void setSDKKEY(Application application) {
        SDKUtils.init(application, "d2fnGqzf2Rs=");
    }

    public static YXSDK newInstance() {
        if (item == null || item.name == null) return null;
        item.modelKey = "Z212";
        return new Printer_Y50();
    }



    //设置监听对象
    public void setListen(ConnectListener listener, TaskCallback callback,PrintCallBack callBack) {
        helper = printer.getHelper();
        printer.setListener(listener);
        printer.setTaskCallback(callback);
        this.callBack = callBack;
    }


    /**
     * 连接蓝牙设备
     */
    public void connect() {
        printer.connect(item);
    }

    public void disconnect() {
        printer.disconnect();
    }

    public void release() {
        printer.release();
    }


    /**
     * 打印图片
     *
     * @param count     打印数量
     * @param paperType
     */
    public void print(Bitmap bitmap, int count, int paperType) {
        List<Bitmap> list = new ArrayList<>();
        list.add(bitmap);
        print(list, count, paperType);
    }

    public void print(List<Bitmap> bitmaps, int count, int paperType) {
        if (!printer.isConnect()) {
            return;
        }
        this.paperType = paperType;
        helper.stopPrint();
        List<ImgData> list = new ArrayList<>();
        for (int i = 0; i < bitmaps.size(); i++) {
            list.add(new ImgData("name" + i, bitmaps.get(i)));
        }
        helper.setImgDatas(128, list);//SDK提前缓存处理图片
        for (int i = 0; i < count; i++) {
            for (int j = 0; j < bitmaps.size(); j++) {
                imgNames.add("name" + j);//这里是用来打印SDK已缓存的对应的图片数据
            }
        }
        printIndex = 1;
        sendIndex = 0;
        allCount = imgNames.size();
        nextPrint();
        if (callBack!=null){
            callBack.startPrint();
            callBack.Printing(printIndex);
        }
    }

    protected abstract void nextPrint();

    /**
     * 停止打印
     * stop printing
     */
    public void stopPrint(String msg) {
        PrintActivity.log("停止打印 : " + msg);
        helper.stopPrint();
        printIndex = 0;
        sendIndex = 0;
        allCount = 0;
        imgNames.clear();
        callBack.stop(msg);
    }

    /*
     * 打印回调
     * printer status callback
     */
    protected TaskCallback printCall = new TaskCallback() {
        @Override
        public void sendStatus(TaskCallBean bean) {
            if (bean.status != PrinterConstantPool.Status.OK) {
                stopPrint("数据发送失败");
            }
        }

        @Override
        public void readCall(TaskCallBean bean) {
            if (!CommonUtil.equals(bean.type, PrinterConstantPool.Command.PRINT_IMG)) {
                return;
            }
            PrintActivity.log("打印回调： msg = " + bean.msg + ", HEX = " + CommonUtil.byte2Hex(bean.data, "", " "));

            if (bean.status == PrinterConstantPool.Status.TIMEOUT) {//打印超时
                stopPrint("打印超时");
                return;
            }


            if (bean.data == null) {
                return;
            }

            if (CommonUtil.equals(bean.type, PrinterConstantPool.ResultType.ERROR)) {//打印异常
                stopPrint("打印异常");
                return;
            }
            if (printIndex >= allCount) {
                stopPrint("完成打印");
                if (callBack!=null){
                    callBack.success();
                }
                return;
            }

            boolean b = false;
            if (paperType == PrinterConstantPool.PaperType.CONTINUOUS) {
                if (bean.data.length == 1 && bean.data[0] == (byte) 0XAA) {
                    b = true;
                } else if (bean.data.length == 3 && bean.data[2] == (byte) 0XAA) {
                    b = true;
                }
            } else {
                for (int j = 0; j < bean.data.length - 1; j++) {
                    if (bean.data[j] == (byte) 0X4F && bean.data[j + 1] == (byte) 0X4B) {
                        b = true;
                        break;
                    }
                }
            }

            if (b) {
                printIndex++;
                if (callBack!=null){
                    callBack.Printing(printIndex);
                }
                if (sendIndex < allCount && printer.isConnect()) {
                    nextPrint();
                }
            }

        }

        @Override
        public int timeOut() {
            return 30 * 1000;//可以根据需要改动 Can be modified as needed
        }
    };


    /**
     * 处理打印机主动上报逻辑
     */
    public void proactivelyReport(TaskCallBean bean) {
       /* if (bean.data[0] == (byte) 0XFF) {
            switch (bean.data[1]) {
                case 0X02://开盖
                case 0X01://缺纸
                    //demo这边执行停止打印任务操作，实际情况根据需求进行逻辑操作
                    Log.e("printer","设备主动上报：打印机缺纸");
                    stopPrint();
                    break;
                case 0X03:
                    Log.e("printer","设备主动上报：打印机过热");
                    break;
                case 0X04:
                    Log.e("printer","设备主动上报：打印机低电压");
                    break;
            }
        }*/
    }
}
