import { useState, useMemo } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useTargets } from "../../hooks/useTargets";
import { useFitsStore } from "../../stores/useFitsStore";
import { TargetCard } from "../../components/targets/TargetCard";
import { AddTargetSheet } from "../../components/targets/AddTargetSheet";
import { EmptyState } from "../../components/common/EmptyState";
import type { TargetType, TargetStatus } from "../../lib/fits/types";

type SortKey = "name" | "date" | "frames" | "exposure";

export default function TargetsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TargetType | null>(null);
  const [filterStatus, setFilterStatus] = useState<TargetStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const {
    targets,
    addTarget,
    scanAndAutoDetect,
    getTargetStats,
    formatExposureTime: _formatExposureTime,
  } = useTargets();

  const files = useFitsStore((s) => s.files);

  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTargetStats>>();
    for (const t of targets) {
      map.set(t.id, getTargetStats(t.id));
    }
    return map;
  }, [targets, getTargetStats]);

  const filteredTargets = useMemo(() => {
    let result = [...targets];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.aliases.some((a) => a.toLowerCase().includes(q)),
      );
    }

    if (filterType) {
      result = result.filter((t) => t.type === filterType);
    }

    if (filterStatus) {
      result = result.filter((t) => t.status === filterStatus);
    }

    result.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "date":
          return b.createdAt - a.createdAt;
        case "frames":
          return b.imageIds.length - a.imageIds.length;
        case "exposure": {
          const aExp = statsMap.get(a.id)?.exposureStats.totalExposure ?? 0;
          const bExp = statsMap.get(b.id)?.exposureStats.totalExposure ?? 0;
          return bExp - aExp;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [targets, searchQuery, filterType, filterStatus, sortKey, statsMap]);

  const handleAddTarget = (data: {
    name: string;
    type: TargetType;
    ra?: string;
    dec?: string;
    notes?: string;
  }) => {
    const raNum = data.ra ? parseFloat(data.ra) : undefined;
    const decNum = data.dec ? parseFloat(data.dec) : undefined;
    addTarget(data.name, data.type, {
      ra: raNum && !isNaN(raNum) ? raNum : undefined,
      dec: decNum && !isNaN(decNum) ? decNum : undefined,
      notes: data.notes,
    });
    setShowAddSheet(false);
  };

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">{t("targets.title")}</Text>
            <Text className="mt-1 text-sm text-muted">
              {t("targets.subtitle")} ({targets.length})
            </Text>
          </View>
          <View className="flex-row gap-1">
            <Button size="sm" variant="outline" onPress={scanAndAutoDetect}>
              <Ionicons name="scan-outline" size={14} color={mutedColor} />
            </Button>
            <Button size="sm" variant="primary" onPress={() => setShowAddSheet(true)}>
              <Ionicons name="add" size={14} color="#fff" />
            </Button>
          </View>
        </View>

        {/* Stats Summary */}
        {targets.length > 0 && (
          <View className="mt-3 flex-row gap-2">
            {(["planned", "acquiring", "completed", "processed"] as const).map((s) => {
              const count = targets.filter((t) => t.status === s).length;
              if (count === 0) return null;
              const colors = {
                planned: "#6b7280",
                acquiring: "#f59e0b",
                completed: "#22c55e",
                processed: "#3b82f6",
              };
              return (
                <View key={s} className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[s] }} />
                  <Text className="text-[10px] text-muted">
                    {count}{" "}
                    {t(
                      `targets.${s}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Separator className="my-4" />

        {/* Search */}
        <View className="mb-3 flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center rounded-xl border border-separator bg-background px-3">
            <Ionicons name="search-outline" size={14} color={mutedColor} />
            <TextInput
              className="flex-1 py-2.5 pl-2 text-sm text-foreground"
              placeholder={t("targets.searchPlaceholder")}
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={14} color={mutedColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-1.5">
            {/* Type filters */}
            {(["galaxy", "nebula", "cluster", "planet", "other"] as TargetType[]).map((tt) => (
              <TouchableOpacity
                key={tt}
                onPress={() => setFilterType(filterType === tt ? null : tt)}
              >
                <Chip size="sm" variant={filterType === tt ? "primary" : "secondary"}>
                  <Chip.Label className="text-[9px]">
                    {t(
                      `targets.types.${tt}` as
                        | "targets.types.galaxy"
                        | "targets.types.nebula"
                        | "targets.types.cluster"
                        | "targets.types.planet"
                        | "targets.types.other",
                    )}
                  </Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}

            <View className="w-px bg-separator mx-1" />

            {/* Status filters */}
            {(["planned", "acquiring", "completed", "processed"] as TargetStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setFilterStatus(filterStatus === s ? null : s)}
              >
                <Chip size="sm" variant={filterStatus === s ? "primary" : "secondary"}>
                  <Chip.Label className="text-[9px]">
                    {t(
                      `targets.${s}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Sort */}
        <View className="mb-3 flex-row items-center gap-1.5">
          <Ionicons name="swap-vertical-outline" size={12} color={mutedColor} />
          {(["date", "name", "frames", "exposure"] as SortKey[]).map((sk) => (
            <TouchableOpacity key={sk} onPress={() => setSortKey(sk)}>
              <Text
                className={`text-[10px] px-2 py-1 rounded-md ${
                  sortKey === sk ? "bg-primary/20 text-primary font-semibold" : "text-muted"
                }`}
              >
                {t(
                  `targets.sort.${sk}` as
                    | "targets.sort.date"
                    | "targets.sort.name"
                    | "targets.sort.frames"
                    | "targets.sort.exposure",
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredTargets.length === 0 && targets.length === 0 ? (
          <EmptyState
            icon="telescope-outline"
            title={t("targets.noTargets")}
            description={t("targets.autoDetected")}
            actionLabel={files.length > 0 ? t("targets.scanNow") : undefined}
            onAction={files.length > 0 ? scanAndAutoDetect : undefined}
          />
        ) : filteredTargets.length === 0 ? (
          <EmptyState icon="search-outline" title={t("targets.noResults")} />
        ) : (
          <View className="gap-3">
            {filteredTargets.map((target) => {
              const stats = statsMap.get(target.id);
              const totalExposureMin = stats
                ? Math.round(stats.exposureStats.totalExposure / 60)
                : 0;
              const completion = stats?.completion.overall;

              return (
                <TargetCard
                  key={target.id}
                  target={target}
                  frameCount={target.imageIds.length}
                  totalExposureMinutes={totalExposureMin}
                  completionPercent={completion}
                  onPress={() => router.push(`/target/${target.id}`)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddTargetSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onConfirm={handleAddTarget}
      />
    </>
  );
}
