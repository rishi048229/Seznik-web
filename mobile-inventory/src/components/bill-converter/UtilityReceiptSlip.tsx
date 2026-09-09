import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UtilityBill } from '@/types/utilityBill';

export interface UtilityReceiptData {
  kioskName?: string;
  billType?: string;
  provider?: string;
  consumerNumber?: string;
  consumerName?: string;
  dueDate?: string | null;
  billDate?: string | null;
  unitsConsumed?: string | null;
  billAmount: number;
  convenienceFee: number;
  totalAmount: number;
  status?: string;
  receiptNumber?: string;
  createdAt?: string;
}

/**
 * Pads left and right strings to fill exactly totalWidth columns.
 */
function justifyLine(left: string, right: string, totalWidth: number): string {
  const available = totalWidth - left.length - right.length;
  if (available <= 0) {
    return `${left} ${right}`;
  }
  return `${left}${' '.repeat(available)}${right}`;
}

/**
 * Centers text within a given column width.
 */
function centerLine(text: string, totalWidth: number): string {
  if (text.length >= totalWidth) return text.slice(0, totalWidth);
  const pad = Math.max(0, Math.floor((totalWidth - text.length) / 2));
  return ' '.repeat(pad) + text;
}

/**
 * Builds the exact reference thermal receipt text layout.
 * Formatted for 32 columns (58mm) or 48 columns (80mm).
 * Empty fields remain empty or are cleanly omitted without placeholder artifacts.
 */
export function formatUtilityReceiptText(
  bill: UtilityReceiptData,
  paperWidth: '58mm' | '80mm' = '58mm'
): string {
  const cols = paperWidth === '80mm' ? 48 : 32;
  const doubleLine = '='.repeat(cols);
  const singleLine = '-'.repeat(cols);

  const kioskTitle = (bill.kioskName || 'SEZNIK KIOSK').toUpperCase();
  const billType = bill.billType || 'ELECTRICITY';
  const typeHeader = `${billType.toUpperCase()} BILL RECEIPT`;

  const dateObj = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const dateStr = bill.billDate || dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const lines: string[] = [
    doubleLine,
    centerLine(kioskTitle, cols),
    centerLine(typeHeader, cols),
    doubleLine,
    justifyLine(`Date: ${dateStr}`, timeStr, cols),
  ];

  if (bill.provider && bill.provider.trim()) {
    lines.push(`Provider: ${bill.provider.trim()}`);
  }
  if (bill.consumerNumber && bill.consumerNumber.trim()) {
    lines.push(`Consumer No: ${bill.consumerNumber.trim()}`);
  }
  if (bill.consumerName && bill.consumerName.trim()) {
    lines.push(`Consumer: ${bill.consumerName.trim()}`);
  }
  if (bill.dueDate && bill.dueDate.trim()) {
    lines.push(`Bill Due Date: ${bill.dueDate.trim()}`);
  }
  if (bill.unitsConsumed && bill.unitsConsumed.trim()) {
    lines.push(`Units Consumed: ${bill.unitsConsumed.trim()}`);
  }

  lines.push(singleLine);

  const formattedBillAmount = `Rs.${bill.billAmount.toFixed(2)}`;
  const formattedFee = `Rs.${bill.convenienceFee.toFixed(2)}`;
  const formattedTotal = `Rs.${bill.totalAmount.toFixed(2)}`;

  lines.push(justifyLine('Bill Amount:', formattedBillAmount, cols));
  lines.push(justifyLine('Convenience / Fee:', formattedFee, cols));
  lines.push(singleLine);
  lines.push(justifyLine('TOTAL RECEIVED:', formattedTotal, cols));
  lines.push(justifyLine('Status:', (bill.status || 'SUCCESS (PAID)').toUpperCase(), cols));
  lines.push(doubleLine);
  lines.push(centerLine('Thank you! Keep this slip.', cols));
  lines.push('\n\n\n'); // Paper feed

  return lines.join('\n');
}

/**
 * Builds standard HTML representation for system printing / PDF preview.
 */
