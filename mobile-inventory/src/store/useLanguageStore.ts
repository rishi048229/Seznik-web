import { create } from 'zustand';
import { LanguageCode, SUPPORTED_LANGUAGES, TRANSLATIONS } from '@/constants/translations';
import { getStoredLanguage, setStoredLanguage } from '@/services/secureStore';

export { LanguageCode, SUPPORTED_LANGUAGES, TRANSLATIONS };

interface LanguageState {
  currentLanguage: LanguageCode;
  isHydrated: boolean;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  initializeLanguage: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'en',
  isHydrated: false,

  initializeLanguage: async () => {
    try {
      const savedLang = await getStoredLanguage();
      if (savedLang && Object.prototype.hasOwnProperty.call(TRANSLATIONS, savedLang)) {
        set({ currentLanguage: savedLang as LanguageCode, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  setLanguage: async (lang: LanguageCode) => {
    set({ currentLanguage: lang });
    await setStoredLanguage(lang);
  },

  t: (key: string, fallback?: string): string => {
    const lang = get().currentLanguage;
    const currentDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    const enDict = TRANSLATIONS.en;
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  },
}));

// Automatically trigger language hydration on load
useLanguageStore.getState().initializeLanguage();
