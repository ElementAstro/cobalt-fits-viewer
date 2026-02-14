import { View, Text } from "react-native";
import { Card, RadioGroup, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ExportFormat } from "../../lib/fits/types";

interface FormatOption {
  key: ExportFormat;
  label: string;
  descriptionKey: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { key: "png", label: "PNG", descriptionKey: "converter.fmtPngDesc" },
  { key: "jpeg", label: "JPEG", descriptionKey: "converter.fmtJpegDesc" },
  { key: "webp", label: "WebP", descriptionKey: "converter.fmtWebpDesc" },
];

interface FormatSelectorProps {
  selected: ExportFormat;
  onSelect: (format: ExportFormat) => void;
}

export function FormatSelector({ selected, onSelect }: FormatSelectorProps) {
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  return (
    <RadioGroup
      value={selected}
      onValueChange={(val) => onSelect(val as ExportFormat)}
      className="gap-2"
    >
      {FORMAT_OPTIONS.map((fmt) => (
        <RadioGroup.Item key={fmt.key} value={fmt.key}>
          {({ isSelected }) => (
            <Card variant="secondary" className={isSelected ? "border border-success" : ""}>
              <Card.Body className="flex-row items-center justify-between p-3">
                <View className="flex-row items-center gap-3">
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-lg ${
                      isSelected ? "bg-success/20" : "bg-surface-secondary"
                    }`}
                  >
                    <Ionicons
                      name="document-outline"
                      size={16}
                      color={isSelected ? successColor : mutedColor}
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-foreground">{fmt.label}</Text>
                    <Text className="text-[10px] text-muted">{t(fmt.descriptionKey)}</Text>
                  </View>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={successColor} />}
              </Card.Body>
            </Card>
          )}
        </RadioGroup.Item>
      ))}
    </RadioGroup>
  );
}
