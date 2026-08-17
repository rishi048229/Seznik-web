import { Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';
import { sendOtpEmail, sendPasswordResetOtpEmail } from '../services/emailService';

const OTP_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 request per email per minute
const OTP_MAX_ATTEMPTS = 5;
// After a successful verification the user gets this long to finish signup.
const OTP_VERIFIED_WINDOW_MS = 30 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,14}$/;

const normalizeEmail = (email: unknown): string => String(email || '').trim().toLowerCase();

// An email must resolve to at most one account across BOTH tables — a primary
// User (owner/admin) and a ManagedUser (staff sub-account) share the same
// login-by-email space, so every account-creation path needs to check both.
const findAccountByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) return { type: 'user' as const, record: user };
  const managedUser = await prisma.managedUser.findFirst({ where: { email } });
  if (managedUser) return { type: 'managed' as const, record: managedUser };
  return null;
};

// Step 1 of signup: email in → 6-digit code out (via SMTP).
export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const existingAccount = await findAccountByEmail(email);
    if (existingAccount) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const existingOtp = await prisma.emailOtp.findUnique({ where: { email } });
    if (existingOtp && Date.now() - existingOtp.updatedAt.getTime() < OTP_RESEND_COOLDOWN_MS && !existingOtp.verifiedAt) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.emailOtp.upsert({
      where: { email },
      create: { email, codeHash, expiresAt },
      update: { codeHash, expiresAt, attempts: 0, verifiedAt: null },
    });

    console.log('\n====================================================');
    console.log(`🔑 [DEV VERIFICATION CODE]: ${otp} for ${email}`);
    console.log('====================================================\n');

    try {
      await sendOtpEmail(email, otp);
      res.json({ message: 'Verification code sent to your email' });
    } catch (emailErr) {
      console.error('SMTP Email Sending Failed:', emailErr);
      const isDev = process.env.NODE_ENV !== 'production';
      return res.json({
        message: isDev ? `OTP generated! (Dev code: ${otp})` : 'Verification code sent! (Check email or server logs)',
        ...(isDev ? { devOtp: otp } : {}),
      });
    }
  } catch (error) {
    console.error('sendEmailOtp error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send verification email' });
  }
};

// Step 2 of signup: user types the code back; we mark the email verified.
export const verifyEmailOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    const record = await prisma.emailOtp.findUnique({ where: { email } });
    if (!record) {
      return res.status(400).json({ error: 'No verification code was requested for this email' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code expired. Please request a new one' });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new code' });
    }

    const isMatch = await bcrypt.compare(otp, record.codeHash);
    if (!isMatch) {
      await prisma.emailOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ error: 'Incorrect code. Please try again' });
    }

    await prisma.emailOtp.update({ where: { email }, data: { verifiedAt: new Date() } });
    res.json({ message: 'Email verified' });
  } catch (error) {
    console.error('verifyEmailOtp error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

// Step 1 of Forgot Password: Send OTP code
export const sendForgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check if account exists in User or ManagedUser
    const user = await prisma.user.findUnique({ where: { email } });
    const managedUser = !user ? await prisma.managedUser.findFirst({ where: { email } }) : null;

    if (!user && !managedUser) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    const existingOtp = await prisma.emailOtp.findUnique({ where: { email } });
    if (existingOtp && Date.now() - existingOtp.updatedAt.getTime() < OTP_RESEND_COOLDOWN_MS && !existingOtp.verifiedAt) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.emailOtp.upsert({
      where: { email },
      create: { email, codeHash, expiresAt },
      update: { codeHash, expiresAt, attempts: 0, verifiedAt: null },
    });

    console.log('\n====================================================');
    console.log(`🔑 [DEV FORGOT PASSWORD OTP CODE]: ${otp} for ${email}`);
    console.log('====================================================\n');

    try {
      await sendPasswordResetOtpEmail(email, otp);
      res.json({ message: 'Password reset code sent to your email' });
    } catch (emailErr) {
      console.error('SMTP Password Reset Email Failed:', emailErr);
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        return res.json({
          message: `OTP generated! (Dev mode: Check terminal for code: ${otp})`,
          devOtp: otp,
        });
      }
      return res.status(500).json({
        error: 'Failed to send reset email. Please check your SMTP settings or server logs.',
      });
    }
  } catch (error) {
    console.error('sendForgotPasswordOtp error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to process request' });
  }
};

// Step 2 of Forgot Password: Verify OTP code
export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    const record = await prisma.emailOtp.findUnique({ where: { email } });
    if (!record) {
      return res.status(400).json({ error: 'No verification code was requested for this email' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code expired. Please request a new one' });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new code' });
    }

    const isMatch = await bcrypt.compare(otp, record.codeHash);
    if (!isMatch) {
      await prisma.emailOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ error: 'Incorrect code. Please try again' });
    }

    await prisma.emailOtp.update({ where: { email }, data: { verifiedAt: new Date() } });
    res.json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('verifyForgotPasswordOtp error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

const validatePasswordComplexity = (password: string): string | null => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z)';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z)';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9)';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*)';
  }
  return null;
};

