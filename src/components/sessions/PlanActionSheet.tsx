import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationPlan } from "../../lib/fits/types";
import { ActionSheetList, type ActionItem, type ConditionalActionItem } from "./ActionSheetList";

interface PlanActionSheetProps {
  visible: boolean;
  plan: ObservationPlan | null;
  onClose: () => void;
  onSyncToCalendar?: (plan: ObservationPlan) => void;
  onUnsyncFromCalendar?: (plan: ObservationPlan) => void;
  onOpenInCalendar?: (plan: ObservationPlan) => void;
  onRefreshFromCalendar?: (plan: ObservationPlan) => void;
  onEditInCalendar?: (plan: ObservationPlan) => void;
  onCreateViaSystemCalendar?: (plan: ObservationPlan) => void;
  onDuplicate?: (plan: ObservationPlan) => void;
  onRollover?: (plan: ObservationPlan) => void;
  onCreateSession?: (plan: ObservationPlan) => void;
  onStatusChange?: (plan: ObservationPlan, status: "planned" | "completed" | "cancelled") => void;
  onEdit?: (plan: ObservationPlan) => void;
  onDelete?: (plan: ObservationPlan) => void;
}

export function PlanActionSheet({
  visible,
  plan,
  onClose,
  onSyncToCalendar,
  onUnsyncFromCalendar,
  onOpenInCalendar,
  onRefreshFromCalendar,
  onEditInCalendar,
  onCreateViaSystemCalendar,
  onDuplicate,
  onRollover,
  onCreateSession,
  onStatusChange,
  onEdit,
  onDelete,
}: PlanActionSheetProps) {
  const { t } = useI18n();

  const actions = useMemo<ActionItem[]>(() => {
    if (!plan) return [];
    const isSynced = !!plan.calendarEventId;
    const status = plan.status ?? "planned";
    return (
      [
        {
          label: t("sessions.syncToCalendar"),
          icon: "sync-outline",
          onPress: () => onSyncToCalendar?.(plan),
          _visible: !isSynced && !!onSyncToCalendar,
        },
        {
          label: t("sessions.createViaSystemCalendar"),
          icon: "add-circle-outline",
          onPress: () => onCreateViaSystemCalendar?.(plan),
          _visible: !isSynced && !!onCreateViaSystemCalendar,
        },
        {
          label: t("sessions.openInCalendar"),
          icon: "open-outline",
          onPress: () => onOpenInCalendar?.(plan),
          _visible: isSynced && !!onOpenInCalendar,
        },
        {
          label: t("sessions.refreshFromCalendar"),
          icon: "refresh-outline",
          onPress: () => onRefreshFromCalendar?.(plan),
          _visible: isSynced && !!onRefreshFromCalendar,
        },
        {
          label: t("sessions.editInCalendar"),
          icon: "build-outline",
          onPress: () => onEditInCalendar?.(plan),
          _visible: isSynced && !!onEditInCalendar,
        },
        {
          label: t("sessions.unsyncFromCalendar"),
          icon: "remove-circle-outline",
          onPress: () => onUnsyncFromCalendar?.(plan),
          _visible: isSynced && !!onUnsyncFromCalendar,
        },
        {
          label: t("sessions.convertToSession"),
          icon: "play-forward-outline",
          onPress: () => onCreateSession?.(plan),
          highlight: true,
          _visible: !!onCreateSession,
        },
        {
          label: t("sessions.duplicatePlan"),
          icon: "copy-outline",
          onPress: () => onDuplicate?.(plan),
          _visible: !!onDuplicate,
        },
        {
          label: t("sessions.rolloverPlan"),
          icon: "return-up-forward-outline",
          onPress: () => onRollover?.(plan),
          _visible: !!onRollover,
        },
        {
          label: t("sessions.status.planned"),
          icon: "refresh-outline",
          onPress: () => onStatusChange?.(plan, "planned"),
          _visible: !!onStatusChange && status !== "planned",
        },
        {
          label: t("sessions.status.completed"),
          icon: "checkmark-circle-outline",
          onPress: () => onStatusChange?.(plan, "completed"),
          highlight: true,
          _visible: !!onStatusChange && status !== "completed",
        },
        {
          label: t("sessions.status.cancelled"),
          icon: "close-circle-outline",
          onPress: () => onStatusChange?.(plan, "cancelled"),
          _visible: !!onStatusChange && status !== "cancelled",
        },
        {
          label: t("common.edit"),
          icon: "create-outline",
          onPress: () => onEdit?.(plan),
          _visible: !!onEdit,
        },
        {
          label: t("common.delete"),
          icon: "trash-outline",
          onPress: () => onDelete?.(plan),
          destructive: true,
          _visible: !!onDelete,
        },
      ] as ConditionalActionItem[]
    ).filter((a) => a._visible);
  }, [
    plan,
    t,
    onSyncToCalendar,
    onCreateViaSystemCalendar,
    onOpenInCalendar,
    onRefreshFromCalendar,
    onEditInCalendar,
    onUnsyncFromCalendar,
    onCreateSession,
    onDuplicate,
    onRollover,
    onStatusChange,
    onEdit,
    onDelete,
  ]);

  if (!plan) return null;

  return (
    <ActionSheetList
      visible={visible}
      title={plan.title || plan.targetName}
      actions={actions}
      onClose={onClose}
    />
  );
}
