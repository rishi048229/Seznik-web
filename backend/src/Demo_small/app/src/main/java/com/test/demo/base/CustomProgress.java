package com.test.demo.base;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.widget.RelativeLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.test.demo.R;

public class CustomProgress extends Dialog {
    private static CustomProgress dialog;
    private static String msg = "";
    private TextView tv;

    private static int styleId = R.style.dialog;
    public static boolean cancelable = true;



    public CustomProgress(@NonNull Context context) {
        super(context, styleId);
    }

    public CustomProgress(@NonNull Context context, int themeResId) {
        super(context, themeResId);
    }

    protected CustomProgress(@NonNull Context context, boolean cancelable, @Nullable OnCancelListener cancelListener) {
        super(context, cancelable, cancelListener);
    }


    protected void onCreate(Bundle var1) {
        super.onCreate(var1);
        this.setCancelable(cancelable);//弹出后会点击屏幕或物理返回键，dialog不消失
        this.setCanceledOnTouchOutside(false);//弹出后会点击屏幕，dialog不消失；点击物理返回键dialog消失

        initViewTips();
    }

    private void initViewTips() {
        @SuppressLint("InflateParams") View view = this.getLayoutInflater().inflate(R.layout.layout_progress_tips_dialog1, null);
        tv = view.findViewById(R.id.m);
        if (msg == null || msg.isEmpty()) {
            tv.setVisibility(View.GONE);
        }else {
            tv.setText(msg);
            tv.setVisibility(View.VISIBLE);
        }
        this.setContentView(view);
        Window window = this.getWindow();
        if (window != null) {
            window.setLayout(RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.MATCH_PARENT);
            window.setGravity(Gravity.CENTER);
        }
    }


    @Override
    public boolean onKeyDown(int keyCode, @NonNull KeyEvent event) {
        if (cancelable && keyCode == KeyEvent.KEYCODE_BACK) {
            dismissPD();
        }
        return super.onKeyDown(keyCode, event);
    }



    public static boolean isShow() {
        return dialog != null && dialog.isShowing();
    }



    public static void showPD(Activity act, String s) {
        if (act == null) return;
        dismissPD();
        msg = s;
        dialog = new CustomProgress(act);
        dialog.show();
    }


    public static void updatePD(String s) {
        if (isShow() && dialog.tv != null) {
            dialog.tv.setText(s);
        }
    }

    public static void dismissPD() {
        try {
            if (isShow()) {
                dialog.dismiss();
            }
        } catch (Exception ignored) {
        } finally {
            if (dialog!=null){
                dialog.tv = null;
            }
            msg = "";
            dialog = null;
        }
    }

}

