export interface ManualSessionTimeRangeResult {
  startTime: number;
  endTime: number;
  duration: number;
  crossMidnight: boolean;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidTimeParts(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

export function resolveManualSessionTimeRange(
  dateStr: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): ManualSessionTimeRangeResult | null {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!isValidDateParts(year, month, day)) return null;
  if (!isValidTimeParts(startHour, startMinute) || !isValidTimeParts(endHour, endMinute)) {
    return null;
  }

  const startTime = new Date(year, month - 1, day, startHour, startMinute, 0, 0).getTime();
  const crossMidnight = endHour < startHour || (endHour === startHour && endMinute <= startMinute);
  const endDate = crossMidnight
    ? new Date(year, month - 1, day + 1, endHour, endMinute, 0, 0)
    : new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  const endTime = endDate.getTime();
  const duration = Math.floor((endTime - startTime) / 1000);
  if (duration <= 0) return null;

  return {
    startTime,
    endTime,
    duration,
    crossMidnight,
  };
}
