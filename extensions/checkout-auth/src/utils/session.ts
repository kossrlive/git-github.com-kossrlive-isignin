import type { SessionData } from '../types';

const SESSION_KEY = 'shopify_auth_session';
const SESSION_EXPIRY_DAYS = 30;

export function saveSession(sessionData: SessionData): void {
  try {
    // Save to localStorage
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    
    // Save to cookie as backup
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SESSION_EXPIRY_DAYS);
    
    document.cookie = `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(sessionData))}; expires=${expiryDate.toUTCString()}; path=/; secure; samesite=strict`;
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

export function getSession(): SessionData | null {
  try {
    // Try localStorage first
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored) as SessionData;
      
      // Check if expired
      if (session.expiresAt > Date.now()) {
        return session;
      } else {
        // Clear expired session
        clearSession();
        return null;
      }
    }
    
    // Fallback to cookie
    const cookieValue = getCookie(SESSION_KEY);
    if (cookieValue) {
      const session = JSON.parse(decodeURIComponent(cookieValue)) as SessionData;
      
      if (session.expiresAt > Date.now()) {
        // Restore to localStorage
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
      } else {
        clearSession();
        return null;
      }
    }
    
    return null;
  } catch (err) {
    console.error('Failed to get session:', err);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = `${SESSION_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}

export function isAuthenticated(): boolean {
  const session = getSession();
  return session !== null;
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  
  return null;
}

export function createSessionData(customerId: string, email: string, token: string): SessionData {
  const expiresAt = Date.now() + (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  return {
    customerId,
    email,
    token,
    expiresAt,
  };
}

export function updateSessionExpiry(session: SessionData): SessionData {
  // Extend session expiry on activity
  const newExpiresAt = Date.now() + (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const updatedSession = {
    ...session,
    expiresAt: newExpiresAt,
  };
  
  saveSession(updatedSession);
  return updatedSession;
}

export function getSessionTimeRemaining(): number | null {
  const session = getSession();
  if (!session) return null;
  
  const remaining = session.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function isSessionExpiringSoon(thresholdHours: number = 24): boolean {
  const remaining = getSessionTimeRemaining();
  if (remaining === null) return false;
  
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return remaining < thresholdMs;
}
