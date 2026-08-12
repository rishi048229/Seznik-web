import type { InvoiceTrafficLog, TelemetryEvent, TrafficTimeFrame } from '../types/appTraffic';

// Seed realistic mock invoice logs for mobile and web
export const fetchInvoiceTrafficLogs = (): InvoiceTrafficLog[] => {
  const now = Date.now();
  const users = [
    { name: 'Aaditya Basisth', email: 'aaditya@seznik.com' },
    { name: 'Priya Sharma', email: 'priya@seznik.com' },
    { name: 'Rahul Verma', email: 'rahul@seznik.com' },
    { name: 'Neha Gupta', email: 'neha@seznik.com' },
    { name: 'Vikram Singh', email: 'vikram@seznik.com' },
  ];

  const logs: InvoiceTrafficLog[] = [];

  for (let i = 1; i <= 60; i++) {
    const isMobile = i % 2 === 0 || i % 5 === 0;
    const hoursAgo = Math.floor((i * 14) / 3);
    const user = users[i % users.length];
    const amount = Math.floor(250 + Math.random() * 4500);

    logs.push({
      id: `inv_log_${i}`,
      invoiceNumber: `INV-2026-${1000 + i}`,
      platform: isMobile ? 'mobile' : 'web',
      deviceInfo: isMobile ? 'Seznik Mobile App (iOS / Android)' : 'Web App (Chrome Desktop)',
      userName: user.name,
      userEmail: user.email,
      amount,
      itemsCount: Math.floor(1 + Math.random() * 6),
      timestamp: new Date(now - hoursAgo * 3600 * 1000).toISOString(),
      status: i % 7 === 0 ? 'synced' : 'completed',
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Seed realistic telemetry events stream
export const fetchTelemetryEvents = (): TelemetryEvent[] => {
  const now = Date.now();

  const events: TelemetryEvent[] = [
    {
      id: 'evt-1',
      eventName: 'Mobile App Invoice Created',
      platform: 'mobile',
      category: 'invoice',
      details: 'Created quick bill invoice #INV-2026-1060 (₹1,450) via Android Bluetooth POS',
      timestamp: new Date(now - 8 * 60 * 1000).toISOString(),
      severity: 'success',
    },
    {
      id: 'evt-2',
      eventName: 'Web Dashboard Checkout',
      platform: 'web',
      category: 'invoice',
      details: 'Completed multi-item billing sale #INV-2026-1059 (₹3,890) on Chrome Desktop',
      timestamp: new Date(now - 22 * 60 * 1000).toISOString(),
      severity: 'success',
    },
    {
      id: 'evt-3',
      eventName: 'Offline Mobile Sync Event',
      platform: 'mobile',
      category: 'sync',
      details: 'Batch synced 14 offline mobile invoices to database seamlessly',
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
      severity: 'info',
    },
    {
      id: 'evt-4',
      eventName: 'Web Thermal Print Request',
      platform: 'web',
      category: 'invoice',
      details: 'Sent 3-inch ESC/POS thermal receipt command to USB printer driver',
      timestamp: new Date(now - 1.2 * 3600 * 1000).toISOString(),
      severity: 'info',
    },
    {
      id: 'evt-5',
      eventName: 'Mobile App Session Start',
      platform: 'mobile',
      category: 'session',
      details: 'User authenticated on iOS Mobile App v2.4 (Biometric FaceID Auth)',
      timestamp: new Date(now - 2.5 * 3600 * 1000).toISOString(),
      severity: 'info',
    },
    {
      id: 'evt-6',
      eventName: 'Web Application Login',
      platform: 'web',
      category: 'session',
      details: 'Authenticated admin web session from IP 103.22.140.12 (Mumbai, IN)',
      timestamp: new Date(now - 3.8 * 3600 * 1000).toISOString(),
      severity: 'info',
    },
    {
      id: 'evt-7',
      eventName: 'Mobile Payment Gateway Callback',
      platform: 'mobile',
      category: 'invoice',
      details: 'UPI QR Payment confirmed for mobile bill #INV-2026-1055 (₹890)',
      timestamp: new Date(now - 5 * 3600 * 1000).toISOString(),
      severity: 'success',
    },
    {
      id: 'evt-8',
      eventName: 'Web Bulk Report Export',
      platform: 'web',
      category: 'invoice',
      details: 'Exported daily sales ledger CSV for 145 invoices',
      timestamp: new Date(now - 8 * 3600 * 1000).toISOString(),
      severity: 'info',
    },
  ];

  return events;
};
