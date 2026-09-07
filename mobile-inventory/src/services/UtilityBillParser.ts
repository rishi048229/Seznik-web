/**
 * UtilityBillParser.ts
 * 
 * High-speed deterministic regex and heuristic parsing engine for extracting billing fields
 * from raw OCR text of A4 utility bills (Electricity, Water, Gas, Telecom, Invoices)
 * completely on-device without cloud dependencies.
 */

export interface ParsedUtilityBill {
  providerName: string;
  consumerNo: string;
  consumerName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  billingPeriod?: string;
  unitsConsumed: string;
  billAmount: number;
  amountAfterDueDate?: number;
  convenienceFee: number;
  totalCollected: number;
  subDivision?: string;
  customerPhone?: string;
  rawText: string;
}

const COMMON_DISCOMS = [
  { pattern: /UPPCL|PVVNL|MVVNL|DVVNL|PuVVNL|Madhyanchal|Dakshinanchal|Pashchimanchal/i, name: 'UPPCL (Uttar Pradesh Power)' },
  { pattern: /BSES\s*Rajdhani|BRPL/i, name: 'BSES Rajdhani Power Ltd' },
  { pattern: /BSES\s*Yamuna|BYPL/i, name: 'BSES Yamuna Power Ltd' },
  { pattern: /Tata\s*Power|TPDDL|TPCODL|TPNODL/i, name: 'Tata Power' },
  { pattern: /MSEDCL|Mahavitaran|MSEB/i, name: 'MSEDCL (Mahavitaran)' },
  { pattern: /WBSEDCL/i, name: 'WBSEDCL (West Bengal Power)' },
  { pattern: /PSPCL/i, name: 'PSPCL (Punjab Power)' },
  { pattern: /DHBVN/i, name: 'DHBVN (Dakshin Haryana)' },
  { pattern: /UHBVN/i, name: 'UHBVN (Uttar Haryana)' },
  { pattern: /BESCOM/i, name: 'BESCOM (Bangalore Electricity)' },
  { pattern: /TANGEDCO/i, name: 'TANGEDCO (Tamil Nadu)' },
  { pattern: /Torrent\s*Power/i, name: 'Torrent Power' },
  { pattern: /Adani\s*Electricity|AEML/i, name: 'Adani Electricity' },
  { pattern: /APDCL/i, name: 'APDCL (Assam Power)' },
  { pattern: /NBPDCL|SBPDCL|Bihar\s*State\s*Power/i, name: 'Bihar State Power (BSPHCL)' },
  { pattern: /JBVNL/i, name: 'JBVNL (Jharkhand Bijli)' },
  { pattern: /CSPDCL/i, name: 'CSPDCL (Chhattisgarh Power)' },
  { pattern: /CESC/i, name: 'CESC Limited' },
  { pattern: /IGL|Indraprastha\s*Gas/i, name: 'Indraprastha Gas (IGL)' },
  { pattern: /Mahanagar\s*Gas|MGL/i, name: 'Mahanagar Gas (MGL)' },
  { pattern: /Adani\s*Total\s*Gas|Adani\s*Gas/i, name: 'Adani Total Gas' },
  { pattern: /Delhi\s*Jal\s*Board|DJB/i, name: 'Delhi Jal Board' },
];

