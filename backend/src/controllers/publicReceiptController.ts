import { Request, Response } from 'express';
import prisma from '../config/db';

interface SaleItemLike {
  id?: string;
  name?: string;
  productName?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  sellingPrice?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  total?: number;
  unit?: string;
  sku?: string;
  hsnCode?: string;
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(amount: number): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractParamId(param: unknown): string {
  if (Array.isArray(param)) return param[0] ? String(param[0]).trim() : '';
  return typeof param === 'string' ? param.trim() : '';
}

export const getPublicReceiptData = async (req: Request, res: Response) => {
  try {
    const rawId = extractParamId(req.params.id);
    if (!rawId) {
      return res.status(400).json({ error: 'Invoice number or sale ID is required' });
    }

    const cleanId = decodeURIComponent(rawId);

    const sale = await prisma.sale.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { invoiceNumber: cleanId },
          { invoiceNumber: { equals: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        customer: true,
        user: {
          select: {
            businessName: true,
            displayName: true,
            email: true,
            phone: true,
            settings: true,
          },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const settings = sale.user?.settings as any;
    const receiptConfig = (settings?.receiptConfig || {}) as Record<string, any>;
    const invoiceConfig = (settings?.invoiceConfig || {}) as Record<string, any>;

    const storeInfo = {
      storeName: receiptConfig.companyName || settings?.businessName || sale.user?.businessName || sale.user?.displayName || 'Store',
      storeAddress: receiptConfig.address || settings?.businessAddress || '',
      storePhone: receiptConfig.phone || settings?.businessPhone || sale.user?.phone || '',
      storeGstin: receiptConfig.gstin || settings?.businessGSTIN || '',
      storeLogoUrl: receiptConfig.logoURL || settings?.businessLogoURL || '',
      upiId: receiptConfig.upiId || settings?.upiId || '',
      footerMessage: receiptConfig.footerMessage || 'Thank you for your purchase!',
      terms: [receiptConfig.termsLine1, receiptConfig.termsLine2, receiptConfig.termsLine3]
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0),
      invoiceTerms: invoiceConfig.footerText || '',
    };

    res.json({
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        createdAt: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        subtotal: sale.subtotal,
        totalDiscount: sale.totalDiscount,
        totalTax: sale.totalTax,
        grandTotal: sale.grandTotal,
        amountPaid: sale.amountPaid,
        changeReturned: sale.changeReturned,
        billCharges: sale.billCharges,
        extraChargesTotal: sale.extraChargesTotal,
        items: Array.isArray(sale.items) ? sale.items : [],
      },
      customer: sale.customer
        ? {
            name: sale.customer.name,
            phone: sale.customer.phone,
            email: sale.customer.email,
            address: sale.customer.address,
          }
        : null,
      store: storeInfo,
    });
  } catch (error) {
    console.error('Error fetching public receipt data:', error);
    res.status(500).json({ error: 'Failed to retrieve invoice' });
  }
};

export const renderPublicReceiptHtml = async (req: Request, res: Response) => {
  try {
    const rawId = extractParamId(req.params.id);
    if (!rawId) {
      return res.status(400).send('<h3>Invalid invoice identifier</h3>');
    }

    const cleanId = decodeURIComponent(rawId);

    const sale = await prisma.sale.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { invoiceNumber: cleanId },
          { invoiceNumber: { equals: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        customer: true,
        user: {
          select: {
            businessName: true,
            displayName: true,
            email: true,
            phone: true,
            settings: true,
          },
        },
      },
    });

    if (!sale) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Invoice Not Found - Seznik</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; padding: 20px; }
            .card { background: white; padding: 36px 28px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 420px; border: 1px solid #e2e8f0; }
            h1 { font-size: 20px; margin: 12px 0 6px; color: #0f172a; }
            p { font-size: 14px; color: #64748b; margin-bottom: 20px; }
            .badge { display: inline-block; padding: 4px 12px; background: #fee2e2; color: #991b1b; border-radius: 9999px; font-size: 12px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">404</span>
            <h1>Invoice Not Found</h1>
            <p>The requested invoice (${escapeHtml(cleanId)}) could not be located or has been archived.</p>
          </div>
        </body>
        </html>
      `);
    }

    const settings = sale.user?.settings as any;
    const receiptConfig = (settings?.receiptConfig || {}) as Record<string, any>;
    const invoiceConfig = (settings?.invoiceConfig || {}) as Record<string, any>;

    const storeName = escapeHtml(receiptConfig.companyName || settings?.businessName || sale.user?.businessName || sale.user?.displayName || 'Store');
    const storeAddress = escapeHtml(receiptConfig.address || settings?.businessAddress || '');
    const storePhone = escapeHtml(receiptConfig.phone || settings?.businessPhone || sale.user?.phone || '');
    const storeGstin = escapeHtml(receiptConfig.gstin || settings?.businessGSTIN || '');
    const storeLogoUrl = receiptConfig.logoURL || settings?.businessLogoURL || '';
    const footerMessage = escapeHtml(receiptConfig.footerMessage || 'Thank you for your business!');
    const terms = [receiptConfig.termsLine1, receiptConfig.termsLine2, receiptConfig.termsLine3]
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map(escapeHtml);

    const items = (Array.isArray(sale.items) ? sale.items : []) as SaleItemLike[];
    const dateFormatted = new Date(sale.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = new Date(sale.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isPaid = (sale.amountPaid || 0) >= (sale.grandTotal || 0);

    const rowsHtml = items.map((item, idx) => {
      const name = escapeHtml(item.productName || item.name || 'Item');
      const qty = item.quantity ?? item.qty ?? 1;
      const price = item.sellingPrice ?? item.price ?? 0;
      const taxRate = item.taxRate || 0;
      const discount = item.discount || 0;
      const total = item.total ?? (price * qty - discount);

      return `
        <tr>
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${name}</div>
            ${item.sku ? `<div style="font-size: 11px; color: #94a3b8;">SKU: ${escapeHtml(item.sku)}</div>` : ''}
          </td>
          <td style="text-align: right; color: #334155;">${formatMoney(price)}</td>
          <td style="text-align: center; color: #0f172a; font-weight: 600;">${qty}</td>
          ${discount > 0 ? `<td style="text-align: right; color: #dc2626;">-${formatMoney(discount)}</td>` : '<td style="text-align: right; color: #94a3b8;">-</td>'}
          <td style="text-align: center; color: #64748b;">${taxRate > 0 ? `${taxRate}%` : '0%'}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatMoney(total)}</td>
        </tr>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tax Invoice - ${escapeHtml(sale.invoiceNumber)} - ${storeName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .top-actions {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 900px;
      margin: 0 auto;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
      border-color: #cbd5e1;
    }
    .btn-secondary:hover { background: #f8fafc; }
    .page-container {
      max-width: 860px;
      margin: 24px auto 48px;
      padding: 0 16px;
    }
    .invoice-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      padding: 40px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 24px;
      margin-bottom: 24px;
      gap: 20px;
    }
    .store-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .store-logo {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      padding: 4px;
    }
    .store-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px;
      letter-spacing: -0.5px;
    }
    .store-meta {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .invoice-badge-box {
      text-align: right;
    }
    .invoice-type {
      font-size: 20px;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .invoice-meta-item {
      font-size: 12px;
      color: #475569;
      margin-bottom: 3px;
    }
    .invoice-meta-item strong {
      color: #0f172a;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #dcfce7;
      color: #15803d;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      margin-top: 6px;
      text-transform: uppercase;
    }
    .bill-to-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .bill-to-col h4 {
      margin: 0 0 4px;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .bill-to-col .cust-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .bill-to-col .cust-meta {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead th {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-bottom: 2px solid #cbd5e1;
      padding: 12px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
    }
    tbody td {
      padding: 12px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 32px;
      margin-top: 16px;
    }
    .summary-left {
      flex: 1;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .summary-right {
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 13px;
      color: #475569;
    }
    .summary-row.total-row {
      border-top: 2px dashed #cbd5e1;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .terms-box {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .terms-box h5 {
      margin: 0 0 6px;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
      font-weight: 700;
    }
    .footer-note {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #94a3b8;
    }

    @media print {
      body { background: #ffffff; }
      .top-actions { display: none !important; }
      .page-container { margin: 0; padding: 0; max-width: 100%; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
      @page {
        size: A4;
        margin: 12mm;
      }
    }
    @media (max-width: 640px) {
      .invoice-card { padding: 20px 16px; }
      .header-row { flex-direction: column; align-items: flex-start; }
      .invoice-badge-box { text-align: left; }
      .summary-grid { flex-direction: column; }
      .summary-right { width: 100%; }
    }
  </style>
</head>
<body>

  <div class="top-actions">
    <div style="font-size: 13px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <span>Digital Tax Invoice</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="shareInvoice()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        Share
      </button>
      <button class="btn btn-primary" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / PDF
      </button>
    </div>
  </div>

  <div class="page-container">
    <div class="invoice-card">
      <!-- Store & Invoice Header -->
      <div class="header-row">
        <div class="store-brand">
          ${storeLogoUrl ? `<img src="${escapeHtml(storeLogoUrl)}" alt="Logo" class="store-logo" />` : ''}
          <div>
            <h1 class="store-title">${storeName}</h1>
            <div class="store-meta">
              ${storeAddress ? `<div>${storeAddress}</div>` : ''}
              ${storePhone ? `<div>Phone: ${storePhone}</div>` : ''}
              ${storeGstin ? `<div><strong>GSTIN:</strong> ${storeGstin}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="invoice-badge-box">
          <div class="invoice-type">Tax Invoice</div>
          <div class="invoice-meta-item">Invoice No: <strong>#${escapeHtml(sale.invoiceNumber)}</strong></div>
          <div class="invoice-meta-item">Date: <strong>${dateFormatted}</strong></div>
          <div class="invoice-meta-item">Time: <strong>${timeFormatted}</strong></div>
          <div class="invoice-meta-item">Payment: <strong>${escapeHtml(sale.paymentMethod.toUpperCase())}</strong></div>
          <div><span class="status-badge">${isPaid ? 'PAID' : 'PAYMENT PENDING'}</span></div>
        </div>
      </div>

      <!-- Bill To / Customer -->
      ${sale.customer ? `
        <div class="bill-to-section">
          <div class="bill-to-col">
            <h4>Billed To (Customer)</h4>
            <div class="cust-name">${escapeHtml(sale.customer.name)}</div>
            ${sale.customer.phone ? `<div class="cust-meta">📞 ${escapeHtml(sale.customer.phone)}</div>` : ''}
            ${sale.customer.email ? `<div class="cust-meta">✉️ ${escapeHtml(sale.customer.email)}</div>` : ''}
          </div>
          ${sale.customer.address ? `
            <div class="bill-to-col">
              <h4>Customer Address</h4>
              <div class="cust-meta">${escapeHtml(sale.customer.address)}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Items Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="text-align: left;">Item Description</th>
            <th style="text-align: right; width: 100px;">Rate</th>
            <th style="text-align: center; width: 70px;">Qty</th>
            <th style="text-align: right; width: 80px;">Disc</th>
            <th style="text-align: center; width: 70px;">Tax</th>
            <th style="text-align: right; width: 110px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Summary & Totals -->
      <div class="summary-grid">
        <div class="summary-left">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Thank you for shopping with us!</div>
          <div>${footerMessage}</div>
          ${sale.amountPaid !== undefined ? `
            <div style="margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block;">
              <div>Amount Paid: <strong>${formatMoney(sale.amountPaid)}</strong> via ${escapeHtml(sale.paymentMethod.toUpperCase())}</div>
              ${sale.changeReturned > 0 ? `<div>Change Returned: <strong>${formatMoney(sale.changeReturned)}</strong></div>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="summary-right">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatMoney(sale.subtotal)}</span>
          </div>
          ${sale.totalDiscount > 0 ? `
            <div class="summary-row" style="color: #dc2626;">
              <span>Total Discount</span>
              <span>-${formatMoney(sale.totalDiscount)}</span>
            </div>
          ` : ''}
          ${sale.totalTax > 0 ? `
            <div class="summary-row">
              <span>GST / Tax Total</span>
              <span>+${formatMoney(sale.totalTax)}</span>
            </div>
          ` : ''}
          ${sale.extraChargesTotal > 0 ? `
            <div class="summary-row">
              <span>Add-on / Service Charges</span>
              <span>+${formatMoney(sale.extraChargesTotal)}</span>
            </div>
          ` : ''}
          <div class="summary-row total-row">
            <span>Grand Total</span>
            <span style="color: #2563eb;">${formatMoney(sale.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- Terms & Conditions -->
      ${terms.length > 0 ? `
        <div class="terms-box">
          <h5>Terms & Conditions</h5>
          <ol style="margin: 0; padding-left: 18px;">
            ${terms.map(t => `<li>${t}</li>`).join('')}
          </ol>
        </div>
      ` : ''}

      <div class="footer-note">
        This is a computer-generated tax invoice verified by Seznik POS.
      </div>
    </div>
  </div>

  <script>
    function shareInvoice() {
      if (navigator.share) {
        navigator.share({
          title: 'Tax Invoice #${escapeHtml(sale.invoiceNumber)}',
          text: 'View Tax Invoice from ${storeName}',
          url: window.location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          alert('Invoice link copied to clipboard!');
        });
      }
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error rendering public receipt HTML:', error);
    res.status(500).send('<h3>Failed to render invoice</h3>');
  }
};
