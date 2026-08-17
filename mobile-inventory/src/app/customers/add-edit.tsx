import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, User, Phone, MapPin, CheckCircle2 } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useCustomerStore } from '@/store/useCustomerStore';
import { Input } from '@/components/ui/input';

export default function CustomerAddEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { customers, addCustomer, updateCustomer } = useCustomerStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const isEditing = !!id;

  useEffect(() => {
    if (isEditing && customers.length > 0) {
      const customer = customers.find((c) => c.id === id);
      if (customer) {
        setName(customer.name);
        setPhone(customer.phone);
        setAddress(customer.address || '');
      }
    }
  }, [id, isEditing, customers]);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (phone.length < 10) {
      setError('Valid phone number is required (min 10 digits)');
      return;
    }

    if (isEditing) {
      const customer = customers.find((c) => c.id === id);
      if (customer) {
        await updateCustomer({
          ...customer,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      }
    } else {
      await addCustomer({
        id: `cust_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        totalSpend: 0,
        visitCount: 0,
        lastVisitAt: new Date().toISOString(),
        creditBalance: 0,
        createdAt: new Date().toISOString(),
      });
    }

    router.back();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {isEditing ? 'Edit Customer' : 'Add Customer'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + '20' }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Input
              label="Full Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rahul Sharma"
              rightElement={<User size={18} color={colors.neutral} />}
            />
          </View>

          <View style={styles.formGroup}>
            <Input
              label="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              rightElement={<Phone size={18} color={colors.neutral} />}
            />
          </View>

          <View style={styles.formGroup}>
            <Input
              label="Address (Optional)"
              value={address}
              onChangeText={setAddress}
              placeholder="City, Locality or Full Address"
              rightElement={<MapPin size={18} color={colors.neutral} />}
            />
          </View>

        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: name && phone.length >= 10 ? colors.primary : colors.neutral }]}
            onPress={handleSave}
            disabled={!name || phone.length < 10}
          >
            <CheckCircle2 size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>Save Customer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  errorBox: { padding: 12, borderRadius: 8, marginBottom: 8 },
  errorText: { fontSize: 13, fontWeight: '600' },
  formGroup: { marginBottom: 4 },
  footer: { padding: 20, borderTopWidth: 1 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 16 },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
