import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Ticket,
  Plus,
  Trash2,
  X,
  Printer,
  Ban,
  CheckCircle2,
  Settings2,
  Edit3,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '@/hooks/useTokens';
import { TokenType, Token } from '@/types/token';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { KeyboardAvoidingWrapper } from '@/components/ui/KeyboardAvoidingWrapper';

export default function QuickTokensScreen() {
  const router = useRouter();

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

  // Selected Token Type for Issue Sheet
  const [selectedType, setSelectedType] = useState<TokenType | null>(null);
  const [issueQty, setIssueQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [note, setNote] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  // Manage Types Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingType, setEditingType] = useState<TokenType | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePrice, setNewTypePrice] = useState('50');

  const theme = useAppTheme();

  const handleIssueToken = async () => {
    if (!selectedType) return;
    setIsIssuing(true);
    try {
      const qty = parseInt(issueQty) || 1;
      const priceVal = parseFloat(customPrice) || selectedType.price || selectedType.defaultPrice || 50;

      await createToken({
        tokenTypeId: selectedType.id,
        quantity: qty,
        amount: priceVal * qty,
        paymentMethod: 'cash',
        note: note.trim() || undefined,
      });

      setSelectedType(null);
      setIssueQty('1');
      setCustomPrice('');
      setNote('');
      Alert.alert('Ticket Issued!', `Token #${tokens.length + 1} issued successfully.`);
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
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.mainWrapper}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.textSecondary} />
            <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManageModal(true)} style={styles.manageBtn}>
            <Settings2 size={16} color={BRAND_COLORS.blue600} />
            <Text style={styles.manageBtnText}>Manage Types</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>Quick Ticket Tokens</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Counter ticket sales with daily ticket counter
        </Text>

        {/* Token Type Tap Grid */}
        <Text style={styles.sectionHeader}>TAP TO ISSUE TOKEN</Text>
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

        {/* Today's Tickets List */}
        <Text style={styles.sectionHeader}>TODAY'S TICKETS ({tokens.length})</Text>
        {isLoadingTokens ? (
          <ActivityIndicator size="large" color={BRAND_COLORS.blue600} style={{ marginVertical: 20 }} />
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
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.ticketPrice, { color: theme.textPrimary }]}>
                    ₹{(item.price || item.tokenType?.price || 50).toFixed(2)}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <TouchableOpacity style={styles.actionIconBtn}>
                      <Printer size={14} color={BRAND_COLORS.blue600} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleCancelToken(item)} style={[styles.actionIconBtn, { marginLeft: 6 }]}>
                      <Ban size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Issue Token Bottom Sheet */}
      <Modal visible={!!selectedType} animationType="slide" transparent>
        <KeyboardAvoidingWrapper inModal>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                Issue Ticket: {selectedType?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedType(null)}>
                <X size={24} color={theme.textSecondary} />
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
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Price (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.textPrimary }]}
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleIssueToken} disabled={isIssuing} style={styles.submitBtn}>
              {isIssuing && <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />}
              <Text style={styles.submitBtnText}>Print & Issue Ticket</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingWrapper>
      </Modal>

      {/* Manage Token Types Modal */}
      <Modal visible={showManageModal} animationType="slide" onRequestClose={() => setShowManageModal(false)}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingWrapper inModal>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Manage Token Types</Text>
              <TouchableOpacity onPress={() => { setShowManageModal(false); handleCancelEditType(); }}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              {editingType ? `Editing: ${editingType.name}` : 'Token Type Name'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. Lunch Ticket"
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

            <View style={{ flexDirection: 'row' }}>
              {editingType ? (
                <TouchableOpacity onPress={handleCancelEditType} style={[styles.submitBtn, { flex: 1, marginRight: 8, backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.borderColor }]}>
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
                  <Edit3 size={14} color={BRAND_COLORS.blue600} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteType(type)} style={[styles.actionIconBtn, { marginLeft: 6, backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingWrapper>
        </SafeAreaView>
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
  manageBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(37, 99, 235, 0.12)' },
  manageBtnText: { fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 10 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  typeCard: { width: '48.5%', borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  tokenBadgeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeName: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  typePrice: { fontSize: 13, fontWeight: '900', color: BRAND_COLORS.blue600, marginTop: 4 },
  ticketCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  ticketSeqBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND_COLORS.navyInk, alignItems: 'center', justifyContent: 'center' },
  ticketSeqText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  ticketName: { fontSize: 14, fontWeight: '700' },
  ticketSub: { fontSize: 11, marginTop: 2 },
  ticketPrice: { fontSize: 14, fontWeight: '900' },
  actionIconBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.12)' },
  typeListRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  bottomSheet: { borderRadius: 24, padding: 20, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  modalSafeArea: { flex: 1 },
});
