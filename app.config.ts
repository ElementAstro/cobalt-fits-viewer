import appJson from "./app.json";

const config = appJson.expo;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

type GlobalAppConfigWarnings = typeof globalThis & {
  __cobaltAppConfigMissingEnvWarned?: Set<string>;
};

function warnMissingEnvOnce(envKey: string, message: string): void {
  const globalWithWarnings = globalThis as GlobalAppConfigWarnings;
  const warnedKeys = (globalWithWarnings.__cobaltAppConfigMissingEnvWarned ??= new Set<string>());
  if (warnedKeys.has(envKey)) return;

  warnedKeys.add(envKey);
  console.warn(message);
}

if (!googleMapsApiKey) {
  // Keep this visible in CI/dev logs for easier diagnosis.
  warnMissingEnvOnce(
    "GOOGLE_MAPS_API_KEY",
    "[app.config] GOOGLE_MAPS_API_KEY is missing. Android Google Maps may not work.",
  );
}

export default {
  ...config,
  android: {
    ...config.android,
    config: {
      ...((config.android as { config?: object } | undefined)?.config ?? {}),
      googleMaps: {
        ...(config.android as { config?: { googleMaps?: { apiKey?: string } } } | undefined)?.config
          ?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  },
};
