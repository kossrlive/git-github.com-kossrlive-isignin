import type { AppSettings, AuthResponse, OTPResponse } from '../types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

export async function sendOTP(phone: string): Promise<OTPResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone }),
  });
  return response.json();
}

export async function verifyOTP(phone: string, otp: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, otp }),
  });
  return response.json();
}

export async function emailLogin(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/email-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function initiateOAuth(provider: string): Promise<{ authUrl: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/oauth/${provider}`);
  if (!response.ok) {
    throw new Error('Failed to initiate OAuth');
  }
  return response.json();
}

export async function restoreSession(sessionData: any): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/session/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionData),
  });
  return response.json();
}
