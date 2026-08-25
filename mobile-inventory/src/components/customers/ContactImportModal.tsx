import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UserPlus,
  Search,
  X,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Users,
  Check,
  Smartphone,
  ShieldAlert,
} from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BRAND_COLORS } from '@/constants/theme';
import { CreateCustomerPayload } from '@/types/customer';

let Contacts: any = null;
try {
  Contacts = require('expo-contacts/legacy');
} catch (e) {
  Contacts = null;
}



export interface PhoneContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
  bulkCreateCustomers: (customers: CreateCustomerPayload[]) => Promise<{ success: boolean; count: number }>;
}

export function ContactImportModal({ visible, onClose, onImportSuccess, bulkCreateCustomers }: Props) {
  const theme = useAppTheme();

  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<PhoneContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Resets selection/search at the moment the modal actually closes (via handleClose below),
  // rather than reactively inside an effect — calling setState synchronously in an effect body
  // is flagged by the React Compiler and can cause cascading renders.
  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  const loadPhoneContacts = useCallback(async () => {
    if (!Contacts || typeof Contacts.requestPermissionsAsync !== 'function') {
      Alert.alert('Contacts Module Missing', 'Contacts integration requires rebuilding native binaries or updating Expo Go.');
      return;
    }

    setLoading(true);
    setPermissionDenied(false);

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Addresses,
        ],
      });

      const parsedList: PhoneContactItem[] = [];
      const seenPhones = new Set<string>();

      if (data && data.length > 0) {
        for (const item of data) {
          if (!item.name || !item.phoneNumbers || item.phoneNumbers.length === 0) continue;
          
          const rawPhone = item.phoneNumbers[0].number || '';
          const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
          if (!cleanPhone || cleanPhone.length < 5) continue;
          if (seenPhones.has(cleanPhone)) continue;
          seenPhones.add(cleanPhone);

          const email = item.emails && item.emails.length > 0 ? item.emails[0].email : undefined;
          const address = item.addresses && item.addresses.length > 0 ? item.addresses[0].formattedAddress : undefined;

          parsedList.push({
            id: item.id || `contact-${Math.random()}`,
            name: String(item.name).trim(),
            phone: cleanPhone,
            email,
            address,
          });
        }
      }

      parsedList.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(parsedList);
    } catch (err: any) {
      console.error('Failed to load phone contacts:', err);
      Alert.alert('Contacts Error', err?.message || 'Could not fetch device contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Deferred a tick so the fetch (and its setState calls) runs after this effect's own
    // synchronous commit, not within it — calling something that sets state directly inside an
    // effect's synchronous body is what the React Compiler's set-state-in-effect rule flags.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadPhoneContacts();
    });
    return () => {
      cancelled = true;
    };
  }, [visible, loadPhoneContacts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredContacts.map((c) => c.id));
      setSelectedIds(allIds);
    }
  };

  const handleConfirmImport = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact to import.');
      return;
    }

    setImporting(true);
    try {
      const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
      const payload: CreateCustomerPayload[] = selectedContacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        creditLimit: 5000,
      }));

      const res = await bulkCreateCustomers(payload);
      const count = res?.count ?? payload.length;
      onImportSuccess(count);
      handleClose();
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Failed to import contacts as customers.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <View style={styles.headerTitleRow}>
            <View style={styles.iconBox}>
              <Smartphone size={20} color="#FFFFFF" />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Import Phone Contacts</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Select contacts to add as customers</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {permissionDenied ? (
          <View style={styles.emptyContainer}>
            <ShieldAlert size={48} color="#EF4444" />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Contacts Permission Required</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Please grant contacts permission in your phone settings to import customers directly from your phone address book.
            </Text>
            <TouchableOpacity onPress={loadPhoneContacts} style={[styles.retryBtn, { backgroundColor: BRAND_COLORS.blue600 }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Grant Permission / Retry</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={BRAND_COLORS.blue600} />
            <Text style={[styles.emptySub, { color: theme.textSecondary, marginTop: 14 }]}>Loading phone contacts...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* SEARCH & BULK ACTIONS */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder={`Search ${contacts.length} contacts...`}
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
                  {filteredContacts.length} Contacts Found • {selectedIds.size} Selected
                </Text>
                <TouchableOpacity onPress={toggleSelectAll}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: BRAND_COLORS.blue600 }}>
                    {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* CONTACTS LIST */}
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={7}
              removeClippedSubviews={true}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              renderItem={({ item }) => {
                const isSelected = selectedIds.has(item.id);
                const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';

                return (
                  <TouchableOpacity
                    onPress={() => toggleSelect(item.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.contactCard,
                      { backgroundColor: theme.cardBg, borderColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor },
                      isSelected && { backgroundColor: 'rgba(37, 99, 235, 0.06)' },
                    ]}
                  >
                    <View style={styles.contactLeft}>
                      <View style={[styles.avatar, { backgroundColor: isSelected ? BRAND_COLORS.blue600 : theme.borderColor }]}>
                        <Text style={[styles.avatarText, { color: isSelected ? '#FFFFFF' : theme.textPrimary }]}>{initial}</Text>
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[styles.contactName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Phone size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>{item.phone}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.checkbox, isSelected && { backgroundColor: BRAND_COLORS.blue600, borderColor: BRAND_COLORS.blue600 }]}>
                      {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Users size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary, marginTop: 10 }]}>No Contacts Found</Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    No contacts matching &quot;{searchQuery}&quot; were found in your phone address book.
                  </Text>
                </View>
              )}
            />

            {/* FOOTER */}
            <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
              <TouchableOpacity
                onPress={handleConfirmImport}
                disabled={importing || selectedIds.size === 0}
                style={[
                  styles.importBtn,
                  { backgroundColor: BRAND_COLORS.blue600 },
                  selectedIds.size === 0 && { opacity: 0.5 },
                ]}
              >
                {importing ? (
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <UserPlus size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.importBtnText}>
                  Import {selectedIds.size} Selected Contacts
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', padding: 0 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  contactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  contactName: { fontSize: 14, fontWeight: '800' },
  contactPhone: { fontSize: 12, fontWeight: '600' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    borderTopWidth: 1,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  importBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
});
