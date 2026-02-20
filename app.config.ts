import appJson from "./app.json";

const config = appJson.expo;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  // Keep this visible in CI/dev logs for easier diagnosis.
  console.warn("[app.config] GOOGLE_MAPS_API_KEY is missing. Android Google Maps may not work.");
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
