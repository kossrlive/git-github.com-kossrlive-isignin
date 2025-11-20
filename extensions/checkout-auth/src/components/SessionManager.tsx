import { useEffect, useState } from 'react';
import type { SessionData } from '../types';
import { restoreSession } from '../utils/api';
import {
    clearSession,
    getSession,
    isSessionExpiringSoon,
    saveSession,
    updateSessionExpiry,
} from '../utils/session';

interface SessionManagerProps {
  onSessionRestored?: (session: SessionData) => void;
  onSessionExpired?: () => void;
  onSessionError?: (error: Error) => void;
}

export function useSessionManager({
  onSessionRestored,
  onSessionExpired,
  onSessionError,
}: SessionManagerProps = {}) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    autoRestoreSession();
    
    // Set up periodic session check
    const interval = setInterval(() => {
      checkSessionValidity();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  async function autoRestoreSession() {
    setIsRestoring(true);

    try {
      const storedSession = getSession();
      
      if (!storedSession) {
        setIsRestoring(false);
        return;
      }

      // Validate session with backend
      const result = await restoreSession(storedSession);
      
      if (result.success) {
        // Session is valid, update expiry
        const updatedSession = updateSessionExpiry(storedSession);
        setSession(updatedSession);
        
        if (onSessionRestored) {
          onSessionRestored(updatedSession);
        }
      } else {
        // Session invalid, clear it
        clearSession();
        setSession(null);
        
        if (onSessionExpired) {
          onSessionExpired();
        }
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
      clearSession();
      setSession(null);
      
      if (onSessionError) {
        onSessionError(error as Error);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  function checkSessionValidity() {
    const currentSession = getSession();
    
    if (!currentSession) {
      if (session) {
        // Session was cleared
        setSession(null);
        if (onSessionExpired) {
          onSessionExpired();
        }
      }
      return;
    }

    // Check if session is expiring soon and refresh it
    if (isSessionExpiringSoon(24)) {
      updateSessionExpiry(currentSession);
    }

    setSession(currentSession);
  }

  function updateSession(newSession: SessionData) {
    saveSession(newSession);
    setSession(newSession);
  }

  function destroySession() {
    clearSession();
    setSession(null);
    
    if (onSessionExpired) {
      onSessionExpired();
    }
  }

  return {
    session,
    isRestoring,
    isAuthenticated: session !== null,
    updateSession,
    destroySession,
    refreshSession: autoRestoreSession,
  };
}