// Step 3 of Forgot Password: Reset password in DB
export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const newPassword = String(req.body.newPassword || '');

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const otpRecord = await prisma.emailOtp.findUnique({ where: { email } });
    const verifiedRecently =
      otpRecord?.verifiedAt && Date.now() - otpRecord.verifiedAt.getTime() < OTP_VERIFIED_WINDOW_MS;
    if (!verifiedRecently) {
      return res.status(400).json({ error: 'Please verify the OTP code before resetting your password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
    } else {
      const managedUser = await prisma.managedUser.findFirst({ where: { email } });
      if (managedUser) {
        await prisma.managedUser.update({
          where: { id: managedUser.id },
          data: { password: hashedPassword },
        });
      } else {
        return res.status(404).json({ error: 'Account not found' });
      }
    }

    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});

    res.json({ message: 'Password updated successfully! You can now log in with your new password.' });
  } catch (error) {
    console.error('resetPasswordWithOtp error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};


export const register = async (req: Request, res: Response) => {
  try {
    const { password, displayName } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (!phone || !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }
    const passwordError = validatePasswordComplexity(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existingAccount = await findAccountByEmail(email);
    if (existingAccount) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Email must have completed the OTP flow recently.
    const otpRecord = await prisma.emailOtp.findUnique({ where: { email } });
    const verifiedRecently =
      otpRecord?.verifiedAt && Date.now() - otpRecord.verifiedAt.getTime() < OTP_VERIFIED_WINDOW_MS;
    if (!verifiedRecently) {
      return res.status(400).json({ error: 'Please verify your email before signing up' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        emailVerified: true,
        phone,
        password: hashedPassword,
        displayName,
        uid: email, // temporary uid until firebase is fully removed
      },
    });

    // One-time use: the OTP record has served its purpose.
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});

    const token = generateToken(user.id, user.role || 'admin');

    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Check main User table (Admin / Store Owner)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = generateToken(user.id, user.role || 'admin');
        return res.json({
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role || 'admin',
            onboardingCompleted: user.onboardingCompleted,
            accountType: 'user',
          },
          token,
        });
      }
    }

    // 2. Check ManagedUser table (Agents / Sub-accounts)
    const managedUser = await prisma.managedUser.findFirst({ where: { email } });
    if (managedUser && managedUser.password) {
      const isMatch = await bcrypt.compare(password, managedUser.password);
      if (isMatch) {
        const token = generateToken(managedUser.id, managedUser.role || 'agent');
        return res.json({
          user: {
            id: managedUser.id,
            email: managedUser.email,
            displayName: managedUser.displayName,
            role: managedUser.role || 'agent',
            onboardingCompleted: true,
            permissions: managedUser.permissions,
            accountType: 'managed',
          },
          token,
        });
      }
    }

    return res.status(400).json({ error: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const socialLogin = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { uid, displayName } = req.body;

    let user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      // Don't let a social sign-in silently create a second account for an
      // email that's already a staff (ManagedUser) login.
      const managedUser = await prisma.managedUser.findFirst({ where: { email } });
      if (managedUser) {
        return res.status(400).json({
          error: 'This email is already registered as a staff account. Please log in with your email and password instead.',
        });
      }

      user = await prisma.user.create({
        data: {
          email,
          uid,
          displayName,
          role: 'admin',
        },
      });
    }

    const token = generateToken(user.id, user.role || 'admin');
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during social login' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    }

    const managedUser = await prisma.managedUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      const { password, ...userWithoutPassword } = managedUser;
      return res.json({
        ...userWithoutPassword,
        onboardingCompleted: true,
      });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const setRole = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { role, password, agentUid } = req.body;

    // 1. If switching to a specific agent account from access selection
    if (role === 'agent' && agentUid) {
      const managedUser = await prisma.managedUser.findFirst({
        where: { uid: agentUid, adminId: userId },
      });

      if (!managedUser) {
        return res.status(404).json({ error: 'Selected agent account not found' });
      }

      if (password) {
        const isMatch = await bcrypt.compare(password, managedUser.password || '');
        if (!isMatch) {
          return res.status(400).json({ error: 'Invalid password for selected agent' });
        }
      }

      // Generate new token for the managed user
      const token = generateToken(managedUser.id, managedUser.role || 'agent');
      return res.json({
        user: {
          id: managedUser.id,
          uid: managedUser.uid,
          email: managedUser.email,
          displayName: managedUser.displayName,
          role: managedUser.role || 'agent',
          permissions: managedUser.permissions,
          accountType: 'managed',
          onboardingCompleted: true,
        },
        token,
      });
    }

    // 2. Regular user role confirmation (Admin or Direct user)
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      if (password) {
        const isMatch = await bcrypt.compare(password, user.password || '');
        if (!isMatch) {
          return res.status(400).json({ error: 'Invalid password for account' });
        }
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: role || user.role || 'admin' },
      });
      const { password: _, ...userWithoutPassword } = updatedUser;
      return res.json({ user: userWithoutPassword });
    }

    let managedUser = await prisma.managedUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      if (password) {
        const isMatch = await bcrypt.compare(password, managedUser.password || '');
        if (!isMatch) {
          return res.status(400).json({ error: 'Invalid password for account' });
        }
      }
      if (role === 'admin' && managedUser.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Agent account does not have Admin privileges' });
      }
      const updatedManaged = await prisma.managedUser.update({
        where: { id: userId },
        data: { role: role || managedUser.role || 'agent' },
      });
      const { password: _, ...userWithoutPassword } = updatedManaged;
      return res.json({ user: userWithoutPassword });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error('setRole error:', error);
    res.status(500).json({ error: 'Server error setting role' });
  }
};

