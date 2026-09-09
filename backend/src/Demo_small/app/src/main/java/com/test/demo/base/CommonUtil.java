package com.test.demo.base;

import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.graphics.drawable.BitmapDrawable;

import com.print.base.utils.SDKUtils;
import com.test.demo.R;

import java.io.InputStream;

public class CommonUtil {

    public static String byte2Hex(byte[] inBytArr,String s, String s1) {
        if (inBytArr == null) {
            return "";
        }
        StringBuilder strBuilder = new StringBuilder();
        for (byte b : inBytArr) {
            String hex = Integer.toHexString(b & 0xFF);
            hex = hex.toUpperCase();
            if (hex.length() == 1) {
                hex = '0' + hex;
            }
            strBuilder.append(s + hex + s1);
        }
        return strBuilder.toString();
    }
    public static Bitmap zoomImg(Bitmap bm, int newWidth, int newHeight) {
        int width = bm.getWidth();
        int height = bm.getHeight();
        float scaleWidth = ((float) newWidth) / width;
        float scaleHeight = ((float) newHeight) / height;
        Matrix matrix = new Matrix();
        matrix.postScale(scaleWidth, scaleHeight);
        return Bitmap.createBitmap(bm, 0, 0, width, height, matrix, true);
    }
    public static boolean equals(String a, String b) {
        if (a != null) {
            return a.equals(b);
        }
        return b == null;
    }

    public static Bitmap getBitmap(int resId) {
        InputStream is = SDKUtils.getContext().getResources().openRawResource(resId);
        BitmapDrawable bmpDraw = new BitmapDrawable(is);
        return bmpDraw.getBitmap();
    }
}
