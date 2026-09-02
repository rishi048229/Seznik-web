import { LabelTemplate, LabelElement } from '@/types/labelTemplate';

export type LabelPresetId = 'classic_mrp' | 'retail_dual_code' | 'centered_standard' | 'minimal_tag';

export interface LabelPresetMeta {
  id: LabelPresetId;
  name: string;
  /** Plain-language description — these are chosen by shop staff, not designers. */
  description: string;
}

export const LABEL_PRESETS: ReadonlyArray<LabelPresetMeta> = [
  {
    id: 'classic_mrp',
    name: 'Classic MRP',
    description: 'Shop name, product, barcode and MRP — everything centred',
  },
  {
    id: 'retail_dual_code',
    name: 'Barcode + QR',
    description: 'Barcode and QR side by side, with the MRP line underneath',
  },
  {
    id: 'centered_standard',
    name: 'Simple Centred',
    description: 'Shop name, product, barcode and price. No MRP line',
  },
  {
    id: 'minimal_tag',
    name: 'Price Tag',
    description: 'Just the product, barcode and price — no shop name',
  },
];

let seq = 0;
const nextId = () => `el-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Builds one of the four stock label layouts at a given label size.
 *
 * These mirror the layouts the web app already prints (see
 * frontend/src/utils/labelPrint.ts — PRESET_RETAIL_DUAL_CODE,
 * PRESET_CENTERED_STANDARD, PRESET_MINIMAL_TAG and defaultLabelTemplate), so a
 * shop running both gets the same sticker from either. The web version lays elements out
 * in flow order; mobile positions everything in millimetres, so each one is
 * rebuilt here proportionally rather than copied, which is also what lets the
 * same preset work on a 25mm tag and a 100mm label.
 *
 * `businessName` is baked in as fixed text because there is no businessName
 * binding — the resolver only ever sees a Product, not the store profile.
 */
export function buildLabelPreset(
  preset: LabelPresetId,
  widthMm: number,
  heightMm: number,
  businessName?: string
): LabelTemplate {
  const now = new Date().toISOString();
  const pad = Math.max(1.5, Math.round(widthMm * 0.05 * 10) / 10);
  const innerW = widthMm - pad * 2;

  // Text heights scale with the label so a 25mm tag stays readable and a 100mm
  // label does not end up with a stripe of text floating at the top.
  const titleH = Math.max(3, Math.min(5, heightMm * 0.14));
  const bodyH = Math.max(2.6, Math.min(4.2, heightMm * 0.12));
  const smallH = Math.max(2.2, Math.min(3.2, heightMm * 0.09));

  const meta = LABEL_PRESETS.find((p) => p.id === preset);
  const base = {
    id: `label-${preset}-${Date.now()}`,
    name: meta?.name ?? 'Label',
    widthMm,
    heightMm,
    orientation: (widthMm >= heightMm ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
    createdAt: now,
    updatedAt: now,
  };

  const shopLine = (y: number): LabelElement => ({
    id: nextId(),
    type: 'text',
    binding: 'custom',
    customText: businessName || 'My Shop',
    xMm: pad,
    yMm: y,
    widthMm: innerW,
    heightMm: titleH,
    fontSizePt: titleH,
    bold: true,
    align: 'center',
  });

  if (preset === 'minimal_tag') {
    // Product top-left, barcode through the middle, price bottom-right.
    const codeTop = pad + bodyH + 1;
    const codeH = Math.max(5, heightMm - codeTop - bodyH - pad - 1);
    return {
      ...base,
      elements: [
        {
          id: nextId(), type: 'text', binding: 'productName',
          xMm: pad, yMm: pad, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'left',
        },
        {
          id: nextId(), type: 'barcode', format: 'code128', binding: 'barcode',
          xMm: pad, yMm: codeTop, widthMm: innerW, heightMm: codeH,
        },
        {
          id: nextId(), type: 'text', binding: 'price',
          xMm: pad, yMm: heightMm - bodyH - pad, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'right',
        },
      ],
    };
  }

  if (preset === 'retail_dual_code') {
    // Barcode and QR share a row; the MRP line and price sit left-aligned below.
    const nameY = pad + titleH + 0.8;
    const codeTop = nameY + bodyH + 0.8;
    const codeH = Math.max(6, heightMm - codeTop - smallH - bodyH - pad - 1.6);
    const qrSide = Math.min(codeH, innerW * 0.34);
    return {
      ...base,
      elements: [
        shopLine(pad),
        {
          id: nextId(), type: 'text', binding: 'productName',
          xMm: pad, yMm: nameY, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'left',
        },
        {
          id: nextId(), type: 'barcode', format: 'code128', binding: 'barcode',
          xMm: pad, yMm: codeTop, widthMm: innerW - qrSide - 1.5, heightMm: codeH,
        },
        {
          id: nextId(), type: 'qrcode', binding: 'barcode',
          xMm: widthMm - pad - qrSide, yMm: codeTop, widthMm: qrSide, heightMm: qrSide,
        },
        {
          id: nextId(), type: 'text', binding: 'custom',
          customText: 'MRP (Incl. of all taxes)',
          xMm: pad, yMm: heightMm - bodyH - smallH - pad, widthMm: innerW, heightMm: smallH,
          fontSizePt: smallH, align: 'left',
        },
        {
          id: nextId(), type: 'text', binding: 'price',
          xMm: pad, yMm: heightMm - bodyH - pad, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'left',
        },
      ],
    };
  }

  if (preset === 'centered_standard') {
    const nameY = pad + titleH + 0.8;
    const codeTop = nameY + bodyH + 1;
    const codeH = Math.max(6, heightMm - codeTop - bodyH - pad - 1);
    return {
      ...base,
      elements: [
        shopLine(pad),
        {
          id: nextId(), type: 'text', binding: 'productName',
          xMm: pad, yMm: nameY, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'center',
        },
        {
          id: nextId(), type: 'barcode', format: 'code128', binding: 'barcode',
          xMm: pad, yMm: codeTop, widthMm: innerW, heightMm: codeH,
        },
        {
          id: nextId(), type: 'text', binding: 'price',
          xMm: pad, yMm: heightMm - bodyH - pad, widthMm: innerW, heightMm: bodyH,
          fontSizePt: bodyH, bold: true, align: 'center',
        },
      ],
    };
  }

  // classic_mrp — the shared default: everything centred, with the MRP caption.
  const nameY = pad + titleH + 0.8;
  const codeTop = nameY + bodyH + 1;
  const codeH = Math.max(6, heightMm - codeTop - smallH - bodyH - pad - 1.6);
  return {
    ...base,
    elements: [
      shopLine(pad),
      {
        id: nextId(), type: 'text', binding: 'productName',
        xMm: pad, yMm: nameY, widthMm: innerW, heightMm: bodyH,
        fontSizePt: bodyH, align: 'center',
      },
      {
        id: nextId(), type: 'barcode', format: 'code128', binding: 'barcode',
        xMm: pad, yMm: codeTop, widthMm: innerW, heightMm: codeH,
      },
      {
        id: nextId(), type: 'text', binding: 'custom',
        customText: 'MRP (Incl. of all taxes)',
        xMm: pad, yMm: heightMm - bodyH - smallH - pad, widthMm: innerW, heightMm: smallH,
        fontSizePt: smallH, align: 'center',
      },
      {
        id: nextId(), type: 'text', binding: 'price',
        xMm: pad, yMm: heightMm - bodyH - pad, widthMm: innerW, heightMm: bodyH,
        fontSizePt: bodyH, bold: true, align: 'center',
      },
    ],
  };
}
