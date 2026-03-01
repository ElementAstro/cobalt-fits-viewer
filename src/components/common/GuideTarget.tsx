/**
 * GuideTarget
 *
 * Wraps a target UI element with a heroui-native Popover-based tooltip guide.
 * When the current guide step matches this target, a bubble tooltip is shown
 * with a dimmed overlay and arrow pointing to the element.
 *
 * When the guide is inactive or this step is not active, renders children only
 * with zero overhead.
 */

import { type ReactNode } from "react";
import { View, Text } from "react-native";
import { Button, Popover, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { useGuideStep } from "../../hooks/useTooltipGuide";

interface GuideTargetProps {
  name: string;
  page: string;
  order: number;
  children: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export function GuideTarget({ name: _name, page, order, children, placement }: GuideTargetProps) {
  const { t } = useI18n();
  const { isActive, stepConfig, currentStep, totalSteps, isLastStep, next, skipAll } = useGuideStep(
    page,
    order,
  );
  const [accentColor] = useThemeColor(["success"]);

  if (!isActive || !stepConfig) {
    return <>{children}</>;
  }

  const resolvedPlacement = placement ?? stepConfig.placement;

  return (
    <Popover isOpen onOpenChange={() => {}}>
      <Popover.Trigger asChild>
        <View
          style={{
            borderWidth: 2,
            borderColor: accentColor,
            borderRadius: 12,
            borderStyle: "dashed",
          }}
        >
          {children}
        </View>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Overlay className="bg-black/50" closeOnPress={false} />
        <Popover.Content
          presentation="popover"
          placement={resolvedPlacement}
          width={280}
          className="rounded-xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <Popover.Title>{t(stepConfig.titleKey)}</Popover.Title>
          <Popover.Description>{t(stepConfig.descKey)}</Popover.Description>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {currentStep + 1} / {totalSteps}
            </Text>
            <View className="flex-row gap-2">
              <Button variant="ghost" size="sm" onPress={skipAll}>
                <Button.Label className="text-muted">
                  {t("onboarding.tooltip.skipAll")}
                </Button.Label>
              </Button>
              <Button variant="primary" size="sm" onPress={next}>
                <Button.Label>
                  {isLastStep ? t("onboarding.tooltip.done") : t("onboarding.tooltip.next")}
                </Button.Label>
              </Button>
            </View>
          </View>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
