const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      businessName: true,
      plan: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const salesCount = await prisma.sale.count();
  const productsCount = await prisma.product.count();
  const customersCount = await prisma.customer.count();

  console.log('--- DB SUMMARY ---');
  console.log('Real DB Users Count:', users.length);
  console.log('Real Sales Count:', salesCount);
  console.log('Real Products Count:', productsCount);
  console.log('Real Customers Count:', customersCount);
  console.log('Real Users Data:', JSON.stringify(users, null, 2));

  await prisma.$disconnect();
}

checkDb().catch(console.error);
