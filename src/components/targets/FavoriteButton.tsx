import { Button, Checkbox, ControlField, Label, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  ResolvedTargetInteractionUi,
  TargetActionControlMode,
} from "../../lib/targets/targetInteractionUi";
import { resolveTargetInteractionUi } from "../../lib/targets/targetInteractionUi";

interface TargetBinaryToggleProps {
  isSelected: boolean;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  activeColor: string;
  onToggle: () => void;
  mode?: TargetActionControlMode;
  interactionUi?: ResolvedTargetInteractionUi;
  testID?: string;
}

function stopEventPropagation(event: unknown) {
  if (event && typeof event === "object" && "stopPropagation" in event) {
    const stopPropagation = (event as { stopPropagation?: () => void }).stopPropagation;
    stopPropagation?.();
  }
}

function TargetBinaryToggle({
  isSelected,
  label,
  activeIcon,
  inactiveIcon,
  activeColor,
  onToggle,
  mode = "icon",
  interactionUi = resolveTargetInteractionUi({
    preset: "standard",
    autoScaleFromFont: true,
    fontScale: 1,
  }),
  testID,
}: TargetBinaryToggleProps) {
  const mutedColor = useThemeColor("muted");
  const labelClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-sm text-foreground"
      : interactionUi.effectivePreset === "standard"
        ? "text-xs text-foreground"
        : "text-[11px] text-foreground";

  if (mode === "checkbox") {
    return (
      <ControlField
        testID={testID}
        className="flex-row items-center gap-2 rounded-lg px-2 py-1"
        isSelected={isSelected}
        onSelectedChange={() => onToggle()}
        onPress={(event) => stopEventPropagation(event)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={label}
      >
        <ControlField.Indicator>
          <Checkbox />
        </ControlField.Indicator>
        <Label className={labelClassName}>{label}</Label>
      </ControlField>
    );
  }

  return (
    <Button
      testID={testID}
      size={interactionUi.buttonSize}
      isIconOnly
      variant="outline"
      onPress={(event) => {
        stopEventPropagation(event);
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={isSelected ? activeIcon : inactiveIcon}
        size={interactionUi.iconSize}
        color={isSelected ? activeColor : mutedColor}
      />
    </Button>
  );
}

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  mode?: TargetActionControlMode;
  interactionUi?: ResolvedTargetInteractionUi;
  label?: string;
  testID?: string;
}

export function FavoriteButton({
  isFavorite,
  onToggleFavorite,
  mode,
  interactionUi,
  label = "Favorite",
  testID,
}: FavoriteButtonProps) {
  const warningColor = useThemeColor("warning");

  return (
    <TargetBinaryToggle
      isSelected={isFavorite}
      label={label}
      activeIcon="star"
      inactiveIcon="star-outline"
      activeColor={warningColor}
      onToggle={onToggleFavorite}
      mode={mode}
      interactionUi={interactionUi}
      testID={testID}
    />
  );
}

interface PinButtonProps {
  isPinned: boolean;
  onTogglePinned: () => void;
  mode?: TargetActionControlMode;
  interactionUi?: ResolvedTargetInteractionUi;
  label?: string;
  testID?: string;
}

export function PinButton({
  isPinned,
  onTogglePinned,
  mode,
  interactionUi,
  label = "Pinned",
  testID,
}: PinButtonProps) {
  const accentColor = useThemeColor("accent");

  return (
    <TargetBinaryToggle
      isSelected={isPinned}
      label={label}
      activeIcon="pin"
      inactiveIcon="pin-outline"
      activeColor={accentColor}
      onToggle={onTogglePinned}
      mode={mode}
      interactionUi={interactionUi}
      testID={testID}
    />
  );
}
