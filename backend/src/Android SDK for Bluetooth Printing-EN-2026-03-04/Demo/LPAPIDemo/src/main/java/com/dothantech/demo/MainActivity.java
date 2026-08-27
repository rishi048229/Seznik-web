package com.dothantech.demo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.content.DialogInterface;
import android.content.DialogInterface.OnClickListener;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.os.Handler;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.dothantech.lpapi.LPAPI;
import com.dothantech.lpapi.LPAPI.BarcodeType;
import com.dothantech.printer.IDzPrinter;
import com.dothantech.printer.IDzPrinter.PrintParamName;
import com.dothantech.printer.IDzPrinter.PrintProgress;
import com.dothantech.printer.IDzPrinter.PrinterAddress;
import com.dothantech.printer.IDzPrinter.PrinterState;
import com.dothantech.printer.IDzPrinter.ProgressInfo;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@SuppressLint("InflateParams")
public class MainActivity extends Activity {

    private LPAPI api;

    // Used for handling various notification messages and refreshing the interface. handler
    private final Handler mHandler = new Handler();

    // All required control objects
    private Button btnConnectDevice = null;
    private Button btnGapType = null;
    private Button btnGapLength = null;
    private Button btnPrintDensity = null;
    private Button btnPrintSpeed = null;
    private Button btnPrintText = null;
    private Button btnPrintText1DBarcode = null;
    private Button btnPrintText2DBarcode = null;
    private Button btnPrintBitmap = null;
    private Button btnPrintLabel = null;
    private Button btnPrintMultipleLabel = null;
    private EditText et1 = null;
    private EditText et2 = null;

    // Print parameters
    private int gapType = -1;
    private int gapLength = 3;
    private int printDensity = -1;
    private int printSpeed = -1;
    private int printCopiesNum = 1; // Number of print copies
    private int currentPrintCopiedNum = 0; // Current number of copies

    // Print data
    private String defaultText1;
    private String defaultText2;
    private String default1dBarcode = "1234567890";
    private String default2dBarcode = "http://www.dothantech.com/";

    // List of arrays and sets for filling
    private String[] printDensityList;
    private String[] printSpeedList;
    private String[] gapTypeList;
    private final int[] bitmapOrientations = new int[]{0, 90, 0, 90,};

    private final List<Bitmap> printBitmaps = new ArrayList<>();

    // Status Prompt Box
    private AlertDialog stateAlertDialog = null;
    // Printer pop-up
    private DeviceListAdapter printerAdapter = null;
    private List<PrinterAddress> discoveredPrinterList = null;

    //********************************************************************************************************************************************
    // DzPrinter Related to printing and connectivity functions
    //********************************************************************************************************************************************

    // LPAPI Callback functions related to printer operations.
    private final LPAPI.Callback mCallback = new LPAPI.Callback() {

        //****************************************************************************************************************************************
        // All callback functions are invoked within the printing thread. Therefore, if you need to refresh the UI, you need send a message to the UI's main thread to avoid cumbersome operations like mutual exclusion.
        //****************************************************************************************************************************************

        // Called when the printer connection status changes
        @Override
        public void onStateChange(PrinterAddress arg0, PrinterState arg1) {
            final PrinterAddress printer = arg0;
            switch (arg1) {
                case Connected:
                case Connected2:
                    // Printer connection successful. Send notification. Refresh interface prompt.
                    mHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            onPrinterConnected(printer);
                        }
                    });
                    break;

