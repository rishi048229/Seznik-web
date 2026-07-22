import nodemailer from 'nodemailer';

// SMTP transport built from environment config. Works with any SMTP provider
// (Gmail app password, Brevo, SendGrid, Mailgun, etc.).
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env');
  }

  const isGmail = host.includes('gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  const transporter = getTransporter();
  const user = process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || `Seznik POS <${user}>`;

  await transporter.sendMail({
    from,
    to,
    subject: `${otp} is your Seznik POS verification code`,
    text: `Your Seznik POS email verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;">
        <div style="text-align:center;padding:16px 0;">
          <div style="display:inline-block;padding:10px 18px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#38bdf8);color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">
            SEZNIK POS
          </div>
        </div>
        <h2 style="text-align:center;margin:16px 0 8px;">Verify your email</h2>
        <p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px;">
          Use the code below to verify your email address and finish creating your account.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;padding:14px 28px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:30px;font-weight:bold;letter-spacing:8px;">
            ${otp}
          </span>
        </div>
        <p style="text-align:center;color:#6b7280;font-size:13px;">
          This code expires in <strong>10 minutes</strong>.<br/>
          If you didn't request it, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string): Promise<void> => {
  const transporter = getTransporter();
  const user = process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || `Seznik POS <${user}>`;

  await transporter.sendMail({
    from,
    to,
    subject: `${otp} is your Password Reset Code - Seznik POS`,
    text: `Your Seznik POS password reset verification code is ${otp}. It expires in 10 minutes. If you didn't request a password reset, please ignore this email or secure your account.`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;">
        <div style="text-align:center;padding:16px 0;">
          <div style="display:inline-block;padding:10px 18px;border-radius:12px;background:linear-gradient(135deg,#0a0a2e,#1e1b6e);color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">
            SEZNIK POS
          </div>
        </div>
        <h2 style="text-align:center;margin:16px 0 8px;">Reset Your Password</h2>
        <p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px;">
          Use the verification code below to reset your Seznik POS account password.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;padding:14px 28px;border-radius:12px;background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;font-size:30px;font-weight:bold;letter-spacing:8px;">
            ${otp}
          </span>
        </div>
        <p style="text-align:center;color:#6b7280;font-size:13px;">
          This code expires in <strong>10 minutes</strong>.<br/>
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};