export const updateManagedUserPassword = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { uid, newPassword } = req.body;

    if (!uid || !newPassword) {
      return res.status(400).json({ error: 'Agent ID and new password are required' });
    }

    const managed = await prisma.managedUser.findFirst({
      where: { uid, adminId },
    });

    if (!managed) {
      return res.status(404).json({ error: 'Agent account not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await prisma.managedUser.update({
      where: { id: managed.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Agent password updated successfully' });
  } catch (error) {
    console.error('updateManagedUserPassword error:', error);
    res.status(500).json({ error: 'Failed to update agent password' });
  }
};

export const completeOnboarding = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { businessName } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { businessName, onboardingCompleted: true },
    });

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Managed users (sub-accounts an admin configures) ────────────────────────
// The frontend keeps the full list in state and persists it; these endpoints
// back that with the ManagedUser table. Data always belongs to the admin, so
// managed users are configuration only (role + permission flags + password).

const serializeManagedUser = (m: any) => ({
  uid: m.uid,
  displayName: m.displayName,
  email: m.email,
  role: m.role,
  permissions: m.permissions,
  photoURL: m.photoURL,
  businessName: m.businessName,
  plan: m.plan,
  createdAt: m.createdAt,
});

export const getManagedUsers = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const managed = await prisma.managedUser.findMany({
      where: { adminId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(managed.map(serializeManagedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch managed users' });
  }
};

export const createManagedUser = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { uid, displayName, email, role, permissions, password, photoURL, businessName, plan } = req.body;

    if (!displayName || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;
    if (normalizedEmail) {
      const existingAccount = await findAccountByEmail(normalizedEmail);
      if (existingAccount) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const managed = await prisma.managedUser.create({
      data: {
        uid: uid || `user_${Date.now()}`,
        displayName,
        email: normalizedEmail,
        role: role || 'agent',
        permissions: permissions ?? undefined,
        password: hashedPassword,
        photoURL: photoURL || null,
        businessName: businessName || '',
        plan: plan || 'free',
        adminId,
      },
    });

    res.status(201).json(serializeManagedUser(managed));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create managed user' });
  }
};

// Bulk sync: the request body is the full desired list of managed users.
// Users present are upserted; users absent are deleted. Passwords are only
// (re)hashed when a plaintext password is included for that user.
export const syncManagedUsers = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const incoming: any[] = req.body.users ?? [];

    const existing = await prisma.managedUser.findMany({ where: { adminId } });
    const incomingUids = new Set(incoming.map(u => u.uid));

    // Validate every email before writing anything — no two accounts (managed
    // or primary) may share one, and the incoming payload itself can't either.
    const seenInPayload = new Set<string>();
    for (const u of incoming) {
      if (!u.email) continue;
      const normalizedEmail = normalizeEmail(u.email);

      if (seenInPayload.has(normalizedEmail)) {
        return res.status(400).json({ error: `Duplicate email in request: ${normalizedEmail}` });
      }
      seenInPayload.add(normalizedEmail);

      const existingUser = existing.find(e => e.uid === u.uid);
      const account = await findAccountByEmail(normalizedEmail);
      if (account && account.record.id !== existingUser?.id) {
        return res.status(400).json({ error: `An account with this email already exists: ${normalizedEmail}` });
      }
    }

    // Delete users no longer in the list.
    const toDelete = existing.filter(e => !incomingUids.has(e.uid));
    if (toDelete.length > 0) {
      await prisma.managedUser.deleteMany({
        where: { adminId, uid: { in: toDelete.map(e => e.uid) } },
      });
    }

    // Upsert everyone in the incoming list.
    for (const u of incoming) {
      const existingUser = existing.find(e => e.uid === u.uid);
      const data: any = {
        displayName: u.displayName,
        email: u.email ? normalizeEmail(u.email) : null,
        role: u.role || 'agent',
        permissions: u.permissions ?? undefined,
        photoURL: u.photoURL || null,
        businessName: u.businessName || '',
        plan: u.plan || 'free',
      };
      if (u.password) {
        data.password = await bcrypt.hash(u.password, await bcrypt.genSalt(10));
      }

      if (existingUser) {
        await prisma.managedUser.update({ where: { uid: u.uid }, data });
      } else {
        await prisma.managedUser.create({
          data: {
            uid: u.uid || `user_${Date.now()}`,
            ...data,
            password: data.password || (await bcrypt.hash('password123', await bcrypt.genSalt(10))),
            adminId,
          },
        });
      }
    }

    const updated = await prisma.managedUser.findMany({
      where: { adminId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(updated.map(serializeManagedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to sync managed users' });
  }
};
