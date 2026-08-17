import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Share2,
  DollarSign,
  CreditCard,
  Bell,
  TrendingUp,
  AlertTriangle,
  SlidersHorizontal,
  Wallet,
  Clock,
  MessageCircle,
  X,
  ChevronRight,
  Receipt,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  useDaybook,
  useCredits,
  useRemindersDue,
  useSendReminder,
  useDayClose,
} from '@/hooks/useCredits';
import { useCustomers } from '@/hooks/useCustomers';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/api/settings';
import { buildBillReminderMessage, buildBalanceReminderMessage } from '@/utils/reminderMessage';
import type { ReminderDue } from '@/api/credits';
import type { Customer } from '@/types/customer';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

type AgeingBucket = '0-7' | '8-15' | '16-30' | '30+';

const AGEING_COLORS: Record<AgeingBucket, string> = {
  '0-7': '#F59E0B',
  '8-15': '#F97316',
  '16-30': '#EF4444',
  '30+': '#B91C1C',
};

const daysOverdueFor = (oldestUnpaidSince?: string | null): number => {
  if (!oldestUnpaidSince) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(oldestUnpaidSince).getTime()) / (1000 * 60 * 60 * 24)));
};

const ageingBucketFor = (days: number): AgeingBucket => {
  if (days <= 7) return '0-7';
  if (days <= 15) return '8-15';
  if (days <= 30) return '16-30';
  return '30+';
};

