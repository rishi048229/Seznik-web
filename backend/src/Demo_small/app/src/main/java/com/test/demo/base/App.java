package com.test.demo.base;

import android.app.Application;

import com.test.demo.print.YXSDK;

public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        YXSDK.setSDKKEY(this);
    }
}
