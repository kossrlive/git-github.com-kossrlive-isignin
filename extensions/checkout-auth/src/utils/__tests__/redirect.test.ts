import fc from 'fast-check';
import {
    buildMultipassRedirectUrl,
    getCartToken,
    getCheckoutReturnUrl,
    restoreCheckoutState,
    saveCheckoutState
} from '../redirect';

/**
 * Feature: shopify-sms-auth, Property 34: Post-auth checkout redirect
 * Validates: Requirements 15.5
 */
describe('Property 34: Post-auth checkout redirect', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset window.location
    delete (window as any).location;
    window.location = {
      href: 'https://test-store.myshopify.com/checkout',
      hostname: 'test-store.myshopify.com',
      search: '',
    } as any;
  });

  it('should preserve cart contents during auth flow', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 50 }), // cartToken
        fc.webUrl(), // multipassUrl
        (cartToken, multipassUrl) => {
          // Save cart token to localStorage
          localStorage.setItem('cart', JSON.stringify({ token: cartToken }));
          
          // Build redirect URL
          const redirectUrl = buildMultipassRedirectUrl(multipassUrl, {
            preserveCart: true,
            cartToken,
          });
          
          // Verify cart token is in the URL
          const url = new URL(redirectUrl);
          const cartParam = url.searchParams.get('cart');
          
          // Property: Cart token should be preserved in redirect URL
          expect(cartParam).toBe(cartToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include return_to URL in multipass redirect', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // multipassUrl
        fc.webUrl(), // returnToUrl
        (multipassUrl, returnToUrl) => {
          // Build redirect URL with return_to
          const redirectUrl = buildMultipassRedirectUrl(multipassUrl, {
            returnTo: returnToUrl,
          });
          
          const url = new URL(redirectUrl);
          const returnTo = url.searchParams.get('return_to');
          
          // Property: return_to should be preserved in redirect URL
          expect(returnTo).toBe(returnToUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should save and restore checkout state correctly', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // checkoutUrl
        fc.string({ minLength: 10, maxLength: 50 }), // cartToken
        (checkoutUrl, cartToken) => {
          // Set up window location
          (window.location as any).href = checkoutUrl;
          
          // Save cart token
          localStorage.setItem('cart', JSON.stringify({ token: cartToken }));
          
          // Save checkout state
          saveCheckoutState();
          
          // Restore checkout state
          const restored = restoreCheckoutState();
          
          // Property: Restored state should match saved state
          expect(restored).not.toBeNull();
          expect(restored?.url).toBe(checkoutUrl);
          expect(restored?.cartToken).toBe(cartToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle checkout state expiration', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // checkoutUrl
        fc.string({ minLength: 10, maxLength: 50 }), // cartToken
        (checkoutUrl, cartToken) => {
          // Set up window location
          (window.location as any).href = checkoutUrl;
          
          // Save cart token
          localStorage.setItem('cart', JSON.stringify({ token: cartToken }));
          
          // Save checkout state with old timestamp
          const oldState = {
            url: checkoutUrl,
            timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
            cartToken,
          };
          sessionStorage.setItem('checkout_state', JSON.stringify(oldState));
          
          // Try to restore
          const restored = restoreCheckoutState();
          
          // Property: Expired state should return null
          expect(restored).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should get checkout return URL correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'https://test-store.myshopify.com/checkout',
          'https://test-store.myshopify.com/cart',
          'https://test-store.myshopify.com/products/test'
        ),
        (currentUrl) => {
          // Set current URL
          (window.location as any).href = currentUrl;
          
          // Get return URL
          const returnUrl = getCheckoutReturnUrl();
          
          // Property: Return URL should always point to checkout
          expect(returnUrl).toContain('/checkout');
          expect(returnUrl).toContain('test-store.myshopify.com');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extract cart token from URL or localStorage', () => {
    fc.assert(
      fc.property(
        // Generate realistic cart tokens (alphanumeric + hyphens/underscores)
        fc.stringMatching(/^[a-zA-Z0-9_-]{10,50}$/),
        fc.boolean(), // useUrl
        (cartToken, useUrl) => {
          // Clear state before each property test iteration
          localStorage.clear();
          (window.location as any).search = '';
          
          if (useUrl) {
            // Put cart token in URL
            (window.location as any).search = `?cart=${cartToken}`;
          } else {
            // Put cart token in localStorage
            localStorage.setItem('cart', JSON.stringify({ token: cartToken }));
          }
          
          // Get cart token
          const extracted = getCartToken();
          
          // Property: Cart token should be extracted correctly
          expect(extracted).toBe(cartToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should build valid multipass redirect URLs', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // multipassUrl
        fc.option(fc.webUrl(), { nil: undefined }), // returnTo
        fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: undefined }), // cartToken
        (multipassUrl, returnTo, cartToken) => {
          // Build redirect URL
          const redirectUrl = buildMultipassRedirectUrl(multipassUrl, {
            returnTo,
            cartToken,
          });
          
          // Property: Result should be a valid URL
          expect(() => new URL(redirectUrl)).not.toThrow();
          
          // Property: Base URL should be preserved
          const originalUrl = new URL(multipassUrl);
          const resultUrl = new URL(redirectUrl);
          expect(resultUrl.origin).toBe(originalUrl.origin);
          expect(resultUrl.pathname).toBe(originalUrl.pathname);
          
          // Property: Parameters should be added correctly
          if (returnTo) {
            expect(resultUrl.searchParams.get('return_to')).toBe(returnTo);
          }
          if (cartToken) {
            expect(resultUrl.searchParams.get('cart')).toBe(cartToken);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
