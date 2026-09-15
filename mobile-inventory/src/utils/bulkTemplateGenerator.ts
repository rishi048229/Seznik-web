import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

export const UNIT_OPTIONS: Array<{
  id: number;
  key: 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box';
  label: string;
  aliases: string[];
}> = [
  { id: 1, key: 'piece', label: 'Piece / Unit (pcs)', aliases: ['piece', 'pcs', 'pc', 'nos', 'unit', 'units', '1'] },
  { id: 2, key: 'kg', label: 'Kilogram (kg)', aliases: ['kg', 'kgs', 'kilo', 'kilogram', '2'] },
  { id: 3, key: 'gram', label: 'Gram (g)', aliases: ['gram', 'gm', 'gms', 'g', '3'] },
  { id: 4, key: 'liter', label: 'Liter (L)', aliases: ['liter', 'litre', 'ltr', 'l', '4'] },
  { id: 5, key: 'meter', label: 'Meter (m)', aliases: ['meter', 'metre', 'mtr', 'm', '5'] },
  { id: 6, key: 'dozen', label: 'Dozen (12 pcs)', aliases: ['dozen', 'doz', 'dz', '6'] },
  { id: 7, key: 'box', label: 'Box / Pack (box)', aliases: ['box', 'bx', 'pkt', 'packet', '7'] },
];

export const UNIT_INDEX_MAP: Record<string, 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'> = {
  '1': 'piece',
  'piece': 'piece',
  'pcs': 'piece',
  'pc': 'piece',
  'nos': 'piece',
  'unit': 'piece',
  'units': 'piece',
  '2': 'kg',
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilogram': 'kg',
  '3': 'gram',
  'gram': 'gram',
  'gm': 'gram',
  'gms': 'gram',
  'g': 'gram',
  '4': 'liter',
  'litre': 'liter',
  'liter': 'liter',
  'ltr': 'liter',
  'l': 'liter',
  '5': 'meter',
  'metre': 'meter',
  'meter': 'meter',
  'mtr': 'meter',
  'm': 'meter',
  '6': 'dozen',
  'dozen': 'dozen',
  'doz': 'dozen',
  'dz': 'dozen',
  '7': 'box',
  'box': 'box',
  'bx': 'box',
  'pkt': 'box',
  'packet': 'box',
};

export function normalizeUnit(raw: string | number | undefined | null): 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box' {
  if (raw === undefined || raw === null) return 'piece';
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return 'piece';
  return UNIT_INDEX_MAP[trimmed] || 'piece';
}

export const TEMPLATE_HEADERS = [
  'Product Name*',
  'Category*',
  'Cost Price*',
  'Selling Price*',
  'Stock Quantity*',
  'Unit*',
  'Barcode (Optional)',
  'Tax Rate % (Optional)',
  'Min Stock Alert (Optional)',
  'Brand (Optional)',
  'Description (Optional)',
];

export const SAMPLE_TEMPLATE_ROWS = [
  [
    'Parle-G Gold 100g',
    'Snacks & Biscuits',
    18.00,
    22.50,
    100,
    'piece',
    '8901030383451',
    5,
    10,
    'Parle',
    'Glucose Biscuits 100g Pack',
  ],
  [
    'Amul Butter 500g',
    'Dairy & Breakfast',
    185.00,
    212.00,
    30,
    'piece',
    '8901262010051',
    12,
    5,
    'Amul',
    'Pasteurised Salted Butter',
  ],
  [
    'Basmati Rice Classic 1kg',
    'Staples & Grains',
    95.00,
    120.00,
    50,
    'kg',
    '', // empty for auto barcode
    0,
    0,
    'India Gate',
    'Aged Long Grain Basmati Rice',
  ],
  [
    'Ariel Matic Detergent Powder 2kg',
    'Household',
    280.00,
    328.00,
    20,
    'box',
    '789100000133',
    18,
    0,
    'Ariel',
    'Front Load Laundry Detergent',
  ],
  [
    'Fresh Cow Milk 1L',
    'Dairy & Breakfast',
    54.00,
    62.00,
    40,
    'liter',
    '',
    0,
    0,
    'Mother Dairy',
    'Pasteurized Milk Pouch',
  ],
];

export async function downloadBulkUploadTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> {
  try {
    const wsData = [TEMPLATE_HEADERS, ...SAMPLE_TEMPLATE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Product Name
      { wch: 20 }, // Category
      { wch: 14 }, // Cost Price
      { wch: 14 }, // Selling Price
      { wch: 16 }, // Stock Quantity
      { wch: 14 }, // Unit
      { wch: 20 }, // Barcode
      { wch: 20 }, // Tax Rate %
      { wch: 22 }, // Min Stock Alert
      { wch: 18 }, // Brand
      { wch: 32 }, // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    const fileName = `seznik_product_upload_template.${format}`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    if (format === 'csv') {
      const csvData = XLSX.utils.sheet_to_csv(ws);
      await FileSystem.writeAsStringAsync(fileUri, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType:
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
        dialogTitle: 'Download Bulk Upload Template',
        UTI: format === 'xlsx' ? 'org.openxmlformats.spreadsheetml.sheet' : 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Download Ready', `Template saved to ${fileUri}`);
    }
  } catch (error: any) {
    console.error('Failed to generate template:', error);
    Alert.alert('Error', sanitizeErrorMessage(error, 'Failed to download bulk upload template. Please try again.'));
  }
}
