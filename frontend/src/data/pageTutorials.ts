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
      { title: 'Dashboard Header', description: 'Your business control center. Click Video Guide anytime for video tutorials.', targetSelector: '[data-tour="dashboard-title"]' },
      { title: 'Quick POS Terminal', description: 'Click here to jump straight into high-speed billing and retail checkout.', targetSelector: '[data-tour="pos-shortcut"]' },
      { title: 'Total Revenue KPI', description: 'Track your live store sales revenue and growth trends.', targetSelector: '[data-tour="kpi-revenue"]' },
      { title: 'Bluetooth Printer Status', description: 'Scan, pair, or disconnect your thermal receipt printer.', targetSelector: '[data-tour="printer-card"]' },
    ],
  },
  pos: {
    pageKey: 'pos',
    title: 'Scan To Bill Terminal',
    subtitle: 'Learn how to process high-speed retail checkout, scan barcodes, and issue instant receipts',
    videoUrl: '/assets/videos/guide-pos.mp4',
    summary: 'The Scan To Bill Terminal is optimized for desktop and tablet counter billing. It features instant barcode scanning, product search, cart discounts, customer credit billing, and instant thermal printing.',
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
      { title: 'Barcode & Product Search', description: 'Search items by name, SKU, or scan barcodes to add items directly to cart.', targetSelector: '[data-tour="pos-search-input"]' },
      { title: 'Category Filters', description: 'Filter your store catalog by category with one click.', targetSelector: '[data-tour="pos-category-tabs"]' },
      { title: 'Customer Credit / Walk-in', description: 'Select a customer to bill on Store Credit (Udhar) or walk-in.', targetSelector: '[data-tour="pos-customer-select"]' },
      { title: 'Complete & Print Bill', description: 'Choose payment method (Cash, Card, UPI, Credit) and print thermal receipt.', targetSelector: '[data-tour="pos-checkout-btn"]' },
    ],
  },
  'pos-lite': {
    pageKey: 'pos-lite',
    title: 'QUICK BILL (Mobile & Fast Entry)',
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
      { title: 'Barcode Scanner Mode', description: 'Turn on scanning to add registered products instantly.', targetSelector: '[data-tour="pos-lite-scan-btn"]' },
      { title: 'Custom Item Name', description: 'Enter any item name on the fly without pre-registering.', targetSelector: '[data-tour="pos-lite-name-input"]' },
      { title: 'Add to Cart Button', description: 'Add custom or scanned items into your active cart bill.', targetSelector: '[data-tour="pos-lite-add-cart-btn"]' },
      { title: 'Recent items', description: 'Tap a recent item to add it again in one tap.', targetSelector: '[data-tour="pos-lite-recent"]' },
      { title: 'Mobile Cart Tab', description: 'Switch to the Cart tab to view totals and complete printing.', targetSelector: '[data-tour="pos-lite-tab-cart"]' },
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
      { title: '+ Add Product Button', description: 'Click here to create a new product with price, barcode, tax rate, and images.', targetSelector: '[data-tour="add-product-btn"]' },
      { title: 'Scan to Update Stock', description: 'Quickly restock or adjust product inventory by scanning barcodes.', targetSelector: '[data-tour="scan-stock-btn"]' },
      { title: 'List & Grid Toggle', description: 'Switch between detailed table view and visual grid cards.', targetSelector: '[data-tour="view-mode-toggle"]' },
      { title: 'Instant Search Input', description: 'Search inventory instantly by item name, SKU, or barcode number.', targetSelector: '[data-tour="search-input"]' },
      { title: 'Total Inventory Value', description: 'View total monetary value of all stock currently in your store.', targetSelector: '[data-tour="inventory-value-widget"]' },
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
      { title: '+ New Category Button', description: 'Create main categories or nested subcategories for your store.', targetSelector: '[data-tour="new-category-btn"]' },
      { title: 'Category Search Bar', description: 'Filter categories and subcategories instantly by name.', targetSelector: '[data-tour="category-search-input"]' },
      { title: 'Category Table Row', description: 'Edit, delete, or manage subcategories and product counts.', targetSelector: '[data-tour="category-first-row"]' },
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
      { title: '+ Add Customer Button', description: 'Register a new customer profile with phone, email, and credit limit.', targetSelector: '[data-tour="add-customer-btn"]' },
      { title: 'Search Customers', description: 'Find customers instantly by phone number or name.', targetSelector: '[data-tour="customer-search-input"]' },
      { title: 'Customer Credit Ledger', description: 'View outstanding credit dues (Udhar) and log cash/UPI settlements.', targetSelector: '[data-tour="customer-first-row"]' },
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
      { title: '+ Add Supplier Button', description: 'Register wholesale vendors with phone, email, and GSTIN tax details.', targetSelector: '[data-tour="add-supplier-btn"]' },
      { title: 'Supplier Record Row', description: 'View vendor contact details and edit supplier profiles.', targetSelector: '[data-tour="supplier-first-row"]' },
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
      { title: '+ Add Expense Button', description: 'Record daily costs like rent, salaries, electricity, and attach receipts.', targetSelector: '[data-tour="add-expense-btn"]' },
      { title: 'Filter Expenses', description: 'Filter expense logs by category or date range.', targetSelector: '[data-tour="expense-filters-btn"]' },
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
      { title: 'Record Purchase Button', description: 'Log wholesale stock bills to update product current stock automatically.', targetSelector: '[data-tour="record-purchase-btn"]' },
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
      { title: 'Sales Report Card', description: 'View daily revenue, invoice registers, and export to Excel.', targetSelector: '[data-tour="report-card-sales"]' },
      { title: 'Profit & Loss Card', description: 'Calculate net profit after deducting store expenses and stock costs.', targetSelector: '[data-tour="report-card-pl"]' },
      { title: 'GST Tax Report Card', description: 'View taxable turnover and tax collected ready for monthly GST filing.', targetSelector: '[data-tour="report-card-tax"]' },
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
      { title: 'Label Printer Designer', description: 'Choose 50 mm sticker sizes (50×30, 25, 50, 75, 100), printer type (label vs receipt), and barcode layout.' },
      { title: 'Test Receipt Print', description: 'Send a test receipt or barcode label to verify printer alignment and quality.' },
    ],
    proTips: [
      'On mobile devices (iOS / Android), you can also use System Print or AirPrint to print to any printer.',
    ],
    tourSteps: [
      { title: 'Scan & Connect Printer', description: 'Pair your Bluetooth thermal ESC/POS receipt printer directly in browser.', targetSelector: '[data-tour="printer-connect-btn"]' },
      { title: 'Test Print Button', description: 'Send a test print to verify thermal receipt paper alignment.', targetSelector: '[data-tour="printer-test-btn"]' },
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
      { title: 'Business Profile Tab', description: 'Configure business name, store logo, address, and GSTIN number.', targetSelector: '[data-tour="settings-tab-business"]' },
      { title: 'Cashier & Sub-Users Tab', description: 'Create cashier logins and manage access permissions for staff.', targetSelector: '[data-tour="settings-tab-permissions"]' },
    ],
  },
  login: {
    pageKey: 'login',
    title: 'Login & Account Access Guide',
    subtitle: 'Learn how to sign in, create a business account, verify email OTP, and reset forgotten passwords',
    videoUrl: '/assets/videos/guide-login.mp4',
    summary: 'Access your Seznik Inventory & POS workspace. Sign in with your registered email and password, register a new business account with instant 6-digit email OTP verification, or reset forgotten credentials.',
    keyFeatures: [
      { title: 'Secure Account Sign In', description: 'Log in securely with your registered email address and account password.' },
      { title: 'New Business Registration', description: 'Create a new business workspace with instant 6-digit email OTP verification.' },
      { title: 'Forgot Password Self-Reset', description: 'Reset your password securely via instant OTP sent to your registered email.' },
      { title: 'Multi-Role Staff Access', description: 'Log in as Owner, Store Manager, or Cashier with pre-assigned permissions.' },
    ],
    proTips: [
      'Use the Show/Hide password toggle to verify your password before submitting.',
      'If you forget your password, click "Forgot Password?" to receive an instant 6-digit OTP.',
    ],
    tourSteps: [
      { title: 'Email Address Field', description: 'Enter your registered email address to access your store.', targetSelector: '[data-tour="login-email"]' },
      { title: 'Password Field', description: 'Enter your secure account password.', targetSelector: '[data-tour="login-password"]' },
      { title: 'Sign In Button', description: 'Click to authenticate and open your store workspace.', targetSelector: '[data-tour="login-submit"]' },
    ],
  },
}
