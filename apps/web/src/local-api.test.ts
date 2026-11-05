import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localApi } from "./local-api";

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
UID:holiday
SUMMARY:Holiday
DTSTART;VALUE=DATE:20261020
DTEND;VALUE=DATE:20261021
END:VEVENT
END:VCALENDAR`;

class MemoryStorage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("localApi", () => {
  it("creates, updates, lists, and deletes tasks across views", async () => {
    const task = await localApi.createTask({
      title: "Write report",
      importance: 80,
      urgency: 30
    });

    expect(task.title).toBe("Write report");
    expect(task.status).toBe("active");
    expect(await localApi.listTasks("active")).toHaveLength(1);

    const completed = await localApi.updateTask(task.id, {
      importance: 90,
      status: "completed"
    });
    expect(completed.importance).toBe(90);
    expect(completed.completedAt).not.toBeNull();

    expect(await localApi.listTasks("active")).toHaveLength(0);
    expect(await localApi.listTasks("completed")).toHaveLength(1);

    await localApi.deleteTask(task.id);
    expect(await localApi.listTasks("completed")).toHaveLength(0);
  });

  it("archives and restores tasks", async () => {
    const task = await localApi.createTask({ title: "Old task" });

    await localApi.updateTask(task.id, { archived: true });
    expect(await localApi.listTasks("active")).toHaveLength(0);
    expect(await localApi.listTasks("archived")).toHaveLength(1);

    await localApi.updateTask(task.id, { archived: false });
    expect(await localApi.listTasks("active")).toHaveLength(1);
    expect(await localApi.listTasks("archived")).toHaveLength(0);
  });

  it("attaches tags, sorts them, and removes them when the tag is deleted", async () => {
    const work = await localApi.createTag("work");
    const personal = await localApi.createTag("personal");
    const task = await localApi.createTask({
      title: "Plan",
      tagIds: [work.id, personal.id]
    });

    expect(task.tags.map((tag) => tag.name)).toEqual(["personal", "work"]);

    await localApi.deleteTag(work.id);
    const [after] = await localApi.listTasks("active");
    expect(after?.tags.map((tag) => tag.name)).toEqual(["personal"]);
  });

  it("rejects duplicate tag names", async () => {
    await localApi.createTag("work");
    await expect(localApi.createTag("work")).rejects.toThrow(
      "A tag with that name already exists"
    );
  });

  it("persists settings", async () => {
    const settings = await localApi.updateSettings({
      theme: "light",
      threshold: 60
    });

    expect(settings).toEqual({ theme: "light", threshold: 60 });
    expect(await localApi.getSettings()).toEqual({
      theme: "light",
      threshold: 60
    });
  });

  it("rejects invalid task input", async () => {
    await expect(localApi.createTask({ title: "   " })).rejects.toThrow();
  });

  it("stores a task schedule", async () => {
    const task = await localApi.createTask({
      title: "Scheduled",
      scheduledStart: "2026-10-19T01:00:00.000Z",
      scheduledEnd: "2026-10-19T02:00:00.000Z"
    });
    expect(task.scheduledStart).toBe("2026-10-19T01:00:00.000Z");

    const updated = await localApi.updateTask(task.id, {
      scheduledStart: null,
      scheduledEnd: null
    });
    expect(updated.scheduledStart).toBeNull();
    expect(updated.scheduledEnd).toBeNull();
  });

  it("imports an ICS file and expands its events", async () => {
    const calendar = await localApi.importCalendar({
      name: "Imported",
      ics: ICS
    });
    expect(calendar.sourceType).toBe("file");

    const events = await localApi.listCalendarEvents(
      "2026-10-18T00:00:00.000Z",
      "2026-10-25T00:00:00.000Z"
    );
    expect(events.some((event) => event.title === "Team meeting")).toBe(true);
    expect(events.some((event) => event.allDay)).toBe(true);
  });

  it("fetches a URL subscription directly and keeps a custom color", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ICS, {
        status: 200,
        headers: { "content-type": "text/calendar" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const calendar = await localApi.createCalendar({
      name: "Remote",
      url: "webcal://example.com/calendar.ics",
      color: "#3DDC97"
    });
    expect(calendar.url).toBe("https://example.com/calendar.ics");
    expect(calendar.color).toBe("#3DDC97");
    expect(calendar.lastError).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/calendar.ics",
      expect.objectContaining({
        headers: { Accept: "text/calendar, text/plain, */*" }
      })
    );

    const calendars = await localApi.listCalendars();
    expect(calendars).toHaveLength(1);

    const events = await localApi.listCalendarEvents(
      "2026-10-18T00:00:00.000Z",
      "2026-10-25T00:00:00.000Z"
    );
    expect(events.some((event) => event.title === "Team meeting")).toBe(true);
  });

  it("records a fetch failure instead of dropping the calendar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")));

    const calendar = await localApi.createCalendar({
      name: "Blocked",
      url: "https://example.com/calendar.ics"
    });

    expect(calendar.lastError).toContain("CORS");
    expect(await localApi.listCalendars()).toHaveLength(1);
  });

  it("updates a calendar color", async () => {
    const calendar = await localApi.importCalendar({
      name: "Imported",
      ics: ICS
    });

    const updated = await localApi.updateCalendar(calendar.id, {
      color: "#B388FF"
    });
    expect(updated.color).toBe("#B388FF");
    expect((await localApi.listCalendars())[0]?.color).toBe("#B388FF");
  });
});
