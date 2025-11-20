/**
 * Utility functions for handling post-authentication redirects
 */

export interface RedirectOptions {
  returnTo?: string;
  preserveCart?: boolean;
  cartToken?: string;
}

/**
 * Build a Multipass redirect URL with return_to parameter
 */
export function buildMultipassRedirectUrl(
  multipassUrl: string,
  options: RedirectOptions = {}
): string {
  const url = new URL(multipassUrl);
  
  if (options.returnTo) {
    url.searchParams.set('return_to', options.returnTo);
  }
  
  if (options.cartToken) {
    url.searchParams.set('cart', options.cartToken);
  }
  
  return url.toString();
}

/**
 * Get the current checkout URL to use as return_to
 */
export function getCheckoutReturnUrl(): string {
  // Get current checkout URL
  const currentUrl = window.location.href;
  
  // If we're already at checkout, return that URL
  if (currentUrl.includes('/checkout')) {
    return currentUrl;
  }
  
  // Otherwise, construct checkout URL
  const shopDomain = window.location.hostname;
  return `https://${shopDomain}/checkout`;
}

/**
 * Get cart token from current session/URL
 */
export function getCartToken(): string | null {
  // Try to get from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const cartParam = urlParams.get('cart');
  
  if (cartParam) {
    return cartParam;
  }
  
  // Try to get from localStorage
  try {
    const cartData = localStorage.getItem('cart');
    if (cartData) {
      const parsed = JSON.parse(cartData);
      return parsed.token || null;
    }
  } catch (err) {
    console.error('Failed to get cart token:', err);
  }
  
  return null;
}

/**
 * Check if cart is valid (not empty or expired)
 */
export async function isCartValid(cartToken: string): Promise<boolean> {
  try {
    // Make a request to check cart status
    const response = await fetch(`/cart.js`);
    
    if (!response.ok) {
      return false;
    }
    
    const cart = await response.json();
    
    // Check if cart has items
    return cart.item_count > 0;
  } catch (err) {
    console.error('Failed to validate cart:', err);
    return false;
  }
}

/**
 * Handle edge cases for cart during auth flow
 */
export async function handleCartEdgeCases(): Promise<{
  isValid: boolean;
  isEmpty: boolean;
  isExpired: boolean;
}> {
  try {
    const response = await fetch(`/cart.js`);
    
    if (!response.ok) {
      return {
        isValid: false,
        isEmpty: false,
        isExpired: true,
      };
    }
    
    const cart = await response.json();
    
    const isEmpty = cart.item_count === 0;
    const isExpired = false; // Shopify carts don't really expire, they just empty
    
    return {
      isValid: !isEmpty,
      isEmpty,
      isExpired,
    };
  } catch (err) {
    console.error('Failed to check cart:', err);
    return {
      isValid: false,
      isEmpty: false,
      isExpired: true,
    };
  }
}

/**
 * Redirect to checkout after successful authentication
 */
export async function redirectToCheckout(
  multipassUrl: string,
  options: RedirectOptions = {}
): Promise<void> {
  // Check cart status
  const cartStatus = await handleCartEdgeCases();
  
  if (cartStatus.isEmpty) {
    console.warn('Cart is empty, redirecting to cart page');
    window.location.href = '/cart';
    return;
  }
  
  if (!cartStatus.isValid) {
    console.warn('Cart is invalid or expired');
    // Still try to proceed, but log the issue
  }
  
  // Get return URL (checkout)
  const returnTo = options.returnTo || getCheckoutReturnUrl();
  
  // Get cart token if preserving cart
  const cartToken = options.preserveCart !== false ? getCartToken() : null;
  
  // Build final redirect URL
  const redirectUrl = buildMultipassRedirectUrl(multipassUrl, {
    returnTo,
    cartToken: cartToken || undefined,
  });
  
  // Perform redirect
  window.location.href = redirectUrl;
}

/**
 * Save current checkout state before auth
 */
export function saveCheckoutState(): void {
  try {
    const state = {
      url: window.location.href,
      timestamp: Date.now(),
      cartToken: getCartToken(),
    };
    
    sessionStorage.setItem('checkout_state', JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save checkout state:', err);
  }
}

/**
 * Restore checkout state after auth
 */
export function restoreCheckoutState(): {
  url: string;
  cartToken: string | null;
} | null {
  try {
    const stored = sessionStorage.getItem('checkout_state');
    
    if (!stored) {
      return null;
    }
    
    const state = JSON.parse(stored);
    
    // Check if state is not too old (5 minutes)
    const age = Date.now() - state.timestamp;
    if (age > 5 * 60 * 1000) {
      sessionStorage.removeItem('checkout_state');
      return null;
    }
    
    return {
      url: state.url,
      cartToken: state.cartToken,
    };
  } catch (err) {
    console.error('Failed to restore checkout state:', err);
    return null;
  }
}
