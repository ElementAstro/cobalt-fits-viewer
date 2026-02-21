export type TargetActionControlMode = "icon" | "checkbox";
export type TargetActionSizePreset = "compact" | "standard" | "accessible";

export interface ResolvedTargetInteractionUi {
  effectivePreset: TargetActionSizePreset;
  buttonSize: "sm" | "md" | "lg";
  chipSize: "sm" | "md" | "lg";
  iconSize: number;
  compactIconSize: number;
  miniIconSize: number;
}

export interface ResolveTargetInteractionUiParams {
  preset: TargetActionSizePreset;
  autoScaleFromFont: boolean;
  fontScale: number;
}

function promotePresetOnce(preset: TargetActionSizePreset): TargetActionSizePreset {
  if (preset === "compact") return "standard";
  return "accessible";
}

function resolveEffectivePreset({
  preset,
  autoScaleFromFont,
  fontScale,
}: ResolveTargetInteractionUiParams): TargetActionSizePreset {
  if (!autoScaleFromFont) return preset;

  const normalizedFontScale = Number.isFinite(fontScale) ? fontScale : 1;
  if (normalizedFontScale < 1.1) return preset;
  if (normalizedFontScale < 1.3) return promotePresetOnce(preset);
  return "accessible";
}

export function resolveTargetInteractionUi(
  params: ResolveTargetInteractionUiParams,
): ResolvedTargetInteractionUi {
  const effectivePreset = resolveEffectivePreset(params);

  switch (effectivePreset) {
    case "compact":
      return {
        effectivePreset,
        buttonSize: "sm",
        chipSize: "sm",
        iconSize: 14,
        compactIconSize: 12,
        miniIconSize: 10,
      };
    case "standard":
      return {
        effectivePreset,
        buttonSize: "md",
        chipSize: "md",
        iconSize: 16,
        compactIconSize: 14,
        miniIconSize: 12,
      };
    case "accessible":
      return {
        effectivePreset,
        buttonSize: "lg",
        chipSize: "lg",
        iconSize: 18,
        compactIconSize: 16,
        miniIconSize: 14,
      };
  }
}
