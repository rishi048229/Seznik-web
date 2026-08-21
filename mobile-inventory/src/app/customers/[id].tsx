import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  MessageCircle,
  CheckCircle2,
  Receipt,
  X,
  ChevronDown,
  ChevronUp,
  Edit3,
  PlusCircle,
  FileDown,
  ShoppingBag,
  Calendar,
  TrendingUp,
  Notebook,
  StickyNote,
} from 'lucide-react-native';
import { useCustomerLedger, useCredits, useSendReminder } from '@/hooks/useCredits';
import { useCustomers } from '@/hooks/useCustomers';
import { useSettings } from '@/hooks/useSettings';
import { buildBillReminderMessage, buildBalanceReminderMessage } from '@/utils/reminderMessage';
import { shareBillReceiptPdf } from '@/utils/shareBillReceipt';
import type { CustomerBill } from '@/api/credits';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { CustomerLedgerSkeleton } from '@/components/ui/ScreenSkeleton';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

const AGEING_COLORS: Record<string, string> = {
  '0-7': '#F59E0B',
  '8-15': '#F97316',
  '16-30': '#EF4444',
  '30+': '#B91C1C',
};

export default function CustomerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const { ledger, isLoading } = useCustomerLedger(id || null);
  const { settings } = useSettings();
  const { recordCreditPayment, addManualCredit } = useCredits();
  const { sendReminder } = useSendReminder();
  const { updateCustomer } = useCustomers();

  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [sendingBillId, setSendingBillId] = useState<string | null>(null);
  const [sharingBillId, setSharingBillId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [addCreditAmount, setAddCreditAmount] = useState('');
  const [addCreditNotes, setAddCreditNotes] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Follow-Up CRM Notes State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [followUpLogs, setFollowUpLogs] = useState<Array<{ id: string; date: string; note: string }>>([]);

  const sendBillReminder = async (bill: CustomerBill) => {
    const phone = ledger?.customer.phone;
    if (!phone) {
      Alert.alert('No Phone Number', 'This customer has no phone number on file.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = buildBillReminderMessage(settings, ledger?.customer.name || 'Customer', bill, ledger?.customer.daysOverdue);
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
    try {
      setSendingBillId(bill.id);
      await Linking.openURL(url);
      await sendReminder({ customerId: id as string, amount: bill.outstandingAmount });
    } catch {
      Alert.alert('Error', 'Unable to open WhatsApp');
    } finally {
      setSendingBillId(null);
    }
  };

  const shareBillPdf = async (bill: CustomerBill) => {
    try {
      setSharingBillId(bill.id);
      await shareBillReceiptPdf(settings, ledger?.customer.name || 'Customer', bill, ledger?.customer.daysOverdue);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create the bill PDF.');
    } finally {
      setSharingBillId(null);
    }
  };

  const sendTotalBalanceReminder = async () => {
    const phone = ledger?.customer.phone;
    if (!phone || !ledger) {
      Alert.alert('No Phone Number', 'This customer has no phone number on file.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = buildBalanceReminderMessage(settings, ledger.customer.name, ledger.customer.creditBalance, ledger.customer.daysOverdue);
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
      await sendReminder({ customerId: id as string, amount: ledger.customer.creditBalance });
    } catch {
      Alert.alert('Error', 'Unable to open WhatsApp');
    }
  };

  const handleCall = () => {
    const phone = ledger?.customer.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Unable to start a call.'));
  };

  const handleRecordPayment = async () => {
    if (!payAmount.trim() || !id) return;
    try {
      await recordCreditPayment({ customerId: id, amount: parseFloat(payAmount) });
      setShowPayModal(false);
      setPayAmount('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record payment');
    }
  };

  const handleAddCredit = async () => {
    if (!addCreditAmount.trim() || !id) return;
    try {
      await addManualCredit({ customerId: id, amount: parseFloat(addCreditAmount), notes: addCreditNotes.trim() || undefined });
      setShowAddCreditModal(false);
      setAddCreditAmount('');
      setAddCreditNotes('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record credit');
    }
  };

  const openEditModal = () => {
    if (!ledger) return;
    setEditName(ledger.customer.name);
    setEditPhone(ledger.customer.phone || '');
    setEditAddress(ledger.customer.address || '');
    setEditCreditLimit(String(ledger.customer.creditLimit ?? 0));
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPhone.trim() || !id) {
      Alert.alert('Required Fields', 'Name and phone number are required.');
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateCustomer({
        id,
        payload: {
          name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim() || undefined,
          creditLimit: parseFloat(editCreditLimit) || 0,
        },
      });
      setShowEditModal(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update customer');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading || !ledger) {
    return (
      <ScreenLoadingState
        message="Loading customer ledger..."
        hint="Fetching credit history, bills, and account details"
        skeleton={<CustomerLedgerSkeleton />}
        fullScreen
      />
    );
  }

  const { customer, bills, sales } = ledger;
  const unpaidBills = bills.filter((b) => !b.isPaid);

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={theme.textSecondary} />
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openEditModal} style={styles.editIconBtn}>
          <Edit3 size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Profile */}
        <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.customerName, { color: theme.textPrimary }]}>{customer.name}</Text>
            {customer.phone ? (
              <View style={styles.metaRow}>
                <Phone size={12} color={theme.textSecondary} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{customer.phone}</Text>
              </View>
            ) : null}
            {customer.address ? (
              <View style={styles.metaRow}>
                <MapPin size={12} color={theme.textSecondary} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{customer.address}</Text>
              </View>
            ) : null}
          </View>
          {customer.phone ? (
            <TouchableOpacity onPress={handleCall} style={styles.callBtn}>
              <PhoneCall size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <TrendingUp size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>₹{customer.totalSpent.toFixed(0)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lifetime Spend</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <ShoppingBag size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{customer.totalVisits}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Visits</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Calendar size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.statValue, { color: theme.textPrimary, fontSize: 11 }]}>
              {customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString() : 'Never'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Last Visit</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Clock size={14} color={BRAND_COLORS.blue600} />
            <Text style={[styles.statValue, { color: theme.textPrimary, fontSize: 11 }]}>
              {new Date(customer.customerSince).toLocaleDateString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Customer Since</Text>
          </View>
        </View>

        {/* Balance summary */}
        <View style={[styles.balanceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Outstanding Balance</Text>
            <Text style={[styles.balanceValue, { color: customer.creditBalance > 0 ? '#EF4444' : '#10B981' }]}>
              ₹{customer.creditBalance.toFixed(2)}
            </Text>
            {customer.ageingBucket ? (
              <View style={[styles.ageingBadge, { backgroundColor: AGEING_COLORS[customer.ageingBucket] }]}>
                <Clock size={10} color="#FFFFFF" />
                <Text style={styles.ageingBadgeText}>
                  Owing {customer.daysOverdue} day(s) — since {new Date(customer.oldestUnpaidSince as string).toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <Text style={[styles.metaText, { color: '#10B981', marginTop: 4 }]}>Fully settled ✓</Text>
            )}
            <Text style={[styles.metaText, { color: theme.textSecondary, marginTop: 6 }]}>
              Credit Limit: ₹{customer.creditLimit.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.actionsWrap}>
          {customer.creditBalance > 0 ? (
            <TouchableOpacity onPress={() => setShowPayModal(true)} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
              <CheckCircle2 size={15} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Record Payment</Text>
            </TouchableOpacity>
          ) : null}
          {customer.creditBalance > 0 ? (
            <TouchableOpacity onPress={sendTotalBalanceReminder} style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}>
              <MessageCircle size={15} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Remind Total</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setShowAddCreditModal(true)} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}>
            <PlusCircle size={15} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Udhaar Diya</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNoteModal(true)} style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}>
            <Notebook size={15} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Follow-up Note</Text>
          </TouchableOpacity>
        </View>

        {/* CRM Follow-Up Notes Section */}
        {followUpLogs.length > 0 ? (
          <View style={{ marginTop: 12, marginBottom: 14 }}>
            <Text style={styles.sectionHeader}>FOLLOW-UP NOTES & PROMISES ({followUpLogs.length})</Text>
            {followUpLogs.map((log) => (
              <View key={log.id} style={[styles.billCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, padding: 12, marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <StickyNote size={14} color="#8B5CF6" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary }}>
                    {new Date(log.date).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, lineHeight: 18 }}>
                  {log.note}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Old Bills */}
        <Text style={[styles.sectionHeader, { marginTop: 6 }]}>
          {unpaidBills.length > 0 ? `UNPAID BILLS (${unpaidBills.length})` : 'CREDIT BILL HISTORY'}
        </Text>
        {bills.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No credit bills for this customer yet.</Text>
        ) : (
          bills.map((bill) => {
            const isExpanded = expandedBillId === bill.id;
            return (
              <View key={bill.id} style={[styles.billCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <TouchableOpacity
                  style={styles.billHeaderRow}
                  onPress={() => setExpandedBillId(isExpanded ? null : bill.id)}
                >
                  <Receipt size={16} color={bill.isPaid ? '#10B981' : '#EF4444'} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.billTitle, { color: theme.textPrimary }]}>
                      {bill.invoiceNumber ? `Invoice ${bill.invoiceNumber}` : 'Manual Credit Entry'}
                    </Text>
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {new Date(bill.date).toLocaleDateString()} · Original ₹{bill.originalAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.billAmount, { color: bill.isPaid ? '#10B981' : '#EF4444' }]}>
                      {bill.isPaid ? 'Paid' : `₹${bill.outstandingAmount.toFixed(2)}`}
                    </Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={16} color={theme.textSecondary} style={{ marginLeft: 8 }} />
                  ) : (
                    <ChevronDown size={16} color={theme.textSecondary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>

                {isExpanded ? (
                  <View style={styles.billExpanded}>
                    {bill.items && bill.items.length > 0 ? (
                      bill.items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={[styles.itemText, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.productName} × {item.quantity}
                          </Text>
                          <Text style={[styles.itemText, { color: theme.textSecondary }]}>
                            ₹{(item.total ?? (item.unitPrice || 0) * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    ) : bill.notes ? (
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{bill.notes}</Text>
                    ) : (
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>No item details for this entry.</Text>
                    )}

                    {!bill.isPaid ? (
                      <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={() => sendBillReminder(bill)}
                          disabled={sendingBillId === bill.id}
                          style={[styles.actionBtn, { backgroundColor: '#F59E0B', marginRight: 8 }]}
                        >
                          {sendingBillId === bill.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <MessageCircle size={13} color="#FFFFFF" />
                              <Text style={styles.actionBtnText}>Send Reminder</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => shareBillPdf(bill)}
                          disabled={sharingBillId === bill.id}
                          style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                        >
                          {sharingBillId === bill.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <FileDown size={13} color="#FFFFFF" />
                              <Text style={styles.actionBtnText}>Share Bill PDF</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {/* All Invoices */}
        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>ALL INVOICES ({sales.length})</Text>
        {sales.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No purchases recorded yet.</Text>
        ) : (
          sales.map((sale) => (
            <View key={sale.id} style={[styles.invoiceRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.billTitle, { color: theme.textPrimary }]}>{sale.invoiceNumber}</Text>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {new Date(sale.createdAt).toLocaleDateString()} · {sale.paymentMethod.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.billAmount, { color: theme.textPrimary }]}>₹{sale.grandTotal.toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={showPayModal} animationType="fade" transparent onRequestClose={() => setShowPayModal(false)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.metaText, { color: theme.textSecondary, marginBottom: 10 }]}>
              {customer.name} owes ₹{customer.creditBalance.toFixed(2)}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Amount received"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={payAmount}
              onChangeText={setPayAmount}
            />
            <TouchableOpacity onPress={handleRecordPayment} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600, justifyContent: 'center' }]}>
              <Text style={styles.actionBtnText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Add Credit (Udhaar Diya) Modal */}
      <Modal visible={showAddCreditModal} animationType="fade" transparent onRequestClose={() => setShowAddCreditModal(false)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Give Credit (Udhaar)</Text>
              <TouchableOpacity onPress={() => setShowAddCreditModal(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.metaText, { color: theme.textSecondary, marginBottom: 10 }]}>
              Record credit given to {customer.name} outside a POS sale (e.g. goods given on trust).
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Amount"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={addCreditAmount}
              onChangeText={setAddCreditAmount}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Notes (optional)"
              placeholderTextColor="#94A3B8"
              value={addCreditNotes}
              onChangeText={setAddCreditNotes}
            />
            <TouchableOpacity onPress={handleAddCredit} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.navyInk, justifyContent: 'center' }]}>
              <Text style={styles.actionBtnText}>Add Credit</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal visible={showEditModal} animationType="fade" transparent onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit Customer</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Name"
              placeholderTextColor="#94A3B8"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={editPhone}
              onChangeText={setEditPhone}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Address (optional)"
              placeholderTextColor="#94A3B8"
              value={editAddress}
              onChangeText={setEditAddress}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Credit Limit"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={editCreditLimit}
              onChangeText={setEditCreditLimit}
            />
            <TouchableOpacity onPress={handleSaveEdit} disabled={isSavingEdit} style={[styles.actionBtn, { backgroundColor: BRAND_COLORS.blue600, justifyContent: 'center' }]}>
              {isSavingEdit ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Add Follow-Up Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Log Follow-Up Note</Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor, minHeight: 80 }]}
              placeholder="e.g. Spoke on call, customer promised to pay ₹2000 on Friday"
              placeholderTextColor="#94A3B8"
              multiline
              value={noteText}
              onChangeText={setNoteText}
            />
            <TouchableOpacity
              onPress={() => {
                if (!noteText.trim()) return;
                setFollowUpLogs((prev) => [{ id: `note-${Date.now()}`, date: new Date().toISOString(), note: noteText.trim() }, ...prev]);
                setNoteText('');
                setShowNoteModal(false);
              }}
              style={[styles.actionBtn, { backgroundColor: '#8B5CF6', justifyContent: 'center', marginTop: 8 }]}
            >
              <Text style={styles.actionBtnText}>Save Follow-up Log</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>
    </SafeAreaView>
    </ScreenBackground>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  editIconBtn: { padding: 6 },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 14, marginBottom: 12 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: BRAND_COLORS.blue600, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  customerName: { fontSize: 17, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 11, marginLeft: 4 },
  callBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  statTile: { width: '48%', padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 8, marginRight: '4%', alignItems: 'flex-start' },
  statValue: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  statLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  balanceCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  balanceLabel: { fontSize: 11, fontWeight: '700' },
  balanceValue: { fontSize: 26, fontWeight: '900', marginTop: 2 },
  ageingBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
  ageingBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12, marginRight: 8, marginBottom: 8, minWidth: '30%' },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, marginLeft: 6 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },
  emptyText: { fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  billCard: { borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  billHeaderRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  billTitle: { fontSize: 13, fontWeight: '800' },
  billAmount: { fontSize: 14, fontWeight: '900' },
  billExpanded: { paddingHorizontal: 14, paddingBottom: 14 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemText: { fontSize: 11, flex: 1 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  payModalSheet: { width: '100%', maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 18 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 12 },
});
