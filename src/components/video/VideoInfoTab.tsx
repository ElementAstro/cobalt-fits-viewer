import { useMemo } from "react";
import { Text, View } from "react-native";
import { Accordion, Button, Card, Chip } from "heroui-native";
import type { FitsMetadata } from "../../lib/fits/types";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import { formatFileSize } from "../../lib/utils/fileManager";
import { useFitsStore } from "../../stores/useFitsStore";
import { useI18n } from "../../i18n/useI18n";

interface VideoInfoTabProps {
  file: FitsMetadata;
  isVideo: boolean;
  isAudio: boolean;
  onNavigateToFile?: (fileId: string) => void;
}

export function VideoInfoTab({ file, isVideo, isAudio, onNavigateToFile }: VideoInfoTabProps) {
  const { t } = useI18n();
  const allFiles = useFitsStore((s) => s.files);

  const sourceFile = useMemo(
    () => (file.derivedFromId ? allFiles.find((f) => f.id === file.derivedFromId) : undefined),
    [allFiles, file.derivedFromId],
  );

  const derivedFiles = useMemo(
    () => allFiles.filter((f) => f.derivedFromId === file.id),
    [allFiles, file.id],
  );

  return (
    <View className="mt-3 gap-2">
      <Card variant="secondary">
        <Card.Body className="gap-2 p-3">
          <View className="flex-row flex-wrap gap-2">
            <Chip size="sm" variant="secondary">
              <Chip.Label>
                {(file.sourceFormat ?? (isAudio ? "audio" : "video")).toUpperCase()}
              </Chip.Label>
            </Chip>
            <Chip size="sm" variant="secondary">
              <Chip.Label>{formatVideoDuration(file.durationMs)}</Chip.Label>
            </Chip>
            {isVideo && (
              <Chip size="sm" variant="secondary">
                <Chip.Label>
                  {formatVideoResolution(file.videoWidth, file.videoHeight) || "--"}
                </Chip.Label>
              </Chip>
            )}
            {!!file.frameRate && (
              <Chip size="sm" variant="secondary">
                <Chip.Label>{file.frameRate.toFixed(2)} fps</Chip.Label>
              </Chip>
            )}
          </View>
          <Text className="text-xs text-muted">
            {t("settings.videoSizeLabel", { size: formatFileSize(file.fileSize) })}
          </Text>
          {!!file.videoCodec && (
            <Text className="text-xs text-muted">
              {t("settings.videoCodecLabel", { codec: file.videoCodec })}
            </Text>
          )}
          {!!file.audioCodec && (
            <Text className="text-xs text-muted">
              {t("settings.audioCodecLabel", { codec: file.audioCodec })}
            </Text>
          )}
          {!!file.bitrateKbps && (
            <Text className="text-xs text-muted">
              {t("settings.videoBitrateLabel", { bitrate: file.bitrateKbps })}
            </Text>
          )}
        </Card.Body>
      </Card>

      {(!!file.processingTag || !!sourceFile) && (
        <Card variant="secondary">
          <Card.Body className="gap-2 p-3">
            {!!file.processingTag && (
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted">{t("settings.videoProcessingTagLabel")}</Text>
                <Chip size="sm" variant="soft" color="accent">
                  <Chip.Label>{file.processingTag.toUpperCase()}</Chip.Label>
                </Chip>
              </View>
            )}
            {!!sourceFile && (
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted">{t("settings.videoDerivedFromLabel")}</Text>
                <Button size="sm" variant="ghost" onPress={() => onNavigateToFile?.(sourceFile.id)}>
                  <Button.Label className="text-xs">{sourceFile.filename}</Button.Label>
                </Button>
              </View>
            )}
          </Card.Body>
        </Card>
      )}

      {derivedFiles.length > 0 && (
        <Card variant="secondary">
          <Card.Body className="gap-2 p-3">
            <Text className="text-xs font-semibold text-foreground">
              {t("settings.videoDerivedFilesLabel")}
            </Text>
            {derivedFiles.map((df) => (
              <View key={df.id} className="flex-row items-center gap-2">
                {!!df.processingTag && (
                  <Chip size="sm" variant="soft" color="default">
                    <Chip.Label className="text-[9px]">{df.processingTag.toUpperCase()}</Chip.Label>
                  </Chip>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onPress={() => onNavigateToFile?.(df.id)}
                >
                  <Button.Label className="text-xs" numberOfLines={1}>
                    {df.filename}
                  </Button.Label>
                </Button>
              </View>
            ))}
          </Card.Body>
        </Card>
      )}

      {isVideo && (
        <Accordion selectionMode="multiple" variant="surface" defaultValue={["compatibility"]}>
          <Accordion.Item value="compatibility">
            <Accordion.Trigger>
              <Text className="flex-1 text-sm font-semibold text-foreground">
                {t("settings.videoCompatibilityProfileTitle")}
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <Text className="text-xs text-muted">
                {t("settings.videoCompatibilityProfileDesc")}
              </Text>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      )}
    </View>
  );
}
