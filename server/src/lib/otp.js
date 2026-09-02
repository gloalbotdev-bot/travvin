import crypto from 'node:crypto';

/** Six-digit OTP (faithful to Register.jsx InputOTP maxLength=6). */
export function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function saveOtp(prisma, email, code, purpose = 'register') {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.otpCode.deleteMany({ where: { email, purpose } });
  await prisma.otpCode.create({
    data: { email: email.toLowerCase(), code, purpose, expiresAt },
  });
}

export async function verifyOtpCode(prisma, email, code, purpose = 'register') {
  const row = await prisma.otpCode.findFirst({
    where: {
      email: email.toLowerCase(),
      code,
      purpose,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return false;
  await prisma.otpCode.delete({ where: { id: row.id } });
  return true;
}

function allowConsoleOtp() {
  const flag = process.env.ALLOW_CONSOLE_OTP;
  if (flag === '1' || flag === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

/** SEC-016 — never log secrets in production unless ALLOW_CONSOLE_OTP=1 (Render-safe). */
export function deliverOtp(email, code, purpose) {
  if (process.env.SMTP_HOST) {
    // Milestone 15 / ops: wire nodemailer when SMTP_* env is set.
    console.log(`[otp] SMTP not wired yet — would email ${email}`);
  }
  if (allowConsoleOtp()) {
    console.log(`[otp] ${purpose} for ${email}: ${code}`);
  } else {
    console.log(
      `[otp] ${purpose} for ${email} (code withheld — set ALLOW_CONSOLE_OTP=1 or configure SMTP)`,
    );
  }
}

export function deliverResetLink(email, token) {
  if (allowConsoleOtp()) {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${base}/reset-password?token=${token}`;
    console.log(`[password-reset] ${email}: ${url}`);
  } else {
    console.log(
      `[password-reset] link generated for ${email} (withheld — set ALLOW_CONSOLE_OTP=1 or SMTP)`,
    );
  }
}
