import { describe, expect, it } from "vitest";
import {
  countExportableCalendarEvents,
  exportTasksToIcs,
  isValidCalendarIcs,
  normalizeCalendarUrl,
  parseCalendarEvents,
  type Task
} from "@eisenhower/shared";
import { combineLocal, layoutDayItems, timeFromIso } from "./calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:meeting
SUMMARY:Team meeting
DTSTART:20261019T090000Z
DTEND:20261019T100000Z
END:VEVENT
BEGIN:VEVENT
UID:standup
SUMMARY:Daily standup
DTSTART:20261019T010000Z
DTEND:20261019T011500Z
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
BEGIN:VEVENT
UID:standup
RECURRENCE-ID:20261021T010000Z
SUMMARY:Standup moved
DTSTART:20261021T020000Z
DTEND:20261021T021500Z
END:VEVENT
BEGIN:VEVENT
UID:holiday
SUMMARY:Holiday
DTSTART;VALUE=DATE:20261020
DTEND;VALUE=DATE:20261021
END:VEVENT
END:VCALENDAR`;

const RANGE_START = new Date("2026-10-18T00:00:00Z");
const RANGE_END = new Date("2026-10-25T00:00:00Z");

describe("calendar parsing", () => {
  it("parses timed, all-day, recurring, and moved occurrences", () => {
    const events = parseCalendarEvents(
      ICS,
      RANGE_START,
      RANGE_END,
      "calendar-1"
    );

    const meeting = events.find((event) => event.title === "Team meeting");
    expect(meeting?.start).toBe("2026-10-19T09:00:00.000Z");
    expect(meeting?.allDay).toBe(false);

    const holiday = events.find((event) => event.title === "Holiday");
    expect(holiday?.allDay).toBe(true);
    expect(holiday?.startDate).toBe("2026-10-20");
    expect(holiday?.endDate).toBe("2026-10-21");

    const standups = events.filter(
      (event) =>
        event.title === "Daily standup" || event.title === "Standup moved"
    );
    expect(standups).toHaveLength(5);
    expect(
      standups.some((event) => event.title === "Standup moved")
    ).toBe(true);

    // Every non-overridden occurrence must keep its 15-minute duration, not fall back to 1h.
    const secondStandup = standups.find(
      (event) => event.start === "2026-10-20T01:00:00.000Z"
    );
    expect(secondStandup?.end).toBe("2026-10-20T01:15:00.000Z");
  });

  it("preserves standalone RECURRENCE-ID events without a master RRULE", () => {
    const events = parseCalendarEvents(
      `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:single-occ
RECURRENCE-ID:20261020T090000Z
SUMMARY:Single Exception Invite
DTSTART:20261020T090000Z
DTEND:20261020T094500Z
END:VEVENT
END:VCALENDAR`,
      RANGE_START,
      RANGE_END,
      "calendar-1"
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Single Exception Invite");
    expect(events[0]?.end).toBe("2026-10-20T09:45:00.000Z");
  });

  it("resolves common Windows TZIDs without VTIMEZONE", () => {
    const events = parseCalendarEvents(
      `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:win-pst
SUMMARY:US Sync
DTSTART;TZID=Pacific Standard Time:20261019T090000
DTEND;TZID=Pacific Standard Time:20261019T100000
END:VEVENT
END:VCALENDAR`,
      RANGE_START,
      RANGE_END,
      "calendar-1"
    );

    // October 19 is PDT (UTC-7): 09:00 PDT = 16:00 UTC.
    expect(events[0]?.start).toBe("2026-10-19T16:00:00.000Z");
    expect(events[0]?.end).toBe("2026-10-19T17:00:00.000Z");
  });

  it("keeps the wall clock of a TZID whose VTIMEZONE is empty", () => {
    const events = parseCalendarEvents(
      `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTIMEZONE
