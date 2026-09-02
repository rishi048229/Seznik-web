import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ticket,
  Plus,
  Trash2,
  X,
  Printer,
  Ban,
  Settings2,
  Edit3,
  Bluetooth,
} from 'lucide-react-native';
import { useRouter, Redirect } from 'expo-router';
import { useTokens } from '@/hooks/useTokens';
import { TokenType, Token } from '@/types/token';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';
import { ListScreenSkeleton, QuickTokensListSkeleton } from '@/components/ui/ScreenSkeleton';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { useLanguageStore } from '@/store/useLanguageStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import { useSettings } from '@/hooks/useSettings';
import ThermalPrinterService from '@/services/PrinterService';
import { DirectPrinterConnectModal } from '@/components/printers/DirectPrinterConnectModal';
import { useAuth } from '@/hooks/useAuth';
import { isNavFeatureVisible } from '@/utils/businessFeatures';

export default function QuickTokensScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguageStore();
  const { settings } = useSettings();
  const { connectionState } = usePrinterStore();

  const {
    tokenTypes,
    tokens,
    isLoadingTokens,
    createTokenType,
    updateTokenType,
    deleteTokenType,
    createToken,
    deleteToken,
  } = useTokens();

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 14);

  // Selected Token Type for Issue Sheet
  const [selectedType, setSelectedType] = useState<TokenType | null>(null);
  const [issueQty, setIssueQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [note, setNote] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  // Manage Types Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingType, setEditingType] = useState<TokenType | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePrice, setNewTypePrice] = useState('50');

  if (!isNavFeatureVisible(user?.businessType, 'tokens')) {
    return <Redirect href="/(tabs)" />;
  }

  const handlePrintToken = async (token: Token) => {
    const seq = token.dailySequence || token.dailyNumber || 1;
    const typeName = token.tokenType?.name || 'Quick Ticket Token';
    const price = token.price || token.tokenType?.price || 50;

    if (connectionState !== 'connected') {
      setShowPrinterModal(true);
      return;
    }

    try {
      await ThermalPrinterService.printTokenSlip({
        storeName: settings?.businessName || 'SEZNIK TOKEN',
        storeAddress: settings?.businessAddress || '',
        storePhone: settings?.businessPhone || '',
        tokenNumber: seq,
        typeName,
        quantity: 1,
        price,
        totalAmount: price,
        paymentMethod: 'CASH',
        date: new Date(token.createdAt).toLocaleDateString('en-GB'),
        time: new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: token.note || undefined,
      });
      Alert.alert('Token Printed!', `Token #${seq} slip printed successfully.`);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Failed to print token');
    }
  };

  const handleIssueToken = async () => {
    if (!selectedType) return;
    setIsIssuing(true);
    try {
      const qty = parseInt(issueQty) || 1;
      const priceVal = parseFloat(customPrice) || selectedType.price || selectedType.defaultPrice || 50;
      const totalAmount = priceVal * qty;

      await createToken({
        tokenTypeId: selectedType.id,
        quantity: qty,
        amount: totalAmount,
        paymentMethod: 'cash',
        note: note.trim() || undefined,
      });

      const nextSeq = tokens.length + 1;

      // Auto-print compact thermal token slip if printer is connected
      if (connectionState === 'connected') {
        try {
          await ThermalPrinterService.printTokenSlip({
            storeName: settings?.businessName || 'SEZNIK TOKEN',
            storeAddress: settings?.businessAddress || '',
            storePhone: settings?.businessPhone || '',
            tokenNumber: nextSeq,
            typeName: selectedType.name,
            quantity: qty,
            price: priceVal,
            totalAmount,
            paymentMethod: 'CASH',
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: note.trim() || undefined,
          });
        } catch (printErr) {
          console.warn('Auto print token failed:', printErr);
        }
      }

      setSelectedType(null);
      setIssueQty('1');
      setCustomPrice('');
      setNote('');
      Alert.alert('Ticket Issued!', `Token #${nextSeq} issued successfully for ${selectedType.name}.`);
    } catch (err: any) {
      Alert.alert('Issue Error', err?.message || 'Failed to issue token');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleOpenEditType = (type: TokenType) => {
    setEditingType(type);
    setNewTypeName(type.name);
    setNewTypePrice(String(type.price || type.defaultPrice || 50));
  };

  const handleCancelEditType = () => {
    setEditingType(null);
    setNewTypeName('');
    setNewTypePrice('50');
  };

  const handleSaveType = async () => {
    if (!newTypeName.trim()) return;
    try {
      if (editingType) {
        await updateTokenType({
          id: editingType.id,
          payload: { name: newTypeName.trim(), price: parseFloat(newTypePrice) || 0 },
        });
      } else {
        await createTokenType({
          name: newTypeName.trim(),
          price: parseFloat(newTypePrice) || 0,
        });
      }
      handleCancelEditType();
    } catch (err: any) {
      Alert.alert('Error', err?.message || `Failed to ${editingType ? 'update' : 'create'} token type`);
    }
  };

  const handleDeleteType = (type: TokenType) => {
    Alert.alert('Delete Token Type', `Delete "${type.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTokenType(type.id);
            if (editingType?.id === type.id) handleCancelEditType();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete token type');
          }
        },
      },
    ]);
  };

  const handleCancelToken = (token: Token) => {
    const seq = token.dailySequence || token.dailyNumber;
    Alert.alert('Cancel Ticket', `Are you sure you want to cancel Ticket #${seq}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteToken(token.id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to cancel ticket');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={18} color={theme.textPrimary} />
              <Text style={[styles.backBtnText, { color: theme.textPrimary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowPrinterModal(true)}
                style={[
                  styles.printerStatusChip,
                  {
                    backgroundColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    borderColor: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                  },
                ]}
              >
                <Bluetooth size={14} color={connectionState === 'connected' ? '#10B981' : '#EF4444'} />
                <Text
                  style={[
                    styles.printerStatusText,
                    { color: connectionState === 'connected' ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {connectionState === 'connected' ? 'Printer Ready' : 'Connect Printer'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowManageModal(true)}
                style={[styles.manageBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)', borderColor: 'rgba(37, 99, 235, 0.25)' }]}
              >
                <Settings2 size={16} color={BRAND_COLORS.blue600} />
                <Text style={styles.manageBtnText}>Manage Types</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t('quickTokensPageTitle', 'Quick Ticket Tokens')}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Counter ticket sales with live thermal ticket printing
            </Text>
          </View>

          {/* Token Type Tap Grid */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            {t('issueToken', 'TAP TO ISSUE TOKEN')} ({tokenTypes.length})
          </Text>

          {tokenTypes.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowManageModal(true)}
              style={[styles.emptyTypesCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <Plus size={24} color={BRAND_COLORS.blue600} />
              <Text style={[styles.emptyTypesText, { color: theme.textPrimary }]}>No Token Types Created Yet</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>Tap to add your first token type (e.g. Chai, Lunch, Parking)</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.gridRow}>
              {tokenTypes.map((type) => {
                const displayPrice = type.price || type.defaultPrice || 50;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => {
                      setSelectedType(type);
                      setCustomPrice(String(displayPrice));
                    }}
                    style={[styles.typeCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <View style={styles.tokenBadgeIcon}>
                      <Ticket size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.typeName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {type.name}
                    </Text>
                    <Text style={styles.typePrice}>
                      ₹{displayPrice.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Today's Tickets List */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginBottom: 0 }]}>
              TODAY&apos;S TICKETS ({tokens.length})
            </Text>
            {tokens.length > 0 && (
              <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND_COLORS.blue600 }}>
                Total: ₹{tokens.reduce((acc, tk) => acc + ((tk.price || tk.tokenType?.price || 50) * (tk.quantity || 1)), 0).toFixed(2)}
              </Text>
            )}
          </View>

          {isLoadingTokens ? (
            <ScreenLoadingState
              message="Loading tokens..."
              hint="Fetching service tokens and queue tickets"
              skeleton={<QuickTokensListSkeleton count={4} />}
            />
          ) : (
            <FlatList
              data={tokens}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={[styles.ticketCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.ticketSeqBox}>
                    <Text style={styles.ticketSeqText}>#{item.dailySequence || item.dailyNumber}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.ticketName, { color: theme.textPrimary }]}>{item.tokenType?.name || 'Ticket'}</Text>
                    <Text style={[styles.ticketSub, { color: theme.textSecondary }]}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Paid Cash
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.ticketPrice, { color: theme.textPrimary }]}>
                      ₹{((item.price || item.tokenType?.price || 50) * (item.quantity || 1)).toFixed(2)}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handlePrintToken(item)}
                        style={[styles.actionIconBtn, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}
                      >
                        <Printer size={15} color={BRAND_COLORS.blue600} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleCancelToken(item)}
                        style={[styles.actionIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                      >
                        <Ban size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ticket size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Tickets Issued Today</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tap any token type above to instantly issue and print tickets.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Issue Token Bottom Sheet */}
        <Modal visible={!!selectedType} animationType="slide" transparent>
          <KeyboardAvoidingWrapper inModal>
            <View style={styles.modalOverlay}>
              <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={styles.sheetHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ticket size={20} color={BRAND_COLORS.blue600} />
                    <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                      Issue: {selectedType?.name}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedType(null)} style={styles.modalCloseBtn}>
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Quantity</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={issueQty}
                      onChangeText={setIssueQty}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Price per Token (₹)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                      value={customPrice}
                      onChangeText={setCustomPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Order Note (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Table 4, Extra Sugar"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Grand Total:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: BRAND_COLORS.blue600 }}>
                    ₹{((parseFloat(customPrice) || selectedType?.price || 50) * (parseInt(issueQty) || 1)).toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity onPress={handleIssueToken} disabled={isIssuing} style={styles.submitBtn}>
                  {isIssuing ? (
                    <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Printer size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.submitBtnText}>Print & Issue Ticket</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingWrapper>
        </Modal>

        {/* Manage Token Types Modal */}
        <Modal visible={showManageModal} animationType="slide" onRequestClose={() => setShowManageModal(false)}>
          <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: topPadding }}>
            <KeyboardAvoidingWrapper inModal>
              <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
                <View style={styles.manageHeaderRow}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Manage Token Types</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowManageModal(false);
                      handleCancelEditType();
                    }}
                    style={[styles.modalCloseBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  >
                    <X size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>
                  {editingType ? `Editing: ${editingType.name}` : 'Token Type Name'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={newTypeName}
                  onChangeText={setNewTypeName}
                  placeholder="e.g. Lunch Ticket, Chai, Coffee"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Default Price (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={newTypePrice}
                  onChangeText={setNewTypePrice}
                  keyboardType="numeric"
                  placeholder="50.00"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {editingType ? (
                    <TouchableOpacity
                      onPress={handleCancelEditType}
                      style={[styles.submitBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.borderColor }]}
                    >
                      <Text style={[styles.submitBtnText, { color: theme.textPrimary }]}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={handleSaveType} style={[styles.submitBtn, { flex: 1 }]}>
                    <Text style={styles.submitBtnText}>{editingType ? 'Save Changes' : 'Create Token Type'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionHeader, { marginTop: 24 }]}>EXISTING TYPES ({tokenTypes.length})</Text>
                {tokenTypes.map((type) => (
                  <View key={type.id} style={[styles.typeListRow, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ticketName, { color: theme.textPrimary }]}>{type.name}</Text>
                      <Text style={[styles.ticketSub, { color: theme.textSecondary }]}>₹{(type.price || type.defaultPrice || 50).toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleOpenEditType(type)} style={styles.actionIconBtn}>
                      <Edit3 size={15} color={BRAND_COLORS.blue600} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteType(type)}
                      style={[styles.actionIconBtn, { marginLeft: 6, backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                    >
                      <Trash2 size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </KeyboardAvoidingWrapper>
          </View>
        </Modal>

        {/* Direct Bluetooth Printer Connect Dialog */}
        <DirectPrinterConnectModal
          visible={showPrinterModal}
          onClose={() => setShowPrinterModal(false)}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  manageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  backBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 4 },
  printerStatusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  printerStatusText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  manageBtnText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  typeCard: { width: '48.5%', borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 10, alignItems: 'center' },
  tokenBadgeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeName: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  typePrice: { fontSize: 14, fontWeight: '900', color: BRAND_COLORS.blue600, marginTop: 4 },
  ticketCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  ticketSeqBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center' },
  ticketSeqText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  ticketName: { fontSize: 14, fontWeight: '800' },
  ticketSub: { fontSize: 11, marginTop: 2 },
  ticketPrice: { fontSize: 15, fontWeight: '900' },
  actionIconBtn: { padding: 8, borderRadius: 10 },
  typeListRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  emptyTypesCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderStyle: 'dashed' },
  emptyTypesText: { fontSize: 14, fontWeight: '800', marginTop: 8 },
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
