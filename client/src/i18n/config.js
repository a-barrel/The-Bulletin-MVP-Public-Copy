import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import pirateCommon from './locales/pr/common.json';
import leetCommon from './locales/lx/common.json';
import emojiCommon from './locales/em/common.json';

export const LANGUAGE_STORAGE_KEY = 'pinpoint:language';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pr', label: 'Pirate (experimental)' },
  { code: 'lx', label: 'Leetspeak (demo)' },
  { code: 'em', label: 'Emoji (demo)' }
];
export const EMERGENCY_LANGUAGE = { code: 'en', label: 'Emergency English' };
export const LANGUAGE_OPTIONS = [...SUPPORTED_LANGUAGES, { ...EMERGENCY_LANGUAGE, emergency: true }];

const resources = {
  en: {
    common: enCommon
  },
  es: {
    common: esCommon
  },
  pr: {
    common: pirateCommon
  },
  lx: {
    common: leetCommon
  },
  em: {
    common: emojiCommon
  }
};

const detectionOptions = {
  order: ['localStorage', 'navigator'],
  lookupLocalStorage: LANGUAGE_STORAGE_KEY,
  caches: ['localStorage'],
  convertDetectedLanguage: (lng) => (lng ? lng.slice(0, 2) : lng)
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((language) => language.code),
    ns: ['common'],
    defaultNS: 'common',
    detection: detectionOptions,
    interpolation: {
      escapeValue: false
    },
    returnEmptyString: false
  });

const updateDocumentLanguage = (language) => {
  if (typeof document === 'undefined') {
    return;
  }
  const resolvedLanguage = language || DEFAULT_LANGUAGE;
  document.documentElement.setAttribute('lang', resolvedLanguage);
};

updateDocumentLanguage(i18n.resolvedLanguage);
i18n.on('languageChanged', updateDocumentLanguage);

export const getActiveLanguage = () => i18n.resolvedLanguage || DEFAULT_LANGUAGE;

export const setLanguage = async (language) => {
  const supported =
    SUPPORTED_LANGUAGES.some((entry) => entry.code === language) || language === EMERGENCY_LANGUAGE.code;
  const safeLanguage = supported ? language : DEFAULT_LANGUAGE;
  await i18n.changeLanguage(safeLanguage);
  updateDocumentLanguage(safeLanguage);
  return safeLanguage;
};

export default i18n;
