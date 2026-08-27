package com.dothantech.demo;

import android.content.Context;
import android.graphics.Bitmap;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;

import java.util.List;

public class BitmapListAdapter extends BaseAdapter {
    private ImageView iv_bmp = null;
    private Context context;
    private List<Bitmap> printBitmaps;

    public BitmapListAdapter(Context context, List<Bitmap> printBitmaps) {
        this.context = context;
        this.printBitmaps = printBitmaps;
    }

    @Override
    public int getCount() {
        return printBitmaps.size();
    }

    @Override
    public Object getItem(int position) {
        return printBitmaps.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        if (convertView == null) {
            convertView = LayoutInflater.from(context).inflate(R.layout.bitmap_item, null);
        }
        iv_bmp = convertView.findViewById(R.id.iv_bmp);
        if (printBitmaps != null && printBitmaps.size() > position) {
            Bitmap bmp = printBitmaps.get(position);
            if (bmp != null) {
                iv_bmp.setImageBitmap(bmp);
            }
        }

        return convertView;
    }

}
