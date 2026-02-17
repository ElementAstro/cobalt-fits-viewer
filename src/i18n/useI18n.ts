import { useCallback, useSyncExternalStore } from "react";
import i18n, { getI18nLocale, setI18nLocale, subscribeI18nChange } from "./index";

type TranslateOptions = Parameters<typeof i18n.t>[1];

function getSnapshot() {
  return getI18nLocale();
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribeI18nChange, getSnapshot);

  const t = useCallback(
    (scope: string, options?: TranslateOptions) => i18n.t(scope, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const setLocale = useCallback((newLocale: string) => {
    setI18nLocale(newLocale);
  }, []);

  return { t, locale, setLocale };
}
