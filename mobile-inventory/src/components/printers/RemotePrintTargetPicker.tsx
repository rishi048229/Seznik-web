import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Send, CheckCircle2, Circle, Smartphone } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { useManagedUsers } from '@/hooks/useManagedUsers';
import { useBusinessDevices } from '@/hooks/usePrintJobs';
import { useAuthStore } from '@/store/useAuthStore';

interface RemotePrintTargetPickerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Context line under the title — usually the invoice being sent. */
  subtitle?: string;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (agentId: string) => void;
  /** Hidden from the list — used when reassigning away from whoever already didn't respond. */
  excludeAgentId?: string | null;
}

/** Shared "who should print this?" list. Both sending a new request and reassigning one that went
 *  unanswered pick a person exactly the same way, so this is one component rather than two lists
 *  that could drift apart. */
export const RemotePrintTargetPicker: React.FC<RemotePrintTargetPickerProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  submitLabel,
  isSubmitting,
  onSubmit,
  excludeAgentId,
}) => {
  const theme = useAppTheme();
  const currentActorId = useAuthStore((s) => s.user?.id);
  const { staff, isLoading: staffLoading } = useManagedUsers();
  const { devices, isLoading: devicesLoading } = useBusinessDevices(visible);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const deviceByActor = useMemo(() => new Map(devices.map((d) => [d.actorId, d])), [devices]);

  /** Union of two sources on purpose: the staff roster is only readable by the business owner, so
   *  a staff member who was granted send permission would otherwise see an empty list. Registered
   *  devices are readable by anyone in the business and cover exactly the people who can actually
   *  receive a job — together they cover both callers. */
  const targets = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const member of staff) {
      if (member.id) byId.set(member.id, { id: member.id, name: member.displayName || member.email || 'Staff' });
    }
    for (const device of devices) {
      if (!byId.has(device.actorId)) byId.set(device.actorId, { id: device.actorId, name: device.actorName });
    }
    return Array.from(byId.values()).filter((t) => t.id !== excludeAgentId && t.id !== currentActorId);
  }, [staff, devices, excludeAgentId, currentActorId]);

  const isLoadingTargets = staffLoading && devicesLoading;

  const handleClose = () => {
    setSelectedAgentId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.cardBg }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Who should print this receipt?</Text>

          {isLoadingTargets ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={BRAND_COLORS.blue600} />
          ) : targets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nobody available to send to yet. Add a staff member from Settings → Staff &amp; Permissions, and make
                sure they have signed in on their phone at least once.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 340 }}>
              {targets.map((target) => {
                const hasDevice = !!deviceByActor.get(target.id);
                const selected = selectedAgentId === target.id;
                return (
                  <TouchableOpacity
                    key={target.id}
                    style={[
                      styles.staffRow,
                      { borderColor: selected ? BRAND_COLORS.blue600 : theme.borderColor },
                      selected && { backgroundColor: BRAND_COLORS.blue600 + '10' },
                    ]}
                    onPress={() => setSelectedAgentId(target.id)}
                    activeOpacity={0.75}
                  >
                    {selected ? (
                      <CheckCircle2 size={20} color={BRAND_COLORS.blue600} />
                    ) : (
                      <Circle size={20} color={theme.textSecondary} />
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.staffName, { color: theme.textPrimary }]}>{target.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <Smartphone size={11} color={hasDevice ? '#16A34A' : '#DC2626'} style={{ marginRight: 4 }} />
                        <Text style={[styles.staffMeta, { color: hasDevice ? '#16A34A' : '#DC2626' }]}>
                          {hasDevice ? 'Phone ready to receive' : 'No phone registered — they may not get it'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.sendBtn, { opacity: !selectedAgentId || isSubmitting ? 0.5 : 1 }]}
            onPress={() => selectedAgentId && onSubmit(selectedAgentId)}
            disabled={!selectedAgentId || isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={18} color="#FFFFFF" />}
            <Text style={styles.sendBtnText}>{isSubmitting ? 'Sending…' : submitLabel}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '82%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  emptyBox: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 10 },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  staffName: { fontSize: 14, fontWeight: '700' },
  staffMeta: { fontSize: 11.5, fontWeight: '600' },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_COLORS.blue600,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 12,
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
