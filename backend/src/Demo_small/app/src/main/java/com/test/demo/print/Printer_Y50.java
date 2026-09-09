package com.test.demo.print;

import com.print.base.bean.PrinterConstantPool;
import com.print.printer.PrintImgHelper;
import com.test.demo.ui.PrintActivity;

/**
 * Y50 没有主动上报
 * 请使用已适配的纸张，否则打印可能出现异常
 */
public class Printer_Y50 extends YXSDK {

    protected void nextPrint() {
        if (sendIndex >= allCount) {
            return;
        }

        sendIndex++;
        PrintActivity.log("正在发送第" + sendIndex + "张图片数据");
        boolean isGap = paperType != PrinterConstantPool.PaperType.CONTINUOUS;
        PrintImgHelper.PrintBuild build = helper.build(printCall);
        build.enable();
        if (sendIndex == 1 && isGap) {
            build.backoffPaper();
        }
        build.paperType(paperType);//优化后的设置纸张类型接口
        build.printImg(imgNames.remove(0));
        if (isGap) {
            build.fixedPoint();
            if (sendIndex == allCount) {
                build.forwardPaper();
            }
        } else {
            build.printLinedots((sendIndex == allCount ? 20 : 5) * dpi);//走纸5mm
        }
        build.disenable();
        helper.run(build);
    }

}
