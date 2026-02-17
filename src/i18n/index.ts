import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import { en, zh } from "./locales";

const i18n = new I18n({ en, zh });
const SUPPORTED_LOCALES = ["en", "zh"] as const;

type I18nLocale = (typeof SUPPORTED_LOCALES)[number];

i18n.defaultLocale = "en";
i18n.enableFallback = true;

function normalizeLocale(locale: string | undefined | null): I18nLocale {
  if (!locale) return "en";
  return SUPPORTED_LOCALES.includes(locale as I18nLocale) ? (locale as I18nLocale) : "en";
}

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getI18nLocale() {
  return normalizeLocale(i18n.locale);
}

export function setI18nLocale(locale: string, shouldEmit = true) {
  const normalized = normalizeLocale(locale);
  if (i18n.locale === normalized) return normalized;
  i18n.locale = normalized;
  if (shouldEmit) {
    emitChange();
  }
  return normalized;
}

export function subscribeI18nChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const deviceLanguage = normalizeLocale(getLocales()[0]?.languageCode);
i18n.locale = deviceLanguage;

export default i18n;
