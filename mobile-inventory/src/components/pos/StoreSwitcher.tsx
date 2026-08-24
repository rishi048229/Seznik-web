import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Store } from 'lucide-react-native';
import { useSettings } from '@/hooks/useSettings';
import { useLocations } from '@/hooks/useLocations';
import { getStoredSelectedStoreId, setStoredSelectedStoreId } from '@/services/secureStore';
import { BRAND_COLORS } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Billing/browsing store toggle — renders only when multi-store inventory is enabled in
 * Settings AND at least one active store exists. Shared between POS and Products via the
 * same persisted key, so picking a store on one screen carries over to the other (a cashier
 * is physically at one store for a whole shift, not per cart-line).
 */
export function StoreSwitcher({ onChange }: { onChange: (storeId: string | null) => void }) {
  const theme = useAppTheme();
  const { settings } = useSettings();
  const { locations } = useLocations();
  const enabled = settings?.locationConfig?.enabled ?? false;
  const activeLocations = locations.filter((l) => l.isActive);
  const activeIdsKey = activeLocations.map((l) => l.id).join(',');

  const [stored, setStored] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore the previously picked store once, on mount.
  useEffect(() => {
    let cancelled = false;
    getStoredSelectedStoreId()
      .then((value) => {
        if (!cancelled) {
          setStored(value);
          setHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived during render rather than synced via an effect: a stored store that is no longer
  // active (deactivated or deleted) simply reads as "no selection", so we never bill from a
  // store that no longer exists and never need a corrective setState pass.
  const selected = stored && activeLocations.some((l) => l.id === stored) ? stored : null;

  // Tell the parent which store is in effect. Only an external notification lives in the
  // effect — no local state is written here.
  useEffect(() => {
    if (!hydrated) return;
    onChange(enabled ? selected : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selected, activeIdsKey, hydrated]);

  // Drop the now-dangling stored id in the background so it doesn't linger in storage.
  useEffect(() => {
    if (hydrated && stored && !selected) {
      setStoredSelectedStoreId(null);
    }
  }, [hydrated, stored, selected]);

  if (!enabled || activeLocations.length === 0) return null;

  const pick = (id: string | null) => {
    setStored(id);
    setStoredSelectedStoreId(id);
  };

  return (
    <View style={styles.wrap}>
      <Store size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => pick(null)}
          style={[
            styles.pill,
            { borderColor: theme.borderColor, backgroundColor: theme.cardBg },
            selected === null && { backgroundColor: BRAND_COLORS.navyInk, borderColor: BRAND_COLORS.navyInk },
          ]}
        >
          <Text style={[styles.pillText, { color: selected === null ? '#FFFFFF' : theme.textSecondary }]}>All Stores</Text>
        </TouchableOpacity>
        {activeLocations.map((loc) => {
          const isSelected = selected === loc.id;
          return (
            <TouchableOpacity
              key={loc.id}
              onPress={() => pick(isSelected ? null : loc.id)}
              style={[
                styles.pill,
                { borderColor: theme.borderColor, backgroundColor: theme.cardBg },
                isSelected && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 },
              ]}
            >
              <Text style={[styles.pillText, { color: isSelected ? '#FFFFFF' : theme.textSecondary }]}>{loc.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginRight: 7 },
  pillText: { fontSize: 11, fontWeight: '800' },
});
