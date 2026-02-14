import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import { en, zh } from "./locales";

const i18n = new I18n({ en, zh });

i18n.defaultLocale = "en";
i18n.enableFallback = true;

const deviceLanguage = getLocales()[0]?.languageCode ?? "en";
i18n.locale = deviceLanguage;

export default i18n;
