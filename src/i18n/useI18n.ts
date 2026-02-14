import { useCallback, useSyncExternalStore } from "react";
import i18n from "./index";

type TranslateOptions = Parameters<typeof i18n.t>[1];

let listeners: (() => void)[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return i18n.locale;
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot);

  const t = useCallback(
    (scope: string, options?: TranslateOptions) => i18n.t(scope, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const setLocale = useCallback((newLocale: string) => {
    i18n.locale = newLocale;
    emitChange();
  }, []);

  return { t, locale, setLocale };
}
