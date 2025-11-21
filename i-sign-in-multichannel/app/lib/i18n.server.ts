/**
 * Internationalization (i18n) utility for multi-language support
 * Supports: English (en), Spanish (es), French (fr), German (de)
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de';

export interface Translations {
  // Login form labels and buttons
  loginForm: {
    title: string;
    phoneLabel: string;
    phonePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    sendCodeButton: string;
    verifyCodeButton: string;
    loginButton: string;
    orDivider: string;
    googleButton: string;
    appleButton: string;
    facebookButton: string;
    codeLabel: string;
    codePlaceholder: string;
    resendCode: string;
  };
  
  // Error messages
  errors: {
    invalidCode: string;
    codeExpired: string;
    tooManyAttempts: string;
    smsFailure: string;
    invalidPhone: string;
    invalidEmail: string;
    invalidCredentials: string;
    accountBlocked: string;
    requiredField: string;
    genericError: string;
  };
  
  // SMS message templates
  sms: {
    otpMessage: string; // Template: "Your verification code is: {code}"
    orderConfirmation: string; // Template: "Thank you for your order! Order #{number} - Total: ${total}"
  };
  
  // Success messages
  success: {
    codeSent: string;
    loginSuccess: string;
  };
}

const translations: Record<SupportedLanguage, Translations> = {
  en: {
    loginForm: {
      title: 'Sign In',
      phoneLabel: 'Phone Number',
      phonePlaceholder: '+1234567890',
      emailLabel: 'Email',
      emailPlaceholder: 'your@email.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      sendCodeButton: 'Send Code',
      verifyCodeButton: 'Verify Code',
      loginButton: 'Log In',
      orDivider: 'or',
      googleButton: 'Continue with Google',
      appleButton: 'Continue with Apple',
      facebookButton: 'Continue with Facebook',
      codeLabel: 'Verification Code',
      codePlaceholder: '123456',
      resendCode: 'Resend Code',
    },
    errors: {
      invalidCode: 'Invalid code. Please try again.',
      codeExpired: 'Code expired. Request a new one.',
      tooManyAttempts: 'Too many attempts. Please try again later.',
      smsFailure: 'Unable to send SMS. Please try another method.',
      invalidPhone: 'Invalid phone number format.',
      invalidEmail: 'Invalid email address.',
      invalidCredentials: 'Invalid email or password.',
      accountBlocked: 'Account temporarily blocked. Please try again in 15 minutes.',
      requiredField: 'This field is required.',
      genericError: 'An error occurred. Please try again.',
    },
    sms: {
      otpMessage: 'Your verification code is: {code}',
      orderConfirmation: 'Thank you for your order! Order #{number} - Total: ${total}. We\'ll notify you when it ships.',
    },
    success: {
      codeSent: 'Verification code sent successfully.',
      loginSuccess: 'Login successful!',
    },
  },
  
  es: {
    loginForm: {
      title: 'Iniciar Sesión',
      phoneLabel: 'Número de Teléfono',
      phonePlaceholder: '+1234567890',
      emailLabel: 'Correo Electrónico',
      emailPlaceholder: 'tu@correo.com',
      passwordLabel: 'Contraseña',
      passwordPlaceholder: 'Ingresa tu contraseña',
      sendCodeButton: 'Enviar Código',
      verifyCodeButton: 'Verificar Código',
      loginButton: 'Iniciar Sesión',
      orDivider: 'o',
      googleButton: 'Continuar con Google',
      appleButton: 'Continuar con Apple',
      facebookButton: 'Continuar con Facebook',
      codeLabel: 'Código de Verificación',
      codePlaceholder: '123456',
      resendCode: 'Reenviar Código',
    },
    errors: {
      invalidCode: 'Código inválido. Por favor, inténtalo de nuevo.',
      codeExpired: 'Código expirado. Solicita uno nuevo.',
      tooManyAttempts: 'Demasiados intentos. Por favor, inténtalo más tarde.',
      smsFailure: 'No se pudo enviar el SMS. Por favor, prueba otro método.',
      invalidPhone: 'Formato de número de teléfono inválido.',
      invalidEmail: 'Dirección de correo electrónico inválida.',
      invalidCredentials: 'Correo electrónico o contraseña inválidos.',
      accountBlocked: 'Cuenta bloqueada temporalmente. Por favor, inténtalo en 15 minutos.',
      requiredField: 'Este campo es obligatorio.',
      genericError: 'Ocurrió un error. Por favor, inténtalo de nuevo.',
    },
    sms: {
      otpMessage: 'Tu código de verificación es: {code}',
      orderConfirmation: '¡Gracias por tu pedido! Pedido #{number} - Total: ${total}. Te notificaremos cuando se envíe.',
    },
    success: {
      codeSent: 'Código de verificación enviado exitosamente.',
      loginSuccess: '¡Inicio de sesión exitoso!',
    },
  },
  
  fr: {
    loginForm: {
      title: 'Se Connecter',
      phoneLabel: 'Numéro de Téléphone',
      phonePlaceholder: '+1234567890',
      emailLabel: 'Email',
      emailPlaceholder: 'votre@email.com',
      passwordLabel: 'Mot de Passe',
      passwordPlaceholder: 'Entrez votre mot de passe',
      sendCodeButton: 'Envoyer le Code',
      verifyCodeButton: 'Vérifier le Code',
      loginButton: 'Se Connecter',
      orDivider: 'ou',
      googleButton: 'Continuer avec Google',
      appleButton: 'Continuer avec Apple',
      facebookButton: 'Continuer avec Facebook',
      codeLabel: 'Code de Vérification',
      codePlaceholder: '123456',
      resendCode: 'Renvoyer le Code',
    },
    errors: {
      invalidCode: 'Code invalide. Veuillez réessayer.',
      codeExpired: 'Code expiré. Demandez-en un nouveau.',
      tooManyAttempts: 'Trop de tentatives. Veuillez réessayer plus tard.',
      smsFailure: 'Impossible d\'envoyer le SMS. Veuillez essayer une autre méthode.',
      invalidPhone: 'Format de numéro de téléphone invalide.',
      invalidEmail: 'Adresse email invalide.',
      invalidCredentials: 'Email ou mot de passe invalide.',
      accountBlocked: 'Compte temporairement bloqué. Veuillez réessayer dans 15 minutes.',
      requiredField: 'Ce champ est obligatoire.',
      genericError: 'Une erreur s\'est produite. Veuillez réessayer.',
    },
    sms: {
      otpMessage: 'Votre code de vérification est: {code}',
      orderConfirmation: 'Merci pour votre commande! Commande #{number} - Total: ${total}. Nous vous informerons lors de l\'expédition.',
    },
    success: {
      codeSent: 'Code de vérification envoyé avec succès.',
      loginSuccess: 'Connexion réussie!',
    },
  },
  
  de: {
    loginForm: {
      title: 'Anmelden',
      phoneLabel: 'Telefonnummer',
      phonePlaceholder: '+1234567890',
      emailLabel: 'E-Mail',
      emailPlaceholder: 'ihre@email.com',
      passwordLabel: 'Passwort',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      sendCodeButton: 'Code Senden',
      verifyCodeButton: 'Code Überprüfen',
      loginButton: 'Anmelden',
      orDivider: 'oder',
      googleButton: 'Mit Google Fortfahren',
      appleButton: 'Mit Apple Fortfahren',
      facebookButton: 'Mit Facebook Fortfahren',
      codeLabel: 'Bestätigungscode',
      codePlaceholder: '123456',
      resendCode: 'Code Erneut Senden',
    },
    errors: {
      invalidCode: 'Ungültiger Code. Bitte versuchen Sie es erneut.',
      codeExpired: 'Code abgelaufen. Fordern Sie einen neuen an.',
      tooManyAttempts: 'Zu viele Versuche. Bitte versuchen Sie es später erneut.',
      smsFailure: 'SMS konnte nicht gesendet werden. Bitte versuchen Sie eine andere Methode.',
      invalidPhone: 'Ungültiges Telefonnummernformat.',
      invalidEmail: 'Ungültige E-Mail-Adresse.',
      invalidCredentials: 'Ungültige E-Mail oder Passwort.',
      accountBlocked: 'Konto vorübergehend gesperrt. Bitte versuchen Sie es in 15 Minuten erneut.',
      requiredField: 'Dieses Feld ist erforderlich.',
      genericError: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    },
    sms: {
      otpMessage: 'Ihr Bestätigungscode lautet: {code}',
      orderConfirmation: 'Vielen Dank für Ihre Bestellung! Bestellung #{number} - Gesamt: ${total}. Wir benachrichtigen Sie, wenn sie versendet wird.',
    },
    success: {
      codeSent: 'Bestätigungscode erfolgreich gesendet.',
      loginSuccess: 'Anmeldung erfolgreich!',
    },
  },
};

/**
 * Detects the browser language from Accept-Language header
 * Returns a supported language code or 'en' as default
 */
