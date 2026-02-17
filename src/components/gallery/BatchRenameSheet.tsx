import { useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import {
  BottomSheet,
  Button,
  Chip,
  Input,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import {
  previewRenames,
  getTemplateVariables,
  DEFAULT_TEMPLATE,
} from "../../lib/gallery/fileRenamer";
import type { FitsMetadata } from "../../lib/fits/types";

interface RenameOperation {
  fileId: string;
  filename: string;
}

interface RenameOperationResult {
  success: number;
  failed: number;
}

interface BatchRenameSheetProps {
  visible: boolean;
  files: FitsMetadata[];
  selectedIds: string[];
  onApplyRenames: (operations: RenameOperation[]) => RenameOperationResult;
  onClose: () => void;
  isApplying?: boolean;
}

export function BatchRenameSheet({
  visible,
  files,
  selectedIds,
  onApplyRenames,
  onClose,
  isApplying = false,
}: BatchRenameSheetProps) {
  const { t } = useI18n();
  const [_mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedIds.includes(f.id)),
    [files, selectedIds],
  );

  const previews = useMemo(
    () => previewRenames(selectedFiles, template),
    [selectedFiles, template],
  );

  const variables = useMemo(() => getTemplateVariables(), []);

  const handleInsertVariable = (key: string) => {
    setTemplate((prev) => prev + key);
  };

  const handleClose = () => {
    setTemplate(DEFAULT_TEMPLATE);
    onClose();
  };

  const handleApply = () => {
    const changed = previews.filter((preview) => preview.oldName !== preview.newName);
    if (changed.length === 0) {
      Alert.alert(t("common.success"), t("files.renameNoChanges"));
      return;
    }

    const result = onApplyRenames(
      changed.map((item) => ({ fileId: item.id, filename: item.newName })),
    );
    const message = t("files.renamePartial")
      .replace("{success}", String(result.success))
      .replace("{failed}", String(result.failed));

    if (result.failed > 0) {
      Alert.alert(t("common.error"), message);
    } else {
      Alert.alert(t("common.success"), message);
    }
    handleClose();
  };

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="text-center">{t("gallery.batchRename")}</BottomSheet.Title>
          <Text className="text-center text-xs text-muted mb-2">
            {selectedIds.length} {t("album.selected") ?? "selected"}
          </Text>
          <Separator className="my-1" />

          {/* Template input */}
          <View className="px-4 py-2">
            <Text className="text-xs font-semibold text-foreground mb-1">
              {t("gallery.renameTemplate")}
            </Text>
            <TextField>
              <Input
                testID="batch-rename-template-input"
                value={template}
                onChangeText={setTemplate}
                placeholder={DEFAULT_TEMPLATE}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </TextField>
          </View>

          {/* Variable chips */}
          <View className="px-4 py-1">
            <View className="flex-row flex-wrap gap-1">
              {variables.map((v) => (
                <Chip
                  key={v.key}
                  size="sm"
                  variant="secondary"
                  onPress={() => handleInsertVariable(v.key)}
                >
                  <Chip.Label className="text-[9px]">{v.key}</Chip.Label>
                </Chip>
              ))}
            </View>
          </View>

          <Separator className="my-1" />

          {/* Preview list */}
          <View className="px-4 py-1">
            <Text className="text-xs font-semibold text-foreground mb-1">
              {t("gallery.renamePreview")}
            </Text>
          </View>
          <FlatList
            data={previews.slice(0, 20)}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <View className="flex-row items-center gap-2 px-4 py-1.5">
                <View className="flex-1">
                  <Text className="text-[10px] text-muted" numberOfLines={1}>
                    {item.oldName}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="arrow-forward" size={10} color={successColor} />
                    <Text className="text-[10px] text-foreground flex-1" numberOfLines={1}>
                      {item.newName}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
          {previews.length > 20 && (
            <Text className="text-center text-[10px] text-muted py-1">
              +{previews.length - 20} more...
            </Text>
          )}

          <Separator className="my-1" />
          <View className="flex-row gap-2 px-4 py-2">
            <Button
              testID="batch-rename-cancel"
              variant="outline"
              onPress={handleClose}
              className="flex-1"
            >
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button
              testID="batch-rename-apply"
              variant="primary"
              onPress={handleApply}
              className="flex-1"
              isDisabled={!template.trim() || selectedFiles.length === 0 || isApplying}
            >
              <Ionicons name="checkmark-outline" size={14} color="#fff" />
              <Button.Label>{t("common.confirm") ?? "Rename"}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
