import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

console.log('User:', user);
console.log('Pass:', pass);

async function testPort(port, secure) {
  console.log(`\nTesting Port ${port} (secure=${secure})...`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log(`✅ Port ${port} SUCCESS!`);
  } catch (err) {
    console.error(`❌ Port ${port} FAILED:`, err.message);
  }
}

async function run() {
  await testPort(587, false);
  await testPort(465, true);
}

run();
