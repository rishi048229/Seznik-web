package com.dothantech.demo;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.dothantech.printer.IDzPrinter;

import java.util.List;

/**
 * 用于填充打印机列表的Adapter
 */
public class DeviceListAdapter extends BaseAdapter {
    private TextView tv_name = null;
    private TextView tv_mac = null;

    private Context context;
    private List<IDzPrinter.PrinterAddress> printerList;

    public DeviceListAdapter(Context context) {
        this.context = context;
    }

    public void setData(List<IDzPrinter.PrinterAddress> printers) {
        this.printerList = printers;
    }

    @Override
    public int getCount() {
        if (null == printerList) {
            return 0;
        }

        return printerList.size();
    }

    @Override
    public Object getItem(int position) {
        return printerList.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        if (convertView == null) {
            convertView = LayoutInflater.from(context).inflate(R.layout.printer_item, null);
        }
        tv_name = convertView.findViewById(R.id.tv_device_name);
        tv_mac = convertView.findViewById(R.id.tv_macaddress);

        if (printerList != null && printerList.size() > position) {
            IDzPrinter.PrinterAddress printer = printerList.get(position);
            tv_name.setText(printer.shownName);
            tv_mac.setText(printer.macAddress);
        }

        return convertView;
    }
}
