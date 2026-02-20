import { useState, useCallback } from "react";

export type SettingsPickerType =
  | "stretch"
  | "colormap"
  | "gridColumns"
  | "thumbQuality"
  | "thumbSize"
  | "sessionGap"
  | "exportFormat"
  | "theme"
  | "themeColorMode"
  | "language"
  | "fontFamily"
  | "monoFont"
  | "reminder"
  | "histogramMode"
  | "histogramHeight"
  | "pixelDecimals"
  | "gallerySortBy"
  | "gallerySortOrder"
  | "stackMethod"
  | "alignmentMode"
  | "stackingDetectionProfile"
  | "debounce"
  | "fileListStyle"
  | "converterFormat"
  | "batchNamingRule"
  | "editorMaxUndo"
  | "timelineGrouping"
  | "targetSortBy"
  | "targetSortOrder"
  | "composePreset"
  | "advancedComposeRegistration"
  | "advancedComposeFraming"
  | "videoProfile"
  | "videoTargetPreset"
  | "imageProcessingProfile"
  | "orientation"
  | "mapPreset"
  | "gridColor"
  | "crosshairColor"
  | null;

export function useSettingsPicker() {
  const [activePicker, setActivePicker] = useState<SettingsPickerType>(null);

  const openPicker = useCallback((type: SettingsPickerType) => {
    setActivePicker(type);
  }, []);

  const closePicker = useCallback(() => {
    setActivePicker(null);
  }, []);

  const isActive = useCallback((type: SettingsPickerType) => activePicker === type, [activePicker]);

  return {
    activePicker,
    openPicker,
    closePicker,
    isActive,
  };
}
