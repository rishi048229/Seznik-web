package com.test.demo.base;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.AttributeSet;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.widget.NestedScrollView;

import com.test.demo.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class LogView extends FrameLayout {

    public TextView tv;
    public NestedScrollView sv;
    private final Handler mHandler = new Handler(Looper.getMainLooper());
    private final SimpleDateFormat simpleDateFormat = new SimpleDateFormat("mm:ss SSS", Locale.CHINA);

    public LogView(Context context) {
        this(context, null);
    }

    public LogView(Context context, @Nullable AttributeSet attrs) {
        this(context, null, 0);
    }

    public LogView(Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    public void init() {
        tv = findViewById(R.id.console);
        sv = findViewById(R.id.scrollview);
        findViewById(R.id.clear).setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                tv.setText("");
            }
        });
    }

    public void log(String txt) {
        Log.e("test", "txt = " + txt);
        if (txt == null || txt.trim().isEmpty()) {
            return;
        }
        Activity act = (Activity) getContext();
        if (act == null || act.isFinishing()) {
            return;
        }
        String msg = simpleDateFormat.format(new Date()) + ": " + txt;
        String s = tv.getText().toString().trim();
        final String str;
        if (TextUtils.isEmpty(s)) {
            str = msg;
        } else if (s.length() > 5000) {
            str = "日志定时清理完成...\n\n" + msg;
        } else {
            str = s + "\n\n" + msg;
        }
        mHandler.post(new Runnable() {
            @Override
            public void run() {
                tv.setText(str);
                sv.post(new Runnable() {
                    public void run() {
                        sv.fullScroll(130);
                    }
                });
            }
        });
    }

}
