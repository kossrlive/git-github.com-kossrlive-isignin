export function validatePhone(phone: string): boolean {
  // E.164 format validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export function validateEmail(email: string): boolean {
  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateOTP(otp: string): boolean {
  // 6-digit OTP validation
  return /^\d{6}$/.test(otp);
}

export function formatPhoneForDisplay(phone: string): string {
  // Remove + and format for display
  return phone.replace(/^\+/, '');
}