export function generateUtilityReceiptHtml(
  bill: UtilityReceiptData,
  paperWidth: '58mm' | '80mm' = '58mm'
): string {
  const widthPx = paperWidth === '80mm' ? '300px' : '220px';
  const kioskTitle = (bill.kioskName || 'SEZNIK KIOSK').toUpperCase();
  const billType = bill.billType || 'ELECTRICITY';
  const typeHeader = `${billType.toUpperCase()} BILL RECEIPT`;

  const dateObj = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const dateStr = bill.billDate || dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${bill.receiptNumber || 'Thermal'}</title>
  <style>
    @page { size: auto; margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: ${widthPx};
      margin: 0 auto;
      padding: 10px 6px;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep-double { border-top: 2px dashed #000; margin: 6px 0; }
    .sep-single { border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .title { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
    .subtitle { font-size: 11px; font-weight: bold; }
    .total-row { font-size: 12px; font-weight: bold; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="sep-double"></div>
  <div class="center title">${kioskTitle}</div>
  <div class="center subtitle">${typeHeader}</div>
  <div class="sep-double"></div>

  <div class="row">
    <span>Date: ${dateStr}</span>
    <span>${timeStr}</span>
  </div>

  ${bill.provider ? `<div class="row"><span>Provider:</span> <span class="bold">${bill.provider}</span></div>` : ''}
  ${bill.consumerNumber ? `<div class="row"><span>Consumer No:</span> <span class="bold">${bill.consumerNumber}</span></div>` : ''}
  ${bill.consumerName ? `<div class="row"><span>Consumer:</span> <span>${bill.consumerName}</span></div>` : ''}
  ${bill.dueDate ? `<div class="row"><span>Bill Due Date:</span> <span>${bill.dueDate}</span></div>` : ''}
  ${bill.unitsConsumed ? `<div class="row"><span>Units Consumed:</span> <span>${bill.unitsConsumed}</span></div>` : ''}

  <div class="sep-single"></div>

  <div class="row">
    <span>Bill Amount:</span>
    <span>&#8377;${bill.billAmount.toFixed(2)}</span>
  </div>
  <div class="row">
    <span>Convenience / Fee:</span>
    <span>&#8377;${bill.convenienceFee.toFixed(2)}</span>
  </div>

  <div class="sep-single"></div>

  <div class="row total-row">
    <span>TOTAL RECEIVED:</span>
    <span>&#8377;${bill.totalAmount.toFixed(2)}</span>
  </div>
  <div class="row">
    <span>Status:</span>
    <span class="bold">${bill.status || 'SUCCESS (PAID)'}</span>
  </div>

  <div class="sep-double"></div>
  <div class="center" style="margin-top: 6px;">Thank you! Keep this slip.</div>
</body>
</html>`;
}

/**
 * Builds formatted text payload for 1-tap WhatsApp sharing with customers.
 */
export function formatUtilityWhatsAppMessage(bill: UtilityReceiptData): string {
  const kioskTitle = (bill.kioskName || 'SEZNIK KIOSK').toUpperCase();
  const billType = (bill.billType || 'ELECTRICITY').toUpperCase();

  const dateObj = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const dateStr = bill.billDate || dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const lines = [
    `🧾 *${kioskTitle}*`,
    `⚡ *${billType} BILL PAYMENT RECEIPT*`,
    `──────────────────────────`,
    `📅 *Date:* ${dateStr} ${timeStr}`,
  ];

  if (bill.receiptNumber) {
    lines.push(`🔖 *Receipt No:* ${bill.receiptNumber}`);
  }
  if (bill.provider && bill.provider.trim()) {
    lines.push(`🏢 *Provider:* ${bill.provider.trim()}`);
  }
  if (bill.consumerNumber && bill.consumerNumber.trim()) {
    lines.push(`🔢 *Consumer No:* ${bill.consumerNumber.trim()}`);
  }
  if (bill.consumerName && bill.consumerName.trim()) {
    lines.push(`👤 *Consumer:* ${bill.consumerName.trim()}`);
  }
  if (bill.dueDate && bill.dueDate.trim()) {
    lines.push(`⏳ *Due Date:* ${bill.dueDate.trim()}`);
  }
  if (bill.unitsConsumed && bill.unitsConsumed.trim()) {
    lines.push(`📊 *Units Consumed:* ${bill.unitsConsumed.trim()}`);
  }

  lines.push(`──────────────────────────`);
  lines.push(`💵 *Bill Amount:* ₹${bill.billAmount.toFixed(2)}`);
  lines.push(`🪙 *Convenience Fee:* ₹${bill.convenienceFee.toFixed(2)}`);
  lines.push(`──────────────────────────`);
  lines.push(`💰 *TOTAL PAID:* ₹${bill.totalAmount.toFixed(2)}`);
  lines.push(`✅ *Status:* ${bill.status || 'SUCCESS (PAID)'}`);
  lines.push(`──────────────────────────`);
  lines.push(`🙏 _Thank you for your payment! Please keep this slip for your records._`);

  return lines.join('\n');
}

/**
 * Visual Monospaced Thermal Receipt Component matching reference design.
 */
export const UtilityReceiptSlip: React.FC<{
  bill: UtilityReceiptData;
  scale?: number;
}> = ({ bill, scale = 1 }) => {
  const kioskTitle = (bill.kioskName || 'SEZNIK KIOSK').toUpperCase();
  const billType = bill.billType || 'ELECTRICITY';
  const typeHeader = `${billType.toUpperCase()} BILL RECEIPT`;

  const dateObj = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const dateStr = bill.billDate || dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      <Text style={styles.borderLine}>================================</Text>
      <Text style={[styles.monoText, styles.centerText, styles.boldText, styles.headerTitle]}>
        {kioskTitle}
      </Text>
      <Text style={[styles.monoText, styles.centerText, styles.boldText]}>
        {typeHeader}
      </Text>
      <Text style={styles.borderLine}>================================</Text>

      <View style={styles.row}>
        <Text style={styles.monoText}>Date: {dateStr}</Text>
        <Text style={styles.monoText}>{timeStr}</Text>
      </View>

      {Boolean(bill.provider) && (
        <View style={styles.row}>
          <Text style={styles.monoText}>Provider:</Text>
          <Text style={[styles.monoText, styles.boldText]} numberOfLines={1}>
            {bill.provider}
          </Text>
        </View>
      )}

      {Boolean(bill.consumerNumber) && (
        <View style={styles.row}>
          <Text style={styles.monoText}>Consumer No:</Text>
          <Text style={[styles.monoText, styles.boldText]}>{bill.consumerNumber}</Text>
        </View>
      )}

      {Boolean(bill.consumerName) && (
        <View style={styles.row}>
          <Text style={styles.monoText}>Consumer:</Text>
          <Text style={styles.monoText} numberOfLines={1}>{bill.consumerName}</Text>
        </View>
      )}

      {Boolean(bill.dueDate) && (
        <View style={styles.row}>
          <Text style={styles.monoText}>Bill Due Date:</Text>
          <Text style={styles.monoText}>{bill.dueDate}</Text>
        </View>
      )}

      {Boolean(bill.unitsConsumed) && (
        <View style={styles.row}>
          <Text style={styles.monoText}>Units Consumed:</Text>
          <Text style={styles.monoText}>{bill.unitsConsumed}</Text>
        </View>
      )}

      <Text style={styles.dashedLine}>--------------------------------</Text>

      <View style={styles.row}>
        <Text style={styles.monoText}>Bill Amount:</Text>
        <Text style={styles.monoText}>₹{bill.billAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.monoText}>Convenience / Fee:</Text>
        <Text style={styles.monoText}>₹{bill.convenienceFee.toFixed(2)}</Text>
      </View>

      <Text style={styles.dashedLine}>--------------------------------</Text>

      <View style={styles.row}>
        <Text style={[styles.monoText, styles.boldText, styles.totalLabel]}>
          TOTAL RECEIVED:
        </Text>
        <Text style={[styles.monoText, styles.boldText, styles.totalAmount]}>
          ₹{bill.totalAmount.toFixed(2)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.monoText}>Status:</Text>
        <Text style={[styles.monoText, styles.boldText]}>
          {(bill.status || 'SUCCESS (PAID)').toUpperCase()}
        </Text>
      </View>

      <Text style={styles.borderLine}>================================</Text>

      <Text style={[styles.monoText, styles.centerText, styles.footerText]}>
        Thank you! Keep this slip.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    width: 290,
    alignSelf: 'center',
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  boldText: {
    fontWeight: '700',
  },
  centerText: {
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  borderLine: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
    marginVertical: 4,
    fontWeight: '700',
  },
  dashedLine: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
  },
  totalAmount: {
    fontSize: 13,
  },
  footerText: {
    marginTop: 4,
    fontSize: 11,
    fontStyle: 'italic',
  },
});
