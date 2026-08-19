import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'seznik_auth_token';
const USER_KEY = 'seznik_user_data';

export async function setAuthToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(TOKEN_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error reading auth token:', error);
    return null;
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
}

export async function setStoredUser(user: any): Promise<void> {
  try {
    const json = JSON.stringify(user);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_KEY, json);
      }
    } else {
      await SecureStore.setItemAsync(USER_KEY, json);
    }
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

export async function getStoredUser<T>(): Promise<T | null> {
  try {
    let json: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        json = window.localStorage.getItem(USER_KEY);
      }
    } else {
      json = await SecureStore.getItemAsync(USER_KEY);
    }
    return json ? (JSON.parse(json) as T) : null;
  } catch (error) {
    console.error('Error reading user data:', error);
    return null;
  }
}

export async function removeStoredUser(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (error) {
    console.error('Error deleting user data:', error);
  }
}

const LANGUAGE_KEY = 'seznik_app_language';
const TEMPLATE_KEY = 'seznik_active_template_id';

export async function setStoredLanguage(lang: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LANGUAGE_KEY, lang);
      }
    } else {
      await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
    }
  } catch (error) {
    console.error('Error saving language:', error);
  }
}

export async function getStoredLanguage(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(LANGUAGE_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch (error) {
    console.error('Error reading language:', error);
    return null;
  }
}

export async function setStoredActiveTemplate(templateId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TEMPLATE_KEY, templateId);
      }
    } else {
      await SecureStore.setItemAsync(TEMPLATE_KEY, templateId);
    }
  } catch (error) {
    console.error('Error saving active template:', error);
  }
}

export async function getStoredActiveTemplate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(TEMPLATE_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(TEMPLATE_KEY);
  } catch (error) {
    console.error('Error reading active template:', error);
    return null;
  }
}

const CUSTOM_RECEIPT_TEMPLATES_KEY = 'seznik_custom_receipt_templates';
const ACTIVE_CUSTOM_RECEIPT_KEY = 'seznik_active_custom_receipt';
const ENABLE_BILL_QR_KEY = 'seznik_enable_bill_qr';

export async function getStoredCustomReceiptTemplates(): Promise<any[] | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(CUSTOM_RECEIPT_TEMPLATES_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(CUSTOM_RECEIPT_TEMPLATES_KEY);
    }
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error reading custom receipt templates:', error);
    return null;
  }
}

export async function setStoredCustomReceiptTemplates(templates: any[]): Promise<void> {
  try {
    const raw = JSON.stringify(templates);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CUSTOM_RECEIPT_TEMPLATES_KEY, raw);
      }
    } else {
      await SecureStore.setItemAsync(CUSTOM_RECEIPT_TEMPLATES_KEY, raw);
    }
  } catch (error) {
    console.error('Error saving custom receipt templates:', error);
  }
}

export async function getStoredActiveCustomReceiptTemplate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_CUSTOM_RECEIPT_KEY) : null;
    }
    return await SecureStore.getItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY);
  } catch (error) {
    console.error('Error reading active custom receipt template id:', error);
    return null;
  }
}

export async function setStoredActiveCustomReceiptTemplate(id: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (id) window.localStorage.setItem(ACTIVE_CUSTOM_RECEIPT_KEY, id);
        else window.localStorage.removeItem(ACTIVE_CUSTOM_RECEIPT_KEY);
      }
    } else {
      if (id) await SecureStore.setItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY, id);
      else await SecureStore.deleteItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY);
    }
  } catch (error) {
    console.error('Error saving active custom receipt template id:', error);
  }
}

export async function getStoredEnableBillQr(): Promise<boolean> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(ENABLE_BILL_QR_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(ENABLE_BILL_QR_KEY);
    }
    return raw !== null ? raw === 'true' : true; // default true
  } catch {
    return true;
  }
}

export async function setStoredEnableBillQr(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ENABLE_BILL_QR_KEY, enabled ? 'true' : 'false');
      }
    } else {
      await SecureStore.setItemAsync(ENABLE_BILL_QR_KEY, enabled ? 'true' : 'false');
    }
  } catch (error) {
    console.error('Error saving enable bill qr setting:', error);
  }
}