TZID:Asia/Hong_Kong
END:VTIMEZONE
BEGIN:VEVENT
UID:hk-class
SUMMARY:Computer Fundamentals
DTSTART;TZID=Asia/Hong_Kong:20261019T090000
DTEND;TZID=Asia/Hong_Kong:20261019T110000
END:VEVENT
END:VCALENDAR`,
      RANGE_START,
      RANGE_END,
      "calendar-1"
    );

    // 09:00 in Hong Kong (UTC+8) is 01:00 UTC — not 09:00 UTC.
    expect(events[0]?.start).toBe("2026-10-19T01:00:00.000Z");
    expect(events[0]?.end).toBe("2026-10-19T03:00:00.000Z");
  });

  it("ignores events outside the requested range", () => {
    const events = parseCalendarEvents(
      ICS,
      new Date("2026-11-01T00:00:00Z"),
      new Date("2026-11-08T00:00:00Z"),
      "calendar-1"
    );
    expect(events).toHaveLength(0);
  });

  it("validates ICS content", () => {
    expect(isValidCalendarIcs(ICS)).toBe(true);
    expect(isValidCalendarIcs("not a calendar")).toBe(false);
  });

  it("normalizes webcal URLs", () => {
    expect(normalizeCalendarUrl("webcal://example.com/calendar.ics")).toBe(
      "https://example.com/calendar.ics"
    );
    expect(normalizeCalendarUrl("example.com/calendar.ics")).toBe(
      "https://example.com/calendar.ics"
    );
    expect(normalizeCalendarUrl("https://example.com/calendar.ics")).toBe(
      "https://example.com/calendar.ics"
    );
  });
});

describe("calendar layout helpers", () => {
  it("round-trips local date and time", () => {
    const iso = combineLocal("2026-10-20", "09:30");
    expect(timeFromIso(iso)).toBe("09:30");
    expect(new Date(iso).getDate()).toBe(20);
  });

  it("places overlapping items side by side", () => {
    const positioned = layoutDayItems([
      { id: "a", start: "2026-10-20T09:00:00.000Z", end: "2026-10-20T10:00:00.000Z" },
      { id: "b", start: "2026-10-20T09:30:00.000Z", end: "2026-10-20T10:30:00.000Z" },
      { id: "c", start: "2026-10-20T11:00:00.000Z", end: "2026-10-20T12:00:00.000Z" }
    ]);

    const a = positioned.find((item) => item.item.id === "a")!;
    const b = positioned.find((item) => item.item.id === "b")!;
    const c = positioned.find((item) => item.item.id === "c")!;

    expect(a.columns).toBe(2);
    expect(b.columns).toBe(2);
    expect(a.column).not.toBe(b.column);
    expect(a.conflict).toBe(true);
    expect(c.columns).toBe(1);
    expect(c.conflict).toBe(false);
  });
});

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Task",
    notes: "",
    importance: 80,
    urgency: 70,
    dueDate: null,
    scheduledStart: null,
    scheduledEnd: null,
    status: "active",
    completedAt: null,
    archivedAt: null,
    recurrence: "none",
    streak: 0,
    lastCompletedAt: null,
    firstAction: null,
    checklists: [],
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    tags: [],
    ...overrides
  };
}

describe("calendar ICS export", () => {
  it("exports scheduled blocks and due-date tasks as round-trippable ICS", () => {
    const tasks: Task[] = [
      makeTask({
        id: "t-sched",
        title: "深度工作; 方案设计, 第一期",
        notes: "Line 1\nLine 2",
        firstAction: "打开文档",
        scheduledStart: "2026-10-19T01:00:00.000Z",
        scheduledEnd: "2026-10-19T02:30:00.000Z",
        tags: [{ id: "tag1", name: "Work", color: "#4EA8FF" }]
      }),
      makeTask({
        id: "t-due",
        title: "Submit Tax",
        dueDate: "2026-10-20"
      }),
      makeTask({
        id: "t-done",
        title: "Done Task",
        status: "completed",
        scheduledStart: "2026-10-21T03:00:00.000Z",
        scheduledEnd: "2026-10-21T04:00:00.000Z"
      }),
      makeTask({
        id: "t-arch",
        title: "Archived Task",
        archivedAt: "2026-10-18T00:00:00.000Z",
        scheduledStart: "2026-10-21T05:00:00.000Z",
        scheduledEnd: "2026-10-21T06:00:00.000Z"
      })
    ];

    expect(countExportableCalendarEvents(tasks)).toEqual({
      total: 2,
      scheduled: 1,
      due: 1,
      external: 0
    });
    expect(
      countExportableCalendarEvents(tasks, {
        scope: "scheduled",
        includeCompleted: true
      })
    ).toEqual({
      total: 2,
      scheduled: 2,
      due: 0,
      external: 0
    });

    const ics = exportTasksToIcs(tasks);
    expect(isValidCalendarIcs(ics)).toBe(true);

    const parsed = parseCalendarEvents(ics, RANGE_START, RANGE_END, "export");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.title).toBe("深度工作; 方案设计, 第一期");
    expect(parsed[0]?.start).toBe("2026-10-19T01:00:00.000Z");
    expect(parsed[0]?.end).toBe("2026-10-19T02:30:00.000Z");
    expect(parsed[1]?.title).toBe("Submit Tax");
    expect(parsed[1]?.allDay).toBe(true);
    expect(parsed[1]?.startDate).toBe("2026-10-20");
    expect(parsed[1]?.endDate).toBe("2026-10-21");
  });
});
