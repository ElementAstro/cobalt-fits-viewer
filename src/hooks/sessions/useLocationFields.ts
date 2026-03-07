import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { parseGeoCoordinate } from "../../lib/sessions/format";
import { LocationService } from "./useLocation";

interface LocationValues {
  placeName?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
}

interface LocationResult {
  latitude: number;
  longitude: number;
  placeName: string;
}

interface UseLocationFieldsReturn {
  locationName: string;
  latitudeInput: string;
  longitudeInput: string;
  setLocationName: (value: string) => void;
  setLatitudeInput: (value: string) => void;
  setLongitudeInput: (value: string) => void;
  useCurrentLocation: (t: (key: string) => string) => Promise<void>;
  validateAndBuild: (t: (key: string) => string) => LocationResult | undefined | null;
  resetLocation: (initial?: LocationValues) => void;
}

export function useLocationFields(initial?: LocationValues): UseLocationFieldsReturn {
  const [locationName, setLocationName] = useState(
    initial?.placeName ?? initial?.city ?? initial?.region ?? "",
  );
  const [latitudeInput, setLatitudeInput] = useState(
    initial?.latitude != null ? String(initial.latitude) : "",
  );
  const [longitudeInput, setLongitudeInput] = useState(
    initial?.longitude != null ? String(initial.longitude) : "",
  );

  const useCurrentLocation = useCallback(async (t: (key: string) => string) => {
    const location = await LocationService.getCurrentLocation();
    if (!location) {
      Alert.alert(t("common.error"), t("sessions.locationPermissionFailed"));
      return;
    }
    setLocationName(location.placeName ?? location.city ?? location.region ?? "");
    setLatitudeInput(String(location.latitude));
    setLongitudeInput(String(location.longitude));
  }, []);

  const validateAndBuild = useCallback(
    (t: (key: string) => string): LocationResult | undefined | null => {
      const latitude = parseGeoCoordinate(latitudeInput, { min: -90, max: 90 });
      if (latitude === null) {
        Alert.alert(t("common.error"), t("sessions.invalidLatitude"));
        return null;
      }
      const longitude = parseGeoCoordinate(longitudeInput, { min: -180, max: 180 });
      if (longitude === null) {
        Alert.alert(t("common.error"), t("sessions.invalidLongitude"));
        return null;
      }

      const normalizedName = locationName.trim();
      const hasAnyField =
        normalizedName.length > 0 || latitude !== undefined || longitude !== undefined;
      if (
        hasAnyField &&
        (normalizedName.length === 0 || latitude === undefined || longitude === undefined)
      ) {
        Alert.alert(t("common.error"), t("sessions.incompleteLocation"));
        return null;
      }

      if (normalizedName.length > 0 && latitude != null && longitude != null) {
        return { latitude, longitude, placeName: normalizedName };
      }
      return undefined;
    },
    [latitudeInput, longitudeInput, locationName],
  );

  const resetLocation = useCallback((next?: LocationValues) => {
    setLocationName(next?.placeName ?? next?.city ?? next?.region ?? "");
    setLatitudeInput(next?.latitude != null ? String(next.latitude) : "");
    setLongitudeInput(next?.longitude != null ? String(next.longitude) : "");
  }, []);

  return {
    locationName,
    latitudeInput,
    longitudeInput,
    setLocationName,
    setLatitudeInput,
    setLongitudeInput,
    useCurrentLocation,
    validateAndBuild,
    resetLocation,
  };
}