                case Disconnected:
                    // Printer connection failed or disconnected. Send notification and refresh interface prompt.
                    mHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            onPrinterDisconnected();
                        }
                    });
                    break;

                default:
                    break;
            }
        }

        // Called when the Bluetooth adapter status changes
        @Override
        public void onProgressInfo(ProgressInfo arg0, Object arg1) {
        }

        @Override
        public void onPrinterDiscovery(PrinterAddress printerAddress, Object o) {
            // TODO This callback function receives the printers that have been discovered.
            onPrinterDiscovered(printerAddress);
        }

        // The progress of printing labels changes when called.
        @Override
        public void onPrintProgress(PrinterAddress address, IDzPrinter.PrintData bitmapData, PrintProgress progress, Object addiInfo) {
            switch (progress) {
                case Success:
                    if (printCopiesNum > 1) {
                        currentPrintCopiedNum++;
                        if (currentPrintCopiedNum < printCopiesNum) {
                            // Label printing successful. Send notification. Refresh interface prompt
                            mHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, currentPrintCopiedNum + " / " + printCopiesNum + getResources().getString(R.string.str_label_print_successful), Toast.LENGTH_SHORT).show();
                                }
                            });
                            // Only printMultipleLabelOnClick () supports multi-copy printing in this demo, so it is directly called again here.
                            printMultipleLabelOnClick();
                            return;
                        } else {
                            // Multi-copy print completed. Page number reset to initial state.
                            printCopiesNum = 1;
                            currentPrintCopiedNum = 0;
                        }
                    }
                    // Label printed successfully. Notification sent, UI refreshed.
                    mHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            onPrintSuccess();
                        }
                    });
                    break;

                case Failed:
                    if (printCopiesNum > 1) {
                        // Print failed; page number reset to initial state.
                        printCopiesNum = 1;
                        currentPrintCopiedNum = 0;
                    }
                    // Label print failed; send notification and refresh UI prompt.
                    mHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            onPrintFailed();
                        }
                    });
                    break;

                default:
                    break;
            }
        }
    };


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        initData();
        //Initialize the interface
        initialView();

        // Call the init method of the LPAPI object for initialization.
        this.api = LPAPI.Factory.createInstance(mCallback);
        // Request permission
        requestPermission();
    }

    private void initData() {
        defaultText1 = getResources().getString(R.string.str_ThanMore_Network_Technology) + "\nDzPrinterDemo";
        defaultText2 = getResources().getString(R.string.str_ThanMore_Network_Technology) + "\nDzPrinterDemo";
        printDensityList = new String[]{
                getResources().getString(R.string.str_normal),
                "1 (" + getResources().getString(R.string.str_density_lightest) + ")",
                "2",
                "3 (" + getResources().getString(R.string.str_density_lighter) + ")",
                "4",
                "5",
                "6 (" + getResources().getString(R.string.str_normal) + ")",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12(" + getResources().getString(R.string.str_density_darker) + ")",
                "13",
                "14",
                "15",
                "16",
                "17",
                "18",
                "19",
                "20(" + getResources().getString(R.string.str_density_darkest) + ")",
        };
        printSpeedList = new String[]{
                getResources().getString(R.string.str_normal),
                "1 (" + getResources().getString(R.string.str_speed_slowest) + ")",
                "2 (" + getResources().getString(R.string.str_speed_slower) + ")",
                "3 (" + getResources().getString(R.string.str_normal) + ")",
                "4 (" + getResources().getString(R.string.str_speed_faster) + ")",
                "5 (" + getResources().getString(R.string.str_speed_fastest) + ")",
        };
        gapTypeList = new String[]{
                getResources().getString(R.string.str_normal),
                getResources().getString(R.string.str_gap_type_receipt),
                getResources().getString(R.string.str_gap_type_positioning_hole),
                getResources().getString(R.string.str_gap_type_label),
                getResources().getString(R.string.str_gap_type_cardstock),
        };
    }

    @Override
    protected void onDestroy() {
        // When the application exits, call the quit method of the LPAPI object to disconnect the printer
        api.quit();
        super.onDestroy();
    }

    // Click event for each item in the printer list
    private class DeviceListItemClicker implements OnClickListener {
        @Override
        public void onClick(DialogInterface dialog, int which) {
            api.stopDiscovery();
            PrinterAddress printer = discoveredPrinterList.get(which);
            if (printer != null) {
                String printerName = api.getPrinterName();

                if (api.getPrinterState().group() == 2 && TextUtils.equals(printerName, printer.shownName)) {
                    // TODO If the currently connected printer is clicked again: disconnect it, ignore the click event, or prohibit reconnection via code.
                    Toast.makeText(MainActivity.this, getResources().getString(R.string.str_current_printer_already_connected), Toast.LENGTH_LONG).show();
                    return;
                } else {
                    // Connect selected printer
                    if (api.openPrinterByAddress(printer)) {
                        // Printer connection request submitted successfully; refresh UI prompt.
                        onPrinterConnecting(printer, true);
                        return;
                    }
                }
            }

            // Printer connection failed; refresh UI prompt.
            onPrinterDisconnected();
        }
    }

    //Check if the current printer is connected
    private boolean isPrinterConnected() {
        // Call LPAPI's getPrinterState() to get the current printer's connection status.
        PrinterState state = api.getPrinterState();

        // Printer unconnected
        if (state == null || state.equals(PrinterState.Disconnected)) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_please_connect_printer_first), Toast.LENGTH_SHORT).show();
            return false;
        }

        // Printer is connecting
        if (state.equals(PrinterState.Connecting)) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_connecting_please_wait), Toast.LENGTH_SHORT).show();
            return false;
        }

        // Printer is connected
        return true;
    }

    // Retrieve the print parameters required for printing. If not configured, the default printer settings will be used.
    private Bundle getPrintParam(int copies, int orientation) {
        Bundle param = new Bundle();

        // Paper type
        if (gapType >= 0) {
            param.putInt(PrintParamName.GAP_TYPE, gapType);
        }
        // Gap length
        if (gapLength >= 0) {
            param.putInt(PrintParamName.GAP_LENGTH, gapLength);
        }
        // Print darkness
        if (printDensity >= 0) {
            param.putInt(PrintParamName.PRINT_DENSITY, printDensity);
        }

        // Print speed
        if (printSpeed >= 0) {
            param.putInt(PrintParamName.PRINT_SPEED, printSpeed);
        }

        // Print page rotation angle
        if (orientation != 0) {
            param.putInt(PrintParamName.PRINT_DIRECTION, orientation);
        }

        //Print copies
        if (copies > 1) {
            param.putInt(PrintParamName.PRINT_COPIES, copies);
        }

        return param;
    }

    //********************************************************************************************************************************************
    // LPAPI Draw and print
    //********************************************************************************************************************************************

    // Print text
    private boolean printText(String text) {
        // Start drawing task and input parameters (page width, page height)
        api.startJob(48, 50, 0);

        // Start drawing a page and draw a text string
        // Input parameters (text string to be drawn, horizontal position, vertical position of top left corner of drawn text box, horizontal width, vertical height of drawn text box, text size, font style)
        api.drawText(text, 4, 5, 40, 40, 4);

        // End the drawing task and submit for printing (follow the printer settings, recommend to use this method if no special requirements)
        return api.commitJob();
    }

    // Print text barcode
    private List<Bitmap> printText1DBarcode(String text, String onedBarcde) {

        // Start the drawing task and input parameters (page width, page height)
        api.startJob(48, 48, 90);

        // Start drawing a page and draw a text string
        // Input parameters (text string to be drawn, horizontal position, vertical position of top left corner of drawn text box, horizontal width, vertical height of drawn text box, text size, font style)
        api.drawText(text, 4, 4, 40, 20, 4);

        // Set the drawn object content to rotate 180 degrees
        api.setItemOrientation(180);

        // Draw a barcode with its content rotated 180 degrees,
        // Input parameters (barcode data, horizontal position, vertical position of top left corner of drawn barcode, horizontal width, vertical height of drawn barcode)
        api.draw1DBarcode(onedBarcde, BarcodeType.AUTO, 4, 25, 40, 15, 3);

        // End draw task
        api.endJob();

        // Get the image data of the completed task page
        return api.getJobPages();
    }

    // Print QR Code
    private boolean print2dBarcode(String twodBarcode, Bundle param) {
        // Start drawing task, input parameters (page width, page height)
        api.startJob(48, 50, 0);

        // Start draw a page, draw QR Code
        // Input parameters (QR Code data, horizontal position, vertical position of top left corner of drawn QR Code, width of the QR code (height is the same as width))
        api.draw2DQRCode(twodBarcode, 9, 10, 30);

        // End draw task and submit for printing (print quality, gap type, print darkness, and print speed, will use the values configured in the application)
        return api.commitJobWithParam(param);
    }

    // Print image
    private boolean printBitmap(Bitmap bitmap, Bundle param) {
        // Print
        return api.printBitmap(bitmap, param);
    }

    //********************************************************************************************************************************************
    //  Interface related
    //********************************************************************************************************************************************

    // Initialize the interface
    private void initialView() {
        String[] testPicName = new String[]{"test1.png", "test2.png", "test3.png", "test4.png",};

        btnConnectDevice = findViewById(R.id.btn_printer);
        btnConnectDevice.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                selectPrinterOnClick();
            }
        });
        btnGapType = findViewById(R.id.btn_gaptype);
        btnGapType.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                gapTypeOnClick();
            }
        });
        btnGapLength = findViewById(R.id.btn_gaplength);
        btnGapLength.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                gapLengthOnClick();
            }
        });
        btnPrintDensity = findViewById(R.id.btn_printdensity);
        btnPrintDensity.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printDensityOnClick();
            }
        });
        btnPrintSpeed = findViewById(R.id.btn_printspeed);
        btnPrintSpeed.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printSpeedOnClick();
            }
        });
        btnPrintText = findViewById(R.id.btn_printtext);
        btnPrintText.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printTextOnClick();
            }
        });
        btnPrintText1DBarcode = findViewById(R.id.btn_printtext1dbarcode);
        btnPrintText1DBarcode.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printText1DBarcodeOnClick();
            }
        });
        btnPrintText2DBarcode = findViewById(R.id.btn_print2dbarcode);
        btnPrintText2DBarcode.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                print2DBarcodeOnClick();
            }
        });
        btnPrintBitmap = findViewById(R.id.btn_printbitmap);
        btnPrintBitmap.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printBitmapOnClick();
            }
        });
        btnPrintLabel = findViewById(R.id.btn_printLabel);
        btnPrintLabel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printLabelOnClick();
            }
        });
        btnPrintMultipleLabel = findViewById(R.id.btn_printMultipleLabel);
        btnPrintMultipleLabel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printCopiesNum = 3;
                currentPrintCopiedNum = 0;
                printMultipleLabelOnClick();
            }
        });
        refreshPrintParamView();

        // Load test image file
        for (String str : testPicName) {
            try {
                InputStream is = getAssets().open(str);
                Bitmap bmp = BitmapFactory.decodeStream(is);
                if (bmp != null) {
                    printBitmaps.add(bmp);
                }
                try {
                    is.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            } catch (IOException e1) {
                e1.printStackTrace();
            }
        }
    }

    // Button event for selecting a printer
    public void selectPrinterOnClick() {
        BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
        if (btAdapter == null) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_not_support_bluetooth), Toast.LENGTH_SHORT).show();
            return;
        }
        if (!btAdapter.isEnabled()) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_bluetooth_adapter_not_turn_on), Toast.LENGTH_SHORT).show();
            return;
        }
        // TODO Start searching printer
        api.discovery();
        discoveredPrinterList = new ArrayList<>();
        new AlertDialog.Builder(MainActivity.this).setTitle(getResources().getString(R.string.str_select_the_discovered_device)).setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(DialogInterface dialog) {
                api.stopDiscovery();
            }
        }).setAdapter(printerAdapter = new DeviceListAdapter(MainActivity.this), new DeviceListItemClicker()).show();
    }

    // Button event for setting the gap type
    public void gapTypeOnClick() {
        new AlertDialog.Builder(MainActivity.this).setTitle(getResources().getString(R.string.str_set_gap_type)).setAdapter(new PrintParamAdapter(MainActivity.this, gapTypeList), new GapTypeItemClicker()).show();
    }

    // Button event for setting print quality
    public void gapLengthOnClick() {
        if (!isPrinterConnected()) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_please_connect_printer_first_2), Toast.LENGTH_LONG).show();
            return;
        }
        // Show print data settings interface
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle(getResources().getString(R.string.str_set_gap_length));
        builder.setView(initView(getResources().getString(R.string.str_gap_length) + ":", String.valueOf(gapLength)));
        builder.setPositiveButton(getResources().getString(R.string.str_ok), new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // Obtain the print data and perform printing
                String length = et1.getText().toString();
                try {
                    gapLength = Integer.parseInt(length);
                } catch (Throwable e) {
                    e.printStackTrace();
                }
                btnGapLength.setText(getResources().getString(R.string.str_gap_length) + "：\n" + gapLength);
                api.setPrintPageGapLength(gapLength);
            }
        });
        builder.setNegativeButton(getResources().getString(R.string.str_cancel), null);
        builder.show();
    }

    // Button event for setting print darkness
    public void printDensityOnClick() {
        if (!isPrinterConnected()) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_please_connect_printer_first_2), Toast.LENGTH_LONG).show();
            return;
        }
        new AlertDialog.Builder(MainActivity.this).setTitle(getResources().getString(R.string.str_set_print_darkness)).setAdapter(new PrintParamAdapter(MainActivity.this, printDensityList), new PrintDensityItemClicker()).show();
    }

    // Button event for setting print speed
    public void printSpeedOnClick() {
        if (!isPrinterConnected()) {
            Toast.makeText(MainActivity.this, getResources().getString(R.string.str_please_connect_printer_first_2), Toast.LENGTH_LONG).show();
            return;
        }
        new AlertDialog.Builder(MainActivity.this).setTitle(getResources().getString(R.string.str_set_print_speed)).setAdapter(new PrintParamAdapter(MainActivity.this, printSpeedList), new PrintSpeedItemClicker()).show();
    }

    // Button event for printing text
    public void printTextOnClick() {
        // Show print data settings interface
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle(getResources().getString(R.string.str_print_text));
        builder.setView(initView(getResources().getString(R.string.str_text_data) + "：", defaultText1));
        builder.setPositiveButton(getResources().getString(R.string.str_ok), new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // Obtain print data and perform printing
                defaultText1 = et1.getText().toString();
                if (isPrinterConnected()) {
                    if (printText(defaultText1)) {
                        onPrintStart();
                    } else {
                        onPrintFailed();
                    }
                }
            }
        });
        builder.setNegativeButton(getResources().getString(R.string.str_cancel), null);
        builder.show();
    }

    // Button event for printing text barcode
    public void printText1DBarcodeOnClick() {
        // Show print data settings interface
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle(getResources().getString(R.string.str_text_barcode));
        builder.setView(init1DBarcodeParamView(defaultText2, default1dBarcode));
        builder.setPositiveButton(getResources().getString(R.string.str_ok), new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                //  Obtain print data and perform printing
                defaultText2 = et1.getText().toString();
                default1dBarcode = et2.getText().toString();
                if (isPrinterConnected()) {
                    List<Bitmap> bitmaps = printText1DBarcode(defaultText1, default1dBarcode);
                    if (null != bitmaps && bitmaps.size() > 0) {
                        showPreviewBitmapDialog(bitmaps.get(0));
                    }
                }
            }
        });
        builder.setNegativeButton(getResources().getString(R.string.str_cancel), null);
        builder.show();
    }

    // Button event for printing QR Code
    public void print2DBarcodeOnClick() {
        // Show print data settings interface
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle(getResources().getString(R.string.str_print_qrcode));
        builder.setView(initView(getResources().getString(R.string.str_qrcode_data) + "：", default2dBarcode));
        builder.setPositiveButton(getResources().getString(R.string.str_ok), new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                printCopiesNum = 1;
                // Obtain print data and perform printing
                default2dBarcode = et1.getText().toString();
                if (isPrinterConnected()) {
                    if (print2dBarcode(default2dBarcode, getPrintParam(1, 0))) {
                        onPrintStart();
                    } else {
                        onPrintFailed();
                    }
                }
            }
        });
        builder.setNegativeButton(getResources().getString(R.string.str_cancel), null);
        builder.show();
    }

    // Button event for printing image
    public void printBitmapOnClick() {
        new AlertDialog.Builder(MainActivity.this).setTitle(getResources().getString(R.string.str_print_image)).setAdapter(new BitmapListAdapter(MainActivity.this, printBitmaps), new BitmapListItemClicker()).show();
    }

    // Print the custom template with the following style：
    /*
     * --------------------------------------------------
     * |                Thanmore Technology Fixed Asset              |
     * --------------------------------------------------
     * |Asset No. | 1234567890123456789                  |
     * --------------------------------------------------
     * |Asset Name |  Laptop                         |
     * --------------------------------------------------
     * |Used by   | Zhangsan                 |              |
     * ----------------------------------      QR Code
     * |Purchase Date | 2025/10/17        |              |
     * --------------------------------------------------
     */
    public void printLabelOnClick() {
        double labelWidth = 60;                                                 // Template width
        double labelHeight = 40;                                                // Template height
        double marginOut = 2;                                                   // Table outer margin
        double marginIn = 0.5;                                                  // Table cell padding
        double tableWidth = labelWidth - marginOut * 2;                         // Table width
        double tableHeight = labelHeight - marginOut * 2;                       // Table height
        double tableRowHeight = tableHeight / 5;                                // Table row height
        double tableColWidth3 = tableRowHeight * 2;                             // Table 3rd column width
        double tableColWidth1 = 15;                                             // Table first column width
        double tableColWidth2 = tableWidth - tableColWidth3 - tableColWidth1;   // Table second column width
        int rotation = 90;                                                      // Clockwise rotation angle for final printing
        double lineWidth = 0.5;                                                 // Line width
        boolean shownLine = true;                                               // Whether to display table lines and outer borders
        double fontSize = 3.5;                                                  // Font size (unit: mm)
        double qrcodeWidth = tableRowHeight * 2 - 3;                           // QR code width and height

        // Start print job
        api.startJob(labelWidth, labelHeight, rotation);
        if (shownLine) {
            // Draw rectangle
            api.drawRectangle(marginOut, marginOut, tableWidth, tableHeight, lineWidth);
            // Draw inner table lines
            // Horizontal line
            api.drawLine(marginOut, marginOut + tableRowHeight * 1, labelWidth - marginOut - lineWidth * 0.5, marginOut + tableRowHeight * 1, lineWidth);
            api.drawLine(marginOut, marginOut + tableRowHeight * 2, labelWidth - marginOut - lineWidth * 0.5, marginOut + tableRowHeight * 2, lineWidth);
            api.drawLine(marginOut, marginOut + tableRowHeight * 3, labelWidth - marginOut - lineWidth * 0.5, marginOut + tableRowHeight * 3, lineWidth);
            api.drawLine(marginOut, marginOut + tableRowHeight * 4, labelWidth - marginOut - lineWidth * 0.5 - tableColWidth3, marginOut + tableRowHeight * 4, lineWidth);
            // Vertical line
            api.drawLine(marginOut + tableColWidth1, marginOut + tableRowHeight * 1, marginOut + tableColWidth1, labelHeight - marginOut - lineWidth * 0.5, lineWidth);
            api.drawLine(marginOut + tableColWidth1 + tableColWidth2, marginOut + tableRowHeight * 3, marginOut + tableColWidth1 + tableColWidth2, labelHeight - marginOut - lineWidth * 0.5, lineWidth);
        }
        // Drawn text will be horizontally centered within the set drawing area (left-aligned by default if not set).
        api.setItemHorizontalAlignment(1);
        // Drawn text is horizontally centered in the set drawing area (top-aligned by default if not set).
        api.setItemVerticalAlignment(1);
        // Title (Bold font)
        api.drawTextRegular("Thanmore Technology Fixed Asset", marginOut + marginIn, marginOut + marginIn, tableWidth - marginIn * 2, tableRowHeight - marginIn * 2, fontSize, 1);
        // Draw left subtitle (font not bold)
        double cellContentWidth = tableColWidth1 - marginIn * 2; // Title text width
        double cellContentHeight = tableRowHeight - marginIn * 2; // Title text height
        api.drawTextRegular("Asset No", marginOut + marginIn, marginOut + marginIn + tableRowHeight * 1, cellContentWidth, cellContentHeight, fontSize, 0);
        api.drawTextRegular("Asset Name", marginOut + marginIn, marginOut + marginIn + tableRowHeight * 2, cellContentWidth, cellContentHeight, fontSize, 0);
        api.drawTextRegular("Used by", marginOut + marginIn, marginOut + marginIn + tableRowHeight * 3, cellContentWidth, cellContentHeight, fontSize, 0);
        api.drawTextRegular("Purchase Date", marginOut + marginIn, marginOut + marginIn + tableRowHeight * 4, cellContentWidth, cellContentHeight, fontSize, 0);
        // Draw the content corresponding to the subtitle (normal font)
        api.setItemHorizontalAlignment(0); // Drawn text is left-aligned horizontally within the set drawing area
        double cellContentWidth1 = tableWidth - tableColWidth1 - marginIn * 2;
        double cellContentWidth2 = tableColWidth2 - marginIn * 2;
        api.drawTextRegular("1234567890123456789", marginOut + tableColWidth1 + marginIn, marginOut + marginIn + tableRowHeight * 1, cellContentWidth1, cellContentHeight, fontSize, 0);
        api.drawTextRegular("Laptop", marginOut + tableColWidth1 + marginIn, marginOut + marginIn + tableRowHeight * 2, cellContentWidth1, cellContentHeight, fontSize, 0);
        api.drawTextRegular("Zhangsan", marginOut + tableColWidth1 + marginIn, marginOut + marginIn + tableRowHeight * 3, cellContentWidth2, cellContentHeight, fontSize, 0);
        api.drawTextRegular("2025/10/17", marginOut + tableColWidth1 + marginIn, marginOut + marginIn + tableRowHeight * 4, cellContentWidth2, cellContentHeight, fontSize, 0);
        // Draw QR Code
        api.draw2DQRCode("QR Code content", labelWidth - marginOut - qrcodeWidth - 1.5, labelHeight - marginOut - qrcodeWidth - 1.5, qrcodeWidth);
        api.commitJob();
    }

    public void printMultipleLabelOnClick() {
        printLabelOnClick();
    }

    // Refresh the display content of each button
    private void refreshPrintParamView() {
        btnConnectDevice.setText("");
        btnGapType.setText(getResources().getString(R.string.str_print_gap_type) + "：\n" + gapTypeList[gapType + 1]);
        btnGapLength.setText(getResources().getString(R.string.str_print_gap_length) + "：\n" + gapLength);
        btnPrintDensity.setText(getResources().getString(R.string.str_print_darkness) + "：\n" + printDensityList[printDensity + 1]);
        btnPrintSpeed.setText(getResources().getString(R.string.str_print_speed) + "：\n" + printSpeedList[printSpeed + 1]);
    }

    // Show print preview  image
    private void showPreviewBitmapDialog(final Bitmap bitmap) {
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle(getResources().getString(R.string.str_print_preview));
        ImageView imageView = new ImageView(MainActivity.this);
        if (null != bitmap) {
            imageView.setImageBitmap(bitmap);
        }
        builder.setView(imageView);
        builder.setPositiveButton(getResources().getString(R.string.str_ok), new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                api.printBitmap(bitmap, null);
            }
        });
        builder.setNegativeButton(getResources().getString(R.string.str_cancel), null);
        builder.show();
    }

    // Action when the printer connection request is submitted successfully
    private void onPrinterConnecting(PrinterAddress printer, boolean showDialog) {
        // Connection request to printer submitted successfully. Refresh interface prompt.
        String txt = printer.shownName;
        if (TextUtils.isEmpty(txt)) {
            txt = printer.macAddress;
        }
        txt = String.format(getResources().getString(R.string.str_connecting_printer), txt);
        if (showDialog) {
            showStateAlertDialog(txt);
        }
        btnConnectDevice.setText(txt);
    }

    // Action on successful printer connection
    private void onPrinterConnected(PrinterAddress printer) {
        // When the printer is connected successfully, refresh the interface prompt and save the relevant information
        clearAlertDialog();
        Toast.makeText(MainActivity.this, getResources().getString(R.string.str_printer_connected_successfully), Toast.LENGTH_SHORT).show();
        // Call the getPrinterInfo method of the LPAPI object to obtain the information of the currently connected printer
        String txt = getResources().getString(R.string.str_printer) + "：";
        txt += api.getPrinterInfo().deviceName + "\n";
        txt += api.getPrinterInfo().deviceAddress;
        btnConnectDevice.setText(txt);
    }

    // Actions when the printer connection operation submission fails, the printer connection fails, or the connection is disconnected
    private void onPrinterDisconnected() {
        // When printer connection submission fails, connection fails, or the connection is lost, refresh the UI prompt.
        clearAlertDialog();

        Toast.makeText(MainActivity.this, getResources().getString(R.string.str_failed_connect_printer), Toast.LENGTH_SHORT).show();
        // Restore printer parameters to default after disconnection
        gapType = -1;
        gapLength = 3;
        printDensity = -1;
        printSpeed = -1;
        refreshPrintParamView();
    }

    // Action on starting label printing
    private void onPrintStart() {
        // When starting label printing, refresh the UI prompt.
        showStateAlertDialog(getResources().getString(R.string.str_printing_label));
    }

    // Action on label print success
    private void onPrintSuccess() {
        // When label printing succeeds, refresh the UI prompt.
        clearAlertDialog();
        Toast.makeText(MainActivity.this, getResources().getString(R.string.str_label_print_successful), Toast.LENGTH_SHORT).show();
    }

    // Action on print request failure or label printing failure
    private void onPrintFailed() {
        // When the print request fails or label printing fails, refresh the UI prompt.
        clearAlertDialog();
        Toast.makeText(MainActivity.this, getResources().getString(R.string.str_label_printed_failed), Toast.LENGTH_SHORT).show();
    }

    // Show status prompts for connection and printing
    private void showStateAlertDialog(String str) {
        if (stateAlertDialog != null && stateAlertDialog.isShowing()) {
            stateAlertDialog.setTitle(str);
        } else {
            stateAlertDialog = new AlertDialog.Builder(MainActivity.this).setCancelable(false).setTitle(str).show();
        }
    }

    // Clear connection and print status prompts
    private void clearAlertDialog() {
        if (stateAlertDialog != null && stateAlertDialog.isShowing()) {
            stateAlertDialog.dismiss();
        }
        stateAlertDialog = null;
    }

    private void onPrinterDiscovered(PrinterAddress address) {
        if (null == address) {
            return;
        }

        if (null == discoveredPrinterList) {
            discoveredPrinterList = new ArrayList<>();
        } else {
            List<PrinterAddress> list = new ArrayList<>(discoveredPrinterList);
            for (PrinterAddress address1 : list) {
                // If printer exists in search list: replace with new one or return directly
                if (null != address1 && TextUtils.equals(address1.shownName, address.shownName)) {
                    return;
                }
            }
        }

        discoveredPrinterList.add(address);
        new Handler(getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                printerAdapter.setData(discoveredPrinterList);
                printerAdapter.notifyDataSetChanged();
            }
        });
    }

    // Click event for each print darkness setting item
    private class PrintDensityItemClicker implements OnClickListener {
        @Override
        public void onClick(DialogInterface dialog, int which) {
            printDensity = which - 1;
            btnPrintDensity.setText(getResources().getString(R.string.str_print_darkness) + "：\n" + printDensityList[which]);
            api.setPrintDarkness(printDensity);
        }
    }

    // Click event for each print speed setting item
    private class PrintSpeedItemClicker implements OnClickListener {
        @Override
        public void onClick(DialogInterface dialog, int which) {
            printSpeed = which - 1;
            btnPrintSpeed.setText(getResources().getString(R.string.str_print_speed) + "：\n" + printSpeedList[which]);
            api.setPrintSpeed(printSpeed);
        }
    }

    // Click event for each gap type setting item
    private class GapTypeItemClicker implements OnClickListener {
        @Override
        public void onClick(DialogInterface dialog, int which) {
            gapType = which - 1;
            btnGapType.setText(getResources().getString(R.string.str_print_gap_type) + "：\n" + gapTypeList[which]);
            api.setPrintPageGapType(gapType);
        }
    }

    // Click event for each item in the sample image list of print images
    private class BitmapListItemClicker implements OnClickListener {
        @Override
        public void onClick(DialogInterface dialog, int which) {
            if (isPrinterConnected()) {
                int orientation = 0;
                if (bitmapOrientations.length > which) {
                    orientation = bitmapOrientations[which];
                }

                // Obtain the print data and perform printing
                Bitmap bmp = printBitmaps.get(which);
                if (bmp != null) {
                    if (printBitmap(bmp, getPrintParam(1, orientation))) {
                        onPrintStart();
                        return;
                    }
                }

                onPrintFailed();
            }
        }
    }

    private void requestPermission() {
        // Request permission
        String[] permissions = new String[]{
                Manifest.permission.BLUETOOTH,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                "android.permission.BLUETOOTH_SCAN",        // TODO Android 12+ (API 31) requires these two permissions. Use legacy permission strings if targetSdk < 31. Upgrade targetSdkVersion if discovery fails
                "android.permission.BLUETOOTH_CONNECT"

        };
        requestPermissions(permissions, 0);
    }

    // Initialize and obtain the interface for setting print data (single data item)
    private View initView(String title1, String text1) {
        View view = View.inflate(MainActivity.this, R.layout.setvalue_item, null);
        ((TextView) view.findViewById(R.id.tv_title1)).setText(title1);
        et1 = (EditText) view.findViewById(R.id.et_value1);
        et1.setText(text1 == null ? "" : text1);
        et1.setSelection(et1.getText().toString().length());
        return view;
    }

    // Initialize and obtain the interface for setting print data (two data items)
    private View init1DBarcodeParamView(String text1, String text2) {
        View view = View.inflate(MainActivity.this, R.layout.setvalue_item, null);
        ((LinearLayout) view.findViewById(R.id.ll_2)).setVisibility(View.VISIBLE);
        ((TextView) view.findViewById(R.id.tv_title1)).setText(getResources().getString(R.string.str_text_data) + "：");
        et1 = (EditText) view.findViewById(R.id.et_value1);
        et1.setText(text1 == null ? "" : text1);
        et1.setSelection(et1.getText().length());
        ((TextView) view.findViewById(R.id.tv_title2)).setText(getResources().getString(R.string.str_barcode_data) + "：");
        et2 = (EditText) view.findViewById(R.id.et_value2);
        et2.setText(text2 == null ? "" : text2);
        et2.setSelection(et2.getText().toString().length());
        return view;
    }
}
