import { useMemo } from "react";
import { useI18n } from "../i18n/useI18n";
import { getFrameTypeDefinitions } from "../lib/gallery/frameClassifier";
import type { FrameClassificationConfig } from "../lib/fits/types";

export function useFrameTypeLabelMap(config: FrameClassificationConfig): Map<string, string> {
  const { t } = useI18n();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const definition of getFrameTypeDefinitions(config)) {
      map.set(
        definition.key,
        definition.builtin
          ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
          : definition.label || definition.key,
      );
    }
    return map;
  }, [config, t]);
}
