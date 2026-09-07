import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Printer,
  FileText,
  Share2,
  Copy,
  Trash2,
  Sparkles,
  QrCode,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Layers,
  Store,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  CreditCard,
  Building,
  Tag,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  RefreshCw,
  Bluetooth,
  Eye,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService from '@/services/PrinterService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { BRAND_COLORS } from '@/constants/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface ReceiptBlockOption {
  id: string;
  label: string;
  description: string;
  icon: any;
  enabled: boolean;
}

export default function TextToThermalPrintScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { user } = useAuth();
  const storeProfile = useStoreProfile();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const {
    activeDevice,
    connectionState,
    paperWidth: storePaperWidth,
    setPaperWidth,
    printCopies,
    setPrintCopies,
    autoCut,
    receiptFont,
  } = usePrinterStore();

  const [paperWidth, setLocalPaperWidth] = useState<'58mm' | '80mm'>(storePaperWidth || '58mm');
  const [copies, setCopies] = useState<number>(printCopies || 1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showBlocksModal, setShowBlocksModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Modular receipt blocks state
  const [blockOptions, setBlockOptions] = useState<ReceiptBlockOption[]>([
    { id: 'store_header', label: 'Store Header & Info', description: 'Store name, address, GSTIN and phone', icon: Store, enabled: true },
    { id: 'logo', label: 'Business Logo', description: 'Header bitmap logo from store settings', icon: Building, enabled: false },
    { id: 'meta_info', label: 'Bill / Token Meta', description: 'Date, time, order/bill number', icon: FileText, enabled: true },
    { id: 'customer_info', label: 'Customer Details', description: 'Customer name and phone number', icon: User, enabled: false },
    { id: 'items_table', label: 'Itemized Items Table', description: 'Clean formatted item, qty and rate lines', icon: ShoppingBag, enabled: true },
    { id: 'totals_summary', label: 'Totals & Tax Summary', description: 'Subtotal, discount, tax and grand total', icon: CreditCard, enabled: true },
    { id: 'upi_qr', label: 'UPI "Scan to Pay" QR', description: 'Scannable payment QR code with store UPI ID', icon: QrCode, enabled: true },
    { id: 'digital_bill_qr', label: 'Digital Bill Link QR', description: 'Instant online bill download link QR', icon: QrCode, enabled: false },
    { id: 'barcode', label: 'Custom Barcode (Code128)', description: 'Scannable 1D barcode with custom code', icon: Tag, enabled: false },
    { id: 'footer_terms', label: 'Footer & Terms', description: 'Thank you message & return policy', icon: Sparkles, enabled: true },
  ]);

  // Quick preset templates
  const presets = useMemo(() => [
    {
      id: 'blank',
      title: 'Blank Note',
      icon: '📝',
      text: '',
    },
    {
      id: 'delivery',
      title: 'Delivery Slip',
      icon: '🚚',
      text: [
        '================================',
        '      EXPRESS DELIVERY SLIP     ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        'Order #: ORD-' + Math.floor(100000 + Math.random() * 900000),
        '--------------------------------',
        'CUSTOMER DETAILS:',
        'Name: Rajesh Verma',
        'Phone: +91 98765 43210',
        'Address: Flat 402, Green Meadows,',
        'MG Road, Bengaluru - 560001',
        '--------------------------------',
        'ITEMS IN PARCEL:',
        '1. Premium Roasted Almonds 500g',
        '2. Organic Wild Honey 250g (1x)',
        '3. Whole Grain Rolled Oats 1kg',
        '--------------------------------',
        'PAYMENT: CASH ON DELIVERY',
        'AMOUNT TO COLLECT: Rs. 1,450.00',
        '================================',
        'Handover with recipient signature:',
        '\n\n',
        'Signature: _____________________',
        'Thank you for shopping with us!',
      ].join('\n'),
    },
    {
      id: 'token',
      title: 'Kitchen / KOT Token',
      icon: '🎫',
      text: [
        '================================',
        '        KITCHEN ORDER TICKET    ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        'Token No: #T-042  Table: T-4',
        'Waiter: Anand K.',
        '--------------------------------',
        'ITEMS ORDERED:',
        '2x Paneer Butter Masala (Spicy)',
        '4x Butter Garlic Naan',
        '1x Jeera Rice (Large Bowl)',
        '2x Fresh Lime Soda (Sweet)',
        '--------------------------------',
        'SPECIAL INSTRUCTION:',
        '• Less oil in paneer curry',
        '• Serve drinks first immediately',
        '================================',
      ].join('\n'),
    },
    {
      id: 'wifi',
      title: 'Store Wi-Fi Notice',
      icon: '📶',
      text: [
        '================================',
        `    ${(storeProfile.storeName || 'OUR STORE').toUpperCase()}    `,
        '================================',
        'WELCOME GUEST! FREE WI-FI ACCESS',
        '--------------------------------',
        'Network SSID: Store_Guest_5G',
        'Password:     Welcome@2026',
        '--------------------------------',
        'Need assistance? Ask our counter',
        'team or call us at:',
        `Ph: ${storeProfile.storePhone || '+91 98765 00000'}`,
        '--------------------------------',
        'Enjoy your visit!',
        '================================',
      ].join('\n'),
    },
    {
      id: 'coupon',
      title: 'Promo / Discount Voucher',
      icon: '🏷️',
      text: [
        '********************************',
        '     SPECIAL DISCOUNT VOUCHER   ',
        '********************************',
        `Issued: ${new Date().toLocaleDateString('en-GB')}`,
        'Valid Until: 30 Days from Issue',
        '--------------------------------',
        'FLAT 15% OFF ON NEXT PURCHASE',
        'Coupon Code: SEZNIK15',
        '--------------------------------',
        'Terms: Valid on minimum billing',
        'of Rs. 500. Not applicable with',
        'other ongoing clearance offers.',
        '********************************',
        'Show this slip at the cash counter',
      ].join('\n'),
    },
    {
      id: 'return',
      title: 'Return / Exchange Slip',
      icon: '🔄',
      text: [
        '================================',
        '    CUSTOMER RETURN & REPAIR    ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Slip #: RET-${Math.floor(1000 + Math.random() * 9000)}`,
        '--------------------------------',
        'Customer: Priya Sundaram',
        'Contact:  +91 99001 12233',
        'Original Bill: INV-2026-0891',
        '--------------------------------',
        'Item: Wireless Bluetooth Speaker',
        'Issue: Charging port loose',
        'Action: Sent to service center',
        'Estimated Ready Date: In 3 days',
        '================================',
        'Please retain this slip for pickup',
      ].join('\n'),
    },
  ], [storeProfile]);

  const [text, setText] = useState<string>(presets[1].text);

  // Column limit guide based on paper width
  const maxCols = paperWidth === '80mm' ? 48 : 32;

  // Insert helper text at cursor/end
  const insertText = (snippet: string) => {
    setText((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  };

  const insertDivider = (type: 'dash' | 'double' | 'star' | 'dot') => {
    const char = type === 'dash' ? '-' : type === 'double' ? '=' : type === 'star' ? '*' : '.';
    insertText(char.repeat(maxCols));
  };

  const insertTag = (tag: string) => {
    let val = '';
    const now = new Date();
    if (tag === 'date') val = now.toLocaleDateString('en-GB');
    if (tag === 'time') val = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (tag === 'store') val = storeProfile.storeName || 'My Store';
    if (tag === 'phone') val = storeProfile.storePhone || '';
    if (tag === 'inv') val = 'INV-' + Math.floor(10000 + Math.random() * 90000);
    insertText(val);
  };

  // Generate formatted text from selected receipt blocks
  const buildReceiptBlocksText = () => {
    const lines: string[] = [];
    const div = '-'.repeat(maxCols);
    const doubleDiv = '='.repeat(maxCols);
    const storeName = storeProfile.storeName || 'SEZNIK STORE';

    blockOptions.forEach((b) => {
      if (!b.enabled) return;

      if (b.id === 'store_header') {
        lines.push(doubleDiv);
        lines.push(centerText(storeName, maxCols));
        if (storeProfile.storeAddress) lines.push(centerText(storeProfile.storeAddress, maxCols));
        if (storeProfile.storePhone) lines.push(centerText(`Ph: ${storeProfile.storePhone}`, maxCols));
        if (storeProfile.storeGstin) lines.push(centerText(`GSTIN: ${storeProfile.storeGstin}`, maxCols));
        lines.push(doubleDiv);
      }

      if (b.id === 'meta_info') {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB');
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lines.push(`Date: ${dateStr}   Time: ${timeStr}`);
        lines.push(`Bill No: INV-${Math.floor(1000 + Math.random() * 9000)}   Counter: 01`);
        lines.push(div);
      }

      if (b.id === 'customer_info') {
        lines.push('CUSTOMER: Walk-in Customer');
        lines.push('Phone:    +91 98765 43210');
        lines.push(div);
      }

      if (b.id === 'items_table') {
        lines.push(padColumns('Item', 'Qty x Rate', 'Total', maxCols));
        lines.push(div);
        lines.push(padColumns('Organic Green Tea 100g', '1 x 180.00', '180.00', maxCols));
        lines.push(padColumns('Almond Butter 250g', '2 x 260.00', '520.00', maxCols));
        lines.push(padColumns('Cold Pressed Mustard 1L', '1 x 195.00', '195.00', maxCols));
        lines.push(div);
      }

      if (b.id === 'totals_summary') {
        lines.push(padTwo('Subtotal:', 'Rs. 895.00', maxCols));
        lines.push(padTwo('Discount (5%):', '- Rs. 44.75', maxCols));
        lines.push(padTwo('CGST (2.5%):', 'Rs. 21.26', maxCols));
        lines.push(padTwo('SGST (2.5%):', 'Rs. 21.26', maxCols));
        lines.push(div);
        lines.push(padTwo('GRAND TOTAL:', 'Rs. 892.77', maxCols));
        lines.push(doubleDiv);
      }

      if (b.id === 'upi_qr') {
        lines.push(centerText('*** SCAN TO PAY VIA UPI ***', maxCols));
        if (storeProfile.upiId) lines.push(centerText(`UPI ID: ${storeProfile.upiId}`, maxCols));
        lines.push(div);
      }

      if (b.id === 'digital_bill_qr') {
        lines.push(centerText('Scan QR for Digital Tax Invoice', maxCols));
        lines.push(div);
      }

      if (b.id === 'barcode') {
        lines.push(centerText('* BARCODE: 8901234567890 *', maxCols));
        lines.push(div);
      }

      if (b.id === 'footer_terms') {
        lines.push(centerText('Thank you! Visit Again', maxCols));
        lines.push(centerText('Goods once sold cannot be returned', maxCols));
        lines.push(doubleDiv);
      }
    });

    return lines.join('\n');
  };

  const handleApplyBlocks = (mode: 'append' | 'replace') => {
    const blockText = buildReceiptBlocksText();
    if (mode === 'replace') {
      setText(blockText);
    } else {
      setText((prev) => (prev ? `${prev}\n\n${blockText}` : blockText));
    }
    setShowBlocksModal(false);
  };

  const handlePrint = async () => {
    if (!text.trim()) {
      Alert.alert('Empty Text', 'Please enter some text or select receipt blocks to print.');
      return;
    }

    setIsPrinting(true);
    try {
      const upiId = blockOptions.find((b) => b.id === 'upi_qr' && b.enabled) ? storeProfile.upiId || undefined : undefined;
      const storeLogoUrl = blockOptions.find((b) => b.id === 'logo' && b.enabled) ? storeProfile.storeLogoUrl || undefined : undefined;

      await ThermalPrinterService.printFreeformThermal(text, {
        paperWidth,
        copies,
        autoCut,
        storeLogoUrl: storeLogoUrl || undefined,
        upiId: upiId || undefined,
      });

      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Thermal print job sent to printer!');
      }
    } catch (err: any) {
      console.error('Print failed:', err);
      if (Platform.OS !== 'web' && connectionState !== 'connected') {
        setShowConnectModal(true);
      } else {
        Alert.alert('Printing Error', err?.message || 'Failed to print. Check printer connection.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSharePdf = async () => {
    if (!text.trim()) return;
    try {
      const html = ThermalPrinterService.generateFreeformThermalHtml(text, {
        paperWidth,
        storeLogoUrl: blockOptions.find((b) => b.id === 'logo' && b.enabled) ? storeProfile.storeLogoUrl || undefined : undefined,
        upiId: blockOptions.find((b) => b.id === 'upi_qr' && b.enabled) ? storeProfile.upiId || undefined : undefined,
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleCopyText = async () => {
    if (!text.trim()) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Share.share({ message: text });
      }
      Alert.alert('Copied', 'Thermal text copied to clipboard!');
    } catch {
      // ignore
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
      {/* HEADER BAR */}
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <ArrowLeft size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Text to Thermal Print</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Quick thermal notes, slips & receipt blocks
            </Text>
          </View>
        </View>

        {/* Paper & Copies Quick Controls */}
        <View style={styles.headerRight}>
          <View style={[styles.paperWidthPill, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              onPress={() => {
                setLocalPaperWidth('58mm');
                setPaperWidth('58mm');
              }}
              style={[
                styles.paperWidthBtn,
                paperWidth === '58mm' && { backgroundColor: BRAND_COLORS.blue600 },
              ]}
            >
              <Text
                style={[
                  styles.paperWidthText,
                  { color: paperWidth === '58mm' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                58mm
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setLocalPaperWidth('80mm');
                setPaperWidth('80mm');
              }}
              style={[
                styles.paperWidthBtn,
                paperWidth === '80mm' && { backgroundColor: BRAND_COLORS.blue600 },
              ]}
            >
              <Text
                style={[
                  styles.paperWidthText,
                  { color: paperWidth === '80mm' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                80mm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* PRINTER STATUS BAR */}
      <View style={[styles.statusBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <View style={styles.statusLeft}>
          <Bluetooth size={14} color={connectionState === 'connected' ? '#10B981' : theme.textSecondary} />
          <Text style={[styles.statusText, { color: theme.textPrimary }]}>
            {Platform.OS === 'web'
              ? 'Web Thermal Printing (Standard Browser / Virtual Roll)'
              : connectionState === 'connected' && activeDevice
              ? `Connected: ${activeDevice.name}`
              : 'No Bluetooth printer connected'}
          </Text>
        </View>
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            onPress={() => setShowConnectModal(true)}
            style={[styles.statusActionBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: 'rgba(37, 99, 235, 0.3)' }]}
          >
            <Text style={styles.statusActionText}>
              {connectionState === 'connected' ? 'Change' : 'Connect'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MOBILE TAB TOGGLE (Editor vs Live Preview) */}
      <View style={[styles.mobileTabRow, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('editor')}
          style={[
            styles.mobileTabBtn,
            activeTab === 'editor' && { backgroundColor: BRAND_COLORS.blue600 },
          ]}
        >
          <FileText size={14} color={activeTab === 'editor' ? '#FFFFFF' : theme.textSecondary} />
          <Text
            style={[
              styles.mobileTabText,
              { color: activeTab === 'editor' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            Editor & Formatting
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('preview')}
          style={[
            styles.mobileTabBtn,
            activeTab === 'preview' && { backgroundColor: BRAND_COLORS.blue600 },
          ]}
        >
          <Eye size={14} color={activeTab === 'preview' ? '#FFFFFF' : theme.textSecondary} />
          <Text
            style={[
              styles.mobileTabText,
              { color: activeTab === 'preview' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            Thermal Paper Preview
          </Text>
        </TouchableOpacity>
      </View>

      {/* MAIN WORKBENCH (Split View on Large Screens / Tabbed on Small) */}
      <View style={styles.workbenchContainer}>
        {/* LEFT COLUMN: EDITOR & CONTROLS */}
        <View
          style={[
            styles.editorColumn,
            { display: activeTab === 'editor' || Platform.OS === 'web' ? 'flex' : 'none' },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editorScrollContent}
          >
            {/* PRESETS CAROUSEL */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Sparkles size={14} color={BRAND_COLORS.blue600} />
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Preset Slips</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {presets.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setText(p.text)}
                    style={[
                      styles.presetChip,
                      { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                    ]}
                  >
                    <Text style={styles.presetEmoji}>{p.icon}</Text>
                    <Text style={[styles.presetTitle, { color: theme.textPrimary }]}>{p.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* QUICK BLOCK BUILDER CTA */}
            <View
              style={[
                styles.blockBuilderCtaCard,
                { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.25)' },
              ]}
            >
              <View style={styles.blockBuilderCtaLeft}>
                <Layers size={20} color={BRAND_COLORS.blue600} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.blockBuilderCtaTitle, { color: theme.textPrimary }]}>
                    Select Receipt Blocks
                  </Text>
                  <Text style={[styles.blockBuilderCtaSub, { color: theme.textSecondary }]}>
                    Insert Store Header, Items Table, Totals, or UPI QR from your store
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowBlocksModal(true)}
                style={[styles.blockBuilderCtaBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.blockBuilderCtaBtnText}>Choose Blocks</Text>
              </TouchableOpacity>
            </View>

            {/* FORMATTING TOOLBAR */}
            <View style={[styles.toolbarCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.toolbarHeader}>
                <Text style={[styles.toolbarTitle, { color: theme.textSecondary }]}>
                  INSERT THERMAL FORMATTING
                </Text>
                <Text style={[styles.colCounter, { color: theme.textSecondary }]}>
                  Width: {maxCols} chars/line
                </Text>
              </View>

              {/* Dividers */}
              <View style={styles.toolbarButtonsGroup}>
                <TouchableOpacity
                  onPress={() => insertDivider('dash')}
                  style={[styles.toolBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.toolBtnText, { color: theme.textPrimary }]}>--- Dashes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertDivider('double')}
                  style={[styles.toolBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.toolBtnText, { color: theme.textPrimary }]}>=== Double</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertDivider('star')}
                  style={[styles.toolBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.toolBtnText, { color: theme.textPrimary }]}>*** Stars</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertDivider('dot')}
                  style={[styles.toolBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.toolBtnText, { color: theme.textPrimary }]}>... Dots</Text>
                </TouchableOpacity>
              </View>

              {/* Dynamic Data Tags */}
              <View style={[styles.toolbarButtonsGroup, { marginTop: 8 }]}>
                <TouchableOpacity
                  onPress={() => insertTag('date')}
                  style={[styles.toolTagBtn, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
                >
                  <Text style={styles.toolTagBtnText}>+ Today's Date</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertTag('time')}
                  style={[styles.toolTagBtn, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
                >
                  <Text style={styles.toolTagBtnText}>+ Time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertTag('store')}
                  style={[styles.toolTagBtn, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
                >
                  <Text style={styles.toolTagBtnText}>+ Store Name</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => insertTag('inv')}
                  style={[styles.toolTagBtn, { backgroundColor: 'rgba(37, 99, 235, 0.08)' }]}
                >
                  <Text style={styles.toolTagBtnText}>+ Invoice #</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TEXTAREA INPUT */}
            <View style={[styles.textareaWrapper, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.textareaHeader}>
                <Text style={[styles.textareaLabel, { color: theme.textPrimary }]}>Thermal Receipt Content</Text>
                <View style={styles.textareaActions}>
                  <TouchableOpacity onPress={() => setText('')} style={styles.clearBtn}>
                    <Trash2 size={13} color="#EF4444" />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={[
                  styles.textareaInput,
                  {
                    color: theme.textPrimary,
                    borderColor: theme.borderColor,
                    backgroundColor: theme.bg,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  },
                ]}
                multiline
                value={text}
                onChangeText={setText}
                placeholder="Type or paste custom text to print on thermal paper..."
                placeholderTextColor={theme.textSecondary}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>

        {/* RIGHT COLUMN: LIVE AUTHENTIC THERMAL PAPER PREVIEW */}
        <View
          style={[
            styles.previewColumn,
            { display: activeTab === 'preview' || Platform.OS === 'web' ? 'flex' : 'none' },
          ]}
        >
          <View style={styles.previewCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Eye size={16} color={BRAND_COLORS.blue600} />
              <Text style={[styles.previewHeaderTitle, { color: theme.textPrimary }]}>
                Live Thermal Simulation ({paperWidth})
              </Text>
            </View>
            <View style={styles.previewHeaderActions}>
              <TouchableOpacity onPress={handleCopyText} style={styles.previewActionBtn}>
                <Copy size={14} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSharePdf} style={styles.previewActionBtn}>
                <Share2 size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* AUTHENTIC THERMAL PAPER ROLL CONTAINER */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.previewScrollContent}
          >
            <View style={[styles.thermalPaperRoll, { maxWidth: paperWidth === '80mm' ? 380 : 300 }]}>
              {/* Top Jagged Tear Edge */}
              <View style={styles.thermalTearEdgeTop} />

              {/* Thermal Content Body */}
              <View style={styles.thermalPaperBody}>
                {blockOptions.find((b) => b.id === 'logo' && b.enabled) && (
                  <View style={styles.previewLogoContainer}>
                    <Building size={32} color="#111827" />
                    <Text style={styles.previewLogoText}>
                      {(storeProfile.storeName || 'STORE').toUpperCase()}
                    </Text>
                  </View>
                )}

                <Text style={styles.thermalMonospaceText}>
                  {text || 'Empty Document\nType text or choose receipt blocks to preview output.'}
                </Text>

                {blockOptions.find((b) => b.id === 'upi_qr' && b.enabled) && (
                  <View style={styles.previewUpiBox}>
                    <Text style={styles.previewUpiTitle}>SCAN TO PAY VIA UPI</Text>
                    <View style={styles.previewQrMock}>
                      <QrCode size={56} color="#000000" />
                    </View>
                    <Text style={styles.previewUpiId}>{storeProfile.upiId || 'store@upi'}</Text>
                  </View>
                )}
              </View>

              {/* Bottom Jagged Tear Edge */}
              <View style={styles.thermalTearEdgeBottom} />
            </View>
          </ScrollView>

          {/* BOTTOM PRINT ACTION BAR */}
          <View style={[styles.bottomBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
            <View style={styles.copiesSelector}>
              <Text style={[styles.copiesLabel, { color: theme.textSecondary }]}>Copies:</Text>
              <TouchableOpacity
                onPress={() => setCopies((c) => Math.max(1, c - 1))}
                style={[styles.copiesBtn, { borderColor: theme.borderColor }]}
              >
                <Text style={[styles.copiesBtnText, { color: theme.textPrimary }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.copiesCount, { color: theme.textPrimary }]}>{copies}</Text>
              <TouchableOpacity
                onPress={() => setCopies((c) => Math.min(10, c + 1))}
                style={[styles.copiesBtn, { borderColor: theme.borderColor }]}
              >
                <Text style={[styles.copiesBtnText, { color: theme.textPrimary }]}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handlePrint}
              disabled={isPrinting}
              style={[
                styles.primaryPrintBtn,
                { backgroundColor: BRAND_COLORS.blue600, opacity: isPrinting ? 0.7 : 1 },
              ]}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Printer size={18} color="#FFFFFF" />
                  <Text style={styles.primaryPrintBtnText}>
                    Print to Thermal ({paperWidth})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* RECEIPT BLOCKS SELECTION MODAL */}
      <Modal visible={showBlocksModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color={BRAND_COLORS.blue600} />
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Receipt Blocks</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBlocksModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Toggle blocks to automatically format and insert them into your thermal print:
            </Text>

            <ScrollView style={styles.blocksListScroll} showsVerticalScrollIndicator={false}>
              {blockOptions.map((b) => {
                const IconComp = b.icon;
                return (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => {
                      setBlockOptions((prev) =>
                        prev.map((item) => (item.id === b.id ? { ...item, enabled: !item.enabled } : item))
                      );
                    }}
                    style={[
                      styles.blockItemRow,
                      {
                        backgroundColor: b.enabled ? 'rgba(37, 99, 235, 0.08)' : theme.bg,
                        borderColor: b.enabled ? BRAND_COLORS.blue600 : theme.borderColor,
                      },
                    ]}
                  >
                    <View style={styles.blockItemLeft}>
                      <View
                        style={[
                          styles.blockItemIcon,
                          { backgroundColor: b.enabled ? BRAND_COLORS.blue600 : 'rgba(100, 116, 139, 0.15)' },
                        ]}
                      >
                        <IconComp size={16} color={b.enabled ? '#FFFFFF' : theme.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.blockItemTitle, { color: theme.textPrimary }]}>{b.label}</Text>
                        <Text style={[styles.blockItemDesc, { color: theme.textSecondary }]}>{b.description}</Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.blockCheckbox,
                        {
                          backgroundColor: b.enabled ? BRAND_COLORS.blue600 : 'transparent',
                          borderColor: b.enabled ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      {b.enabled && <Check size={12} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                onPress={() => handleApplyBlocks('append')}
                style={[styles.modalActionBtnSecondary, { borderColor: theme.borderColor }]}
              >
                <Text style={[styles.modalActionBtnSecondaryText, { color: theme.textPrimary }]}>
                  Append to Editor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleApplyBlocks('replace')}
                style={[styles.modalActionBtnPrimary, { backgroundColor: BRAND_COLORS.blue600 }]}
              >
                <Text style={styles.modalActionBtnPrimaryText}>Replace & Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DIRECT PRINTER CONNECT MODAL */}
      <DirectPrinterConnectModal
        visible={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnected={() => {
          setShowConnectModal(false);
          Alert.alert('Printer Connected', 'Your Bluetooth thermal printer is ready.');
        }}
      />
    </View>
  );
}

// Helpers for thermal column justification
function centerText(text: string, width: number): string {
  const clean = text.trim();
  if (clean.length >= width) return clean.slice(0, width);
  const totalPad = width - clean.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return ' '.repeat(leftPad) + clean + ' '.repeat(rightPad);
}

function padTwo(left: string, right: string, width: number): string {
  const l = left.trim();
  const r = right.trim();
  const space = width - l.length - r.length;
  if (space <= 0) return `${l} ${r}`.slice(0, width);
  return l + ' '.repeat(space) + r;
}

function padColumns(col1: string, col2: string, col3: string, width: number): string {
  const c1Width = Math.floor(width * 0.44);
  const c2Width = Math.floor(width * 0.32);
  const c3Width = width - c1Width - c2Width;

  const c1 = col1.slice(0, c1Width).padEnd(c1Width, ' ');
  const c2 = col2.slice(0, c2Width).padStart(c2Width, ' ');
  const c3 = col3.slice(0, c3Width).padStart(c3Width, ' ');
  return c1 + c2 + c3;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paperWidthPill: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
  },
  paperWidthBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paperWidthText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_COLORS.blue600,
  },
  mobileTabRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mobileTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  workbenchContainer: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  editorColumn: {
    flex: 1,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightColor: '#33415522',
  },
  editorScrollContent: {
    padding: 14,
    gap: 12,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  presetEmoji: {
    fontSize: 14,
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  blockBuilderCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  blockBuilderCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  blockBuilderCtaTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  blockBuilderCtaSub: {
    fontSize: 10,
    marginTop: 2,
  },
  blockBuilderCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  blockBuilderCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toolbarCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toolbarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolbarTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  colCounter: {
    fontSize: 10,
    fontWeight: '600',
  },
  toolbarButtonsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  toolBtnText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  toolTagBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toolTagBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_COLORS.blue600,
  },
  textareaWrapper: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  textareaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  textareaLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  textareaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  textareaInput: {
    minHeight: 220,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  previewColumn: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#33415522',
  },
  previewHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  previewScrollContent: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  thermalPaperRoll: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  thermalTearEdgeTop: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  thermalPaperBody: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  previewLogoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  previewLogoText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
  },
  thermalMonospaceText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 15,
    color: '#000000',
  },
  previewUpiBox: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    borderStyle: 'dashed',
  },
  previewUpiTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#000000',
    marginBottom: 4,
  },
  previewQrMock: {
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  previewUpiId: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  thermalTearEdgeBottom: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  copiesSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copiesLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  copiesBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copiesBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  copiesCount: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  primaryPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  blocksListScroll: {
    maxHeight: 340,
  },
  blockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  blockItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  blockItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockItemTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  blockItemDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  blockCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalActionBtnSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActionBtnPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
