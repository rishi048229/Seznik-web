package com.dothantech.demo;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

/**
 * 用于填充设置打印参数界面的 Adapter
 */
public class PrintParamAdapter extends BaseAdapter {
    private TextView tv_param = null;
    private String[] paramArray = null;
    private Context context;

    public PrintParamAdapter(Context context, String[] array) {
        this.context = context;
        this.paramArray = array;
    }

    @Override
    public int getCount() {
        return paramArray.length;
    }

    @Override
    public Object getItem(int position) {
        return paramArray[position];
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        if (convertView == null) {
            convertView = LayoutInflater.from(context).inflate(R.layout.param_item, null);
        }
        tv_param = (TextView) convertView.findViewById(R.id.tv_param);
        String text = "";
        if (paramArray != null && paramArray.length > position) {
            text = paramArray[position];
        }
        tv_param.setText(text);

        return convertView;
    }
}