export function parseUtilityBillText(fullText: string): ParsedUtilityBill {
  const clean = fullText.replace(/\r/g, '\n');
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. Detect Provider / Discom Name
  let providerName = 'Electricity Utility Bill';
  for (const discom of COMMON_DISCOMS) {
    if (discom.pattern.test(clean)) {
      providerName = discom.name;
      break;
    }
  }
  if (providerName === 'Electricity Utility Bill' && lines.length > 0) {
    const header = lines.slice(0, 5).join(' ');
    if (/water|jal|sewerage/i.test(header)) providerName = 'Water Utility Bill';
    else if (/gas|indraprastha|adani\s*gas/i.test(header)) providerName = 'Gas Utility Bill';
    else if (/broadband|telecom|airtel|jio|bsnl|vi/i.test(header)) providerName = 'Telecom / Broadband Bill';
  }

  // 2. Extract Consumer / Account / CA / K Number
  let consumerNo = '';
  const caPatterns = [
    /(?:CA\s*(?:NO|NUMBER|#)?|CONS(?:UMER)?\s*(?:NO|ID|NUMBER|#)?|ACCT?\s*(?:NO|ID|NUMBER)?|ACCOUNT\s*(?:NO|ID|NUMBER)?|K\s*(?:NO|NUMBER)?|SERVICE\s*(?:NO|CONNECTION)?|उपभोक्ता\s*(?:संख्या|सं|क्रमांक))[.:\s-]+([0-9A-Z]{6,16})/i,
    /(?:CONSUMER|ACCOUNT|CA|K\.?NO)[^\n0-9]{1,25}([0-9]{8,14})/i,
    /\b([0-9]{10,12})\b/, // Standalone 10-12 digit CA number
  ];
  for (const pat of caPatterns) {
    const m = clean.match(pat);
    if (m && m[1]) {
      consumerNo = m[1].replace(/[^0-9A-Za-z]/g, '');
      break;
    }
  }

  // 3. Extract Consumer Name
  let consumerName = '';
  const namePatterns = [
    /(?:NAME|CONSUMER NAME|CUSTOMER NAME|NAME OF CONSUMER|उपभोक्ता का नाम|ग्राहक का नाम)[.:\s]+([A-Z\s.]{3,35})/i,
    /(?:SHRI|SMT|MR\.?|MRS\.?|M\/S)\s+([A-Z\s.]{4,30})/i,
  ];
  for (const pat of namePatterns) {
    const m = clean.match(pat);
    if (m && m[1] && !/ELECTRICITY|POWER|LIMITED|LTD|CORPORATION|BOARD|DISCOM|BILL/i.test(m[1])) {
      consumerName = m[1].trim();
      break;
    }
  }

  // 4. Extract Due Date, Bill Date & Billing Period
  let dueDate = '';
  let billDate = '';
  let billingPeriod = '';

  // Extract Due Date (Pay by date / Last date)
  const dueDateMatch = clean.match(/(?:DUE\s*DATE|PAY\s*BY|DUE\s*ON|LAST\s*DATE|PAYMENT\s*DUE\s*DATE|देय तिथि|नियत तिथि|भुगतान तिथि)[.:\s]+([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3}[-\s][0-9]{2,4})/i);
  if (dueDateMatch && dueDateMatch[1]) {
    dueDate = dueDateMatch[1].trim();
  }

  // Extract Bill Date (Issue date)
  const billDateMatch = clean.match(/(?:BILL\s*DATE|INVOICE\s*DATE|BILLING\s*DATE|BILL\s*ISSUE\s*DATE|ISSUE\s*DATE|बिल तिथि|बिल दिनांक|दिनांक)[.:\s]+([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3}[-\s][0-9]{2,4})/i);
  if (billDateMatch && billDateMatch[1]) {
    billDate = billDateMatch[1].trim();
  }

  // Lookahead search across lines if date labels are in table headers
  if (!billDate || !dueDate) {
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      if (!billDate && /(?:BILL\s*DATE|ISSUE\s*DATE|BILLING\s*DATE)/i.test(line)) {
        const m = nextLine.match(/([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3}[-\s][0-9]{2,4})/);
        if (m) billDate = m[1].trim();
      }
      if (!dueDate && /(?:DUE\s*DATE|PAY\s*BY|LAST\s*DATE)/i.test(line)) {
        const m = nextLine.match(/([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3}[-\s][0-9]{2,4})/);
        if (m) dueDate = m[1].trim();
      }
    }
  }

  // Fallback: If still no bill date, search any standalone DD/MM/YYYY
  if (!billDate) {
    const anyDate = clean.match(/\b([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{4})\b/);
    if (anyDate && anyDate[1]) {
      billDate = anyDate[1];
    }
  }

  // Extract Billing Period / Month (e.g. AUG-2026 or 01/07/2026 TO 31/07/2026)
  const periodMatch = clean.match(/(?:BILL\s*MONTH|BILLING\s*MONTH|BILL\s*PERIOD|BILLING\s*PERIOD|बिल माह)[.:\s]+([A-Za-z]{3,9}[-\s]*[0-9]{2,4}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}\s*(?:TO|-)\s*[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i);
  if (periodMatch && periodMatch[1]) {
    billingPeriod = periodMatch[1].trim();
  }

  // 5. Extract Units Consumed
  let unitsConsumed = '';
  const unitsMatch = clean.match(/(?:UNITS\s*CONSUMED|TOTAL\s*UNITS|BILLED\s*UNITS|CONSUMPTION|KWH)[.:\s]+([0-9]+(?:\.[0-9]+)?)/i);
  if (unitsMatch && unitsMatch[1]) {
    unitsConsumed = `${unitsMatch[1]} kWh`;
  }

  // 6. Extract Bill Number
  let billNumber = '';
  const billNoMatch = clean.match(/(?:BILL\s*(?:NO|NUMBER|#)?|INVOICE\s*(?:NO|NUMBER|#)?|RECEIPT\s*NO)[.:\s]+([0-9A-Z/-]{6,20})/i);
  if (billNoMatch && billNoMatch[1]) {
    billNumber = billNoMatch[1].trim();
  } else if (consumerNo) {
    billNumber = consumerNo;
  } else {
    billNumber = `UB-${Date.now().toString().slice(-6)}`;
  }

  // 7. Extract Exact Net Amount Payable (Before Due Date)
  let billAmount = 0;
  let amountAfterDueDate: number | undefined = undefined;

  // High-priority targeted net payable regexes (specifically tailored for Indian utility bills)
  const netAmountPatterns = [
    // "Net Amount Payable by Due Date" / "Net Payable"
    /(?:NET\s*AMOUNT\s*PAYABLE\s*(?:BY|UPTO|BEFORE)?\s*(?:DUE\s*DATE)?|NET\s*PAYABLE\s*AMOUNT|NET\s*PAYABLE|AMOUNT\s*PAYABLE\s*(?:BY|UPTO|BEFORE)\s*DUE\s*DATE)[^0-9₹Rs.]*(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    // Hindi: देय राशि / नियत तिथि तक देय राशि
    /(?:नियत\s*तिथि\s*तक\s*देय\s*राशि|देय\s*राशि|कुल\s*देय\s*राशि)[^0-9₹Rs.]*(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    // "Total Current Demand" / "Net Bill Amount" / "Total Amount Payable"
    /(?:TOTAL\s*CURRENT\s*DEMAND|CURRENT\s*DEMAND|NET\s*BILL\s*AMOUNT|TOTAL\s*AMOUNT\s*PAYABLE|TOTAL\s*PAYABLE|TOTAL\s*DUE|ROUND\s*OFF\s*AMOUNT)[^0-9₹Rs.]*(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    // Standard "Amount Payable"
    /(?:AMOUNT\s*PAYABLE|TOTAL\s*BILL\s*AMOUNT)[^0-9₹Rs.]*(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
  ];

  for (const pat of netAmountPatterns) {
    const m = clean.match(pat);
    if (m && m[1]) {
      const parsed = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0 && parsed < 500000) {
        billAmount = parsed;
        break;
      }
    }
  }

  // Multi-line search: check if line has "NET PAYABLE" and the NEXT line contains the amount
  if (billAmount === 0) {
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (/(?:NET\s*AMOUNT\s*PAYABLE|NET\s*PAYABLE|TOTAL\s*PAYABLE|CURRENT\s*DEMAND|देय राशि)/i.test(line)) {
        const nextLine = lines[i + 1];
        const numMatch = nextLine.match(/(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/);
        if (numMatch && numMatch[1]) {
          const parsed = parseFloat(numMatch[1].replace(/,/g, ''));
          if (!isNaN(parsed) && parsed > 0 && parsed < 500000) {
            billAmount = parsed;
            break;
          }
        }
      }
    }
  }

  // Amount after due date extraction
  const afterDueMatch = clean.match(/(?:AMOUNT\s*AFTER\s*DUE\s*DATE|PAYABLE\s*AFTER\s*DUE\s*DATE|देय तिथि के पश्चात)[^0-9₹Rs.]*(?:₹|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (afterDueMatch && afterDueMatch[1]) {
    const parsed = parseFloat(afterDueMatch[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      amountAfterDueDate = parsed;
    }
  }

  // Default convenience fee is 0 so the net bill amount matches the real bill 100%
  const convenienceFee = 0;
  const totalCollected = billAmount > 0 ? billAmount + convenienceFee : 0;

  return {
    providerName,
    consumerNo,
    consumerName,
    billNumber,
    billDate,
    dueDate,
    billingPeriod,
    unitsConsumed,
    billAmount,
    amountAfterDueDate,
    convenienceFee,
    totalCollected,
    rawText: fullText,
  };
}

import type { PrintSaleData } from '@/services/PrinterService';

/**
 * Maps parsed bill data into a standard thermal receipt payload (PrintSaleData)
 * ready for printing via PrinterService on both 58mm (2") and 80mm (3") printers.
 */
export function buildUtilityReceiptPrintData(
  bill: ParsedUtilityBill,
  storeName: string = 'SEZNIK KIOSK'
): PrintSaleData {
  const items = [
    {
      productName: `${bill.providerName.slice(0, 24)} Payment`,
      quantity: 1,
      unitPrice: bill.billAmount,
      total: bill.billAmount,
    },
  ];

  if (bill.convenienceFee > 0) {
    items.push({
      productName: 'Kiosk Fee',
      quantity: 1,
      unitPrice: bill.convenienceFee,
      total: bill.convenienceFee,
    });
  }

  return {
    invoiceNumber: bill.billNumber || bill.consumerNo || `BILL-${Date.now().toString().slice(-6)}`,
    date: bill.billDate || new Date().toLocaleDateString('en-GB'),
    items,
    subtotal: bill.billAmount,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: bill.totalCollected,
    paymentMethod: 'CASH',
    storeName,
    footerMessage: 'Thank you! Keep this slip for your records.',
    customerName: bill.consumerName || undefined,
    customerPhone: bill.customerPhone || undefined,
    consumerNo: bill.consumerNo || undefined,
    dueDate: bill.dueDate || undefined,
    billingPeriod: bill.billingPeriod || undefined,
    providerName: bill.providerName || undefined,
    unitsConsumed: bill.unitsConsumed || undefined,
    amountAfterDueDate: bill.amountAfterDueDate || undefined,
  };
}
