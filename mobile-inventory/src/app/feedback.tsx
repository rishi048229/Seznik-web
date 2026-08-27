import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Send, MessageSquare, Search, ChevronDown, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFeedback } from '@/hooks/useFeedback';
import { ScreenLoadingState } from '@/components/ui/ScreenLoadingState';
import { FeedbackListSkeleton } from '@/components/ui/ScreenSkeleton';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTranslation } from '@/store/useLanguageStore';
import { SEZNIK_WEBSITE_PRODUCTS } from '@/data/seznikWebsiteProducts';

// Mirrors VALID_AREAS in backend/src/controllers/feedbackController.ts exactly — anything outside
// this list gets silently normalized to "general" server-side, so keep these in sync.
const AREAS: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'pos', label: 'POS / Billing' },
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'customers', label: 'Customers' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'credits', label: 'Credits/Daybook' },
  { value: 'reports', label: 'Reports' },
  { value: 'printers', label: 'Printers' },
  { value: 'settings', label: 'Settings' },
  { value: 'other', label: 'Other' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);
  const { feedback, isLoading, submitFeedback, isSubmitting } = useFeedback();

  const [area, setArea] = useState('general');
  const [productId, setProductId] = useState('');
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const selectedProduct = useMemo(
    () => SEZNIK_WEBSITE_PRODUCTS.find((p) => p.id === productId),
    [productId]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return SEZNIK_WEBSITE_PRODUCTS;
    return SEZNIK_WEBSITE_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [productSearch]);

  const handleSubmit = async () => {
    if (!productId) {
      Alert.alert(t('requiredField', 'Required Field'), t('feedbackProductRequired', 'Please select a product.'));
      return;
    }
    if (!message.trim()) {
      Alert.alert(t('requiredField', 'Required Field'), t('feedbackMessageRequired', 'Please write your feedback before submitting.'));
      return;
    }
    try {
      await submitFeedback({
        area,
        rating,
        message: message.trim(),
        platform: 'mobile',
        productId,
      });
      setMessage('');
      setRating(null);
      Alert.alert(t('thankYou', 'Thank You!'), t('feedbackSubmitted', 'Your feedback has been submitted to the team.'));
    } catch (err: any) {
      Alert.alert(t('error', 'Error'), err?.message || t('feedbackSubmitFailed', 'Failed to submit feedback.'));
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: topPadding }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>{t('back', 'Back')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('feedbackPageTitle', 'Feedback & Suggestions')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('feedbackSubtitle', 'Found a bug or have an idea? Let the team know.')}
          </Text>

          <Text style={[styles.label, { color: theme.textPrimary }]}>
            {t('feedbackProduct', 'Which Seznik product is this about?')} *
          </Text>
          <TouchableOpacity
            onPress={() => setProductModalVisible(true)}
            style={[styles.productPicker, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
          >
            <Text
              style={[
                styles.productPickerText,
                { color: selectedProduct ? theme.textPrimary : theme.textSecondary },
              ]}
              numberOfLines={2}
            >
              {selectedProduct?.name || t('feedbackProductPlaceholder', 'Search and select a product...')}
            </Text>
            <ChevronDown size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>{t('feedbackArea', 'Which area is this about?')}</Text>
          <View style={styles.chipWrap}>
            {AREAS.map((a) => (
              <TouchableOpacity
                key={a.value}
                onPress={() => setArea(a.value)}
                style={[
                  styles.chip,
                  { borderColor: theme.borderColor, backgroundColor: theme.cardBg },
                  area === a.value && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
                ]}
              >
                <Text style={[styles.chipText, { color: theme.textSecondary }, area === a.value && { color: '#FFFFFF' }]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>{t('feedbackRating', 'Rating (optional)')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(rating === n ? null : n)} style={{ marginRight: 6 }}>
                <Star
                  size={28}
                  color={rating != null && n <= rating ? '#F59E0B' : theme.textSecondary}
                  fill={rating != null && n <= rating ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>{`${t('feedbackComments', 'Your Feedback')} *`}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('feedbackCommentsPlaceholder', 'Describe the issue or suggestion in detail...')}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !productId || !message.trim()}
            style={[styles.submitBtn, (!productId || !message.trim()) && { opacity: 0.5 }]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} /> : <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />}
            <Text style={styles.submitBtnText}>{t('submitFeedback', 'Submit Feedback')}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{t('pastFeedback', 'YOUR PAST FEEDBACK')}</Text>
          {isLoading ? (
            <ScreenLoadingState
              message={t('loadingFeedback', 'Loading feedback...')}
              hint={t('loadingFeedbackHint', 'Fetching your past submissions')}
              skeleton={<FeedbackListSkeleton count={3} />}
            />
          ) : feedback.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 30 }}>
              <MessageSquare size={26} color={theme.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{t('noPastFeedback', 'No feedback submitted yet.')}</Text>
            </View>
          ) : (
            feedback.map((f) => (
              <View key={f.id} style={[styles.pastCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.pastArea, { color: BRAND_COLORS.blue600 }]}>
                    {AREAS.find((a) => a.value === f.area)?.label || f.area}
                  </Text>
                  {f.rating ? (
                    <View style={{ flexDirection: 'row' }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} color={n <= (f.rating || 0) ? '#F59E0B' : '#CBD5E1'} fill={n <= (f.rating || 0) ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  ) : null}
                </View>
                {f.productName ? (
                  <Text style={[styles.pastProduct, { color: theme.textSecondary }]} numberOfLines={2}>
                    {f.productName}
                  </Text>
                ) : null}
                <Text style={[styles.pastMessage, { color: theme.textPrimary }]}>{f.message}</Text>
                <Text style={[styles.pastDate, { color: theme.textSecondary }]}>
                  {new Date(f.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <Modal visible={productModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProductModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {t('feedbackProduct', 'Which Seznik product is this about?')}
            </Text>
            <TouchableOpacity onPress={() => setProductModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Search size={16} color={theme.textSecondary} />
            <TextInput
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder={t('feedbackProductSearch', 'Search by name, SKU, or category...')}
              placeholderTextColor="#94A3B8"
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
          </View>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setProductId(item.id);
                  setProductModalVisible(false);
                  setProductSearch('');
                }}
                style={[
                  styles.productRow,
                  { borderBottomColor: theme.borderColor },
                  productId === item.id && { backgroundColor: `${BRAND_COLORS.blue600}15` },
                ]}
              >
                <Text style={[styles.productName, { color: theme.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.productMeta, { color: theme.textSecondary }]}>
                  {item.categoryName} · {item.sku}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 24 }}>
                {t('noProductsFound', 'No products found')}
              </Text>
            }
          />
        </View>
      </Modal>
    </ScreenBackground>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginLeft: -4 },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  productPicker: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productPickerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 11, fontWeight: '800' },
  textArea: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, minHeight: 120, marginBottom: 8 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 30, marginBottom: 10 },
  pastCard: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 8 },
  pastArea: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  pastProduct: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  pastMessage: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  pastDate: { fontSize: 10, marginTop: 6 },
  modalContainer: { flex: 1, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  productRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  productName: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  productMeta: { fontSize: 11, marginTop: 4 },
});
