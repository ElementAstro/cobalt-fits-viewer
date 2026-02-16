/**
 * 系统日历服务层
 * 封装 expo-calendar API，提供观测会话/计划与系统日历的交互
 */

import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import type { ObservationSession, ObservationPlan } from "../fits/types";

const APP_CALENDAR_TITLE = "Cobalt Observations";
const APP_CALENDAR_COLOR = "#6366f1";

/**
 * 请求日历权限
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

/**
 * 检查当前设备是否支持日历 API（不包含权限检查）
 */
export async function isCalendarAvailable(): Promise<boolean> {
  return Calendar.isAvailableAsync();
}

/**
 * 检查日历权限
 */
export async function checkCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === "granted";
}

/**
 * 获取或创建应用专属日历
 */
export async function getOrCreateAppCalendar(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === APP_CALENDAR_TITLE);
  if (existing) return existing.id;

  const defaultCalendarSource =
    Platform.OS === "ios"
      ? await getDefaultCalendarSource()
      : { isLocalAccount: true, name: APP_CALENDAR_TITLE, type: "LOCAL" as const };

  const newCalendarId = await Calendar.createCalendarAsync({
    title: APP_CALENDAR_TITLE,
    color: APP_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultCalendarSource as { id?: string }).id,
    source: defaultCalendarSource as Calendar.Source,
    name: "cobalt-observations",
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return newCalendarId;
}

async function getDefaultCalendarSource(): Promise<Calendar.Source> {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return defaultCalendar.source;
}

/**
 * 将观测会话同步到系统日历
 */
export async function syncSessionToCalendar(
  session: ObservationSession,
  reminderMinutes: number = 0,
): Promise<string> {
  const calendarId = await getOrCreateAppCalendar();
  const eventId = await Calendar.createEventAsync(
    calendarId,
    buildSessionEventDetails(session, reminderMinutes),
  );

  return eventId;
}

/**
 * 创建观测计划事件到系统日历
 */
export async function createPlanEvent(plan: ObservationPlan): Promise<string> {
  const calendarId = await getOrCreateAppCalendar();
  const eventId = await Calendar.createEventAsync(calendarId, buildPlanEventDetails(plan));

  return eventId;
}

/**
 * 更新观测计划事件
 */
export async function updatePlanEvent(eventId: string, plan: ObservationPlan): Promise<void> {
  await Calendar.updateEventAsync(eventId, buildPlanEventDetails(plan));
}

/**
 * 获取日历事件（不存在时返回 null）
 */
export async function getCalendarEvent(eventId: string): Promise<Calendar.Event | null> {
  try {
    return await Calendar.getEventAsync(eventId);
  } catch {
    return null;
  }
}

/**
 * 删除已同步的日历事件
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // 事件可能已被用户手动删除
  }
}

/**
 * 打开系统日历查看事件
 */
export async function openEventInSystemCalendar(eventId: string): Promise<void> {
  await Calendar.openEventInCalendarAsync({ id: eventId });
}

/**
 * 打开系统日历编辑事件
 */
export async function editEventInSystemCalendar(
  eventId: string,
): Promise<Calendar.DialogEventResult> {
  return Calendar.editEventInCalendarAsync({ id: eventId });
}

/**
 * 通过系统 UI 创建事件
 */
export async function createEventViaSystemUI(
  eventData?: Omit<Partial<Calendar.Event>, "id">,
  presentationOptions?: Calendar.PresentationOptions,
): Promise<Calendar.DialogEventResult> {
  return Calendar.createEventInCalendarAsync(eventData, presentationOptions);
}

export function buildPlanEventDetails(plan: ObservationPlan): Omit<Partial<Calendar.Event>, "id"> {
  const title = `🔭 ${plan.title || plan.targetName}`;
  const notes = plan.notes ?? "";
  const location = plan.location
    ? (plan.location.placeName ??
      plan.location.city ??
      `${plan.location.latitude.toFixed(4)}, ${plan.location.longitude.toFixed(4)}`)
    : undefined;

  const alarms: Calendar.Alarm[] = [];
  if (plan.reminderMinutes > 0) {
    alarms.push({ relativeOffset: -plan.reminderMinutes });
  }

  return {
    title,
    startDate: new Date(plan.startDate),
    endDate: new Date(plan.endDate),
    notes,
    location: location ?? "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms,
  };
}

export function buildSessionEventDetails(
  session: ObservationSession,
  reminderMinutes: number = 0,
): Omit<Partial<Calendar.Event>, "id"> {
  const startDate = new Date(session.startTime);
  const endDate = new Date(session.endTime);
  const title = `🔭 ${session.targets.join(", ") || "Observation Session"}`;
  const notes = buildSessionNotes(session);
  const location = session.location
    ? (session.location.placeName ??
      session.location.city ??
      `${session.location.latitude.toFixed(4)}, ${session.location.longitude.toFixed(4)}`)
    : undefined;

  const alarms: Calendar.Alarm[] = [];
  if (reminderMinutes > 0) {
    alarms.push({ relativeOffset: -reminderMinutes });
  }

  return {
    title,
    startDate,
    endDate,
    notes,
    location: location ?? "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms,
  };
}

function buildSessionNotes(session: ObservationSession): string {
  const lines: string[] = [];

  if (session.targets.length > 0) {
    lines.push(`Targets: ${session.targets.join(", ")}`);
  }

  const duration = session.duration;
  const h = Math.floor(duration / 3600);
  const m = Math.floor((duration % 3600) / 60);
  lines.push(`Duration: ${h > 0 ? `${h}h ${m}m` : `${m}m`}`);
  lines.push(`Images: ${session.imageIds.length}`);

  if (session.equipment.telescope) {
    lines.push(`Telescope: ${session.equipment.telescope}`);
  }
  if (session.equipment.camera) {
    lines.push(`Camera: ${session.equipment.camera}`);
  }
  if (session.equipment.filters?.length) {
    lines.push(`Filters: ${session.equipment.filters.join(", ")}`);
  }
  if (session.weather) {
    lines.push(`Weather: ${session.weather}`);
  }
  if (session.seeing) {
    lines.push(`Seeing: ${session.seeing}`);
  }
  if (session.notes) {
    lines.push(`\nNotes: ${session.notes}`);
  }

  return lines.join("\n");
}
