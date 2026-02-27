# How to Add a New Screen

A concise guide for adding a new screen to the application using Expo Router, Zustand stores, and i18n.

1. **Create Route File:** Add file in `src/app/` following Expo Router conventions. Use `[id]` for dynamic routes (e.g., `src/app/newfeature/[id].tsx`).

2. **Add Layout (Optional):** If screen needs a stack navigator, create `_layout.tsx` in the folder (e.g., `src/app/newfeature/_layout.tsx`).

3. **Consume Stores:** Import relevant stores from `src/stores/`:

   ```typescript
   import { useFitsStore } from "@/stores/useFitsStore";
   import { useSettingsStore } from "@/stores/useSettingsStore";
   ```

4. **Add Translations:** Add keys to both `src/i18n/locales/en.ts` and `src/i18n/locales/zh.ts` under appropriate namespace.

5. **Use i18n in Component:**

   ```typescript
   const { t } = useI18n();
   // Use: t("newfeature.title")
   ```

6. **Verify:** Run `pnpm typecheck` and ensure no errors. Test navigation to the new route.
