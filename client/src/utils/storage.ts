import { CartItem, CustomerProfile } from '../types';

const DEVICE_TOKEN_KEY = 'ch1_device_token';
const CUSTOMER_PROFILE_KEY = 'ch1_customer_profile';
const CART_STORAGE_KEY = 'ch1_cart_items';
const CART_INSTRUCTIONS_KEY = 'ch1_cart_instructions';

export const storage = {
  getDeviceToken: (): string | null => {
    try {
      return localStorage.getItem(DEVICE_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setDeviceToken: (token: string) => {
    try {
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  },

  clearDeviceToken: () => {
    try {
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_PROFILE_KEY);
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
  },

  getCustomerProfile: (): CustomerProfile | null => {
    try {
      const data = localStorage.getItem(CUSTOMER_PROFILE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCustomerProfile: (profile: CustomerProfile) => {
    try {
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Profile save error:', e);
    }
  },

  getSavedCart: (): CartItem[] => {
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCart: (items: CartItem[]) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Cart save error:', e);
    }
  },

  getSpecialInstructions: (): string => {
    try {
      return localStorage.getItem(CART_INSTRUCTIONS_KEY) || '';
    } catch {
      return '';
    }
  },

  saveSpecialInstructions: (note: string) => {
    try {
      localStorage.setItem(CART_INSTRUCTIONS_KEY, note);
    } catch (e) {
      console.warn('Instructions save error:', e);
    }
  },

  clearCart: () => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_INSTRUCTIONS_KEY);
    } catch (e) {
      console.warn('Cart clear error:', e);
    }
  }
};