export function detectLanguage(acceptLanguageHeader?: string | null): SupportedLanguage {
  if (!acceptLanguageHeader) {
    return 'en';
  }
  
  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
  const languages = acceptLanguageHeader
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';');
      const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0;
      return { code: code.split('-')[0].toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality);
  
  // Find first supported language
  for (const lang of languages) {
    if (isSupportedLanguage(lang.code)) {
      return lang.code as SupportedLanguage;
    }
  }
  
  // Default to English
  return 'en';
}

/**
 * Checks if a language code is supported
 */
export function isSupportedLanguage(code: string): boolean {
  return ['en', 'es', 'fr', 'de'].includes(code);
}

/**
 * Gets translations for a specific language
 * Defaults to English if language is not supported
 */
export function getTranslations(language: string): Translations {
  const lang = isSupportedLanguage(language) ? (language as SupportedLanguage) : 'en';
  return translations[lang];
}

/**
 * Formats an SMS OTP message with the code
 */
export function formatOTPMessage(code: string, language: string = 'en'): string {
  const t = getTranslations(language);
  return t.sms.otpMessage.replace('{code}', code);
}

/**
 * Formats an order confirmation SMS message
 */
export function formatOrderConfirmationMessage(
  orderNumber: string,
  total: string,
  language: string = 'en'
): string {
  const t = getTranslations(language);
  return t.sms.orderConfirmation
    .replace('{number}', orderNumber)
    .replace('${total}', total);
}

/**
 * Gets all supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['en', 'es', 'fr', 'de'];
}
