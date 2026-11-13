import ICAL from "ical.js";
import { z } from "zod";
import type { Task } from "./index";

export const CALENDAR_SOURCE_TYPES = ["url", "file"] as const;
export type CalendarSourceType = (typeof CALENDAR_SOURCE_TYPES)[number];

export interface CalendarSubscription {
  id: string;
  name: string;
  color: string;
  sourceType: CalendarSourceType;
  url: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export interface CalendarEvent {
  id: string;
  subscriptionId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  /** Inclusive start date (YYYY-MM-DD) for all-day events, avoiding timezone shifts. */
  startDate?: string | null;
  /** Exclusive end date (YYYY-MM-DD) for all-day events per RFC 5545. */
  endDate?: string | null;
  location: string | null;
  notes: string | null;
  url: string | null;
}

export const CALENDAR_PALETTE = [
  "#4EA8FF",
  "#B388FF",
  "#3DDC97",
  "#FFC857",
  "#FF7A90",
  "#9AA4B2",
  "#FF9F43"
] as const;

export function calendarColorFor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return CALENDAR_PALETTE[hash % CALENDAR_PALETTE.length]!;
}

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color");
const isoDateTimeSchema = z.string().datetime();

export const createCalendarSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1),
  color: colorSchema.optional(),
  proxyUrl: z.string().trim().url().optional()
});

export const importCalendarSchema = z.object({
  name: z.string().trim().min(1).max(60),
  ics: z.string().min(1).max(5_000_000),
  color: colorSchema.optional()
});

export const updateCalendarSubscriptionSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: colorSchema.optional()
  })
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    message: "Provide at least one field to update"
  });

export const calendarQuerySchema = z.object({
  start: isoDateTimeSchema,
  end: isoDateTimeSchema
});

export type CreateCalendarSubscriptionInput = z.infer<
  typeof createCalendarSubscriptionSchema
>;
export type ImportCalendarInput = z.infer<typeof importCalendarSchema>;
export type UpdateCalendarSubscriptionInput = z.infer<
  typeof updateCalendarSubscriptionSchema
>;

