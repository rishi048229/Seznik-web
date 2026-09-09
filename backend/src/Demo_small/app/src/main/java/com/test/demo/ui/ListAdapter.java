package com.test.demo.ui;

import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.print.base.bean.DeviceItem;
import com.test.demo.R;

import java.util.ArrayList;
import java.util.List;


public class ListAdapter extends RecyclerView.Adapter<ListAdapter.MyHolder> {


    public List<DeviceItem> devs = new ArrayList<>();
    private final Context context;
    private final CallBack call;

    public ListAdapter(@NonNull Context context,@NonNull CallBack call) {
        this.context = context;
        this.call = call;
    }

    public void clear(){
        this.devs.clear();
        notifyDataSetChanged();
    }
    public void addData(DeviceItem data) {
        this.devs.add(data);
        System.out.println("addData "+data.name+" : "+data.address);
        notifyItemInserted(devs.size());
        notifyItemRangeChanged(devs.size(), 1);
    }

    @NonNull
    @Override
    public MyHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        int density = (int) context.getResources().getDisplayMetrics().density;
        TextView tv = new TextView(context);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, density * 50);
        params.leftMargin = density*15;
        tv.setLayoutParams(params);
        tv.setGravity(Gravity.CENTER_VERTICAL);
        tv.setTextColor(Color.BLACK);
        tv.setTextSize(16);
        tv.setId(R.id.title);
        return new MyHolder(tv);
    }

    @Override
    public void onBindViewHolder(@NonNull MyHolder holder, int position) {
        try {
            DeviceItem data = devs.get(position);
            String s = data.name + " : " + data.address;
            System.out.println("onBindViewHolder "+data.name+" : "+data.address);
            holder.tv.setText(s);
            holder.tv.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    call.oncall(data);
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    @Override
    public int getItemCount() {
        return devs.size();
    }

    public class MyHolder extends RecyclerView.ViewHolder {

        private final TextView tv;

        public MyHolder(View view) {
            super(view);
            tv = view.findViewById(R.id.title);

        }
    }

    public interface CallBack {
        void oncall(DeviceItem dev);
    }
}