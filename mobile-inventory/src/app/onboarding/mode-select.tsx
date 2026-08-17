import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Tag, ShoppingCart, Layers, ChevronRight, Check } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useShopStore } from '@/store/useShopStore';
import { BusinessMode } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MODES: { key: BusinessMode; icon: typeof Tag; title: string; desc: string; examples: string[] }[] = [
  {
    key: 'fixed',
    icon: Tag,
    title: 'Fixed-Price Billing',
    desc: 'Same prices printed repeatedly — no stock tracking needed.',
    examples: ['Parking lots', 'Toll counters', 'Entry tickets', 'Laundry counters', 'Canteens'],
  },
  {
    key: 'product',
    icon: ShoppingCart,
    title: 'Product-Based Billing',
    desc: 'Full cart with many products, quantities vary, stock depletes.',
    examples: ['Retail shops', 'Grocery stores', 'Pharmacies', 'Hardware stores'],
  },
  {
    key: 'hybrid',
    icon: Layers,
    title: 'Both / Hybrid',
    desc: 'Mix of quick-rate billing and full inventory cart.',
    examples: ['Versatile shops', 'Mixed retail + services', 'Restaurants with retail'],
  },
];

const MODE_COLORS: Record<BusinessMode, string> = {
  fixed: '#10B981',
  product: '#3B82F6',
  hybrid: '#8B5CF6',
};

export default function ModeSelect() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setMode } = useShopStore();
  const [selected, setSelected] = useState<BusinessMode | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(MODES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
      Animated.stagger(
        120,
        cardsAnim.map((a) => Animated.spring(a, { toValue: 1, friction: 6, useNativeDriver: true }))
      ).start();
    });
  }, []);

  const handleContinue = async () => {
    if (!selected) return;
    await setMode(selected);
    router.push('/onboarding/store-setup');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={[styles.step, { color: colors.textSecondary }]}>Step 1 of 3</Text>
        <Text style={[styles.title, { color: colors.text }]}>What kind of business{'\n'}do you run?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This configures your billing experience. You can always change it later in Settings.
        </Text>
      </Animated.View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.cardsContainer}
        showsVerticalScrollIndicator={false}
      >
        {MODES.map((mode, idx) => {
          const isSelected = selected === mode.key;
          const accent = MODE_COLORS[mode.key];
          const Icon = mode.icon;

          return (
            <Animated.View
              key={mode.key}
              style={[
                { opacity: cardsAnim[idx], transform: [{ translateY: cardsAnim[idx].interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.card,
                  {
                    backgroundColor: isSelected ? accent + '12' : colors.surface,
                    borderColor: isSelected ? accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelected(mode.key)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBubble, { backgroundColor: accent + '18' }]}>
                    <Icon size={22} color={accent} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{mode.title}</Text>
                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{mode.desc}</Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                      <Check size={14} color="#FFF" strokeWidth={3} />
                    </View>
                  )}
                </View>

                <View style={styles.examplesRow}>
                  {mode.examples.map((ex, i) => (
                    <View key={i} style={[styles.exampleChip, { backgroundColor: accent + '10' }]}>
                      <Text style={[styles.exampleText, { color: accent }]}>{ex}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!selected}
          style={[
            styles.ctaButton,
            { backgroundColor: selected ? (MODE_COLORS[selected] || colors.primary) : colors.neutral, opacity: selected ? 1 : 0.5 },
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.ctaText}>Continue</Text>
          <ChevronRight size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  step: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 36, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  scrollArea: { flex: 1 },
  cardsContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  card: { borderRadius: 16, padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconBubble: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginLeft: 58 },
  exampleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  exampleText: { fontSize: 12, fontWeight: '600' },
  ctaWrap: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 24, paddingTop: 16 },
  ctaButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ctaText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
