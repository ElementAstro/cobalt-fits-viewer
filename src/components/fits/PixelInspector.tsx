import { Text } from "react-native";
import { Card } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface PixelInspectorProps {
  x: number;
  y: number;
  value: number | null;
  ra?: string;
  dec?: string;
  visible?: boolean;
}

export function PixelInspector({ x, y, value, ra, dec, visible = true }: PixelInspectorProps) {
  const { t } = useI18n();
  if (!visible || value === null) return null;

  return (
    <Card variant="secondary" className="absolute bottom-16 left-3 opacity-90">
      <Card.Body className="px-3 py-2">
        <Text className="text-[10px] font-semibold text-foreground">{t("viewer.pixelInfo")}</Text>
        <Text className="text-[9px] text-muted">
          X: {x} Y: {y}
        </Text>
        <Text className="text-[9px] text-muted">
          {t("viewer.value")}: {value.toFixed(2)}
        </Text>
        {ra && dec && (
          <Text className="text-[9px] text-muted">
            RA: {ra} Dec: {dec}
          </Text>
        )}
      </Card.Body>
    </Card>
  );
}
