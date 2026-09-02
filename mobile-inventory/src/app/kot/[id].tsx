import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Printer,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Trash2,
  Minus,
  Edit3,
  Utensils,
  Receipt,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Search,
  AlertTriangle,
  FileText,
  RefreshCw,
  UserCheck,
} from 'lucide-react-native';
import { useKotOrder, useKotOrders } from '@/hooks/useKotOrders';
import { useProducts } from '@/hooks/useProducts';
import { KOTOrderStatus, KOTOrderItem, KOTDeltaChange } from '@/types/kot';
import { Product } from '@/types/product';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState, ScreenErrorState } from '@/components/ui/ScreenLoadingState';
import { KotOrderDetailSkeleton } from '@/components/ui/ScreenSkeleton';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { BRAND_COLORS } from '@/constants/theme';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService, { PrintKotDeltaData } from '@/services/PrinterService';
import { useSettings } from '@/hooks/useSettings';
import { useStoreProfile } from '@/hooks/useStoreProfile';
import { getTemplateById } from '@/constants/receiptTemplates';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import { printInvoiceReceipt } from '@/utils/invoiceActions';
import { AddFoodItemModal } from '@/components/kot/AddFoodItemModal';

const VOID_REASONS = [
  'Guest cancelled',
  'Kitchen mistake / duplicate',
  'Item out of stock',
  'Preparation delay',
  'Wrong item entered',
  'Other / Guest request',
];

interface PendingNewItem {
  tempId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  notes?: string;
  modifiers?: string[];
}

