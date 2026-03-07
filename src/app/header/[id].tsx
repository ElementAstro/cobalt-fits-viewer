import { View, Text, ScrollView, Alert } from "react-native";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/common/useResponsiveLayout";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useFitsFile } from "../../hooks/viewer/useFitsFile";
import { useHeaderEditor } from "../../hooks/viewer/useHeaderEditor";
import { useImageCacheWarmup } from "../../hooks/viewer/useImageCacheWarmup";
import { HeaderTable } from "../../components/fits/HeaderTable";
import { HeaderEditSheet } from "../../components/fits/HeaderEditSheet";
import { HeaderExportDialog } from "../../components/fits/HeaderExportDialog";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { HEADER_GROUP_KEYS } from "../../lib/fits/types";
import type { HeaderGroup, HeaderKeyword } from "../../lib/fits/types";

const GROUPS: { key: HeaderGroup | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "header.allKeywords" },
  { key: "observation", labelKey: "header.observation" },
  { key: "instrument", labelKey: "header.instrumentGroup" },
  { key: "image", labelKey: "header.imageInfo" },
  { key: "wcs", labelKey: "header.wcs" },
  { key: "processing", labelKey: "header.processing" },
];

export default function HeaderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { isLandscapeTablet, contentPaddingTop, horizontalPadding, sidePanelWidth } =
    useResponsiveLayout();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const allFiles = useFitsStore((s) => s.files);
  const viewerPreloadNeighbors = useSettingsStore((s) => s.viewerPreloadNeighbors);
  const viewerPreloadRadius = useSettingsStore((s) => s.viewerPreloadRadius);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

  const { headers: rawHeaders, isLoading, loadFromPath } = useFitsFile();
  const editor = useHeaderEditor();

  const isFits = file?.sourceType === "fits";
  const editable = isFits;
  const editorInitialized = useRef(false);

  const [selectedGroup, setSelectedGroup] = useState<HeaderGroup | "all">("all");
  const [editingKeyword, setEditingKeyword] = useState<HeaderKeyword | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  useEffect(() => {
    if (file) loadFromPath(file.filepath, file.filename, file.fileSize);
  }, [file, loadFromPath]);

  useImageCacheWarmup({
    enabled: viewerPreloadNeighbors,
    currentFile: file,
    allFiles,
    radius: viewerPreloadRadius,
    frameClassificationConfig,
    startWhen: !!file && !isLoading,
  });

  useEffect(() => {
    if (rawHeaders.length > 0 && !editorInitialized.current) {
      editor.initialize(rawHeaders);
      editorInitialized.current = true;
    }
  }, [rawHeaders, editor]);

  const displayHeaders = editable ? editor.headers : rawHeaders;

  const filteredHeaders = useMemo(() => {
    if (selectedGroup === "all") return displayHeaders;
    const groupKeys = HEADER_GROUP_KEYS[selectedGroup] ?? [];
    return displayHeaders.filter((kw) => groupKeys.includes(kw.key));
  }, [displayHeaders, selectedGroup]);

  const handleBack = useCallback(() => {
    if (editor.isDirty) {
      Alert.alert(
        t("header.discardChanges" as Parameters<typeof t>[0]),
        t("header.unsavedChanges" as Parameters<typeof t>[0]),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("header.discardChanges" as Parameters<typeof t>[0]),
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      router.back();
    }
  }, [editor.isDirty, router, t]);

  const handleEditKeyword = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setEditingKeyword(displayHeaders[index] ?? null);
      setEditSheetVisible(true);
    },
    [displayHeaders],
  );

  const handleAddKeyword = useCallback(() => {
    setEditingIndex(-1);
    setEditingKeyword(null);
    setEditSheetVisible(true);
  }, []);

  const handleEditSheetSave = useCallback(
    (keyword: HeaderKeyword) => {
      if (editingIndex >= 0) {
        editor.editKeyword(editingIndex, keyword);
      } else {
        editor.addKeyword(keyword);
      }
      setEditSheetVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [editingIndex, editor],
  );

  const handleDeleteKeyword = useCallback(
    (index: number) => {
      const kw = displayHeaders[index];
      if (!kw) return;
      Alert.alert(
        t("header.deleteKeyword" as Parameters<typeof t>[0]),
        `${kw.key} = ${String(kw.value ?? "")}`,
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              editor.deleteKeyword(index);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ],
      );
    },
    [displayHeaders, editor, t],
  );

  const handleSave = useCallback(async () => {
    if (!file || !editor.isDirty) return;
    const changeCount = editor.historyIndex;
    Alert.alert(
      t("header.saveChanges" as Parameters<typeof t>[0]),
      `${changeCount} change(s) to FITS header?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.save"),
          onPress: async () => {
            const ok = await editor.save(file.filepath);
            if (ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(t("common.success"), t("header.saveSuccess" as Parameters<typeof t>[0]));
            } else {
              Alert.alert(
                t("common.error"),
                editor.saveError ?? t("header.saveFailed" as Parameters<typeof t>[0]),
              );
            }
          },
        },
      ],
    );
  }, [file, editor, t]);

  const handleOpenExportDialog = useCallback(() => {
    if (displayHeaders.length === 0) return;
    setExportDialogVisible(true);
  }, [displayHeaders.length]);

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  const toolbarButtons = (
    <View className="flex-row gap-1">
      {editable && (
        <>
          <Button size="sm" variant="outline" onPress={editor.undo} isDisabled={!editor.canUndo}>
            <Ionicons
              name="arrow-undo-outline"
              size={14}
              color={editor.canUndo ? successColor : mutedColor}
            />
          </Button>
          <Button size="sm" variant="outline" onPress={editor.redo} isDisabled={!editor.canRedo}>
            <Ionicons
              name="arrow-redo-outline"
              size={14}
              color={editor.canRedo ? successColor : mutedColor}
            />
          </Button>
          <Button size="sm" variant="outline" onPress={handleAddKeyword}>
            <Ionicons name="add-outline" size={14} color={successColor} />
          </Button>
          <Button
            size="sm"
            variant={editor.isDirty ? "primary" : "outline"}
            onPress={handleSave}
            isDisabled={!editor.isDirty || editor.isSaving}
          >
            <Ionicons name="save-outline" size={14} color={editor.isDirty ? "#fff" : mutedColor} />
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant="outline"
        onPress={handleOpenExportDialog}
        isDisabled={displayHeaders.length === 0}
      >
        <Ionicons name="share-outline" size={14} color={mutedColor} />
      </Button>
    </View>
  );

  const headerTable = (
    <>
      {file.sourceType === "raster" && displayHeaders.length === 0 ? (
        <View className="rounded-lg bg-surface-secondary px-3 py-4">
          <Text className="text-xs text-muted">{t("header.noHeaderForFormat")}</Text>
        </View>
      ) : (
        <HeaderTable
          keywords={filteredHeaders}
          editable={editable}
          onEditKeyword={handleEditKeyword}
          onDeleteKeyword={handleDeleteKeyword}
        />
      )}
    </>
  );

  const groupFilter = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      <View className="flex-row gap-2">
        {GROUPS.map((group) => (
          <Chip
            key={group.key}
            size="sm"
            variant={selectedGroup === group.key ? "primary" : "secondary"}
            testID={
              group.key === "observation"
                ? "e2e-action-header__param_id-group-observation"
                : `e2e-action-header__param_id-group-${group.key}`
            }
            onPress={() => setSelectedGroup(group.key)}
          >
            <Chip.Label className="text-[10px]">
              {t(group.labelKey as Parameters<typeof t>[0])}
            </Chip.Label>
          </Chip>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View testID="e2e-screen-header__param_id" className="flex-1 bg-background">
      <LoadingOverlay visible={isLoading || editor.isSaving} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: 24,
        }}
      >
        {isLandscapeTablet ? (
          <View className="flex-row items-start gap-4">
            <View style={{ width: sidePanelWidth }}>
              <View className="flex-row items-center gap-3 mb-4">
                <Button
                  testID="e2e-action-header__param_id-back"
                  size="sm"
                  variant="outline"
                  onPress={handleBack}
                >
                  <Ionicons name="arrow-back" size={16} color={mutedColor} />
                </Button>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">{t("header.title")}</Text>
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {file.filename}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[10px] text-muted">
                  {displayHeaders.length} keywords
                  {editor.isDirty ? " *" : ""}
                </Text>
                {toolbarButtons}
              </View>
              {groupFilter}
            </View>
            <View className="flex-1">{headerTable}</View>
          </View>
        ) : (
          <>
            {/* Top Bar */}
            <View className="flex-row items-center gap-3 mb-2">
              <Button
                testID="e2e-action-header__param_id-back"
                size="sm"
                variant="outline"
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={16} color={mutedColor} />
              </Button>
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground">
                  {t("header.title")}
                  {editor.isDirty ? " *" : ""}
                </Text>
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {file.filename}
                </Text>
              </View>
              <Text className="text-[10px] text-muted">{displayHeaders.length}</Text>
            </View>

            {/* Toolbar */}
            <View className="flex-row justify-end mb-3">{toolbarButtons}</View>

            <Separator className="mb-4" />

            {/* Header Group Filter */}
            {groupFilter}

            {/* Header Table */}
            {headerTable}
          </>
        )}
      </ScrollView>

      {/* Edit/Add Dialog */}
      <HeaderExportDialog
        visible={exportDialogVisible}
        keywords={displayHeaders}
        onClose={() => setExportDialogVisible(false)}
      />

      <HeaderEditSheet
        visible={editSheetVisible}
        keyword={editingKeyword}
        onSave={handleEditSheetSave}
        onClose={() => setEditSheetVisible(false)}
      />
    </View>
  );
}
