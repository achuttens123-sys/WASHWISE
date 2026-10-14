/**
 * WashWise Indian Standard Time (IST) Centralized Date & Time Utility
 * Anchors all laundry slot schedules, operational business days, and report timestamps
 * to Indian Standard Time (Asia/Kolkata, UTC+05:30) with local browser fallback.
 */

export const TIMEZONE_IST = 'Asia/Kolkata';

/**
 * Returns today's operational date string in IST formatted as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE_IST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch (e) {
    // Fallback: calculate UTC+5:30 manually
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000));
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Converts any Date, timestamp, or ISO string to an IST Date representation.
 */
export function toISTDate(dateInput: Date | string | number): Date {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

/**
 * Formats a date into a clean, human-readable IST string.
 * e.g., "14 Oct 2026" or "14 Oct 2026, 11:30 AM IST"
 */
export function formatIST(
  dateInput: Date | string | number,
  options: { includeTime?: boolean; includeTimezoneBadge?: boolean } = {}
): string {
  const { includeTime = false, includeTimezoneBadge = false } = options;
  const date = toISTDate(dateInput);

  try {
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: TIMEZONE_IST,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      } : {})
    };

    const formatted = new Intl.DateTimeFormat('en-IN', formatOptions).format(date);
    return includeTimezoneBadge ? `${formatted} IST` : formatted;
  } catch (e) {
    return date.toLocaleDateString('en-IN');
  }
}

/**
 * Formats full timestamp with time and IST suffix.
 * e.g., "14 Oct 2026, 04:30 PM IST"
 */
export function formatDateTimeIST(dateInput: Date | string | number): string {
  return formatIST(dateInput, { includeTime: true, includeTimezoneBadge: true });
}

/**
 * Checks if a given YYYY-MM-DD date is today in Indian Standard Time.
 */
export function isTodayIST(dateStr: string): boolean {
  return dateStr === getTodayIST();
}

/**
 * Parses a slot string (e.g. "10:00-11:00 AM" or "02:00-03:00 PM") into 24-hour end time in IST.
 */
export function parseSlotEndTime(slotStr: string): { hours: number; minutes: number } {
  try {
    const trimmed = slotStr.trim();
    const parts = trimmed.split(' ');
    const timeRange = parts[0] || '';
    const period = (parts[1] || '').toUpperCase();
    const endTime = timeRange.split('-')[1] || timeRange.split('-')[0] || '';
    let [hours, minutes] = endTime.split(':').map(Number);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;

    if (period === 'PM') {
      if (hours < 12) hours += 12;
    } else if (period === 'AM') {
      if (hours === 12) hours = 0;
    }

    return { hours, minutes };
  } catch (e) {
    return { hours: 23, minutes: 59 };
  }
}

/**
 * Returns current IST time breakdown.
 */
export function getCurrentIST(): { year: number; month: number; day: number; hours: number; minutes: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE_IST,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => {
      const part = parts.find(p => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };
    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hours: getPart('hour'),
      minutes: getPart('minute')
    };
  } catch (e) {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000));
    return {
      year: istTime.getFullYear(),
      month: istTime.getMonth() + 1,
      day: istTime.getDate(),
      hours: istTime.getHours(),
      minutes: istTime.getMinutes()
    };
  }
}

/**
 * Accurately determines if a machine slot on a specific date is in the past in IST.
 */
export function isSlotInPastIST(dateStr: string, slotStr: string): boolean {
  const todayIST = getTodayIST();
  if (dateStr < todayIST) return true;
  if (dateStr > todayIST) return false;

  const currentIST = getCurrentIST();
  const slotEnd = parseSlotEndTime(slotStr);

  if (slotEnd.hours < currentIST.hours) return true;
  if (slotEnd.hours === currentIST.hours && slotEnd.minutes <= currentIST.minutes) return true;

  return false;
}
