import { View, Text } from "react-native";

interface InfoRowProps {
  label: string;
  value: string;
  size?: "sm" | "xs";
  selectable?: boolean;
}

export function InfoRow({ label, value, size = "xs", selectable }: InfoRowProps) {
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";
  return (
    <View className={`flex-row items-center justify-between${size === "sm" ? " py-1.5" : ""}`}>
      <Text className={`${textSize} text-muted`}>{label}</Text>
      <Text
        className={`${textSize}${size === "sm" ? "" : " font-medium"} text-foreground`}
        selectable={selectable}
      >
        {value || "N/A"}
      </Text>
    </View>
  );
}
