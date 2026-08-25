export type ChargeApplyOn = 'net_subtotal' | 'gross';
export type ChargeKind = 'service' | 'legacy_vat' | 'other';
export type ChargeType = 'percent' | 'flat';

export interface BillChargePreset {
  id: string;
  label: string;
  kind: ChargeKind;
  type: ChargeType;
  value: number;
  enabled: boolean;
  defaultSelected: boolean;
  applyOn: ChargeApplyOn;
}

export interface AppliedBillCharge {
  presetId: string;
  label: string;
  kind: ChargeKind;
  type: ChargeType;
  value: number;
  amount: number;
  applyOn?: ChargeApplyOn;
}

export interface RestaurantBillingConfig {
  configured: boolean;
  presets: BillChargePreset[];
}

export const DEFAULT_RESTAURANT_PRESETS: BillChargePreset[] = [
  {
    id: 'service-charge-10',
    label: 'Service Charges 10.00%',
    kind: 'service',
    type: 'percent',
    value: 10,
    enabled: true,
    defaultSelected: true,
    applyOn: 'gross',
  },
  {
    id: 'service-tax-5-6',
    label: 'Service Tax 5.6 %',
    kind: 'legacy_vat',
    type: 'percent',
    value: 5.6,
    enabled: true,
    defaultSelected: false,
    applyOn: 'net_subtotal',
  },
];

export const DEFAULT_RESTAURANT_BILLING: RestaurantBillingConfig = {
  configured: false,
  presets: DEFAULT_RESTAURANT_PRESETS,
};

function normalizePreset(raw: Record<string, unknown>, index: number): BillChargePreset | null {
  const label = String(raw.label ?? '').trim();
  if (!label) return null;
  const type: ChargeType = raw.type === 'flat' ? 'flat' : 'percent';
  const kind: ChargeKind =
    raw.kind === 'legacy_vat' ? 'legacy_vat' : raw.kind === 'other' ? 'other' : 'service';
  const applyOn: ChargeApplyOn = raw.applyOn === 'gross' ? 'gross' : 'net_subtotal';
  return {
    id: String(raw.id ?? `preset-${index}`),
    label,
    kind,
    type,
    value: Math.max(0, Number(raw.value) || 0),
    enabled: raw.enabled !== false,
    defaultSelected: Boolean(raw.defaultSelected),
    applyOn,
  };
}

export function parseRestaurantBilling(invoiceConfig: unknown): RestaurantBillingConfig {
  const raw =
    invoiceConfig && typeof invoiceConfig === 'object'
      ? (invoiceConfig as { restaurantBilling?: Record<string, unknown> }).restaurantBilling
      : undefined;

  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_RESTAURANT_BILLING };
  }

  const presetsRaw = Array.isArray(raw.presets) ? raw.presets : [];
  const presets = presetsRaw
    .map((p, i) => (p && typeof p === 'object' ? normalizePreset(p as Record<string, unknown>, i) : null))
    .filter((p): p is BillChargePreset => p !== null);

  return {
    configured: true,
    presets: presets.length > 0 ? presets : DEFAULT_RESTAURANT_PRESETS,
  };
}

export function toRestaurantBillingPayload(config: Omit<RestaurantBillingConfig, 'configured'>): Record<string, unknown> {
  return { presets: config.presets };
}

export function getEnabledPresets(config: RestaurantBillingConfig): BillChargePreset[] {
  return config.presets.filter((p) => p.enabled);
}

export function shouldShowBillCharges(config: RestaurantBillingConfig): boolean {
  return config.configured && config.presets.some((p) => p.enabled);
}

export function computeChargeAmount(
  preset: BillChargePreset,
  netSubtotal: number,
  grossSubtotal = netSubtotal,
): number {
  if (preset.type === 'flat') {
    return Math.round(Math.max(0, preset.value) * 100) / 100;
  }
  const base = preset.applyOn === 'gross' ? grossSubtotal : netSubtotal;
  const pct = Math.max(0, preset.value);
  return Math.round(Math.max(0, base) * (pct / 100) * 100) / 100;
}

export function resolveBillCharges(
  presets: BillChargePreset[],
  selectedIds: string[],
  netSubtotal: number,
  grossSubtotal = netSubtotal,
): AppliedBillCharge[] {
  const selected = new Set(selectedIds);
  return presets
    .filter((p) => p.enabled && selected.has(p.id))
    .map((preset) => ({
      presetId: preset.id,
      label: preset.label,
      kind: preset.kind,
      type: preset.type,
      value: preset.value,
      applyOn: preset.applyOn,
      amount: computeChargeAmount(preset, netSubtotal, grossSubtotal),
    }));
}

export function defaultSelectedPresetIds(presets: BillChargePreset[]): string[] {
  return presets.filter((p) => p.enabled && p.defaultSelected).map((p) => p.id);
}

export function createPresetId(): string {
  return `charge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function formatChargeLabel(preset: BillChargePreset): string {
  if (preset.type === 'flat') return `${preset.label} (₹${preset.value})`;
  return `${preset.label} (${preset.value}%)`;
}
