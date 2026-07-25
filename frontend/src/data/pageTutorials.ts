export interface TourStep {
  title: string
  description: string
  targetSelector?: string
}

export interface PageTutorialData {
  pageKey: string
  title: string
  subtitle: string
  videoUrl: string // Path to video asset e.g. /assets/videos/guide-dashboard.mp4
  videoPoster?: string
  summary: string
  keyFeatures: {
    title: string
    description: string
    iconName?: string
  }[]
  proTips: string[]
  tourSteps: TourStep[]
}

export const PAGE_TUTORIALS: Record<string, PageTutorialData> = {
  dashboard: {
    pageKey: 'dashboard',
    title: 'Dashboard Overview & Analytics',
    subtitle: 'Learn how to monitor real-time sales, inventory alerts, and financial performance',
    videoUrl: '/assets/videos/guide-dashboard.mp4',
    summary: 'The Dashboard is your main business control center. It gives you instant visibility into daily sales metrics, top selling items, payment breakdowns, low stock alerts, and quick POS shortcuts.',
    keyFeatures: [
      { title: 'Real-Time KPI Cards', description: 'Monitor Total Revenue, Total Orders, Average Order Value, and Low Stock Alerts at a glance.' },
      { title: 'Revenue & Trend Charts', description: 'Analyze your sales growth over time with interactive daily/weekly/monthly revenue charts.' },
      { title: 'Receipt Printer Status', description: 'Check and connect your Web Bluetooth thermal printer directly from the top status card.' },
      { title: 'Payment Modes & Top Items', description: 'View breakdown of cash, card, UPI, and credit sales alongside your top-performing products.' },
    ],
    proTips: [
      'Click on any Low Stock card to jump directly to Products filtered for low inventory.',
      'Use the top POS button to quickly jump into high-speed retail checkout.',
    ],
    tourSteps: [
      { title: 'Welcome to Dashboard', description: 'This is your central command hub showing live sales, stock alerts, and key metrics.', targetSelector: '[data-tour="dashboard-header"]' },
      { title: 'KPI Metrics Cards', description: 'Check daily revenue, order counts, average sales, and low stock warnings right here.', targetSelector: '[data-tour="kpi-cards"]' },
      { title: 'Printer Connection Status', description: 'Connect or disconnect your Bluetooth thermal receipt printer with one click.', targetSelector: '[data-tour="printer-card"]' },
      { title: 'Sales & Payment Trends', description: 'Review payment method distributions and revenue charts to make data-driven decisions.', targetSelector: '[data-tour="charts-section"]' },
    ],
  },
  pos: {
    pageKey: 'pos',
    title: 'Retail POS Terminal (Standard)',
    subtitle: 'Learn how to process high-speed retail checkout, scan barcodes, and issue instant receipts',
    videoUrl: '/assets/videos/guide-pos.mp4',
    summary: 'The Retail POS Terminal is optimized for desktop and tablet counter billing. It features instant barcode scanning, product search, cart discounts, customer credit billing, and instant thermal printing.',
    keyFeatures: [
      { title: 'Barcode Scanner Integration', description: 'Plug in any USB/Bluetooth barcode scanner or use camera scan to add items directly to cart.' },
      { title: 'Customer Credit & Ledger', description: 'Link existing customers to bill orders on Store Credit or record partial payments.' },
      { title: 'Instant Bill & Thermal Print', description: 'Complete sales with Cash, Card, UPI, or Credit and print thermal or A4 receipts instantly.' },
      { title: 'Item & Order Discounts', description: 'Apply percentage or flat discounts per item or across the entire cart total.' },
    ],
    proTips: [
      'Press Enter after typing a barcode or SKU to add items instantly without touching the mouse.',
      'Select a customer before completing a credit sale so their account ledger updates automatically.',
    ],
    tourSteps: [
      { title: 'Product Search & Scanner', description: 'Search items by name, SKU, or scan barcodes to add items instantly to cart.', targetSelector: '[data-tour="pos-search-bar"]' },
      { title: 'Product Catalog Grid', description: 'Filter products by category or click item cards to add them to your cart.', targetSelector: '[data-tour="pos-product-grid"]' },
      { title: 'Cart Summary & Discounts', description: 'Review cart items, apply discounts, select customer, and calculate totals.', targetSelector: '[data-tour="pos-cart-panel"]' },
      { title: 'Checkout & Printing', description: 'Select Cash, UPI, Card, or Credit and print custom thermal receipts.', targetSelector: '[data-tour="pos-checkout-btn"]' },
    ],
  },
  'pos-lite': {
    pageKey: 'pos-lite',
    title: 'POS Lite (Mobile & Quick Entry)',
    subtitle: 'Master fast touch-based billing and custom manual product sales on mobile devices',
    videoUrl: '/assets/videos/guide-pos-lite.mp4',
    summary: 'POS Lite is lightweight and mobile-optimized. Perfect for quick billing without pre-registering products or when operating on smartphone screens.',
    keyFeatures: [
      { title: 'Quick Manual Entry', description: 'Sell items on the fly by typing name, price, quantity, and tax rate.' },
      { title: 'Barcode Scan Mode', description: 'Scan registered inventory barcodes using camera or connected scanner.' },
      { title: 'Mobile Split Layout', description: 'Seamlessly switch between Quick Sale entry and Cart checkout tabs on phone screens.' },
      { title: 'Thermal & System Printing', description: 'Print receipts via Bluetooth or native mobile AirPrint/System Print.' },
    ],
    proTips: [
      'Use POS Lite on your mobile phone to bill customers anywhere in your retail store.',
      'Scroll all the way down in the Cart tab to view full totals and checkout options.',
    ],
    tourSteps: [
      { title: 'Welcome to POS Lite', description: 'Designed for fast touch billing and custom unlisted item checkout.', targetSelector: '[data-tour="pos-lite-header"]' },
      { title: 'Manual Product Input', description: 'Enter custom product details and price on the fly.', targetSelector: '[data-tour="pos-lite-manual-form"]' },
      { title: 'Cart & Checkout', description: 'Switch to the Cart tab to adjust quantities, select payment methods, and complete sale.', targetSelector: '[data-tour="pos-lite-cart"]' },
    ],
  },
  products: {
    pageKey: 'products',
    title: 'Products & Inventory Management',
    subtitle: 'Learn how to manage inventory, track stock levels, assign barcodes, and print labels',
    videoUrl: '/assets/videos/guide-products.mp4',
    summary: 'The Products section allows you to manage your catalog, track cost vs selling prices, assign barcodes/SKUs, monitor low stock thresholds, and print barcode price labels.',
    keyFeatures: [
      { title: 'Catalog Search & Filters', description: 'Filter by category, search by SKU/barcode, or switch between List and Grid view.' },
      { title: 'Stock History Tracking', description: 'Record manual stock adjustments or barcode updates with detailed audit logs.' },
      { title: 'Barcode Label Designer & Printing', description: 'Print custom price stickers and barcode labels to TSPL or ESC/POS printers.' },
      { title: 'Bulk Management', description: 'Select multiple products to bulk delete or adjust category assignments.' },
    ],
    proTips: [
      'Set low stock threshold values for critical items to receive automatic dashboard alerts.',
      'Use "Scan to Update Stock" to adjust inventory quantities by scanning barcodes in seconds.',
    ],
    tourSteps: [
      { title: 'Inventory Actions', description: 'Add new products, update stock via barcode, or bulk delete items.', targetSelector: '[data-tour="products-header"]' },
      { title: 'Category Filters & Search', description: 'Filter products by category or search instantly by name or barcode.', targetSelector: '[data-tour="products-search"]' },
      { title: 'Inventory Table', description: 'View stock levels, prices, SKU/barcodes, and edit product details.', targetSelector: '[data-tour="products-table"]' },
    ],
  },
  categories: {
    pageKey: 'categories',
    title: 'Categories & Hierarchy Management',
    subtitle: 'Organize your products into structured main and subcategories',
    videoUrl: '/assets/videos/guide-categories.mp4',
    summary: 'Categories help structure your inventory catalog for fast POS browsing and detailed category-wise sales analytics.',
    keyFeatures: [
      { title: 'Nested Category Hierarchy', description: 'Create main categories (e.g., Clothing) and subcategories (e.g., Shirts).' },
      { title: 'Status Toggle', description: 'Enable or disable categories to control visibility in POS billing terminals.' },
      { title: 'Product Counts', description: 'Track how many active items belong to each category family.' },
    ],
    proTips: [
      'Group related items under subcategories to keep your POS screen clean and easy to navigate.',
    ],
    tourSteps: [
      { title: 'Categories Overview', description: 'Organize your store inventory into clean logical groupings.', targetSelector: '[data-tour="categories-header"]' },
      { title: 'Category Hierarchy Table', description: 'Manage parent and child subcategories with product counts.', targetSelector: '[data-tour="categories-table"]' },
    ],
  },
  customers: {
    pageKey: 'customers',
    title: 'Customer Directory & Store Credit Ledger',
    subtitle: 'Track customer details, purchase histories, and manage store credit balances',
    videoUrl: '/assets/videos/guide-customers.mp4',
    summary: 'Maintain customer relationships, track credit balances (Udhar), record partial credit settlements, and view complete transaction histories.',
    keyFeatures: [
      { title: 'Customer Profile Directory', description: 'Store phone numbers, email, delivery addresses, and custom credit limits.' },
      { title: 'Store Credit Ledger (Udhar)', description: 'Track outstanding credit balances and log partial payments or full settlements.' },
      { title: 'Purchase History Timeline', description: 'Review all past invoices and orders associated with any customer.' },
    ],
    proTips: [
      'Set a credit limit for frequent buyers to prevent exceeding safe store credit bounds.',
      'Record credit payments directly from the customer ledger to update balances instantly.',
    ],
    tourSteps: [
      { title: 'Customer Directory', description: 'Search and manage all customer contact info and store accounts.', targetSelector: '[data-tour="customers-header"]' },
      { title: 'Store Credit & Accounts Table', description: 'Monitor pending customer credit balances and view details.', targetSelector: '[data-tour="customers-table"]' },
    ],
  },
  suppliers: {
    pageKey: 'suppliers',
    title: 'Supplier & Vendor Management',
    subtitle: 'Keep track of vendors, GSTIN credentials, purchase orders, and supplier contacts',
    videoUrl: '/assets/videos/guide-suppliers.mp4',
    summary: 'Manage vendor contacts, GSTIN tax details, and link suppliers to inventory products and purchase receipts.',
    keyFeatures: [
      { title: 'Vendor Directory', description: 'Store supplier phone, email, address, and GSTIN details.' },
      { title: 'Linked Products', description: 'See which products in your catalog are supplied by each vendor.' },
      { title: 'Purchase Orders & Bills', description: 'Link stock purchases and expenses directly to supplier profiles.' },
    ],
    proTips: [
      'Assign suppliers to products so you know exactly who to reorder from when stock is low.',
    ],
    tourSteps: [
      { title: 'Supplier Directory', description: 'Manage vendor info, contact details, and tax credentials.', targetSelector: '[data-tour="suppliers-header"]' },
      { title: 'Vendor List Table', description: 'View supplier phone, email, and GSTIN information.', targetSelector: '[data-tour="suppliers-table"]' },
    ],
  },
  expenses: {
    pageKey: 'expenses',
    title: 'Store Expense Tracking',
    subtitle: 'Log daily store operational expenses, upload receipts, and track cash outflows',
    videoUrl: '/assets/videos/guide-expenses.mp4',
    summary: 'Track all non-inventory store expenses like rent, electricity, staff salary, maintenance, and marketing to compute accurate Net Profit.',
    keyFeatures: [
      { title: 'Expense Categorization', description: 'Tag expenses by category (Rent, Utilities, Salary, Maintenance, Other).' },
      { title: 'Receipt Image Upload', description: 'Upload digital copies or photos of physical expense bills and receipts.' },
      { title: 'Date Range Filtering', description: 'Analyze expenses by day, week, month, or custom date ranges.' },
    ],
    proTips: [
      'Categorize all expenses accurately so your Profit & Loss reports reflect your exact net profit.',
    ],
    tourSteps: [
      { title: 'Store Expenses Log', description: 'Record daily operational costs to maintain accurate accounting.', targetSelector: '[data-tour="expenses-header"]' },
      { title: 'Expense Records Table', description: 'View expenses, category tags, payment methods, and receipt photos.', targetSelector: '[data-tour="expenses-table"]' },
    ],
  },
  purchases: {
    pageKey: 'purchases',
    title: 'Purchase Orders & Inventory Restock',
    subtitle: 'Log inventory restock bills, update cost prices, and automatically increment stock',
    videoUrl: '/assets/videos/guide-purchases.mp4',
    summary: 'Record wholesale purchase bills from suppliers. Restocking items through Purchase Orders automatically increments stock levels.',
    keyFeatures: [
      { title: 'Stock Restock Entry', description: 'Log purchase invoice number, supplier, items, quantities, and cost prices.' },
      { title: 'Auto Inventory Increment', description: 'Adding a purchase automatically updates product current stock counts.' },
      { title: 'GST & Tax Calculations', description: 'Track input tax credit (ITC) paid on wholesale stock purchases.' },
    ],
    proTips: [
      'Log restock invoices promptly so your POS inventory counts stay 100% accurate.',
    ],
    tourSteps: [
      { title: 'Purchases Overview', description: 'Track all stock procurement invoices from suppliers.', targetSelector: '[data-tour="purchases-header"]' },
      { title: 'Purchase Orders Table', description: 'Log purchase items to automatically update store stock levels.', targetSelector: '[data-tour="purchases-table"]' },
    ],
  },
  reports: {
    pageKey: 'reports',
    title: 'Analytics, Reports & GST Filings',
    subtitle: 'Analyze Profit & Loss, Sales breakdown, GST Tax reports, and export Excel data',
    videoUrl: '/assets/videos/guide-reports.mp4',
    summary: 'Comprehensive business intelligence suite including Sales Reports, Profit & Loss Statements, GST Tax Filing summaries, and Excel export tools.',
    keyFeatures: [
      { title: 'Sales Performance Analytics', description: 'View total sales, discounts, net revenue, and average transaction values.' },
      { title: 'Profit & Loss Statement', description: 'Calculate Gross Profit (Sales - Cost) and Net Profit (Gross Profit - Expenses).' },
      { title: 'GST Tax Report', description: 'View taxable turnover, CGST, SGST, IGST totals ready for GSTR-1 / GSTR-3B filing.' },
      { title: 'One-Click Excel Export', description: 'Export full sales registers and tax data directly to Microsoft Excel format.' },
    ],
    proTips: [
      'Use the Date Range picker to generate monthly or quarterly tax totals for your accountant.',
    ],
    tourSteps: [
      { title: 'Reports Hub', description: 'Access financial summaries, sales performance, and tax insights.', targetSelector: '[data-tour="reports-header"]' },
      { title: 'Report Type Cards', description: 'Switch between Sales, Profit & Loss, and GST Tax reports.', targetSelector: '[data-tour="reports-cards"]' },
    ],
  },
  printers: {
    pageKey: 'printers',
    title: 'Printers & Receipt Configuration',
    subtitle: 'Configure thermal receipt printers, Bluetooth ESC/POS connections, and label layouts',
    videoUrl: '/assets/videos/guide-printers.mp4',
    summary: 'Configure Web Bluetooth thermal receipt printers, customize receipt headers/footers, choose paper widths (58mm / 80mm), and design barcode label stickers.',
    keyFeatures: [
      { title: 'Web Bluetooth Scanner', description: 'Scan, pair, and connect Bluetooth thermal receipt printers with one click.' },
      { title: 'Receipt Customizer', description: 'Customize business header, address, phone, GSTIN, receipt logo, and thank you notes.' },
      { title: 'Label Printer Designer', description: 'Configure sticker size (50x30mm), command mode (TSPL/ESCPOS), and price label layout.' },
      { title: 'Test Receipt Print', description: 'Send a test receipt or barcode label to verify printer alignment and quality.' },
    ],
    proTips: [
      'On mobile devices (iOS / Android), you can also use System Print or AirPrint to print to any printer.',
    ],
    tourSteps: [
      { title: 'Printer Management', description: 'Connect thermal printers and customize your receipt branding.', targetSelector: '[data-tour="printers-header"]' },
      { title: 'Bluetooth Printer Status', description: 'Scan and pair your ESC/POS thermal printer directly in your browser.', targetSelector: '[data-tour="printers-status"]' },
    ],
  },
  settings: {
    pageKey: 'settings',
    title: 'Business & System Settings',
    subtitle: 'Configure store profile, GSTIN, user roles, security, and app preferences',
    videoUrl: '/assets/videos/guide-settings.mp4',
    summary: 'Manage your business profile, tax registration details, user roles, security passwords, and general app preferences.',
    keyFeatures: [
      { title: 'Business Profile', description: 'Set business name, address, phone number, GSTIN, and store logo.' },
      { title: 'Sub-User Roles & Security', description: 'Manage cashier and manager accounts with fine-grained access permissions.' },
      { title: 'Password & Security', description: 'Update account password and authentication settings.' },
    ],
    proTips: [
      'Keep your business GSTIN and address updated so they print correctly on all customer invoices.',
    ],
    tourSteps: [
      { title: 'Store Settings', description: 'Manage business identity, tax credentials, and system preferences.', targetSelector: '[data-tour="settings-header"]' },
      { title: 'Settings Category Tabs', description: 'Configure business details, cashier permissions, language, and passwords.', targetSelector: '[data-tour="settings-tabs"]' },
    ],
  },
}
