import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { ArrowLeft, Star, Send, MessageSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFeedback } from '@/hooks/useFeedback';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';

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
  const theme = useAppTheme();
  const { feedback, isLoading, submitFeedback, isSubmitting } = useFeedback();

  const [area, setArea] = useState('general');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Required Field', 'Please write your feedback before submitting.');
      return;
    }
    try {
      await submitFeedback({ area, rating, message: message.trim() });
      setMessage('');
      setRating(null);
      Alert.alert('Thank You!', 'Your feedback has been submitted to the team.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit feedback.');
    }
  };

  return (
    <ScreenBackground color={theme.bg}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainWrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color={theme.textSecondary} />
              <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Send Feedback</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Found a bug or have an idea? Let the team know.
          </Text>

          <Text style={[styles.label, { color: theme.textPrimary }]}>Which area is this about?</Text>
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

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>Rating (optional)</Text>
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

          <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>Your Feedback *</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the issue or suggestion in detail..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} /> : <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />}
            <Text style={styles.submitBtnText}>Submit Feedback</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>YOUR PAST FEEDBACK</Text>
          {isLoading ? (
            <ActivityIndicator color={BRAND_COLORS.blue600} style={{ marginTop: 16 }} />
          ) : feedback.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 30 }}>
              <MessageSquare size={26} color={theme.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>No feedback submitted yet.</Text>
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
                <Text style={[styles.pastMessage, { color: theme.textPrimary }]}>{f.message}</Text>
                <Text style={[styles.pastDate, { color: theme.textSecondary }]}>
                  {new Date(f.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 11, fontWeight: '800' },
  textArea: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, minHeight: 120, marginBottom: 8 },
  submitBtn: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 30, marginBottom: 10 },
  pastCard: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 8 },
  pastArea: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  pastMessage: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  pastDate: { fontSize: 10, marginTop: 6 },
});