export default function KotOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  const { order, isLoading, isRefetching, isError, refetch } = useKotOrder(id);
  const { updateStatus, editOrder, generateBill, isEditing, isGeneratingBill } = useKotOrders();
  const { products } = useProducts();
  const { paperWidth, connectionState, activeTemplateId, customTemplates, activeCustomTemplateId, enableBillQrCode, topMargin, autoCut, fontSize, printCopies } = usePrinterStore();
  const { settings } = useSettings();
  const storeProfile = useStoreProfile();

  const [reprintCounter, setReprintCounter] = useState(0);

  // Local draft changes for active order items
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [voidedItems, setVoidedItems] = useState<Record<string, string>>({}); // itemId -> reason
  const [pendingNewItems, setPendingNewItems] = useState<PendingNewItem[]>([]);

  // Item Note Modal
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [itemNoteText, setItemNoteText] = useState('');

  // Void Reason Modal
  const [voidingItemId, setVoidingItemId] = useState<string | null>(null);
  const [selectedVoidReason, setSelectedVoidReason] = useState(VOID_REASONS[0]);
  const [customVoidReason, setCustomVoidReason] = useState('');

  // Add Item Catalog Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newProductQty, setNewProductQty] = useState(1);
  const [newProductNote, setNewProductNote] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);

  // Settlement / Bill Checkout Modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');

  // Initialize draft states from order
  useEffect(() => {
    if (order) {
      const qMap: Record<string, number> = {};
      const nMap: Record<string, string> = {};
      const vMap: Record<string, string> = {};
      order.items.forEach((it) => {
        qMap[it.id] = it.quantity;
        nMap[it.id] = it.notes || '';
        if (it.status === 'voided') {
          vMap[it.id] = it.notes?.replace(/^\[VOID:?\s*|\]/gi, '') || 'Voided';
        }
      });
      setItemQuantities(qMap);
      setItemNotes(nMap);
      setVoidedItems(vMap);
      setPendingNewItems([]);
      setCustomerNameInput(order.customer?.name || order.partyLabel || '');
      setCustomerPhoneInput(order.customer?.phone || order.contactNumber || '');
    }
  }, [order]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleUpdateStatus = async (newStatus: KOTOrderStatus) => {
    if (!order) return;
    try {
      await updateStatus({ id: order.id, payload: { status: newStatus } });
      refetch();
    } catch (err: any) {
      Alert.alert('Status Error', err?.message || 'Failed to update status');
    }
  };

  // Full KOT Kitchen Slip Print / Reprint
  const handlePrintKitchenSlip = async () => {
    if (!order) return;
    try {
      const nextReprint = reprintCounter + 1;
      setReprintCounter(nextReprint);

      const activeItems = order.items
        .filter((it) => it.status !== 'voided')
        .map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          notes: it.notes || undefined,
          modifiers: it.modifiers,
        }));

      await ThermalPrinterService.printKotTicket(
        {
          storeName: settings?.businessName || 'SEZNIK KITCHEN',
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          tableName: order.table?.name,
          partyLabel: order.partyLabel || undefined,
          guestCount: order.guestCount || undefined,
          contactNumber: order.contactNumber || undefined,
          priority: order.priority,
          notes: order.notes || undefined,
          time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reprintCount: nextReprint > 1 ? nextReprint - 1 : undefined,
          copyType: 'KITCHEN COPY',
          items: activeItems,
        },
        paperWidth || '58mm'
      );
      Alert.alert('Printed!', `Full kitchen slip for KOT #${order.orderNumber} printed.`);
    } catch (err: any) {
      Alert.alert('Printer Error', err?.message || 'Failed to print kitchen slip');
    }
  };

  // Void item confirmation
  const handleConfirmVoid = () => {
    if (!voidingItemId) return;
    const reason = selectedVoidReason === 'Other / Guest request' && customVoidReason.trim()
      ? customVoidReason.trim()
      : selectedVoidReason;

    setVoidedItems((prev) => ({ ...prev, [voidingItemId]: reason }));
    setVoidingItemId(null);
    setCustomVoidReason('');
  };

  // Calculate Delta Changes
  const calculateDeltaChanges = (): KOTDeltaChange[] => {
    if (!order) return [];
    const changes: KOTDeltaChange[] = [];

    // 1. Newly Added Items (+ NEW)
    pendingNewItems.forEach((newItem) => {
      changes.push({
        type: 'new',
        productName: newItem.productName,
        quantity: newItem.quantity,
        notes: newItem.notes,
      });
    });

    // 2. Voided Items (- VOID)
    order.items.forEach((orig) => {
      if (orig.status !== 'voided' && voidedItems[orig.id]) {
        changes.push({
          type: 'void',
          productName: orig.productName,
          quantity: itemQuantities[orig.id] ?? orig.quantity,
          reason: voidedItems[orig.id],
        });
      }
    });

    // 3. Quantity / Note Changes (~ QTY CHANGE)
    order.items.forEach((orig) => {
      if (orig.status !== 'voided' && !voidedItems[orig.id]) {
        const currentQty = itemQuantities[orig.id] ?? orig.quantity;
        const currentNote = itemNotes[orig.id] ?? (orig.notes || '');
        if (currentQty !== orig.quantity || currentNote !== (orig.notes || '')) {
          changes.push({
            type: 'qty_change',
            productName: orig.productName,
            quantity: currentQty,
            oldQuantity: orig.quantity,
            notes: currentNote,
          });
        }
      }
    });

    return changes;
  };

  const deltaChanges = calculateDeltaChanges();

  // Commit Edit & Print Delta KOT
  const handleCommitEditAndFire = async (autoPrintDelta = true) => {
    if (!order) return;
    if (deltaChanges.length === 0) return;

    try {
      const itemsToAdd = pendingNewItems.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        notes: it.notes,
      }));

      const itemsToUpdate = order.items
        .filter((orig) => orig.status !== 'voided' && !voidedItems[orig.id])
        .filter((orig) => (itemQuantities[orig.id] !== undefined && itemQuantities[orig.id] !== orig.quantity) || itemNotes[orig.id] !== orig.notes)
        .map((orig) => ({
          id: orig.id,
          quantity: itemQuantities[orig.id] ?? orig.quantity,
          notes: itemNotes[orig.id] ?? orig.notes,
        }));

      const itemsToVoid = Object.entries(voidedItems)
        .filter(([id]) => order.items.some((it) => it.id === id && it.status !== 'voided'))
        .map(([id, reason]) => ({ id, reason }));

      await editOrder({
        id: order.id,
        payload: {
          status: 'modified',
          itemsToAdd,
          itemsToUpdate,
          itemsToVoid,
        },
      });

      if (autoPrintDelta) {
        try {
          await ThermalPrinterService.printKotDeltaTicket(
            {
              storeName: settings?.businessName || 'SEZNIK KITCHEN',
              orderNumber: order.orderNumber,
              tableName: order.table?.name,
              partyLabel: order.partyLabel || undefined,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              version: (order.version || 1) + 1,
              changes: deltaChanges,
            },
            paperWidth || '58mm'
          );
        } catch (printErr) {
          console.warn('Delta KOT thermal print failed:', printErr);
        }
      }

      setPendingNewItems([]);
      await refetch();

      Alert.alert('Updated!', autoPrintDelta ? `Changes sent to kitchen and Delta KOT printed.` : `Order items saved.`);
    } catch (err: any) {
      Alert.alert('Edit Error', err?.message || 'Failed to update KOT order');
    }
  };

  // Add Item to Draft
  const handleAddProductToDraft = () => {
    if (!selectedProductToAdd) return;
    const newItem: PendingNewItem = {
      tempId: `draft_${Date.now()}_${Math.random()}`,
      productId: selectedProductToAdd.id,
      productName: selectedProductToAdd.name,
      quantity: newProductQty,
      unitPrice: selectedProductToAdd.sellingPrice,
      taxRate: selectedProductToAdd.taxRate || 0,
      notes: newProductNote.trim() || undefined,
    };
    setPendingNewItems((prev) => [...prev, newItem]);
    setSelectedProductToAdd(null);
    setNewProductQty(1);
    setNewProductNote('');
    setShowAddItemModal(false);
  };

  // Generate Customer Bill
  const handleGenerateBill = async () => {
    if (!order) return;
    try {
      // If there are uncommitted changes, commit them first
      if (deltaChanges.length > 0) {
        await handleCommitEditAndFire(false);
      }

      const disc = parseFloat(discountAmount) || 0;
      const result = await generateBill({
        id: order.id,
        payload: {
          paymentMethod,
          discount: disc,
        },
      });

      // Auto print customer tax invoice receipt if connected
      if (connectionState === 'connected') {
        try {
          const template = getTemplateById(activeTemplateId);
          const customTemplate = customTemplates?.find((t) => t.id === activeCustomTemplateId) || null;
          const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
          await printInvoiceReceipt(
            result.sale,
            storeProfile,
            paperWidth || '58mm',
            {
              template,
              customTemplate,
              includeBillQr: enableBillQrCode,
              topMargin,
              autoCut,
              fontSize,
              copies: printCopies,
              storeName: storeProfile.storeName,
              storeAddress: storeProfile.storeAddress,
              storePhone: storeProfile.storePhone,
              storeGstin: storeProfile.storeGstin,
              storeLogoUrl: storeProfile.storeLogoUrl,
              upiId: storeProfile.upiId,
              ...gstPrintOptionOverrides(gstBilling),
            },
            connectionState
          );
        } catch (printErr) {
          console.warn('Auto print receipt failed:', printErr);
        }
      }

      setShowSettleModal(false);
      Alert.alert('Bill Settled!', `Invoice #${result.sale.invoiceNumber} recorded successfully.`, [
        {
          text: 'OK',
          onPress: () => router.replace('/kot' as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Billing Error', err?.message || 'Failed to generate bill');
    }
  };

  if (isError && !order) {
    return (
      <ScreenErrorState
        message="Could not load kitchen order"
        hint="Check your connection and try again"
        onRetry={refetch}
        isRetrying={isRefetching}
        fullScreen
      />
    );
  }

  if (isLoading || !order) {
    return (
      <ScreenLoadingState
        message="Loading kitchen order..."
        hint="Fetching KOT items and preparation status"
        skeleton={<KotOrderDetailSkeleton />}
        fullScreen
      />
    );
  }

  // Active items for live subtotal
  const activeExistingItems = order.items.filter((it) => !voidedItems[it.id]);
  const activeExistingTotal = activeExistingItems.reduce(
    (sum, it) => sum + it.unitPrice * (itemQuantities[it.id] ?? it.quantity),
    0
  );
  const pendingNewTotal = pendingNewItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const liveSubtotal = activeExistingTotal + pendingNewTotal;

  const isOrderEditable = order.status !== 'billed' && order.status !== 'cancelled';

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <ScrollView style={styles.mainWrapper} contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <ChevronLeft size={20} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerBadge}>RESTAURANT KOT</Text>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                KOT #{String(order.orderNumber).padStart(4, '0')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={handlePrintKitchenSlip}
                style={[styles.printSlipBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: 'rgba(37, 99, 235, 0.3)' }]}
              >
                <Printer size={15} color={BRAND_COLORS.blue600} />
                <Text style={styles.printSlipBtnText}>Print KOT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.cardHeadline, { color: theme.textPrimary }]}>
                  {order.table?.name || order.partyLabel || 'Dine-In Table'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  {order.orderType.toUpperCase()} {order.guestCount ? `• ${order.guestCount} Covers` : ''} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={[styles.statusChip, { backgroundColor: BRAND_COLORS.navyInk }]}>
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {order.notes && (
              <View style={[styles.noteBox, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Order Note: {order.notes}</Text>
              </View>
            )}
          </View>

          {/* Kitchen Progress Pipeline */}
          {isOrderEditable && (
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 10 }]}>
                Kitchen Progress Pipeline
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {order.status === 'open' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('sent_to_kitchen')}
                    style={[styles.stepBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                  >
                    <Text style={styles.stepBtnText}>Send to Kitchen ➔</Text>
                  </TouchableOpacity>
                )}
                {(order.status === 'open' || order.status === 'sent_to_kitchen' || order.status === 'modified') && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('preparing')}
                    style={[styles.stepBtn, { backgroundColor: '#F59E0B' }]}
                  >
                    <Text style={styles.stepBtnText}>Mark Preparing 🍳</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'preparing' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('ready')}
                    style={[styles.stepBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.stepBtnText}>Ready to Serve 🔔</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'ready' && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus('served')}
                    style={[styles.stepBtn, { backgroundColor: '#8B5CF6' }]}
                  >
                    <Text style={styles.stepBtnText}>Mark Served 🍽️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* DELTA CHANGES BAR (Appears automatically when edits exist) */}
          {deltaChanges.length > 0 && (
            <View style={[styles.card, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: '#F59E0B' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#B45309' }}>
                    Unfired Changes ({deltaChanges.length})
                  </Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E' }}>
                  Ready to fire delta
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                {deltaChanges.map((c, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.deltaChip,
                      {
                        backgroundColor:
                          c.type === 'new'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : c.type === 'void'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(245, 158, 11, 0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaChipText,
                        {
                          color:
                            c.type === 'new'
                              ? '#059669'
                              : c.type === 'void'
                              ? '#DC2626'
                              : '#D97706',
                        },
                      ]}
                    >
                      {c.type === 'new' && `+ NEW   ${c.quantity}x ${c.productName}`}
                      {c.type === 'void' && `- VOID  ${c.quantity}x ${c.productName} (${c.reason || 'Cancelled'})`}
                      {c.type === 'qty_change' && `~ CHG   ${c.oldQuantity}x ➔ ${c.quantity}x ${c.productName}`}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => handleCommitEditAndFire(false)}
                  disabled={isEditing}
                  style={[styles.saveDraftBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textPrimary }}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleCommitEditAndFire(true)}
                  disabled={isEditing}
                  style={[styles.fireDeltaBtn, { backgroundColor: BRAND_COLORS.blue600, flex: 1 }]}
                >
                  {isEditing ? (
                    <ActivityIndicator color="#FFF" style={{ marginRight: 6 }} />
                  ) : (
                    <Printer size={15} color="#FFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.fireDeltaBtnText}>Fire Changes & Print Delta KOT</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BILL & ITEMS MANAGEMENT SECTION */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                  Order Items ({activeExistingItems.length + pendingNewItems.length})
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                  Adjust quantities, void items, or add instructions
                </Text>
              </View>

              {isOrderEditable && (
                <TouchableOpacity
                  onPress={() => setShowAddItemModal(true)}
                  style={[styles.addItemTopBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                >
                  <Plus size={14} color="#FFF" />
                  <Text style={styles.addItemTopBtnText}>+ Add Item</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Existing Items */}
            {order.items.map((it) => {
              const isVoided = !!voidedItems[it.id];
              const voidReason = voidedItems[it.id];
              const currentQty = itemQuantities[it.id] ?? it.quantity;
              const currentNote = itemNotes[it.id] ?? it.notes;

              return (
                <View
                  key={it.id}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: theme.borderColor },
                    isVoided && styles.itemRowVoided,
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: theme.textPrimary },
                        isVoided && styles.itemNameVoided,
                      ]}
                    >
                      {it.productName}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginTop: 1 }}>
                      {formatCurrency(it.unitPrice)} each
                    </Text>

                    {currentNote ? (
                      <Text style={[styles.itemNoteText, isVoided && { textDecorationLine: 'line-through' }]}>
                        note: {currentNote}
                      </Text>
                    ) : null}

                    {isVoided && (
                      <View style={styles.voidBadge}>
                        <Text style={styles.voidBadgeText}>VOIDED: {voidReason}</Text>
                      </View>
                    )}
                  </View>

                  {/* Quantity and Actions */}
                  {isOrderEditable && !isVoided ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (currentQty > 1) {
                            setItemQuantities((prev) => ({ ...prev, [it.id]: currentQty - 1 }));
                          } else {
                            setVoidingItemId(it.id);
                          }
                        }}
                        style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                      >
                        <Minus size={13} color={theme.textPrimary} />
                      </TouchableOpacity>

                      <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{currentQty}</Text>

                      <TouchableOpacity
                        onPress={() => setItemQuantities((prev) => ({ ...prev, [it.id]: currentQty + 1 }))}
                        style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                      >
                        <Plus size={13} color={theme.textPrimary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setEditingNoteItemId(it.id);
                          setItemNoteText(currentNote || '');
                        }}
                        style={[styles.noteEditBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                      >
                        <Edit3 size={13} color={BRAND_COLORS.blue600} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setVoidingItemId(it.id)}
                        style={[styles.voidBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                      >
                        <Trash2 size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.itemPrice, { color: isVoided ? theme.textSecondary : theme.textPrimary }]}>
                      {isVoided ? 'VOID' : formatCurrency(it.unitPrice * currentQty)}
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Pending Newly Added Items in Draft */}
            {pendingNewItems.map((draft) => (
              <View key={draft.tempId} style={[styles.itemRow, styles.draftItemRow, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={styles.newPill}>
                      <Text style={styles.newPillText}>+ NEW</Text>
                    </View>
                    <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                      {draft.productName}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND_COLORS.blue600, marginTop: 1 }}>
                    {formatCurrency(draft.unitPrice)} each
                  </Text>
                  {draft.notes ? (
                    <Text style={styles.itemNoteText}>note: {draft.notes}</Text>
                  ) : null}
                </View>

                {isOrderEditable ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (draft.quantity > 1) {
                          setPendingNewItems((prev) =>
                            prev.map((p) => (p.tempId === draft.tempId ? { ...p, quantity: p.quantity - 1 } : p))
                          );
                        } else {
                          setPendingNewItems((prev) => prev.filter((p) => p.tempId !== draft.tempId));
                        }
                      }}
                      style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                    >
                      <Minus size={13} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{draft.quantity}</Text>

                    <TouchableOpacity
                      onPress={() =>
                        setPendingNewItems((prev) =>
                          prev.map((p) => (p.tempId === draft.tempId ? { ...p, quantity: p.quantity + 1 } : p))
                        )
                      }
                      style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                    >
                      <Plus size={13} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setPendingNewItems((prev) => prev.filter((p) => p.tempId !== draft.tempId))}
                      style={[styles.voidBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                    >
                      <Trash2 size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.itemPrice, { color: BRAND_COLORS.blue600 }]}>
                    {formatCurrency(draft.unitPrice * draft.quantity)}
                  </Text>
                )}
              </View>
            ))}

            {/* Total Section */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.borderColor }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: theme.textPrimary }}>
                Billable Order Total
              </Text>
              <Text style={{ fontSize: 19, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                {formatCurrency(liveSubtotal)}
              </Text>
            </View>
          </View>

          {/* Settle / Bill Button */}
          {isOrderEditable ? (
            <TouchableOpacity
              onPress={() => setShowSettleModal(true)}
              style={[styles.settleBtn, { backgroundColor: '#10B981' }]}
            >
              <Receipt size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.settleBtnText}>Generate Bill & Checkout ({formatCurrency(liveSubtotal)})</Text>
            </TouchableOpacity>
          ) : order.sale ? (
            <View style={[styles.billedBanner, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#10B981', marginLeft: 8 }}>
                Billed on Invoice #{order.sale.invoiceNumber}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* VOID ITEM REASON MODAL */}
        <Modal visible={!!voidingItemId} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.alertCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <AlertTriangle size={20} color="#EF4444" />
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Void Item Reason</Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                Please select a mandatory void reason for kitchen waste audit:
              </Text>

              {VOID_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedVoidReason(reason)}
                  style={[
                    styles.reasonOption,
                    {
                      backgroundColor: selectedVoidReason === reason ? BRAND_COLORS.navyInk : theme.bg,
                      borderColor: selectedVoidReason === reason ? BRAND_COLORS.navyInk : theme.borderColor,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: selectedVoidReason === reason ? '#FFF' : theme.textPrimary }}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {selectedVoidReason === 'Other / Guest request' && (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, marginTop: 6 }]}
                  placeholder="Specify custom reason..."
                  placeholderTextColor="#94A3B8"
                  value={customVoidReason}
                  onChangeText={setCustomVoidReason}
                />
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => setVoidingItemId(null)}
                  style={[styles.modalCancelBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmVoid}
                  style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>Confirm Void</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* EDIT ITEM NOTE MODAL */}
        <Modal visible={!!editingNoteItemId} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.alertCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, marginBottom: 8 }]}>Special Cooking Note</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary, minHeight: 60 }]}
                placeholder="e.g. extra spicy, no onions, butter on top..."
                placeholderTextColor="#94A3B8"
                value={itemNoteText}
                onChangeText={setItemNoteText}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => setEditingNoteItemId(null)}
                  style={[styles.modalCancelBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (editingNoteItemId) {
                      setItemNotes((prev) => ({ ...prev, [editingNoteItemId]: itemNoteText.trim() }));
                      setEditingNoteItemId(null);
                    }
                  }}
                  style={[styles.modalConfirmBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ADD ITEM CATALOG MODAL */}
        <Modal visible={showAddItemModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, maxHeight: '85%' }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Add Item to Order</Text>
                <TouchableOpacity onPress={() => setShowAddItemModal(false)}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Product Search & + New Dish Button */}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={[styles.searchBox, { backgroundColor: theme.bg, borderColor: theme.borderColor, flex: 1 }]}>
                  <Search size={16} color={theme.textSecondary} />
                  <TextInput
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholder="Search food item..."
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.searchInput, { color: theme.textPrimary }]}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setShowAddFoodModal(true)}
                  style={{
                    backgroundColor: BRAND_COLORS.navyInk,
                    paddingHorizontal: 12,
                    height: 38,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={14} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>+ Dish</Text>
                </TouchableOpacity>
              </View>

              {/* Products List */}
              <FlatList
                data={products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 200, marginVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedProductToAdd?.id === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedProductToAdd(item)}
                      style={[
                        styles.catalogItemRow,
                        {
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : theme.bg,
                          borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catalogItemName, { color: theme.textPrimary }]}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatCurrency(item.sellingPrice)}</Text>
                      </View>
                      {isSelected && <CheckCircle2 size={18} color={BRAND_COLORS.blue600} />}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Quantity & Note */}
              {selectedProductToAdd && (
                <View style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>Quantity:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => setNewProductQty(Math.max(1, newProductQty - 1))}
                        style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                      >
                        <Minus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{newProductQty}</Text>
                      <TouchableOpacity
                        onPress={() => setNewProductQty(newProductQty + 1)}
                        style={[styles.qtyBtn, { backgroundColor: theme.bg, borderColor: theme.borderColor }]}
                      >
                        <Plus size={14} color={theme.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                    placeholder="Cooking note (e.g. extra spicy)..."
                    placeholderTextColor="#94A3B8"
                    value={newProductNote}
                    onChangeText={setNewProductNote}
                  />

                  <TouchableOpacity
                    onPress={handleAddProductToDraft}
                    style={[styles.confirmBillBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                  >
                    <Plus size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmBillBtnText}>Add to Draft</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* SETTLE BILL MODAL */}
        <Modal visible={showSettleModal} transparent animationType="slide">
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                    Settle KOT #{order.orderNumber}
                  </Text>
                  <TouchableOpacity onPress={() => setShowSettleModal(false)}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Customer Details */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Guest / Customer Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={customerNameInput}
                      onChangeText={setCustomerNameInput}
                      placeholder="e.g. Table 2 / Guest"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Phone Number</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={customerPhoneInput}
                      onChangeText={setCustomerPhoneInput}
                      placeholder="Optional"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Payment Method Selector */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Payment Mode</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {[
                    { id: 'cash' as const, label: 'Cash', icon: Banknote },
                    { id: 'upi' as const, label: 'UPI / QR', icon: QrCode },
                    { id: 'card' as const, label: 'Card', icon: CreditCard },
                  ].map((m) => {
                    const active = paymentMethod === m.id;
                    const Icon = m.icon;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => setPaymentMethod(m.id)}
                        style={[
                          styles.payModeChip,
                          {
                            backgroundColor: active ? BRAND_COLORS.navyInk : theme.bg,
                            borderColor: active ? BRAND_COLORS.navyInk : theme.borderColor,
                          },
                        ]}
                      >
                        <Icon size={14} color={active ? '#FFF' : theme.textSecondary} />
                        <Text style={[styles.payModeText, { color: active ? '#FFF' : theme.textSecondary }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Discount */}
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Discount (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Final Net Payable:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                    {formatCurrency(Math.max(0, liveSubtotal - (parseFloat(discountAmount) || 0)))}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleGenerateBill}
                  disabled={isGeneratingBill}
                  style={[styles.confirmBillBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                >
                  {isGeneratingBill ? (
                    <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Receipt size={16} color="#FFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.confirmBillBtnText}>Print Customer Bill & Mark Settled</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* ADD FOOD DISH MODAL */}
        <AddFoodItemModal
          visible={showAddFoodModal}
          onClose={() => setShowAddFoodModal(false)}
          onItemCreated={(newDish) => {
            if (newDish) {
              setSelectedProductToAdd(newDish);
            }
          }}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  headerBadge: { fontSize: 9, fontWeight: '900', color: BRAND_COLORS.sky500, letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  printSlipBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 4 },
  printSlipBtnText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 },
  card: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  cardHeadline: { fontSize: 16, fontWeight: '900' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  noteBox: { borderRadius: 10, padding: 8, borderWidth: 1, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  stepBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  deltaChip: { padding: 8, borderRadius: 8 },
  deltaChipText: { fontSize: 11, fontWeight: '800' },
  saveDraftBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fireDeltaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  fireDeltaBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  addItemTopBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  addItemTopBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  itemRowVoided: { opacity: 0.6 },
  draftItemRow: { backgroundColor: 'rgba(16, 185, 129, 0.05)', paddingHorizontal: 6, borderRadius: 8 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemNameVoided: { textDecorationLine: 'line-through', color: '#EF4444' },
  itemNoteText: { fontSize: 10, color: '#F59E0B', fontStyle: 'italic', marginTop: 2 },
  voidBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  voidBadgeText: { fontSize: 9, fontWeight: '900', color: '#EF4444' },
  newPill: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  newPillText: { fontSize: 9, fontWeight: '900', color: '#10B981' },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 13, fontWeight: '900', minWidth: 16, textAlign: 'center' },
  noteEditBtn: { padding: 6, borderRadius: 8, borderWidth: 1 },
  voidBtn: { padding: 6, borderRadius: 8 },
  itemPrice: { fontSize: 13, fontWeight: '900' },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, marginTop: 4 },
  settleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  billedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 },
  alertCard: { borderRadius: 20, padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  reasonOption: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 12, marginLeft: 6 },
  catalogItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  catalogItemName: { fontSize: 12, fontWeight: '700' },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 },
  payModeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 4 },
  payModeText: { fontSize: 12, fontWeight: '800' },
  confirmBillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  confirmBillBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
