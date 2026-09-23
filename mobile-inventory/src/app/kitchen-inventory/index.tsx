import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { kitchenApi, KitchenIngredient } from '@/api/kitchen';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { BRAND_COLORS } from '@/constants/theme';

export default function KitchenInventoryScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['kitchen-ingredients'],
    queryFn: kitchenApi.listIngredients,
  });
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [opening, setOpening] = useState('0');
  const [threshold, setThreshold] = useState('0');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kitchen-ingredients'] });

  const createMut = useMutation({
    mutationFn: kitchenApi.createIngredient,
    onSuccess: () => {
      setName('');
      refresh();
    },
    onError: (e: any) => Alert.alert('Could not add', e?.message || 'Try again'),
  });

  const stockMut = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      kitchenApi.addStock(id, { quantity, asPurchase: true }),
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Could not add stock', e?.message || 'Try again'),
  });

  const wasteMut = useMutation({
    mutationFn: kitchenApi.logWastage,
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Could not log wastage', e?.message || 'Try again'),
  });

  const promptQty = (title: string, onQty: (qty: number) => void) => {
    Alert.prompt?.(title, 'Quantity', (text) => {
      const qty = Number(text);
      if (qty > 0) onQty(qty);
    });
  };

  const askQty = (title: string, onQty: (qty: number) => void) => {
    if (Alert.prompt) {
      promptQty(title, onQty);
      return;
    }
    Alert.alert(title, 'Use 1 unit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add 1', onPress: () => onQty(1) },
    ]);
  };

  const tone = (row: KitchenIngredient) => {
    if (row.currentStock <= 0) return { label: 'Out', color: '#EF4444' };
    if (row.currentStock <= row.lowStockThreshold) return { label: 'Low', color: '#F59E0B' };
    return { label: 'In stock', color: '#10B981' };
  };

  return (
    <ScreenBackground color={theme.bg}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, padding: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <ChevronLeft size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Kitchen Inventory</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Add ingredient</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#94A3B8" style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]} />
          <TextInput value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor="#94A3B8" style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]} />
          <TextInput value={opening} onChangeText={setOpening} placeholder="Opening stock" keyboardType="decimal-pad" placeholderTextColor="#94A3B8" style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]} />
          <TextInput value={threshold} onChangeText={setThreshold} placeholder="Low-stock threshold" keyboardType="decimal-pad" placeholderTextColor="#94A3B8" style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderColor }]} />
          <TouchableOpacity
            style={styles.primary}
            disabled={!name.trim() || createMut.isPending}
            onPress={() =>
              createMut.mutate({
                name: name.trim(),
                unit: unit.trim() || 'g',
                currentStock: Number(opening) || 0,
                lowStockThreshold: Number(threshold) || 0,
              })
            }
          >
            <Text style={styles.primaryText}>{createMut.isPending ? 'Saving…' : 'Add ingredient'}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
        {ingredients.length === 0 && !isLoading ? (
          <Text style={{ color: theme.textSecondary, marginTop: 16 }}>No kitchen ingredients yet.</Text>
        ) : null}
        {ingredients.map((row) => {
          const badge = tone(row);
          return (
            <View key={row.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{row.name}</Text>
                <Text style={{ color: badge.color, fontWeight: '800' }}>{badge.label}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, marginBottom: 10 }}>
                {row.currentStock} {row.unit}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.secondary} onPress={() => askQty('Add stock', (qty) => stockMut.mutate({ id: row.id, quantity: qty }))}>
                  <Text style={styles.secondaryText}>Add stock</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => askQty('Log wastage', (qty) => wasteMut.mutate({ ingredientId: row.id, quantity: qty }))}>
                  <Text style={styles.secondaryText}>Log wastage</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', marginLeft: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  primary: { backgroundColor: BRAND_COLORS.navyInk, borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { flex: 1, borderRadius: 10, padding: 10, backgroundColor: 'rgba(37,99,235,0.12)', alignItems: 'center' },
  secondaryText: { color: BRAND_COLORS.blue600, fontWeight: '800' },
});
