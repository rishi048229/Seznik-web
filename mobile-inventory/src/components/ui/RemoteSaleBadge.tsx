import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Send } from 'lucide-react-native';

/** Small, plain-language flag shown wherever a sale's receipt was printed remotely (Sales list,
 *  sale detail, Daybook transaction feed) — kept identical everywhere so a non-technical owner
 *  learns to recognize it once. */
export function RemoteSaleBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Send size={compact ? 9 : 11} color="#2563EB" />
      <Text style={[styles.text, compact && styles.textCompact]}>Remote Sale</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgeCompact: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  text: { fontSize: 10.5, fontWeight: '800', color: '#2563EB' },
  textCompact: { fontSize: 9.5 },
});
