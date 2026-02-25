/**
 * FITS 文件选择器 Sheet
 * 支持单选和批量多选模式
 */

import { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { Button, Chip, Dialog, Separator, useThemeColor } from "heroui-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";

interface FilePickerSheetProps {
  visible: boolean;
  files: FitsMetadata[];
  onSelect: (file: FitsMetadata) => void;
  onSelectBatch?: (files: FitsMetadata[]) => void;
  onClose: () => void;
}

export function FilePickerSheet({
  visible,
  files,
  onSelect,
  onSelectBatch,
  onClose,
}: FilePickerSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmitBatch = useCallback(() => {
    if (!onSelectBatch) return;
    const selectedFiles = files.filter((f) => selected.has(f.id));
    if (selectedFiles.length > 0) {
      onSelectBatch(selectedFiles);
    }
    setSelected(new Set());
    setMultiMode(false);
  }, [files, selected, onSelectBatch]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    setMultiMode(false);
    onClose();
  }, [onClose]);

  const selectAll = useCallback(() => {
    setSelected(new Set(files.map((f) => f.id)));
  }, [files]);

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="flex-row items-center justify-between mb-2">
            <Dialog.Title>{t("astrometry.selectFile")}</Dialog.Title>
            <View className="flex-row items-center gap-2">
              {onSelectBatch && (
                <Pressable onPress={() => setMultiMode(!multiMode)}>
                  <Ionicons
                    name={multiMode ? "checkbox" : "checkbox-outline"}
                    size={18}
                    color={multiMode ? accentColor : mutedColor}
                  />
                </Pressable>
              )}
              <Dialog.Close />
            </View>
          </View>

          {multiMode && (
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[10px] text-muted">
                {t("astrometry.selectedCount", { count: selected.size, total: files.length })}
              </Text>
              <Pressable onPress={selectAll}>
                <Text className="text-[10px] text-accent font-medium">
                  {t("astrometry.selectAll")}
                </Text>
              </Pressable>
            </View>
          )}

          {files.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="document-outline" size={40} color={mutedColor} />
              <Text className="mt-2 text-sm text-muted">{t("files.emptyState")}</Text>
            </View>
          ) : (
            <View style={{ height: Math.min(files.length * 72, 400) }}>
              <FlashList
                data={files}
                keyExtractor={(item) => item.id}
                extraData={selected}
                renderItem={({ item }) => (
                  <FileRow
                    file={item}
                    multiMode={multiMode}
                    isSelected={selected.has(item.id)}
                    onPress={() => (multiMode ? toggleSelect(item.id) : onSelect(item))}
                    accentColor={accentColor}
                    mutedColor={mutedColor}
                  />
                )}
              />
            </View>
          )}

          <Separator className="my-2" />
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" size="sm" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            {multiMode && selected.size > 0 && (
              <Button variant="primary" size="sm" onPress={handleSubmitBatch}>
                <Button.Label>
                  {t("astrometry.submit")} ({selected.size})
                </Button.Label>
              </Button>
            )}
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function FileRow({
  file,
  multiMode,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
}: {
  file: FitsMetadata;
  multiMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
}) {
  return (
    <Pressable
      className={`flex-row items-center gap-3 py-2 px-1 rounded-md ${isSelected ? "bg-accent/10" : ""}`}
      onPress={onPress}
    >
      {multiMode && (
        <Ionicons
          name={isSelected ? "checkbox" : "square-outline"}
          size={18}
          color={isSelected ? accentColor : mutedColor}
        />
      )}
      {file.thumbnailUri ? (
        <Image
          source={{ uri: file.thumbnailUri }}
          style={{ width: 36, height: 36, borderRadius: 4 }}
          contentFit="cover"
        />
      ) : (
        <View className="w-9 h-9 rounded bg-surface-secondary items-center justify-center">
          <Ionicons name="image-outline" size={16} color={mutedColor} />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
          {file.filename}
        </Text>
        <View className="flex-row items-center gap-1 mt-0.5">
          {file.object && (
            <Chip size="sm" variant="soft" color="accent">
              <Chip.Label className="text-[8px]">{file.object}</Chip.Label>
            </Chip>
          )}
          {file.filter && (
            <Chip size="sm" variant="soft">
              <Chip.Label className="text-[8px]">{file.filter}</Chip.Label>
            </Chip>
          )}
          {file.exptime != null && <Text className="text-[9px] text-muted">{file.exptime}s</Text>}
        </View>
      </View>
      {!multiMode && <Ionicons name="chevron-forward" size={14} color={mutedColor} />}
    </Pressable>
  );
}
