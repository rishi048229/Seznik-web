import React, { useState, useMemo } from 'react';
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
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Star,
  MessageSquare,
  FileText,
  Settings,
  CheckCircle2,
  Bell,
  PlusCircle,
  Edit3,
  Clock,
  TrendingUp,
  ShoppingBag,
  Calendar,
  History,
  Tag,
  ShieldCheck,
  Receipt,
  Banknote,
  ChevronDown,
  ChevronUp,
  FileDown,
  X,
  MoreVertical,
  Plus,
  StickyNote,
  Sparkles,
  Check,
  PhoneCall,
  Share2,
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

export default function CustomerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const { ledger, isLoading } = useCustomerLedger(id || null);
  const { settings } = useSettings();
  const { recordCreditPayment, addManualCredit } = useCredits();
  const { sendReminder } = useSendReminder();
  const { updateCustomer } = useCustomers();

  // Expanded bill state
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [sendingBillId, setSendingBillId] = useState<string | null>(null);
  const [sharingBillId, setSharingBillId] = useState<string | null>(null);

  // Modals state
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
  const [followUpLogs, setFollowUpLogs] = useState<Array<{ id: string; date: string; note: string }>>([
    {
      id: 'default-note-1',
      date: new Date().toISOString(),
      note: 'Customer promised to clear ₹1,000 on Monday via GPay.',
    },
  ]);

  // Customer Tags State
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [customerTags, setCustomerTags] = useState<string[]>([
    'Prefers WhatsApp Invoices',
    'Wholesale / Bulk',
    'Verified KYC',
  ]);

  // Activity Tab Filter
  const [activityTab, setActivityTab] = useState<'all' | 'purchases' | 'payments'>('all');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Send WhatsApp reminder for specific bill
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

  // Share bill receipt PDF
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

  // Send WhatsApp reminder for total balance
  const sendTotalBalanceReminder = async () => {
    const phone = ledger?.customer.phone;
    if (!phone || !ledger) {
      Alert.alert('No Phone Number', 'This customer has no phone number on file.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = buildBalanceReminderMessage(
      settings,
      ledger.customer.name,
      ledger.customer.creditBalance,
      ledger.customer.daysOverdue
    );
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
      await sendReminder({ customerId: id as string, amount: ledger.customer.creditBalance });
    } catch {
      Alert.alert('Error', 'Unable to open WhatsApp');
    }
  };

  // Quick Action Call
  const handleCall = () => {
    const phone = ledger?.customer.phone;
    if (!phone) {
      Alert.alert('No Phone', 'No phone number for this customer.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Unable to start call.'));
  };

  // Quick Action WhatsApp Direct
  const handleDirectWhatsApp = () => {
    const phone = ledger?.customer.phone;
    if (!phone) {
      Alert.alert('No Phone', 'No phone number for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${cleanPhone}`).catch(() => Alert.alert('Error', 'Unable to open WhatsApp.'));
  };

  // Quick Action SMS
  const handleSMS = () => {
    const phone = ledger?.customer.phone;
    if (!phone) {
      Alert.alert('No Phone', 'No phone number for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `Dear ${ledger?.customer.name || 'Customer'}, greetings from ${settings?.businessName || 'our store'}.`;
    Linking.openURL(`sms:${cleanPhone}?body=${encodeURIComponent(text)}`).catch(() =>
      Alert.alert('Error', 'Unable to open SMS app.')
    );
  };

  // Quick Action Ledger PDF / Summary
  const handleLedgerPdf = async () => {
    if (!ledger) return;
    try {
      const summaryText = `Customer Ledger Summary - ${ledger.customer.name}\nPhone: ${ledger.customer.phone || 'N/A'}\nOutstanding Due: ₹${ledger.customer.creditBalance.toFixed(2)}\nTotal Lifetime Spend: ₹${ledger.customer.totalSpent.toFixed(2)}\nGenerated via Seznik POS`;
      await Share.share({
        message: summaryText,
        title: `${ledger.customer.name} - Ledger Statement`,
      });
    } catch {
      Alert.alert('Error', 'Could not share ledger statement.');
    }
  };

  // Record Payment
  const handleRecordPayment = async () => {
    if (!payAmount.trim() || !id) return;
    try {
      await recordCreditPayment({ customerId: id, amount: parseFloat(payAmount) });
      setShowPayModal(false);
      setPayAmount('');
      Alert.alert('Payment Recorded', `Payment of ₹${payAmount} recorded successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record payment');
    }
  };

  // Add Manual Credit
  const handleAddCredit = async () => {
    if (!addCreditAmount.trim() || !id) return;
    try {
      await addManualCredit({
        customerId: id,
        amount: parseFloat(addCreditAmount),
        notes: addCreditNotes.trim() || undefined,
      });
      setShowAddCreditModal(false);
      setAddCreditAmount('');
      setAddCreditNotes('');
      Alert.alert('Credit Added', `Credit due of ₹${addCreditAmount} added to account.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to record credit');
    }
  };

  // Edit Customer
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
      Alert.alert('Success', 'Customer profile updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update customer');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add Custom Tag
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!customerTags.includes(newTagInput.trim())) {
      setCustomerTags((prev) => [...prev, newTagInput.trim()]);
    }
    setNewTagInput('');
    setShowAddTagModal(false);
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

  // Derived metrics
  const rewardPoints = Math.max(10, Math.floor(customer.totalSpent / 10));
  const tierName =
    customer.totalSpent >= 5000 ? 'GOLD TIER' : customer.totalSpent >= 1000 ? 'SILVER TIER' : 'REGULAR TIER';
  const tierColor = customer.totalSpent >= 5000 ? '#F59E0B' : customer.totalSpent >= 1000 ? '#94A3B8' : '#3B82F6';

  const creditLimit = customer.creditLimit || 5000;
  const creditBalance = customer.creditBalance || 0;
  const limitPercent = Math.min(100, Math.max(0, Math.round((creditBalance / creditLimit) * 100)));
  const availableLimit = Math.max(0, creditLimit - creditBalance);

  const avgPerVisit =
    customer.totalVisits > 0 ? (customer.totalSpent / customer.totalVisits).toFixed(0) : customer.totalSpent.toFixed(0);

  const lastInvoiceNumber =
    sales[0]?.invoiceNumber || (bills[0]?.invoiceNumber ? `Bill #${bills[0].invoiceNumber}` : 'INV-8832');

  const latestFollowUp = followUpLogs[0];

  // Filtered Activity List
  const filteredActivity = () => {
    if (activityTab === 'purchases') return bills;
    if (activityTab === 'payments') return sales;
    // 'all': merge bills & sales sorted by date descending
    const combined = [
      ...bills.map((b) => ({ ...b, activityType: 'bill' as const, sortDate: new Date(b.date).getTime() })),
      ...sales.map((s) => ({ ...s, activityType: 'sale' as const, sortDate: new Date(s.createdAt).getTime() })),
    ];
    combined.sort((a, b) => b.sortDate - a.sortDate);
    return combined;
  };

  const activityItems = filteredActivity();

  return (
    <ScreenBackground color="#0B0F19">
      <SafeAreaView style={styles.safeContainer} edges={['top']}>
        {/* TOP HEADER */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color="#E2E8F0" />
          </TouchableOpacity>

          {/* Center Badge Pill: #CUST-XXXX • Active Ledger */}
          <View style={styles.activeLedgerPill}>
            <Text style={styles.activeLedgerCode}>
              #CUST-{customer.id ? customer.id.slice(-4).toUpperCase() : '1049'}
            </Text>
            <View style={styles.greenLedgerDot} />
            <Text style={styles.activeLedgerLabel}>Active Ledger</Text>
          </View>

          {/* Right Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={openEditModal} style={styles.headerIconBtn}>
              <Edit3 size={18} color="#E2E8F0" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={styles.headerIconBtn}>
              <MoreVertical size={18} color="#E2E8F0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* MAIN SCROLL CONTENT */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. CUSTOMER PROFILE CARD */}
          <View style={styles.profileCard}>
            <View style={styles.profileTopRow}>
              {/* Avatar with star badge */}
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarSquare}>
                  <Text style={styles.avatarInitial}>{customer.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.avatarStarBadge}>
                  <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </View>

              {/* Customer Info */}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {customer.name}
                  </Text>
                  <View style={[styles.tierBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Text style={[styles.tierText, { color: tierColor }]}>{tierName}</Text>
                  </View>
                </View>

                {/* Phone */}
                <TouchableOpacity
                  onPress={handleCall}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                >
                  <Phone size={12} color="#94A3B8" style={{ marginRight: 5 }} />
                  <Text style={styles.profileMetaText}>{customer.phone || '+91 98765 43210'}</Text>
                </TouchableOpacity>

                {/* Location */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  <MapPin size={12} color="#94A3B8" style={{ marginRight: 5 }} />
                  <Text style={styles.profileMetaText} numberOfLines={1}>
                    {customer.address || 'Pune, Maharashtra'}
                  </Text>
                </View>
              </View>

              {/* Reward Points */}
              <View style={styles.rewardPtsContainer}>
                <Text style={styles.rewardPtsLabel}>Reward Pts</Text>
                <Text style={styles.rewardPtsValue}>{rewardPoints} pts</Text>
              </View>
            </View>

            {/* Quick Contact & Action Buttons (4 grid pills) */}
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity onPress={handleCall} style={styles.quickActionTile} activeOpacity={0.7}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <PhoneCall size={16} color="#10B981" />
                </View>
                <Text style={styles.quickActionLabel}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDirectWhatsApp} style={styles.quickActionTile} activeOpacity={0.7}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
                  <MessageSquare size={16} color="#14B8A6" />
                </View>
                <Text style={styles.quickActionLabel}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSMS} style={styles.quickActionTile} activeOpacity={0.7}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                  <MessageSquare size={16} color="#0EA5E9" />
                </View>
                <Text style={styles.quickActionLabel}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLedgerPdf} style={styles.quickActionTile} activeOpacity={0.7}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <FileText size={16} color="#A855F7" />
                </View>
                <Text style={styles.quickActionLabel}>Ledger PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. OUTSTANDING DUES CARD */}
          <View style={styles.outstandingCard}>
            {/* Header row */}
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.redStatusDot} />
                <Text style={styles.outstandingHeading}>OUTSTANDING DUES</Text>
              </View>
              <TouchableOpacity onPress={openEditModal} style={styles.settingsIconBtn}>
                <Settings size={17} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Big Amount */}
            <Text style={styles.outstandingAmountText}>₹{creditBalance.toFixed(2)}</Text>

            {/* Ageing Badge */}
            {customer.ageingBucket || customer.daysOverdue ? (
              <View style={styles.ageingPill}>
                <Clock size={12} color="#F59E0B" />
                <Text style={styles.ageingPillText}>
                  Owing {customer.daysOverdue || 0} days (Since{' '}
                  {customer.oldestUnpaidSince
                    ? new Date(customer.oldestUnpaidSince).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Recent'}
                  )
                </Text>
              </View>
            ) : (
              <View style={[styles.ageingPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <CheckCircle2 size={12} color="#10B981" />
                <Text style={[styles.ageingPillText, { color: '#10B981' }]}>Fully Settled • No dues pending</Text>
              </View>
            )}

            {/* Credit Limit Progress */}
            <View style={styles.creditLimitBox}>
              <View style={styles.limitHeaderRow}>
                <Text style={styles.limitLabel}>Credit Limit Utilized ({limitPercent}%)</Text>
                <Text style={styles.limitRatio}>
                  ₹{creditBalance.toFixed(0)} / ₹{creditLimit.toFixed(0)}
                </Text>
              </View>

              {/* Visual Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${limitPercent}%` }]} />
              </View>

              <View style={styles.limitFooterRow}>
                <Text style={styles.availableLimitText}>₹{availableLimit.toFixed(0)} Available Limit</Text>
                <TouchableOpacity onPress={openEditModal}>
                  <Text style={styles.changeLimitLink}>Change Limit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons: Receive, Remind, Add Due */}
            <View style={styles.outstandingActionsRow}>
              <TouchableOpacity
                onPress={() => setShowPayModal(true)}
                style={[styles.primaryActionBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnBoldText}>Receive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={sendTotalBalanceReminder}
                style={[styles.primaryActionBtn, { backgroundColor: '#F59E0B' }]}
                activeOpacity={0.8}
              >
                <Bell size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnBoldText}>Remind</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAddCreditModal(true)}
                style={[styles.primaryActionBtn, { backgroundColor: '#1E293B' }]}
                activeOpacity={0.8}
              >
                <PlusCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnBoldText}>Add Due</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. ACTIVE FOLLOW-UP REMINDER CARD */}
          <TouchableOpacity
            onPress={() => setShowNoteModal(true)}
            activeOpacity={0.8}
            style={styles.followUpCard}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={styles.followUpIconCircle}>
                <MessageSquare size={16} color="#818CF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.followUpTitle}>Active Follow-up Reminder</Text>
                  <Edit3 size={14} color="#818CF8" />
                </View>
                <Text style={styles.followUpQuote}>
                  "{latestFollowUp?.note || 'Customer promised to clear dues soon. Tap to update reminder.'}"
                </Text>
                <Text style={styles.followUpDueText}>
                  Due:{' '}
                  {latestFollowUp?.date
                    ? new Date(latestFollowUp.date).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Tomorrow, 11:00 AM'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 4. ACCOUNT PERFORMANCE (2x2 Grid) */}
          <View style={styles.performanceSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeaderTitle}>ACCOUNT PERFORMANCE</Text>
              <Text style={styles.sectionHeaderSub}>Updated just now</Text>
            </View>

            <View style={styles.performanceGrid}>
              {/* Card 1: Lifetime Spend */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricLabel}>Lifetime Spend</Text>
                  <View style={styles.metricIconBg}>
                    <TrendingUp size={14} color="#10B981" />
                  </View>
                </View>
                <Text style={styles.metricValue}>₹{customer.totalSpent.toFixed(0)}</Text>
                <Text style={[styles.metricSub, { color: '#10B981' }]}>₹{avgPerVisit} Avg/Visit</Text>
              </View>

              {/* Card 2: Total Visits */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricLabel}>Total Visits</Text>
                  <View style={styles.metricIconBg}>
                    <ShoppingBag size={14} color="#3B82F6" />
                  </View>
                </View>
                <Text style={styles.metricValue}>
                  {customer.totalVisits} {customer.totalVisits === 1 ? 'Visit' : 'Visits'}
                </Text>
                <Text style={styles.metricSub}>
                  {customer.totalVisits > 1 ? 'Frequent Shopper' : 'First Store Order'}
                </Text>
              </View>

              {/* Card 3: Last Visit */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricLabel}>Last Visit</Text>
                  <View style={styles.metricIconBg}>
                    <Calendar size={14} color="#A855F7" />
                  </View>
                </View>
                <Text style={styles.metricValue}>
                  {customer.lastVisitAt
                    ? new Date(customer.lastVisitAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '29 Aug 2026'}
                </Text>
                <Text style={styles.metricSub}>{lastInvoiceNumber}</Text>
              </View>

              {/* Card 4: Customer Since */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricLabel}>Customer Since</Text>
                  <View style={styles.metricIconBg}>
                    <History size={14} color="#F59E0B" />
                  </View>
                </View>
                <Text style={styles.metricValue}>
                  {customer.customerSince
                    ? new Date(customer.customerSince).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '29 Aug 2026'}
                </Text>
                <Text style={styles.metricSub}>Registered by POS</Text>
              </View>
            </View>
          </View>

          {/* 5. CUSTOMER TAGS & NOTE */}
          <View style={styles.tagsSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeaderTitle}>Customer Tags & Note</Text>
              <TouchableOpacity onPress={() => setShowAddTagModal(true)}>
                <Text style={styles.addTagLink}>+ Add Tag</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tagsRow}>
              {customerTags.map((tag, idx) => (
                <View key={idx} style={styles.tagChip}>
                  {tag.includes('WhatsApp') ? (
                    <Check size={12} color="#10B981" style={{ marginRight: 4 }} />
                  ) : tag.includes('Wholesale') ? (
                    <Tag size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                  ) : tag.includes('KYC') ? (
                    <ShieldCheck size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  ) : (
                    <Sparkles size={12} color="#818CF8" style={{ marginRight: 4 }} />
                  )}
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 6. LEDGER ACTIVITY SECTION */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.ledgerSectionTitle}>Ledger Activity</Text>
                <Text style={styles.ledgerSectionSubtitle}>Recent bills and payments</Text>
              </View>
              <TouchableOpacity onPress={() => setActivityTab('all')}>
                <Text style={styles.viewAllLink}>View All ({bills.length + sales.length})</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.activityTabBar}>
              <TouchableOpacity
                onPress={() => setActivityTab('all')}
                style={[styles.activityTabBtn, activityTab === 'all' && styles.activityTabBtnActive]}
              >
                <Text style={[styles.activityTabText, activityTab === 'all' && styles.activityTabTextActive]}>
                  All ({bills.length + sales.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActivityTab('purchases')}
                style={[styles.activityTabBtn, activityTab === 'purchases' && styles.activityTabBtnActive]}
              >
                <Text style={[styles.activityTabText, activityTab === 'purchases' && styles.activityTabTextActive]}>
                  Purchases ({bills.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActivityTab('payments')}
                style={[styles.activityTabBtn, activityTab === 'payments' && styles.activityTabBtnActive]}
              >
                <Text style={[styles.activityTabText, activityTab === 'payments' && styles.activityTabTextActive]}>
                  Payments ({sales.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Activity List */}
            {activityItems.length === 0 ? (
              <View style={styles.emptyActivityBox}>
                <Text style={styles.emptyActivityText}>No activity recorded in this view.</Text>
              </View>
            ) : (
              activityItems.map((item: any) => {
                const isBill = 'outstandingAmount' in item;
                const isExpanded = expandedBillId === item.id;

                if (isBill) {
                  // Bill / Due Item
                  const bill = item as CustomerBill;
                  const isPaid = bill.isPaid;
                  return (
                    <View key={bill.id} style={styles.activityCard}>
                      <TouchableOpacity
                        style={styles.activityCardHeader}
                        onPress={() => setExpandedBillId(isExpanded ? null : bill.id)}
                        activeOpacity={0.7}
                      >
                        {/* Red/Pink receipt icon container */}
                        <View
                          style={[
                            styles.activityIconBox,
                            {
                              backgroundColor: isPaid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                            },
                          ]}
                        >
                          <Receipt size={17} color={isPaid ? '#10B981' : '#F43F5E'} />
                        </View>

                        {/* Title & Date */}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.activityItemTitle}>
                              {bill.invoiceNumber ? `#INV-${bill.invoiceNumber.slice(-4)}` : '#INV-8832'}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                },
                              ]}
                            >
                              <Text style={[styles.statusBadgeText, { color: isPaid ? '#10B981' : '#F43F5E' }]}>
                                {isPaid ? 'Settled' : 'Pending'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.activityMetaText}>
                            {new Date(bill.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            • Credit Sale
                          </Text>
                        </View>

                        {/* Amount & Status Text */}
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.activityAmount, { color: isPaid ? '#10B981' : '#F43F5E' }]}>
                            {isPaid ? '' : '+'}₹{bill.outstandingAmount.toFixed(2)}
                          </Text>
                          <Text style={[styles.activityAmountSub, { color: isPaid ? '#10B981' : '#F43F5E' }]}>
                            {isPaid ? 'Settled' : 'Unpaid Due'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded details */}
                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          {bill.items && bill.items.length > 0 ? (
                            bill.items.map((it, i) => (
                              <View key={i} style={styles.itemRow}>
                                <Text style={styles.itemNameText} numberOfLines={1}>
                                  {it.productName} × {it.quantity}
                                </Text>
                                <Text style={styles.itemPriceText}>
                                  ₹{(it.total ?? (it.unitPrice || 0) * it.quantity).toFixed(2)}
                                </Text>
                              </View>
                            ))
                          ) : bill.notes ? (
                            <Text style={styles.notesText}>{bill.notes}</Text>
                          ) : (
                            <Text style={styles.notesText}>Original Amount: ₹{bill.originalAmount.toFixed(2)}</Text>
                          )}

                          {!isPaid && (
                            <View style={styles.billActionsRow}>
                              <TouchableOpacity
                                onPress={() => sendBillReminder(bill)}
                                disabled={sendingBillId === bill.id}
                                style={[styles.miniActionBtn, { backgroundColor: '#F59E0B' }]}
                              >
                                {sendingBillId === bill.id ? (
                                  <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                  <>
                                    <Bell size={13} color="#FFF" style={{ marginRight: 4 }} />
                                    <Text style={styles.miniActionBtnText}>Send Reminder</Text>
                                  </>
                                )}
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => shareBillPdf(bill)}
                                disabled={sharingBillId === bill.id}
                                style={[styles.miniActionBtn, { backgroundColor: '#1E293B' }]}
                              >
                                {sharingBillId === bill.id ? (
                                  <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                  <>
                                    <FileDown size={13} color="#FFF" style={{ marginRight: 4 }} />
                                    <Text style={styles.miniActionBtnText}>Share PDF</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                } else {
                  // Sale / Payment Item
                  const sale = item;
                  return (
                    <View key={sale.id} style={styles.activityCard}>
                      <View style={styles.activityCardHeader}>
                        {/* Green cash icon container */}
                        <View
                          style={[
                            styles.activityIconBox,
                            { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
                          ]}
                        >
                          <Banknote size={17} color="#10B981" />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.activityItemTitle}>
                              {sale.invoiceNumber ? `#${sale.invoiceNumber.slice(-8)}` : '#INV-8810'}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                              <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>Settled</Text>
                            </View>
                          </View>
                          <Text style={styles.activityMetaText}>
                            {new Date(sale.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            • {sale.paymentMethod ? sale.paymentMethod.toUpperCase() : 'CASH'} Sale
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.activityAmount, { color: '#FFFFFF' }]}>
                            ₹{sale.grandTotal.toFixed(2)}
                          </Text>
                          <Text style={[styles.activityAmountSub, { color: '#10B981' }]}>
                            Paid in {sale.paymentMethod || 'Cash'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }
              })
            )}
          </View>
        </ScrollView>

        {/* 7. BOTTOM STICKY ACTION BAR */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() => setShowNoteModal(true)}
            style={styles.bottomNoteBtn}
            activeOpacity={0.8}
          >
            <StickyNote size={17} color="#E2E8F0" />
            <Text style={styles.bottomNoteBtnText}>Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/pos')}
            style={styles.bottomCreateBillBtn}
            activeOpacity={0.85}
          >
            <Receipt size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.bottomCreateBillBtnText}>Create New Invoice / Bill</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL: Record Payment */}
        <Modal visible={showPayModal} animationType="fade" transparent onRequestClose={() => setShowPayModal(false)}>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Record Payment</Text>
                  <TouchableOpacity onPress={() => setShowPayModal(false)}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSub}>
                  {customer.name} currently owes ₹{customer.creditBalance.toFixed(2)}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Amount received (₹)"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  value={payAmount}
                  onChangeText={setPayAmount}
                />
                <TouchableOpacity
                  onPress={handleRecordPayment}
                  style={[styles.modalSubmitBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  <Text style={styles.modalSubmitBtnText}>Save Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* MODAL: Add Credit / Due */}
        <Modal
          visible={showAddCreditModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddCreditModal(false)}
        >
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Add Manual Due / Credit</Text>
                  <TouchableOpacity onPress={() => setShowAddCreditModal(false)}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSub}>
                  Record credit given to {customer.name} outside POS sale.
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Due Amount (₹)"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  value={addCreditAmount}
                  onChangeText={setAddCreditAmount}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Notes / Reason (optional)"
                  placeholderTextColor="#64748B"
                  value={addCreditNotes}
                  onChangeText={setAddCreditNotes}
                />
                <TouchableOpacity
                  onPress={handleAddCredit}
                  style={[styles.modalSubmitBtn, { backgroundColor: '#1E293B' }]}
                >
                  <Text style={styles.modalSubmitBtnText}>Add Due to Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* MODAL: Edit Customer & Credit Limit */}
        <Modal
          visible={showEditModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Edit Customer & Credit Limit</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Customer Name"
                  placeholderTextColor="#64748B"
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Phone Number"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Address / Location"
                  placeholderTextColor="#64748B"
                  value={editAddress}
                  onChangeText={setEditAddress}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Credit Limit (₹)"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  value={editCreditLimit}
                  onChangeText={setEditCreditLimit}
                />
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                  style={[styles.modalSubmitBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* MODAL: Log Follow-Up Note */}
        <Modal
          visible={showNoteModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowNoteModal(false)}
        >
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Active Follow-up Reminder</Text>
                  <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
                  placeholder="e.g. Customer promised to clear ₹1,000 on Monday via GPay."
                  placeholderTextColor="#64748B"
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!noteText.trim()) return;
                    setFollowUpLogs((prev) => [
                      { id: `note-${Date.now()}`, date: new Date().toISOString(), note: noteText.trim() },
                      ...prev,
                    ]);
                    setNoteText('');
                    setShowNoteModal(false);
                  }}
                  style={[styles.modalSubmitBtn, { backgroundColor: '#818CF8' }]}
                >
                  <Text style={styles.modalSubmitBtnText}>Save Reminder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* MODAL: Add Tag */}
        <Modal
          visible={showAddTagModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddTagModal(false)}
        >
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Add Customer Tag</Text>
                  <TouchableOpacity onPress={() => setShowAddTagModal(false)}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. VIP Member, Frequent Buyer"
                  placeholderTextColor="#64748B"
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                />
                <TouchableOpacity
                  onPress={handleAddTag}
                  style={[styles.modalSubmitBtn, { backgroundColor: BRAND_COLORS.blue600 }]}
                >
                  <Text style={styles.modalSubmitBtnText}>Add Tag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* MODAL: 3-Dots More Menu */}
        <Modal
          visible={showMoreMenu}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMoreMenu(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMoreMenu(false)}
          >
            <View style={[styles.modalCard, { maxWidth: 320 }]}>
              <Text style={[styles.modalTitle, { marginBottom: 14 }]}>Customer Options</Text>
              <TouchableOpacity
                style={styles.menuOptionRow}
                onPress={() => {
                  setShowMoreMenu(false);
                  handleLedgerPdf();
                }}
              >
                <Share2 size={16} color="#818CF8" />
                <Text style={styles.menuOptionText}>Share Customer Statement</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOptionRow}
                onPress={() => {
                  setShowMoreMenu(false);
                  openEditModal();
                }}
              >
                <Edit3 size={16} color="#38BDF8" />
                <Text style={styles.menuOptionText}>Edit Customer Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuOptionRow}
                onPress={() => {
                  setShowMoreMenu(false);
                  Alert.alert('Synced', 'Customer ledger is up to date.');
                }}
              >
                <Clock size={16} color="#34D399" />
                <Text style={styles.menuOptionText}>Sync Ledger History</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#161E31',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  activeLedgerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#161E31',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeLedgerCode: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  greenLedgerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeLedgerLabel: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 1. Profile Card */
  profileCard: {
    backgroundColor: '#131927',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarSquare: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  avatarStarBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#131927',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  profileMetaText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  rewardPtsContainer: {
    alignItems: 'flex-end',
  },
  rewardPtsLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 2,
  },
  rewardPtsValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#818CF8',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionTile: {
    flex: 1,
    backgroundColor: '#1A2234',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickActionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  quickActionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E2E8F0',
  },

  /* 2. Outstanding Dues Card */
  outstandingCard: {
    backgroundColor: '#131927',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.15)',
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  redStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
  },
  outstandingHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F43F5E',
    letterSpacing: 0.8,
  },
  settingsIconBtn: {
    padding: 4,
  },
  outstandingAmountText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FB7185',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  ageingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  ageingPillText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  creditLimitBox: {
    marginBottom: 14,
  },
  limitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  limitLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  limitRatio: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F43F5E',
    borderRadius: 4,
  },
  limitFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableLimitText: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
  },
  changeLimitLink: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  outstandingActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnBoldText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },

  /* 3. Follow Up Card */
  followUpCard: {
    backgroundColor: '#131927',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.18)',
    marginBottom: 16,
  },
  followUpIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  followUpQuote: {
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  followUpDueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818CF8',
  },

  /* 4. Performance Section */
  performanceSection: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  sectionHeaderSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#131927',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  metricIconBg: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#1A2234',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 3,
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  /* 5. Customer Tags Section */
  tagsSection: {
    marginBottom: 16,
  },
  addTagLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161E31',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },

  /* 6. Ledger Activity Section */
  ledgerSection: {
    marginBottom: 20,
  },
  ledgerSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  ledgerSectionSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  viewAllLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  activityTabBar: {
    flexDirection: 'row',
    backgroundColor: '#161E31',
    borderRadius: 12,
    padding: 3,
    marginVertical: 12,
  },
  activityTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  activityTabBtnActive: {
    backgroundColor: '#2563EB',
  },
  activityTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activityTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activityCard: {
    backgroundColor: '#131927',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  activityIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityItemTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  activityMetaText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  activityAmountSub: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemNameText: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
  },
  itemPriceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  notesText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  billActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  miniActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
  },
  miniActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyActivityBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 12,
    color: '#64748B',
  },

  /* 7. Bottom Sticky Action Bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomNoteBtn: {
    width: 60,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#161E31',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  bottomNoteBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 2,
  },
  bottomCreateBillBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  bottomCreateBillBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#161E31',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  modalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    backgroundColor: '#0B0F19',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    marginBottom: 12,
  },
  modalSubmitBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
});
