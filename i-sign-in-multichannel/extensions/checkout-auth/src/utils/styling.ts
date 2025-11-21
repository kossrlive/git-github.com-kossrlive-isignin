/**
 * Utility functions for applying merchant's custom styling to checkout extension
 */

export interface CustomStyling {
  primaryColor: string;
  buttonStyle: 'rounded' | 'square';
  logoUrl?: string;
}

/**
 * Fetch custom styling from the app settings
 */
export async function fetchCustomStyling(shop: string): Promise<CustomStyling | null> {
  try {
    const response = await fetch(`https://${shop}/api/settings/styling`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.styling;
    }
  } catch (err) {
    console.error('Failed to fetch custom styling:', err);
  }

  // Return default styling if fetch fails
  return {
    primaryColor: '#000000',
    buttonStyle: 'rounded',
  };
}

/**
 * Get button corner radius based on button style
 */
export function getButtonCornerRadius(buttonStyle: 'rounded' | 'square'): 'base' | 'none' {
  return buttonStyle === 'rounded' ? 'base' : 'none';
}
