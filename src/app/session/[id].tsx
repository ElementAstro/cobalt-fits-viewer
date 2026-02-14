import { View, Text, ScrollView } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useSessionStore } from "../../stores/useSessionStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessions } from "../../hooks/useSessions";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EmptyState } from "../../components/common/EmptyState";
import type { FitsMetadata } from "../../lib/fits/types";

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const session = useSessionStore((s) => s.getSessionById(id ?? ""));
  const logEntries = useSessionStore((s) => s.getLogEntriesBySession(id ?? ""));
  const files = useFitsStore((s) => s.files);
  const { exportSessionLog } = useSessions();

  const handleFilePress = (file: FitsMetadata) => {
    router.push(`/viewer/${file.id}`);
  };

  if (!session) {
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

  const sessionFiles = files.filter((f) => session.imageIds.includes(f.id));
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      {/* Top Bar */}
      <View className="flex-row items-center gap-3 mb-4">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">
            {t("sessions.session")} - {session.date}
          </Text>
          <Text className="text-[10px] text-muted">
            {formatDuration(session.duration)} · {session.imageIds.length}{" "}
            {t("sessions.imageCount").toLowerCase()}
          </Text>
        </View>
      </View>

      <Separator className="mb-4" />

      {/* Session Info */}
      <View className="flex-row gap-2 mb-4">
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="time-outline" size={20} color={mutedColor} />
            <Text className="mt-1 text-sm font-bold text-foreground">
              {formatDuration(session.duration)}
            </Text>
            <Text className="text-[10px] text-muted">{t("sessions.duration")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="telescope-outline" size={20} color={mutedColor} />
            <Text className="mt-1 text-sm font-bold text-foreground">{session.targets.length}</Text>
            <Text className="text-[10px] text-muted">{t("targets.title")}</Text>
          </Card.Body>
        </Card>
        <Card variant="secondary" className="flex-1">
          <Card.Body className="items-center p-3">
            <Ionicons name="images-outline" size={20} color={mutedColor} />
            <Text className="mt-1 text-sm font-bold text-foreground">
              {session.imageIds.length}
            </Text>
            <Text className="text-[10px] text-muted">{t("sessions.imageCount")}</Text>
          </Card.Body>
        </Card>
      </View>

      {/* Equipment */}
      {session.equipment.telescope && (
        <>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("sessions.equipment")}
          </Text>
          <Card variant="secondary" className="mb-4">
            <Card.Body className="gap-1 p-3">
              {session.equipment.telescope && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="telescope-outline" size={12} color={mutedColor} />
                  <Text className="text-xs text-foreground">{session.equipment.telescope}</Text>
                </View>
              )}
              {session.equipment.camera && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="camera-outline" size={12} color={mutedColor} />
                  <Text className="text-xs text-foreground">{session.equipment.camera}</Text>
                </View>
              )}
              {session.equipment.filters && session.equipment.filters.length > 0 && (
                <View className="flex-row flex-wrap gap-1 mt-1">
                  {session.equipment.filters.map((f) => (
                    <Chip key={f} size="sm" variant="secondary">
                      <Chip.Label className="text-[9px]">{f}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Notes */}
      {session.notes && (
        <>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("sessions.notes")}
          </Text>
          <Card variant="secondary" className="mb-4">
            <Card.Body className="p-3">
              <Text className="text-xs text-foreground">{session.notes}</Text>
            </Card.Body>
          </Card>
        </>
      )}

      <Separator className="mb-4" />

      {/* Observation Log */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold uppercase text-muted">
          {t("sessions.log")} ({logEntries.length})
        </Text>
        <Button size="sm" variant="outline" onPress={() => exportSessionLog(id ?? "", "csv")}>
          <Ionicons name="download-outline" size={12} color={mutedColor} />
          <Button.Label className="text-[10px]">{t("sessions.exportLog")}</Button.Label>
        </Button>
      </View>

      {logEntries.length > 0 ? (
        <View className="gap-1">
          {logEntries.map((entry) => (
            <Card key={entry.id} variant="secondary">
              <Card.Body className="flex-row items-center justify-between p-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-semibold text-foreground">
                    {entry.object} · {entry.filter}
                  </Text>
                  <Text className="text-[9px] text-muted">
                    {entry.dateTime} · {entry.exptime}s{entry.gain != null && ` · G${entry.gain}`}
                  </Text>
                </View>
              </Card.Body>
            </Card>
          ))}
        </View>
      ) : (
        <View className="items-center py-8">
          <Text className="text-xs text-muted">{t("common.noData")}</Text>
        </View>
      )}

      <Separator className="my-4" />

      {/* Image Grid */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("gallery.allImages")} ({sessionFiles.length})
      </Text>
      {sessionFiles.length === 0 ? (
        <EmptyState icon="images-outline" title={t("gallery.noImages")} />
      ) : (
        <ThumbnailGrid files={sessionFiles} columns={3} onPress={handleFilePress} />
      )}
    </ScrollView>
  );
}