export function normalizeCalendarUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("webcal://")) {
    return `https://${trimmed.slice("webcal://".length)}`;
  }
  if (trimmed.startsWith("webcals://")) {
    return `https://${trimmed.slice("webcals://".length)}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidCalendarIcs(ics: string): boolean {
  try {
    const calendar = new ICAL.Component(ICAL.parse(ics));
    return calendar.name === "vcalendar";
  } catch {
    return false;
  }
}

interface ParsedOccurrence {
  event: ICAL.Event;
  start: Date;
  end: Date;
  allDay: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

const WINDOWS_TIMEZONE_MAP: Record<string, string> = {
  "china standard time": "Asia/Shanghai",
  "taipei standard time": "Asia/Taipei",
  "tokyo standard time": "Asia/Tokyo",
  "korea standard time": "Asia/Seoul",
  "singapore standard time": "Asia/Singapore",
  "india standard time": "Asia/Kolkata",
  "aus eastern standard time": "Australia/Sydney",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "romance standard time": "Europe/Paris",
  "eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "alaskan standard time": "America/Anchorage",
  "hawaiian standard time": "Pacific/Honolulu",
  "utc": "UTC"
};

const tzFormatters = new Map<string, Intl.DateTimeFormat | null>();

function normalizeTzid(rawTzid: string): string {
  let cleaned = rawTzid.trim().replace(/^"|"$/g, "");
  // Strip common Olson prefix forms like /mozilla.org/20050126_1/Asia/Shanghai
  if (cleaned.startsWith("/")) {
    const segments = cleaned.split("/").filter(Boolean);
    if (segments.length >= 3) {
      cleaned = segments.slice(-2).join("/");
    } else if (segments.length > 0) {
      cleaned = segments.join("/");
    }
  }
  const mapped = WINDOWS_TIMEZONE_MAP[cleaned.toLowerCase()];
  return mapped ?? cleaned;
}

function parseFixedOffsetMs(tzid: string): number | null {
  const match = tzid
    .trim()
    .match(/^(?:UTC|GMT)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (hours > 14 || minutes > 59) return null;
  return sign * (hours * 60 + minutes) * 60_000;
}

function zoneFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const normalized = normalizeTzid(timeZone);
  if (tzFormatters.has(normalized)) {
    return tzFormatters.get(normalized) ?? null;
  }

  let formatter: Intl.DateTimeFormat | null = null;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    formatter = null;
  }

  tzFormatters.set(normalized, formatter);
  return formatter;
}

/** Offset of `timeZone` at the given instant, in milliseconds (east positive). */
function zoneOffsetMs(formatter: Intl.DateTimeFormat, instant: number): number {
  const parts = formatter.formatToParts(new Date(instant));
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );

  return asUtc - instant;
}

/**
 * Convert a wall-clock ICAL time to an absolute instant using the IANA/mapped
 * zone or fixed offset it references. Two passes ensure times near DST switches
 * land on the right side of the transition.
 */
function wallClockToInstant(time: ICAL.Time, timeZone: string): Date | null {
  const wall = Date.UTC(
    time.year,
    time.month - 1,
    time.day,
    time.hour,
    time.minute,
    time.second
  );

  const fixedOffset = parseFixedOffsetMs(timeZone);
  if (fixedOffset !== null) {
    return new Date(wall - fixedOffset);
  }

  const formatter = zoneFormatter(timeZone);
  if (!formatter) return null;

  const firstOffset = zoneOffsetMs(formatter, wall);
  const guess = wall - firstOffset;
  const secondOffset = zoneOffsetMs(formatter, guess);

  return new Date(secondOffset === firstOffset ? guess : wall - secondOffset);
}

function toIcalDateKey(time: ICAL.Time): string {
  const year = String(time.year).padStart(4, "0");
  const month = String(time.month).padStart(2, "0");
  const day = String(time.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0));
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hasVtimezoneObservances(zone: ICAL.Timezone | null | undefined): boolean {
  const component = zone?.component;
  if (!component) return false;
  return Boolean(
    component.getFirstSubcomponent("standard") ||
      component.getFirstSubcomponent("daylight")
  );
}

function propertyTzid(event: ICAL.Event, propName: "dtstart" | "dtend"): string {
  const param = event.component.getFirstProperty(propName)?.getParameter("tzid");
  return typeof param === "string" ? param.trim() : "";
}

/**
 * ical.js falls back to treating the value as UTC or floating when a feed
 * references a TZID without observances or omits VTIMEZONE entirely. Resolve
 * such values through `Intl` / known zone mappings using the effective TZID.
 */
function toDate(
  time: ICAL.Time | null | undefined,
  fallbackTzid?: string
): Date | null {
  if (!time) return null;

  if (time.isDate) {
    return new Date(Date.UTC(time.year, time.month - 1, time.day, 0, 0, 0, 0));
  }

  const zoneTzid = time.zone?.tzid ?? "";
  if (
    zoneTzid === "UTC" ||
    ICAL.TimezoneService.has(zoneTzid) ||
    hasVtimezoneObservances(time.zone)
  ) {
    return time.toJSDate();
  }

  const effectiveTzid =
    zoneTzid && zoneTzid !== "floating"
      ? zoneTzid
      : (fallbackTzid ?? "").trim();

  if (!effectiveTzid || effectiveTzid === "floating") {
    return time.toJSDate();
  }
  if (effectiveTzid === "UTC") {
    return new Date(
      Date.UTC(
        time.year,
        time.month - 1,
        time.day,
        time.hour,
        time.minute,
        time.second
      )
    );
  }

  return wallClockToInstant(time, effectiveTzid) ?? time.toJSDate();
}

function textProperty(event: ICAL.Event, name: string): string | null {
  const value = event.component.getFirstPropertyValue(name);
  return typeof value === "string" && value.trim() ? value : null;
}

function durationMs(event: ICAL.Event): number | null {
  try {
    const dur = event.duration;
    if (!dur) return null;
    const ms = dur.toSeconds() * 1000;
    return ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

function resolveEnd(
  explicitEnd: ICAL.Time | null | undefined,
  event: ICAL.Event,
  start: Date,
  allDay: boolean,
  fallbackTzid?: string
): Date {
  const end = toDate(explicitEnd, fallbackTzid);
  if (end && end.getTime() > start.getTime()) return end;
  const fallbackMs = durationMs(event) ?? (allDay ? 86_400_000 : 3_600_000);
  return new Date(start.getTime() + fallbackMs);
}

function resolveAllDayDates(
  startTime: ICAL.Time,
  endTime: ICAL.Time | null | undefined
): { startDate: string; endDate: string; start: Date; end: Date } {
  const startDate = toIcalDateKey(startTime);
  const rawEndDate = endTime ? toIcalDateKey(endTime) : "";
  const endDate =
    rawEndDate && rawEndDate > startDate
      ? rawEndDate
      : addDaysToDateKey(startDate, 1);

  return {
    startDate,
    endDate,
    start: dateKeyToUtcDate(startDate),
    end: dateKeyToUtcDate(endDate)
  };
}

function overlaps(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  return start.getTime() < rangeEnd.getTime() && end.getTime() > rangeStart.getTime();
}

function toCalendarEvent(
  subscriptionId: string,
  occurrence: ParsedOccurrence,
  fallbackUid: string
): CalendarEvent {
  const { event, start, end, allDay, startDate, endDate } = occurrence;
  const uid = event.uid || fallbackUid;
  return {
    id: `${subscriptionId}:${uid}:${start.toISOString()}`,
    subscriptionId,
    title: event.summary || "(No title)",
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    ...(allDay ? { startDate: startDate ?? null, endDate: endDate ?? null } : {}),
    location: event.location || null,
    notes: event.description || null,
    url: textProperty(event, "url")
  };
}

/**
 * Parse an ICS feed and expand recurring events into the requested range.
 * Recurrence exceptions and EXDATEs are handled by ical.js, while standalone
 * RECURRENCE-ID components (without a master RRULE) are preserved.
 */
export function parseCalendarEvents(
  ics: string,
  rangeStart: Date,
  rangeEnd: Date,
  subscriptionId: string
): CalendarEvent[] {
  let calendar: ICAL.Component;
  try {
    calendar = new ICAL.Component(ICAL.parse(ics));
  } catch {
    throw new Error("Could not parse this calendar file.");
  }

  const vevents = calendar.getAllSubcomponents("vevent");
  const masterRecurringUids = new Set<string>();
  for (const component of vevents) {
    if (component.hasProperty("recurrence-id")) continue;
    const candidate = new ICAL.Event(component);
    if (candidate.isRecurring() && candidate.uid) {
      masterRecurringUids.add(candidate.uid);
    }
  }

  // Pad all-day range checks by 1 day on each side so server/client timezone
  // differences never clip an all-day event; the UI matches exact YYYY-MM-DD keys.
  const allDayRangeStart = new Date(rangeStart.getTime() - 86_400_000);
  const allDayRangeEnd = new Date(rangeEnd.getTime() + 86_400_000);

  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  const maxEvents = 5000;
  const maxIterations = 100_000;
  let index = 0;

  for (const component of vevents) {
    index++;
    const event = new ICAL.Event(component);

    if (
      component.hasProperty("recurrence-id") &&
      event.uid &&
      masterRecurringUids.has(event.uid)
    ) {
      continue;
    }

    if (event.component.getFirstPropertyValue("status") === "CANCELLED") {
      continue;
    }

    const startTzid = propertyTzid(event, "dtstart");
    const endTzid = propertyTzid(event, "dtend") || startTzid;

    if (!event.isRecurring()) {
      if (!event.startDate) continue;
      const allDay = Boolean(event.startDate.isDate);
      let start: Date | null;
      let end: Date;
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (allDay) {
        const resolved = resolveAllDayDates(event.startDate, event.endDate);
        start = resolved.start;
        end = resolved.end;
        startDate = resolved.startDate;
        endDate = resolved.endDate;
        if (!overlaps(start, end, allDayRangeStart, allDayRangeEnd)) continue;
      } else {
        start = toDate(event.startDate, startTzid);
        if (!start) continue;
        end = resolveEnd(event.endDate, event, start, false, endTzid);
        if (!overlaps(start, end, rangeStart, rangeEnd)) continue;
      }

      const parsed = toCalendarEvent(
        subscriptionId,
        { event, start, end, allDay, startDate, endDate },
        `event-${index}`
      );
      if (!seen.has(parsed.id)) {
        seen.add(parsed.id);
        events.push(parsed);
      }
      continue;
    }

    const iterator = event.iterator();
    let iterations = 0;
    while (iterations < maxIterations && events.length < maxEvents) {
      iterations++;
      const next = iterator.next();
      if (!next) break;

      const occurrenceStart = toDate(next, startTzid);
      if (!occurrenceStart) break;
      const effectiveRangeEnd = next.isDate ? allDayRangeEnd : rangeEnd;
      if (occurrenceStart.getTime() > effectiveRangeEnd.getTime()) break;

      const details = event.getOccurrenceDetails(next);
      const occurrenceEvent = details.item;
      if (
        occurrenceEvent.component.getFirstPropertyValue("status") ===
        "CANCELLED"
      ) {
        continue;
      }

      const occStartTzid = propertyTzid(occurrenceEvent, "dtstart") || startTzid;
      const occEndTzid = propertyTzid(occurrenceEvent, "dtend") || occStartTzid;
      const allDay = Boolean(details.startDate.isDate);
      let start: Date | null;
      let end: Date;
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (allDay) {
        const resolved = resolveAllDayDates(details.startDate, details.endDate);
        start = resolved.start;
        end = resolved.end;
        startDate = resolved.startDate;
        endDate = resolved.endDate;
        if (!overlaps(start, end, allDayRangeStart, allDayRangeEnd)) continue;
      } else {
        start = toDate(details.startDate, occStartTzid);
        if (!start) continue;
        end = resolveEnd(details.endDate, occurrenceEvent, start, false, occEndTzid);
        if (!overlaps(start, end, rangeStart, rangeEnd)) continue;
      }

      const parsed = toCalendarEvent(
        subscriptionId,
        { event: occurrenceEvent, start, end, allDay, startDate, endDate },
        `event-${index}`
      );
      if (!seen.has(parsed.id)) {
        seen.add(parsed.id);
        events.push(parsed);
      }
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

export type CalendarExportScope = "scheduled" | "scheduled_and_due";

export interface ExportTasksToIcsOptions {
  calendarName?: string;
  scope?: CalendarExportScope;
  includeCompleted?: boolean;
  externalEvents?: CalendarEvent[];
  now?: Date;
}

export interface ExportableCalendarCounts {
  total: number;
  scheduled: number;
  due: number;
  external: number;
}

const EXPORT_LOOKBACK_DAYS = 60;
const EXPORT_LOOKAHEAD_DAYS = 300;

/** Default 360-day window used when exporting imported external calendar feeds. */
export function getDefaultCalendarExportRange(now = new Date()): {
  start: Date;
  end: Date;
} {
  return {
    start: new Date(now.getTime() - EXPORT_LOOKBACK_DAYS * 86_400_000),
    end: new Date(now.getTime() + EXPORT_LOOKAHEAD_DAYS * 86_400_000)
  };
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function utf8CharBytes(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/** Fold an iCalendar content line at 75 UTF-8 octets per RFC 5545 Section 3.1. */
function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = utf8CharBytes(char);
    const limit = parts.length === 0 ? 75 : 74; // Continuation lines start with 1 space.
    if (currentBytes + charBytes > limit && current.length > 0) {
      parts.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current.length > 0) parts.push(current);

  return parts.join("\r\n ");
}

function formatIcsUtcDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function isExportableTask(task: Task, includeCompleted: boolean): boolean {
  if (task.archivedAt !== null) return false;
  if (!includeCompleted && task.status === "completed") return false;
  return true;
}

function hasValidSchedule(task: Task): boolean {
  if (!task.scheduledStart || !task.scheduledEnd) return false;
  const start = new Date(task.scheduledStart).getTime();
  const end = new Date(task.scheduledEnd).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function isValidDateKey(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function countExportableCalendarEvents(
  tasks: Task[],
  options: Pick<
    ExportTasksToIcsOptions,
    "scope" | "includeCompleted" | "externalEvents"
  > = {}
): ExportableCalendarCounts {
  const scope = options.scope ?? "scheduled_and_due";
  const includeCompleted = options.includeCompleted ?? false;
  let scheduled = 0;
  let due = 0;

  for (const task of tasks) {
    if (!isExportableTask(task, includeCompleted)) continue;
    if (hasValidSchedule(task)) {
      scheduled++;
    } else if (scope === "scheduled_and_due" && isValidDateKey(task.dueDate)) {
      due++;
    }
  }

  const external = options.externalEvents?.length ?? 0;
  return { total: scheduled + due + external, scheduled, due, external };
}

function buildTaskDescription(task: Task, isDueOnly: boolean): string {
  const lines: string[] = [];
  if (isDueOnly) {
    lines.push("Eisenhower Matrix · Due Date");
  } else {
    lines.push("Eisenhower Matrix · Time Block");
  }
  lines.push(`Importance: ${task.importance} | Urgency: ${task.urgency}`);
  if (task.firstAction?.trim()) {
    lines.push(`First step: ${task.firstAction.trim()}`);
  }
  if (task.checklists.length > 0) {
    const done = task.checklists.filter((item) => item.done).length;
    lines.push(`Checklist: ${done}/${task.checklists.length}`);
  }
  if (task.notes.trim()) {
    lines.push("", task.notes.trim());
  }
  return lines.join("\n");
}

/**
 * Serialize Eisenhower Matrix tasks (scheduled blocks and optionally due dates)
 * into an RFC 5545 compliant iCalendar (.ics) document.
 */
export function exportTasksToIcs(
  tasks: Task[],
  options: ExportTasksToIcsOptions = {}
): string {
  const calendarName = options.calendarName?.trim() || "Eisenhower Matrix";
  const scope = options.scope ?? "scheduled_and_due";
  const includeCompleted = options.includeCompleted ?? false;
  const dtStamp = formatIcsUtcDateTime(options.now ?? new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eisenhower Matrix//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M"
  ];

  for (const task of tasks) {
    if (!isExportableTask(task, includeCompleted)) continue;

    const scheduled = hasValidSchedule(task);
    const dueOnly = !scheduled && scope === "scheduled_and_due" && isValidDateKey(task.dueDate);
    if (!scheduled && !dueOnly) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(
      `UID:${task.id}${dueOnly ? "-due" : ""}@eisenhower-matrix`
    );
    lines.push(`DTSTAMP:${dtStamp}`);

    if (scheduled) {
      lines.push(`DTSTART:${formatIcsUtcDateTime(new Date(task.scheduledStart!))}`);
      lines.push(`DTEND:${formatIcsUtcDateTime(new Date(task.scheduledEnd!))}`);
    } else {
      const startCompact = task.dueDate!.replaceAll("-", "");
      const endCompact = addDaysToDateKey(task.dueDate!, 1).replaceAll("-", "");
      lines.push(`DTSTART;VALUE=DATE:${startCompact}`);
      lines.push(`DTEND;VALUE=DATE:${endCompact}`);
      lines.push("TRANSP:TRANSPARENT");
    }

    lines.push(`SUMMARY:${escapeIcsText(task.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(buildTaskDescription(task, dueOnly))}`);
    if (task.tags.length > 0) {
      lines.push(
        `CATEGORIES:${task.tags.map((tag) => escapeIcsText(tag.name)).join(",")}`
      );
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  for (const event of options.externalEvents ?? []) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@eisenhower-matrix-ext`);
    lines.push(`DTSTAMP:${dtStamp}`);

    if (event.allDay && isValidDateKey(event.startDate ?? null)) {
      const startKey = event.startDate!;
      const endKey =
        isValidDateKey(event.endDate ?? null) && event.endDate! > startKey
          ? event.endDate!
          : addDaysToDateKey(startKey, 1);
      lines.push(`DTSTART;VALUE=DATE:${startKey.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${endKey.replaceAll("-", "")}`);
      lines.push("TRANSP:TRANSPARENT");
    } else {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      if (
        !Number.isFinite(startDate.getTime()) ||
        !Number.isFinite(endDate.getTime()) ||
        endDate.getTime() <= startDate.getTime()
      ) {
        lines.pop();
        lines.pop();
        lines.pop();
        continue;
      }
      lines.push(`DTSTART:${formatIcsUtcDateTime(startDate)}`);
      lines.push(`DTEND:${formatIcsUtcDateTime(endDate)}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title || "Untitled event")}`);
    if (event.location?.trim()) {
      lines.push(`LOCATION:${escapeIcsText(event.location.trim())}`);
    }
    if (event.notes?.trim()) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.notes.trim())}`);
    }
    if (event.url?.trim()) {
      lines.push(`URL:${event.url.trim()}`);
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
