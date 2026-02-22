import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationSession } from "../../lib/fits/types";
import { ActionSheetList, type ActionItem } from "./ActionSheetList";

interface SessionActionSheetProps {
  visible: boolean;
  session: ObservationSession | null;
  calendarSyncEnabled: boolean;
  onClose: () => void;
  onSyncToCalendar?: (session: ObservationSession) => void;
  onUnsyncFromCalendar?: (session: ObservationSession) => void;
  onOpenInCalendar?: (session: ObservationSession) => void;
  onRefreshFromCalendar?: (session: ObservationSession) => void;
  onEditInCalendar?: (session: ObservationSession) => void;
  onCreateViaSystemCalendar?: (session: ObservationSession) => void;
  onDelete?: (session: ObservationSession) => void;
}

export function SessionActionSheet({
  visible,
  session,
  calendarSyncEnabled,
  onClose,
  onSyncToCalendar,
  onUnsyncFromCalendar,
  onOpenInCalendar,
  onRefreshFromCalendar,
  onEditInCalendar,
  onCreateViaSystemCalendar,
  onDelete,
}: SessionActionSheetProps) {
  const { t } = useI18n();

  const actions = useMemo<ActionItem[]>(() => {
    if (!session) return [];
    const isSynced = !!session.calendarEventId;
    return (
      [
        {
          label: t("sessions.syncToCalendar"),
          icon: "sync-outline",
          onPress: () => onSyncToCalendar?.(session),
          _visible: calendarSyncEnabled && !isSynced && !!onSyncToCalendar,
        },
        {
          label: t("sessions.createViaSystemCalendar"),
          icon: "add-circle-outline",
          onPress: () => onCreateViaSystemCalendar?.(session),
          _visible: calendarSyncEnabled && !isSynced && !!onCreateViaSystemCalendar,
        },
        {
          label: t("sessions.openInCalendar"),
          icon: "open-outline",
          onPress: () => onOpenInCalendar?.(session),
          _visible: calendarSyncEnabled && isSynced && !!onOpenInCalendar,
        },
        {
          label: t("sessions.refreshFromCalendar"),
          icon: "refresh-outline",
          onPress: () => onRefreshFromCalendar?.(session),
          _visible: calendarSyncEnabled && isSynced && !!onRefreshFromCalendar,
        },
        {
          label: t("sessions.editInCalendar"),
          icon: "build-outline",
          onPress: () => onEditInCalendar?.(session),
          _visible: calendarSyncEnabled && isSynced && !!onEditInCalendar,
        },
        {
          label: t("sessions.unsyncFromCalendar"),
          icon: "remove-circle-outline",
          onPress: () => onUnsyncFromCalendar?.(session),
          _visible: calendarSyncEnabled && isSynced && !!onUnsyncFromCalendar,
        },
        {
          label: t("common.delete"),
          icon: "trash-outline",
          onPress: () => onDelete?.(session),
          destructive: true,
          _visible: !!onDelete,
        },
      ] as (ActionItem & { _visible: boolean })[]
    ).filter((a) => a._visible);
  }, [
    session,
    calendarSyncEnabled,
    t,
    onSyncToCalendar,
    onCreateViaSystemCalendar,
    onOpenInCalendar,
    onRefreshFromCalendar,
    onEditInCalendar,
    onUnsyncFromCalendar,
    onDelete,
  ]);

  if (!session) return null;

  return (
    <ActionSheetList visible={visible} title={session.date} actions={actions} onClose={onClose} />
  );
}
