import { create } from 'zustand';
import { LanguageCode, SUPPORTED_LANGUAGES, TRANSLATIONS } from '@/constants/translations';

export { LanguageCode, SUPPORTED_LANGUAGES };

interface LanguageState {
  currentLanguage: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'en',
  setLanguage: (lang: LanguageCode) => {
    set({ currentLanguage: lang });
  },
  t: (key: string) => {
    const lang = get().currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  },
}));