export default function CreditsDaybookScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const { daybook, isLoading: isDaybookLoading } = useDaybook();
  const { recordCreditPayment } = useCredits();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const { dayClose, closeDayRegister, isClosing } = useDayClose();

  const reminderConfig = settings?.notificationConfig?.creditReminders || {};
  const thresholdDays: number = typeof reminderConfig.thresholdDays === 'number' ? reminderConfig.thresholdDays : 30;
  const cooldownDays: number = typeof reminderConfig.cooldownDays === 'number' ? reminderConfig.cooldownDays : 7;

  const { remindersDue, isLoading: isRemindersLoading, refetch: refetchReminders } = useRemindersDue(
    thresholdDays,
    cooldownDays
  );
  const { sendReminder } = useSendReminder();

  const [activeTab, setActiveTab] = useState<'daybook' | 'credits'>('daybook');
  const [searchQuery, setSearchQuery] = useState('');
  const [payCustomerModal, setPayCustomerModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(thresholdDays));
  const [cooldownInput, setCooldownInput] = useState(String(cooldownDays));
  const [savingReminderSettings, setSavingReminderSettings] = useState(false);
  const [showCloseRegister, setShowCloseRegister] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [batchSendIndex, setBatchSendIndex] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const moneyIn = daybook?.moneyIn || 0;
  const moneyOut = daybook?.moneyOut || 0;
  const netCash = daybook?.netBalance || 0;
  const creditGiven = daybook?.creditGiven || 0;
  const creditCollectedToday = daybook?.creditCollectedToday || 0;
  const gst = daybook?.gstCollectedToday;

  const customersWithAgeing = useMemo(() => {
    const filtered = customers.filter((c) => {
      if (!searchQuery.trim()) return true;
      return c.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
    return filtered
      .map((c) => {
        const daysOverdue = daysOverdueFor(c.oldestUnpaidSince);
        return { ...c, daysOverdue, ageingBucket: c.oldestUnpaidSince ? ageingBucketFor(daysOverdue) : null };
      })
      .sort((a, b) => b.creditBalance - a.creditBalance);
  }, [customers, searchQuery]);

  const handleRecordPayment = async () => {
    if (!payCustomerModal || !payAmount.trim()) return;
    try {
      await recordCreditPayment({
        customerId: payCustomerModal.id,
        amount: parseFloat(payAmount),
      });
      Alert.alert('Payment Recorded!', `Recorded payment of ₹${payAmount} from ${payCustomerModal.name}`);
      setPayCustomerModal(null);
      setPayAmount('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record payment');
    }
  };

  const sendReminderTo = async (item: ReminderDue) => {
    if (!item.phone) {
      Alert.alert('No Phone Number', `${item.name} has no phone number on file.`);
      return false;
    }
    const cleanPhone = item.phone.replace(/[^0-9]/g, '');
    // Prefer the specific bill driving the overdue status (a proper receipt-style message) —
    // fall back to a lump-sum reminder only when there's no linked bill (e.g. manual credit).
    const text = item.oldestUnpaidBill
      ? buildBillReminderMessage(settings, item.name, item.oldestUnpaidBill, item.daysOverdue)
      : buildBalanceReminderMessage(settings, item.name, item.creditBalance, item.daysOverdue);
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
    try {
      setSendingId(item.id);
      await Linking.openURL(url);
      await sendReminder({ customerId: item.id, amount: item.creditBalance });
      return true;
    } catch {
      Alert.alert('Error', 'Unable to open WhatsApp');
      return false;
    } finally {
      setSendingId(null);
    }
  };

  const handleSaveReminderSettings = async () => {
    if (!settings?.id) return;
    const threshold = Math.max(0, parseInt(thresholdInput, 10) || 0);
    const cooldown = Math.max(0, parseInt(cooldownInput, 10) || 0);
    setSavingReminderSettings(true);
    try {
      await settingsApi.updateNotificationConfig(settings.id, {
        ...(settings.notificationConfig || {}),
        creditReminders: { enabled: true, thresholdDays: threshold, cooldownDays: cooldown },
      });
      setShowReminderSettings(false);
      refetchReminders();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save reminder settings');
    } finally {
      setSavingReminderSettings(false);
    }
  };

  const handleCloseRegister = async () => {
    if (!countedCashInput.trim()) return;
    try {
      await closeDayRegister({ countedCash: parseFloat(countedCashInput) });
      setShowCloseRegister(false);
      setCountedCashInput('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to close register');
    }
  };

  const handleShareDaybook = () => {
    const text =
      `*Seznik POS Daybook Ledger*\nMoney In: ₹${moneyIn.toFixed(2)}\nMoney Out: ₹${moneyOut.toFixed(2)}\n` +
      `Net Cashflow: ₹${netCash.toFixed(2)}\nCredit Given Today: ₹${creditGiven.toFixed(2)}\n` +
      `Credit Collected Today: ₹${creditCollectedToday.toFixed(2)}\n` +
      (gst ? `GST Collected: ₹${gst.total.toFixed(2)} (CGST ₹${gst.cgst.toFixed(2)} + SGST ₹${gst.sgst.toFixed(2)})\n` : '') +
      `Reminders Sent Today: ${daybook?.remindersSentToday || 0}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const batchCustomer = batchSendIndex !== null ? remindersDue[batchSendIndex] : null;

  return (
    <ScreenBackground color={theme.bg}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.mainWrapper}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareDaybook} style={styles.shareBtn}>
            <Share2 size={14} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>Share Ledger</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>Daybook & Credits</Text>

        {/* Tab Switcher */}
        <View style={[styles.tabRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('daybook')}
            style={[styles.tabBtn, activeTab === 'daybook' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'daybook' && styles.tabTextActive]}>Daily Cashflow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('credits')}
            style={[styles.tabBtn, activeTab === 'credits' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'credits' && styles.tabTextActive]}>Credit Ledger</Text>
            {remindersDue.length > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{remindersDue.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {activeTab === 'daybook' ? (
          isDaybookLoading ? (
            <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginTop: 40 }} />
          ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.sectionHeader}>CASHFLOW METRICS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <ArrowDownLeft size={20} color="#10B981" />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Money In</Text>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>+₹{moneyIn.toFixed(2)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <ArrowUpRight size={20} color="#EF4444" />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Money Out</Text>
                <Text style={[styles.kpiValue, { color: '#EF4444' }]}>-₹{moneyOut.toFixed(2)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <DollarSign size={20} color={BRAND_COLORS.blue600} />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Net Balance</Text>
                <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>₹{netCash.toFixed(2)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <CreditCard size={20} color="#F59E0B" />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Udhar Diya (Credit Given)</Text>
                <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>₹{creditGiven.toFixed(2)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Wallet size={20} color="#10B981" />
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Udhar Wasooli (Collected)</Text>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>₹{creditCollectedToday.toFixed(2)}</Text>
              </View>
              {gst ? (
                <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Receipt size={20} color={BRAND_COLORS.blue600} />
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>GST Collected</Text>
                  <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>₹{gst.total.toFixed(2)}</Text>
                  <Text style={[styles.kpiSubtext, { color: theme.textSecondary }]}>
                    CGST ₹{gst.cgst.toFixed(2)} + SGST ₹{gst.sgst.toFixed(2)}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <Text style={styles.sectionHeader}>PAYMENT MODE BREAKDOWN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {(daybook?.paymentModeBreakdown || []).length === 0 ? (
                <View style={[styles.stripPill, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <Text style={styles.pillLabel}>No collections yet today</Text>
                </View>
              ) : (
                daybook!.paymentModeBreakdown.map((m) => (
                  <View key={m.method} style={[styles.stripPill, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={styles.pillLabel}>{m.method.toUpperCase()}</Text>
                    <Text style={[styles.pillValue, { color: theme.textPrimary }]}>₹{m.amount.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <Text style={styles.sectionHeader}>TODAY AT A GLANCE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
              <View style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Bell size={16} color={BRAND_COLORS.blue600} />
                <Text style={[styles.glanceValue, { color: theme.textPrimary }]}>{daybook?.remindersSentToday || 0}</Text>
                <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>Reminders Sent</Text>
              </View>
              <View style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <TrendingUp size={16} color="#10B981" />
                <Text style={[styles.glanceValue, { color: theme.textPrimary, fontSize: 12 }]} numberOfLines={1}>
                  {daybook?.topSellingItemToday?.name || '—'}
                </Text>
                <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>
                  {daybook?.topSellingItemToday ? `${daybook.topSellingItemToday.unitsSold} sold today` : 'Top Seller'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/products')}
                style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={[styles.glanceValue, { color: theme.textPrimary }]}>{daybook?.lowStockAlertCount || 0}</Text>
                <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>Low Stock Alerts</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>CASH REGISTER</Text>
            {dayClose ? (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, marginBottom: 20 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txTitle, { color: theme.textPrimary }]}>Today&apos;s Register Closed</Text>
                  <Text style={[styles.txDate, { color: theme.textSecondary }]}>
                    Counted ₹{dayClose.countedCash.toFixed(2)} · Expected ₹{dayClose.expectedCash.toFixed(2)}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: Math.abs(dayClose.variance) < 1 ? '#10B981' : '#EF4444' }]}>
                  {dayClose.variance >= 0 ? '+' : ''}₹{dayClose.variance.toFixed(2)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCloseRegister(true)}
                style={[styles.closeRegisterBtn, { marginBottom: 20 }]}
              >
                <Wallet size={16} color="#FFFFFF" />
                <Text style={styles.closeRegisterBtnText}>Close Today&apos;s Register</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionHeader}>CHRONOLOGICAL TRANSACTIONS</Text>
            {(daybook?.transactions || []).length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No transactions yet today.</Text>
            ) : (
              daybook!.transactions.map((tx, idx) => (
                <View key={idx} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{tx.description}</Text>
                    <Text style={[styles.txDate, { color: theme.textSecondary }]}>
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.isCredit ? '#EF4444' : '#10B981' }]}>
                    {tx.isCredit ? '-' : '+'}₹{tx.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          )
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Reminders Due Today */}
            <View style={styles.remindersHeaderRow}>
              <Text style={styles.sectionHeader}>REMINDERS DUE TODAY ({remindersDue.length})</Text>
              <TouchableOpacity onPress={() => setShowReminderSettings(true)}>
                <SlidersHorizontal size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {isRemindersLoading ? (
              <ActivityIndicator size="small" color={BRAND_COLORS.blue600} style={{ marginBottom: 16 }} />
            ) : remindersDue.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary, marginBottom: 16 }]}>
                No one is overdue for a reminder right now 🎉
              </Text>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setBatchSendIndex(0)}
                  style={[styles.closeRegisterBtn, { backgroundColor: '#F59E0B', marginBottom: 10 }]}
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text style={styles.closeRegisterBtnText}>Send All ({remindersDue.length})</Text>
                </TouchableOpacity>
                {remindersDue.map((item) => (
                  <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{item.name}</Text>
                        <View style={[styles.ageingBadge, { backgroundColor: AGEING_COLORS[item.ageingBucket] }]}>
                          <Clock size={9} color="#FFFFFF" />
                          <Text style={styles.ageingBadgeText}>{item.daysOverdue}d</Text>
                        </View>
                      </View>
                      <Text style={[styles.txDate, { color: theme.textSecondary }]}>₹{item.creditBalance.toFixed(2)} outstanding</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => sendReminderTo(item)}
                      disabled={sendingId === item.id}
                      style={styles.payBtn}
                    >
                      {sendingId === item.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.payBtnText}>Send Reminder</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>ALL CUSTOMER BALANCES</Text>
            <View style={[styles.searchBoxLite, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Search size={15} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInputLite, { color: theme.textPrimary }]}
                placeholder="Search customers..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {customersWithAgeing.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/customers/${item.id}` as any)}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{item.name}</Text>
                    {item.ageingBucket ? (
                      <View style={[styles.ageingBadge, { backgroundColor: AGEING_COLORS[item.ageingBucket] }]}>
                        <Clock size={9} color="#FFFFFF" />
                        <Text style={styles.ageingBadgeText}>{item.daysOverdue}d</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.txDate, { color: theme.textSecondary }]}>📞 {item.phone}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, { color: item.creditBalance > 0 ? '#EF4444' : '#10B981' }]}>
                    ₹{item.creditBalance.toFixed(2)}
                  </Text>
                  {item.creditBalance > 0 ? (
                    <TouchableOpacity onPress={() => setPayCustomerModal(item)} style={styles.payBtn}>
                      <Text style={styles.payBtnText}>1-Tap Pay</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ChevronRight size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 1-Tap Pay Modal */}
      <Modal visible={!!payCustomerModal} animationType="fade" transparent onRequestClose={() => setPayCustomerModal(null)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPayCustomerModal(null)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.txDate, { color: theme.textSecondary, marginBottom: 10 }]}>
              {payCustomerModal?.name} owes ₹{payCustomerModal?.creditBalance.toFixed(2)}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Amount received"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={payAmount}
              onChangeText={setPayAmount}
            />
            <TouchableOpacity onPress={handleRecordPayment} style={styles.closeRegisterBtn}>
              <Text style={styles.closeRegisterBtnText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Reminder Settings Modal */}
      <Modal visible={showReminderSettings} animationType="fade" transparent onRequestClose={() => setShowReminderSettings(false)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Reminder Settings</Text>
              <TouchableOpacity onPress={() => setShowReminderSettings(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.txDate, { color: theme.textSecondary, marginBottom: 4 }]}>
              Remind customers once they&apos;re overdue by this many days:
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor, marginBottom: 12 }]}
              placeholder="Days overdue threshold (e.g. 30)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={thresholdInput}
              onChangeText={setThresholdInput}
            />
            <Text style={[styles.txDate, { color: theme.textSecondary, marginBottom: 4 }]}>
              Don&apos;t re-remind the same customer for this many days after sending:
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Cooldown days (e.g. 7)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={cooldownInput}
              onChangeText={setCooldownInput}
            />
            <TouchableOpacity onPress={handleSaveReminderSettings} disabled={savingReminderSettings} style={styles.closeRegisterBtn}>
              {savingReminderSettings ? <ActivityIndicator color="#FFF" /> : <Text style={styles.closeRegisterBtnText}>Save Settings</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Close Register Modal */}
      <Modal visible={showCloseRegister} animationType="fade" transparent onRequestClose={() => setShowCloseRegister(false)}>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Close Today&apos;s Register</Text>
              <TouchableOpacity onPress={() => setShowCloseRegister(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.txDate, { color: theme.textSecondary, marginBottom: 10 }]}>
              Count the cash in your till and enter it below — this is compared against today&apos;s cash sales minus expenses.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.borderColor }]}
              placeholder="Counted cash amount"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={countedCashInput}
              onChangeText={setCountedCashInput}
            />
            <TouchableOpacity onPress={handleCloseRegister} disabled={isClosing} style={styles.closeRegisterBtn}>
              {isClosing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.closeRegisterBtnText}>Close Register</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Batch Send Reminders Modal */}
      <Modal visible={batchSendIndex !== null} animationType="fade" transparent onRequestClose={() => setBatchSendIndex(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.payModalSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Sending Reminders {batchSendIndex !== null ? batchSendIndex + 1 : 0} / {remindersDue.length}
              </Text>
              <TouchableOpacity onPress={() => setBatchSendIndex(null)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {batchCustomer ? (
              <>
                <Text style={[styles.txTitle, { color: theme.textPrimary, marginBottom: 4 }]}>{batchCustomer.name}</Text>
                <Text style={[styles.txDate, { color: theme.textSecondary, marginBottom: 14 }]}>
                  ₹{batchCustomer.creditBalance.toFixed(2)} outstanding · {batchCustomer.daysOverdue} days overdue
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    await sendReminderTo(batchCustomer);
                    const next = (batchSendIndex ?? 0) + 1;
                    if (next < remindersDue.length) setBatchSendIndex(next);
                    else setBatchSendIndex(null);
                  }}
                  style={styles.closeRegisterBtn}
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text style={styles.closeRegisterBtnText}>Send via WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const next = (batchSendIndex ?? 0) + 1;
                    if (next < remindersDue.length) setBatchSendIndex(next);
                    else setBatchSendIndex(null);
                  }}
                  style={{ alignItems: 'center', marginTop: 10, paddingVertical: 8 }}
                >
                  <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 12 }}>Skip</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  shareBtn: { backgroundColor: BRAND_COLORS.navyInk, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  shareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  tabRow: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginVertical: 14 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: BRAND_COLORS.blue600 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },
  remindersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiCard: { width: 150, padding: 14, borderRadius: 18, borderWidth: 1, marginRight: 10 },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  kpiValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  kpiSubtext: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  stripPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginRight: 10 },
  pillLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  pillValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  glanceCard: { width: '31%', padding: 10, borderRadius: 14, borderWidth: 1, marginRight: '3.5%', marginBottom: 10, alignItems: 'flex-start' },
  glanceValue: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  glanceLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  closeRegisterBtn: { backgroundColor: BRAND_COLORS.blue600, borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  closeRegisterBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginLeft: 6 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txTitle: { fontSize: 14, fontWeight: '800' },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '900' },
  payBtn: { backgroundColor: BRAND_COLORS.blue600, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6, minWidth: 70, alignItems: 'center' },
  payBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  ageingBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  ageingBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', marginLeft: 2 },
  searchBoxLite: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInputLite: { flex: 1, marginLeft: 8, fontSize: 13 },
  emptyText: { fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  payModalSheet: { width: '100%', maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 18 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16, paddingTop: 14 },
  modalTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  modalSafeArea: { flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 12 },
});
