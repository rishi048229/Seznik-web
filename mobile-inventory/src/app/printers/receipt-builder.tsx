import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  Plus,
  Receipt,
  Share2,
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  Printer,
  CheckCircle2,
  FileText,
  Sparkles,
  QrCode,
  Eye,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePrinterStore } from '@/store/usePrinterStore';
import ThermalPrinterService, { PrintSaleData } from '@/services/PrinterService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/hooks/useSettings';
import { CustomReceiptTemplate, createDefaultReceiptTemplate } from '@/types/customReceipt';
import { BRAND_COLORS } from '@/constants/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function ReceiptBuilderHubScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, 12);

  const {
    customTemplates,
    activeCustomTemplateId,
    activeTemplateId,
    setActiveCustomTemplate,
    deleteCustomTemplate,
    duplicateCustomTemplate,
    saveCustomTemplate,
    enableBillQrCode,
    setEnableBillQrCode,
    paperWidth,
  } = usePrinterStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | '58mm' | '80mm'>('all');
  const [activeMenuTemplate, setActiveMenuTemplate] = useState<CustomReceiptTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<CustomReceiptTemplate | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Sample data for test print / preview
  const samplePrintData: PrintSaleData = useMemo(() => ({
    storeName: settings?.businessName || 'SEZNIK SUPERSTORE',
    storeAddress: settings?.businessAddress || '123 Market Road, City Centre',
    storePhone: settings?.businessPhone || '+91 98765 43210',
    storeGstin: settings?.businessGSTIN || '27AAAAA0000A1Z5',
    storeLogoUrl: settings?.businessLogoURL || undefined,
    upiId: settings?.upiId || 'seznik@upi',
    invoiceNumber: 'INV-2026-0042',
    date: new Date().toLocaleDateString('en-GB'),
    customerName: 'Aarav Sharma',
    customerPhone: '+91 99887 76655',
    items: [
      { productName: 'Premium Basmati Rice 5kg', quantity: 1, unitPrice: 450, total: 450, unit: 'Bag', gstRate: 5 },
      { productName: 'Cold Pressed Sunflower Oil 1L', quantity: 2, unitPrice: 180, total: 360, unit: 'Bottle', gstRate: 5 },
      { productName: 'Organic Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280, total: 280, unit: 'Bag', gstRate: 0 },
    ],
    subtotal: 1090,
    totalDiscount: 50,
    taxableAmt: 1040,
    sgst: 20.25,
    cgst: 20.25,
    totalTax: 40.5,
    grandTotal: 1080.5,
    amountPaid: 1100,
    changeReturned: 19.5,
    paymentMethod: 'UPI',
  }), [settings]);

  const filteredTemplates = useMemo(() => {
    return customTemplates.filter((t) => {
      if (selectedFilter === 'active' && t.id !== activeCustomTemplateId) return false;
      if (selectedFilter === '58mm' && t.paperWidth !== '58mm') return false;
      if (selectedFilter === '80mm' && t.paperWidth !== '80mm') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
    });
  }, [customTemplates, selectedFilter, searchQuery, activeCustomTemplateId]);

  const handleCreateNew = () => {
    const newTpl = createDefaultReceiptTemplate(`Custom Receipt ${customTemplates.length + 1}`);
    saveCustomTemplate(newTpl).then(() => {
      router.push({
        pathname: '/printers/receipt-editor',
        params: { id: newTpl.id },
      });
    });
  };

  const handleSetDefault = async (template: CustomReceiptTemplate) => {
    try {
      await setActiveCustomTemplate(template.id);
      setActiveMenuTemplate(null);
      Alert.alert('Default Updated', `"${template.name}" is now the active receipt layout for POS billing.`);
    } catch {
      Alert.alert('Error', 'Could not set default receipt template.');
    }
  };

  const handleDuplicate = async (template: CustomReceiptTemplate) => {
    try {
      const cloned = await duplicateCustomTemplate(template.id);
      setActiveMenuTemplate(null);
      Alert.alert('Template Duplicated', `Created "${cloned.name}".`);
    } catch {
      Alert.alert('Error', 'Could not duplicate template.');
    }
  };

  const handleDelete = (template: CustomReceiptTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomTemplate(template.id);
            setActiveMenuTemplate(null);
          },
        },
      ]
    );
  };

  const handleTestPrint = async (template: CustomReceiptTemplate) => {
    setIsActionLoading(true);
    try {
      const ok = await ThermalPrinterService.printReceipt(samplePrintData, template.paperWidth || paperWidth, {
        customTemplate: template,
        includeBillQr: enableBillQrCode,
      });
      if (ok) {
        Alert.alert('Print Successful', 'Test receipt sent to thermal printer!');
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Failed to print test receipt.');
    } finally {
      setIsActionLoading(false);
      setActiveMenuTemplate(null);
    }
  };

  const handleSharePdf = async (template: CustomReceiptTemplate) => {
    setIsActionLoading(true);
    try {
      const html = ThermalPrinterService.generateCustomReceiptHtml(samplePrintData, template, template.paperWidth || paperWidth);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt - ${template.name}`,
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      }
    } catch (e: any) {
      Alert.alert('PDF Export Error', e?.message || 'Could not export receipt PDF.');
    } finally {
      setIsActionLoading(false);
      setActiveMenuTemplate(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: topPadding }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Receipt Builder</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Design, customize & print thermal receipts
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCreateNew}
          style={[styles.createHeaderBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.createHeaderBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Top Two Main Action Cards (Matching Screenshot 3) */}
        <View style={styles.topCardsRow}>
          {/* Card 1: Print Custom Receipt */}
          <TouchableOpacity
            style={[styles.topActionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => {
              if (customTemplates.length > 0) {
                setPreviewTemplate(customTemplates.find((t) => t.id === activeCustomTemplateId) || customTemplates[0]);
              } else {
                handleCreateNew();
              }
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.topIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Receipt size={28} color="#2563EB" />
            </View>
            <Text style={[styles.topCardTitle, { color: theme.textPrimary }]}>Print Custom Receipt</Text>
            <Text style={[styles.topCardSub, { color: theme.textSecondary }]}>
              {activeCustomTemplateId ? 'Active: Custom Template' : 'Select or Build Template'}
            </Text>
          </TouchableOpacity>

          {/* Card 2: Share & Print Receipt */}
          <TouchableOpacity
            style={[styles.topActionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => {
              if (customTemplates.length > 0) {
                handleSharePdf(customTemplates[0]);
              } else {
                handleCreateNew();
              }
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.topIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Share2 size={28} color="#16A34A" />
            </View>
            <Text style={[styles.topCardTitle, { color: theme.textPrimary }]}>Share & Print Receipt</Text>
            <Text style={[styles.topCardSub, { color: theme.textSecondary }]}>Export PDF & Share</Text>
          </TouchableOpacity>
        </View>

        {/* Digital Bill QR Code Feature Banner */}
        <View
          style={[
            styles.qrBannerBox,
            {
              backgroundColor: enableBillQrCode ? '#F0FDF4' : theme.cardBg,
              borderColor: enableBillQrCode ? '#86EFAC' : theme.borderColor,
            },
          ]}
        >
          <View style={styles.qrBannerLeft}>
            <View
              style={[
                styles.qrIconCircle,
                { backgroundColor: enableBillQrCode ? '#DCFCE7' : 'rgba(100, 116, 139, 0.15)' },
              ]}
            >
              <QrCode size={22} color={enableBillQrCode ? '#16A34A' : theme.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.qrBannerTitle, { color: theme.textPrimary }]}>
                Digital Bill QR Code
              </Text>
              <Text style={[styles.qrBannerSub, { color: theme.textSecondary }]}>
                Prints a scannable QR on every bill. Customers scan it to view and download full PDF receipt online.
              </Text>
            </View>
          </View>
          <Switch
            value={enableBillQrCode}
            onValueChange={setEnableBillQrCode}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={enableBillQrCode ? '#16A34A' : '#F1F5F9'}
          />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Search size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search custom receipt templates..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active in POS' },
            { id: '58mm', label: '58mm Roll' },
            { id: '80mm', label: '80mm Roll' },
          ].map((f) => {
            const isSelected = selectedFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelectedFilter(f.id as any)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? BRAND_COLORS.navyInk : theme.cardBg,
                    borderColor: isSelected ? BRAND_COLORS.navyInk : theme.borderColor,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#FFF' : theme.textPrimary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Templates Header */}
        <View style={styles.templatesHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Saved Custom Receipts ({filteredTemplates.length})
          </Text>
          <TouchableOpacity onPress={handleCreateNew} style={styles.inlineAddBtn}>
            <Plus size={16} color={BRAND_COLORS.navyInk} />
            <Text style={[styles.inlineAddBtnText, { color: BRAND_COLORS.navyInk }]}>Add Custom</Text>
          </TouchableOpacity>
        </View>

        {/* Templates List */}
        {filteredTemplates.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Receipt size={36} color={theme.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Custom Templates</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Create your first custom receipt layout with custom logos, text, lines, tables, and QR codes.
            </Text>
            <TouchableOpacity onPress={handleCreateNew} style={[styles.emptyActionBtn, { backgroundColor: BRAND_COLORS.navyInk }]}>
              <Plus size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Create Custom Receipt</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredTemplates.map((template) => {
              const isActive = template.id === activeCustomTemplateId;
              const enabledEntriesCount = template.entries.filter((e) => e.enabled).length;

              return (
                <View
                  key={template.id}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: isActive ? '#3B82F6' : theme.borderColor,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.templateCardContent}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/printers/receipt-editor',
                        params: { id: template.id },
                      })
                    }
                  >
                    <View style={[styles.templateIconWrap, { backgroundColor: isActive ? '#EFF6FF' : '#F1F5F9' }]}>
                      <Receipt size={24} color={isActive ? '#2563EB' : '#64748B'} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.templateName, { color: theme.textPrimary }]}>{template.name}</Text>
                        {isActive && (
                          <View style={styles.activePill}>
                            <CheckCircle2 size={12} color="#16A34A" />
                            <Text style={styles.activePillText}>Active POS</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.templateMetaRow}>
                        <Text style={[styles.templateMetaText, { color: theme.textSecondary }]}>
                          {template.paperWidth || '58mm'} • {enabledEntriesCount} block entries
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Actions right */}
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      onPress={() => setPreviewTemplate(template)}
                      style={styles.actionIconBtn}
                      activeOpacity={0.7}
                    >
                      <Eye size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleTestPrint(template)}
                      style={styles.actionIconBtn}
                      activeOpacity={0.7}
                    >
                      <Printer size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveMenuTemplate(template)}
                      style={styles.actionIconBtn}
                      activeOpacity={0.7}
                    >
                      <MoreVertical size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 3-Dots Action Menu Modal */}
      {activeMenuTemplate && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveMenuTemplate(null)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setActiveMenuTemplate(null)}
          >
            <View style={[styles.menuContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.menuHeader}>
                <Text style={[styles.menuTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {activeMenuTemplate.name}
                </Text>
                <TouchableOpacity onPress={() => setActiveMenuTemplate(null)}>
                  <X size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSetDefault(activeMenuTemplate)}
              >
                <CheckCircle2 size={18} color="#16A34A" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Set as Default POS Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const tplId = activeMenuTemplate.id;
                  setActiveMenuTemplate(null);
                  router.push({
                    pathname: '/printers/receipt-editor',
                    params: { id: tplId },
                  });
                }}
              >
                <Edit3 size={18} color="#2563EB" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Edit in Visual Builder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const tpl = activeMenuTemplate;
                  setActiveMenuTemplate(null);
                  setPreviewTemplate(tpl);
                }}
              >
                <Eye size={18} color="#0D9488" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Preview Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleTestPrint(activeMenuTemplate)}
              >
                <Printer size={18} color="#6366F1" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Test Print (Thermal)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSharePdf(activeMenuTemplate)}
              >
                <Share2 size={18} color="#EA580C" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Export / Share PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleDuplicate(activeMenuTemplate)}
              >
                <Copy size={18} color="#64748B" />
                <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Duplicate Template</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.borderColor, marginTop: 4 }]}
                onPress={() => handleDelete(activeMenuTemplate)}
              >
                <Trash2 size={18} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: '#DC2626' }]}>Delete Template</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setPreviewTemplate(null)}
        >
          <View style={styles.previewModalOverlay}>
            <View style={[styles.previewModalContainer, { backgroundColor: theme.bg }]}>
              <View style={[styles.previewHeader, { borderBottomColor: theme.borderColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>
                    {previewTemplate.name}
                  </Text>
                  <Text style={[styles.previewSub, { color: theme.textSecondary }]}>
                    Thermal Receipt Preview ({previewTemplate.paperWidth || '58mm'})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPreviewTemplate(null)}
                  style={styles.previewCloseBtn}
                >
                  <X size={22} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
                <View
                  style={[
                    styles.thermalPaperRoll,
                    {
                      width: previewTemplate.paperWidth === '80mm' ? 340 : 280,
                    },
                  ]}
                >
                  <Text style={styles.thermalPaperMono}>
                    {ThermalPrinterService.formatCustomReceiptText(
                      samplePrintData,
                      previewTemplate,
                      previewTemplate.paperWidth || '58mm'
                    )}
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.previewFooter, { borderTopColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
                <TouchableOpacity
                  style={[styles.previewFooterBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => handleSharePdf(previewTemplate)}
                >
                  <Share2 size={18} color="#334155" style={{ marginRight: 6 }} />
                  <Text style={[styles.previewFooterBtnText, { color: '#334155' }]}>Share PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.previewFooterBtn, { backgroundColor: BRAND_COLORS.navyInk }]}
                  onPress={() => handleTestPrint(previewTemplate)}
                >
                  <Printer size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.previewFooterBtnText, { color: '#FFF' }]}>Print Sample</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Loading Overlay */}
      {isActionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  createHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  createHeaderBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  topActionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  topIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  topCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  topCardSub: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  qrBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  qrBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  qrIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  qrBannerSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  filterChipsRow: {
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  templatesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  templateCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 14,
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  templateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  templateMetaText: {
    fontSize: 12,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  actionIconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  previewModalContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  previewCloseBtn: {
    padding: 6,
  },
  thermalPaperRoll: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  thermalPaperMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
    color: '#000000',
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  previewFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  previewFooterBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
});
