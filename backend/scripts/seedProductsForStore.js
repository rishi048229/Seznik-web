/**
 * Seed products for a store owner by email.
 * Usage: node scripts/seedProductsForStore.js [email] [count]
 * Example: node scripts/seedProductsForStore.js mexabe6147@kikaga.com 120
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STORE_EMAIL = (process.argv[2] || 'mexabe6147@kikaga.com').trim().toLowerCase();
const TARGET_COUNT = Math.max(100, parseInt(process.argv[3] || '120', 10) || 120);

const GST_RATES = [0, 5, 12, 18, 28];

const CATEGORY_CATALOG = [
  { name: 'Staples & Grains', unit: 'kg', priceRange: [35, 220] },
  { name: 'Snacks & Biscuits', unit: 'piece', priceRange: [5, 85] },
  { name: 'Beverages', unit: 'piece', priceRange: [15, 180] },
  { name: 'Dairy & Breakfast', unit: 'piece', priceRange: [25, 350] },
  { name: 'Personal Care', unit: 'piece', priceRange: [20, 450] },
  { name: 'Household', unit: 'piece', priceRange: [30, 520] },
  { name: 'Fresh Produce', unit: 'kg', priceRange: [25, 160] },
  { name: 'Spices & Masala', unit: 'piece', priceRange: [18, 240] },
];

const PRODUCT_NAMES = {
  'Staples & Grains': [
    'Basmati Rice Premium 1kg', 'Sona Masoori Rice 5kg', 'Whole Wheat Atta 5kg', 'Toor Dal 1kg',
    'Moong Dal 500g', 'Chana Dal 1kg', 'Urad Dal 500g', 'Masoor Dal 1kg', 'Poha Thick 500g',
    'Suji Rava 500g', 'Besan 500g', 'Maida 1kg', 'Brown Rice 1kg', 'Quinoa 500g',
  ],
  'Snacks & Biscuits': [
    'Parle-G Gold 100g', 'Monaco Salted 200g', 'Good Day Butter 200g', 'Oreo Chocolate 120g',
    'Lays Classic Salted 52g', 'Kurkure Masala Munch 90g', 'Haldiram Bhujia 200g', 'Bingo Mad Angles 66g',
    'Britannia Marie Gold 250g', 'Hide & Seek 200g', 'Pringles Original 107g', 'Namkeen Mix 150g',
    'Sunfeast Dark Fantasy 150g', 'MTR Rava Idli Mix 500g', 'Maggi 2-Minute Noodles 280g',
  ],
  'Beverages': [
    'Coca-Cola 750ml', 'Pepsi 750ml', 'Sprite 750ml', 'Frooti Mango 1L',
    'Real Mixed Fruit Juice 1L', 'Tropicana Orange 1L', 'Bisleri Water 1L', 'Red Bull 250ml',
    'Nescafe Classic 50g', 'Tata Tea Gold 250g', 'Bru Instant Coffee 100g', 'Horlicks 500g',
    'Boost 500g', 'Complan Chocolate 500g', 'Appy Fizz 250ml',
  ],
  'Dairy & Breakfast': [
    'Amul Taaza Milk 1L', 'Amul Butter 500g', 'Britannia Cheese Slices 200g', 'Mother Dairy Curd 400g',
    'Amul Ghee 1L', 'Nestle Milkmaid 400g', 'Kelloggs Chocos 375g', 'Corn Flakes 475g',
    'Oats 1kg', 'Paneer 200g', 'Eggs Pack of 6', 'Yakult Probiotic 5pc', 'Amul Lassi 200ml',
    'Britannia Bread 400g', 'Dabur Honey 500g',
  ],
  'Personal Care': [
    'Colgate MaxFresh 150g', 'Pepsodent 200g', 'Dove Soap 125g', 'Lux Soft Touch 150g',
    'Head & Shoulders Shampoo 340ml', 'Pantene Shampoo 340ml', 'Dettol Handwash 200ml',
    'Lifebuoy Soap 125g', 'Gillette Guard Razor', 'Nivea Soft Cream 100ml', 'Vaseline Petroleum Jelly 100ml',
    'Himalaya Face Wash 150ml', 'Fiama Gel Bar 125g', 'Clinic Plus Shampoo 340ml', 'Closeup Toothpaste 150g',
  ],
  'Household': [
    'Surf Excel Matic 1kg', 'Ariel Matic 1kg', 'Rin Bar 250g', 'Vim Dishwash Gel 500ml',
    'Harpic Toilet Cleaner 1L', 'Lizol Disinfectant 1L', 'Good Knight Coil 10pc', 'Odomos Cream 50g',
    'Scotch Brite Scrub Pad', 'Tide Plus 1kg', 'Comfort Fabric Conditioner 860ml', 'Colin Glass Cleaner 500ml',
    'Hit Mosquito Spray 400ml', 'Godrej Aer Spray 220ml', 'Dettol Antiseptic 550ml',
  ],
  'Fresh Produce': [
    'Tomato Local', 'Onion Nashik', 'Potato Regular', 'Carrot Orange', 'Cabbage Green',
    'Capsicum Green', 'Cauliflower Fresh', 'Spinach Bunch', 'Coriander Bunch', 'Ginger Fresh',
    'Garlic Premium', 'Green Chilli', 'Lemon 250g Pack', 'Apple Shimla', 'Banana Robusta',
  ],
  'Spices & Masala': [
    'Everest Garam Masala 100g', 'MDH Chana Masala 100g', 'Catch Turmeric 200g', 'Everest Coriander Powder 200g',
    'MDH Kitchen King 100g', 'Catch Red Chilli Powder 200g', 'Tata Salt 1kg', 'Tata Iodized Salt 1kg',
    'Catch Black Pepper 100g', 'Everest Chicken Masala 100g', 'MDH Pav Bhaji Masala 100g',
    'Catch Cumin Seeds 100g', 'Everest Kasuri Methi 25g', 'MDH Sambhar Masala 100g', 'Catch Mustard Seeds 100g',
  ],
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function pickGstProfile(index) {
  const taxRate = GST_RATES[index % GST_RATES.length];
  const priceIncludesGst = index % 3 !== 0;
  return { taxRate, priceIncludesGst };
}

function buildProducts(count, categoryMap) {
  const products = [];
  let idx = 0;

  while (products.length < count) {
    for (const cat of CATEGORY_CATALOG) {
      if (products.length >= count) break;
      const names = PRODUCT_NAMES[cat.name];
      const name = names[idx % names.length];
      const variantSuffix = idx >= names.length ? ` Pack ${Math.floor(idx / names.length) + 1}` : '';
      const { taxRate, priceIncludesGst } = pickGstProfile(products.length);
      const [minP, maxP] = cat.priceRange;
      const basePrice = minP + ((products.length * 17) % (maxP - minP + 1));
      const sellingPrice = round2(basePrice + (taxRate > 0 && priceIncludesGst ? taxRate * 0.1 : 0));
      const costPrice = round2(sellingPrice * (0.55 + (products.length % 25) / 100));
      const stock = 10 + (products.length * 7) % 190;

      products.push({
        name: `${name}${variantSuffix}`.trim(),
        sku: `MX-${String(products.length + 1).padStart(4, '0')}`,
        barcode: `789${String(1000000000 + products.length).slice(-10)}`,
        barcodeType: 'EAN13',
        categoryId: categoryMap.get(cat.name),
        costPrice,
        sellingPrice,
        taxRate,
        priceIncludesGst,
        currentStock: stock,
        lowStockThreshold: stock <= 20 ? 5 : 10,
        unit: cat.unit,
        brand: name.split(' ')[0],
        description: `${name} — GST ${taxRate}% (${priceIncludesGst ? 'inclusive' : 'exclusive'})`,
        isActive: true,
      });
    }
    idx += 1;
  }

  return products.slice(0, count);
}

async function resolveOwnerUserId(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, businessName: true },
  });
  if (user) return user;

  const staff = await prisma.managedUser.findFirst({
    where: { email },
    select: { adminId: true },
  });
  if (!staff) return null;

  return prisma.user.findUnique({
    where: { id: staff.adminId },
    select: { id: true, email: true, businessName: true },
  });
}

async function main() {
  const owner = await resolveOwnerUserId(STORE_EMAIL);
  if (!owner) {
    throw new Error(`No store owner found for email: ${STORE_EMAIL}`);
  }

  console.log(`Seeding ${TARGET_COUNT} products for ${owner.businessName || owner.email} (${owner.id})`);

  const categoryMap = new Map();
  for (const cat of CATEGORY_CATALOG) {
    const existing = await prisma.category.findFirst({
      where: { userId: owner.id, name: cat.name },
    });
    if (existing) {
      categoryMap.set(cat.name, existing.id);
    } else {
      const created = await prisma.category.create({
        data: { name: cat.name, userId: owner.id, isActive: true },
      });
      categoryMap.set(cat.name, created.id);
      console.log(`Created category: ${cat.name}`);
    }
  }

  const productData = buildProducts(TARGET_COUNT, categoryMap).map((p) => ({
    ...p,
    userId: owner.id,
  }));

  const existingCount = await prisma.product.count({ where: { userId: owner.id } });
  const result = await prisma.product.createMany({
    data: productData,
    skipDuplicates: true,
  });

  const finalCount = await prisma.product.count({ where: { userId: owner.id } });
  const gstBreakdown = await prisma.product.groupBy({
    by: ['taxRate', 'priceIncludesGst'],
    where: { userId: owner.id },
    _count: { _all: true },
  });

  console.log('\n--- Seed complete ---');
  console.log(`Products before: ${existingCount}`);
  console.log(`Inserted this run: ${result.count}`);
  console.log(`Products now: ${finalCount}`);
  console.log('GST breakdown:');
  for (const row of gstBreakdown.sort((a, b) => a.taxRate - b.taxRate)) {
    console.log(
      `  ${row.taxRate}% ${row.priceIncludesGst ? 'incl.' : 'excl.'}: ${row._count._all}`
    );
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
