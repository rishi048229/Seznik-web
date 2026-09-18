package com.ninestar.ninestarprinterdemo;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import java.util.List;

/**
 * @作者: 三三同学
 * @时间: 2024/9/25
 * @描述:
 */
public class BluetoothDeviceAdapter extends BaseAdapter {
    private final List<BluetoothDevices> devicesList;
    private final Context context;

    public BluetoothDeviceAdapter(List<BluetoothDevices> devicesList, Context context) {
        this.devicesList = devicesList;
        this.context = context;
    }

    @Override
    public int getCount() {
        return devicesList.size();
    }

    @Override
    public Object getItem(int position) {
        return devicesList.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        ViewHolder viewHolder = null;
        if (convertView == null) {
            viewHolder = new ViewHolder();
            convertView = LayoutInflater.from(context).inflate(R.layout.bluetooth_list_item, parent, false);
            viewHolder.tvName = convertView.findViewById(R.id.name);
            viewHolder.tvMacAddress = convertView.findViewById(R.id.macAddress);
            viewHolder.tvRssi = convertView.findViewById(R.id.rssi);
            convertView.setTag(viewHolder);
        }else {
            viewHolder = (ViewHolder) convertView.getTag();
        }
        BluetoothDevices item = (BluetoothDevices) getItem(position);
        viewHolder.tvName.setText(item.getBluetoothName());
        viewHolder.tvMacAddress.setText(item.getBluetoothMacAddress());
        viewHolder.tvRssi.setText(item.getBluetoothRssi());
        return convertView;
    }

    static class ViewHolder {
        TextView tvName;
        TextView tvMacAddress;
        TextView tvRssi;
    }
}
