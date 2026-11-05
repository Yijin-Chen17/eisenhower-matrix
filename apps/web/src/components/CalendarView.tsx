import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  dueLabel,
  dueState,
  quadrantOf,
  type CalendarEvent,
  type Task
} from "@eisenhower/shared";
import { useCalendarEvents, useCalendars, useRefreshAllCalendars } from "../hooks";
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  GRID_MINUTES,
  HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  REST_END_HOUR,
  REST_START_MINUTES,
  addDays,
  atHour,
  addWeeks,
  formatHour,
  formatTime,
  localDateKey,
  layoutDayItems,
  overlaps,
  startOfWeek,
  weekLabel,
  type PositionedItem
} from "../lib/calendar";
import { CalendarsDialog } from "./CalendarsDialog";

interface CalendarViewProps {
  tasks: Task[];
  threshold: number;
  selectedId: string | null;
  onSelect: (task: Task) => void;
  onError: (message: string) => void;
}

type TimedSegment =
  | {
      kind: "event";
      id: string;
      start: string;
      end: string;
      event: CalendarEvent;
      color: string;
    }
  | {
      kind: "task";
      id: string;
      start: string;
      end: string;
      task: Task;
      qClass: string;
    };

interface DayData {
  date: Date;
  key: string;
  windowStartMs: number;
  allDay: CalendarEvent[];
  due: Task[];
  timed: Array<PositionedItem<TimedSegment>>;
}

/** Hours from 07:00 up to (not including) the rest band, used for axis labels. */
const DAY_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, index) => CALENDAR_START_HOUR + index
);
/** Rest band labels: 01:00 … 07:00 (00:00 shares the 24:00 boundary label). */
const REST_HOURS = Array.from(
  { length: REST_END_HOUR },
  (_, index) => index + 1
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function segmentRange(
  start: string,
  end: string,
  dayStart: string,
  dayEnd: string
): { start: string; end: string } | null {
  if (!overlaps(start, end, dayStart, dayEnd)) return null;
  return {
    start: new Date(
      Math.max(new Date(start).getTime(), new Date(dayStart).getTime())
    ).toISOString(),
    end: new Date(
      Math.min(new Date(end).getTime(), new Date(dayEnd).getTime())
    ).toISOString()
  };
}

function blockStyle(
  segment: TimedSegment,
  windowStartMs: number,
  hourHeight: number
): CSSProperties {
  const minutesIntoGrid = (iso: string) =>
    clamp((new Date(iso).getTime() - windowStartMs) / 60_000, 0, GRID_MINUTES);

  const startMinutes = minutesIntoGrid(segment.start);
  const endMinutes = Math.max(minutesIntoGrid(segment.end), startMinutes + 15);

  return {
    top: (startMinutes / 60) * hourHeight,
    height: Math.max(15, ((endMinutes - startMinutes) / 60) * hourHeight)
  };
}

function sortDue(a: Task, b: Task): number {
  return (
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
    b.importance - a.importance ||
    b.urgency - a.urgency
  );
}

export function CalendarView({
  tasks,
  threshold,
  selectedId,
  onSelect,
  onError
}: CalendarViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT);

  const scrollRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);

  const calendarsQuery = useCalendars();
  const calendars = calendarsQuery.data ?? [];
  const refreshAll = useRefreshAllCalendars();

  const rangeStart = weekStart.toISOString();
  // Sunday's column runs into Monday 07:00, so fetch one extra day.
  const rangeEnd = addDays(weekStart, 8).toISOString();
  const eventsQuery = useCalendarEvents(rangeStart, rangeEnd);
  const events = eventsQuery.data ?? [];

  const calendarsById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedEvent) {
        setSelectedEvent(null);
        return;
      }
      if (dialogOpen) setDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEvent, dialogOpen]);

  const todayKey = localDateKey(new Date());
  const weekStartKey = localDateKey(weekStart);

  const dayData = useMemo<DayData[]>(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const key = localDateKey(date);
      const windowStart = atHour(date, CALENDAR_START_HOUR);
      const windowEnd = atHour(addDays(date, 1), CALENDAR_START_HOUR);
      const windowStartIso = windowStart.toISOString();
      const windowEndIso = windowEnd.toISOString();
      const allDay: CalendarEvent[] = [];
      const timed: TimedSegment[] = [];

      for (const event of events) {
        if (event.allDay) {
          const startsOn = localDateKey(new Date(event.start));
          const endsOn = localDateKey(new Date(event.end));
          if (key >= startsOn && key < endsOn) allDay.push(event);
          continue;
        }
        const range = segmentRange(
          event.start,
          event.end,
          windowStartIso,
          windowEndIso
        );
        if (!range) continue;
        timed.push({
          kind: "event",
          id: `event:${event.id}`,
          start: range.start,
          end: range.end,
          event,
          color: calendarsById.get(event.subscriptionId)?.color ?? "#4EA8FF"
        });
      }

      for (const task of tasks) {
        if (!task.scheduledStart || !task.scheduledEnd) continue;
        const range = segmentRange(
          task.scheduledStart,
          task.scheduledEnd,
          windowStartIso,
          windowEndIso
        );
        if (!range) continue;
        const quadrant = quadrantOf(task, threshold);
        timed.push({
          kind: "task",
          id: `task:${task.id}`,
          start: range.start,
          end: range.end,
          task,
          qClass: quadrant === "pending" ? "pending" : `q${quadrant}`
        });
      }

      const due = tasks
        .filter((task) => task.dueDate === key)
        .sort(sortDue);

      return {
        date,
        key,
        windowStartMs: windowStart.getTime(),
        allDay: allDay.sort((a, b) => a.title.localeCompare(b.title)),
        due,
        timed: layoutDayItems(timed)
      };
    });
  }, [weekStart, events, tasks, threshold, calendarsById]);

  /**
   * Scale the grid so that 07:00–24:00 always fills the visible area; the rest
   * band then lives just below the fold.
   */
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const axis = axisRef.current;
    if (!scroll || !axis) return;

    const update = () => {
      // `offsetTop` is layout based, so scrolling never skews the measurement.
      const headerBlock = axis.offsetTop - scroll.offsetTop;
      // Leave room for the 24:00 label plus a hint of the rest band.
      const available = scroll.clientHeight - headerBlock - 20;
      const perHour = Math.floor(
        available / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)
      );
      setHourHeight(clamp(perHour, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [dayData]);

  const overdue = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate !== null && task.dueDate < weekStartKey)
        .sort(sortDue),
    [tasks, weekStartKey]
  );

  const dueGroups = dayData.filter((day) => day.due.length > 0);

  async function refreshNow() {
    try {
      await refreshAll.mutateAsync();
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Could not refresh calendars"
      );
    }
  }

  const error = eventsQuery.error ?? calendarsQuery.error;

  const gridHeight = (GRID_MINUTES / 60) * hourHeight;
  const restTop = (REST_START_MINUTES / 60) * hourHeight;
  const restHeight = ((GRID_MINUTES - REST_START_MINUTES) / 60) * hourHeight;
  const compactBelow = Math.max(30, hourHeight * 0.85);

  return (
    <div className="calendar-view">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button
            className="cal-nav-btn"
            aria-label="Previous week"
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
          >
            ‹
          </button>
          <button
            className="small-btn"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Today
          </button>
          <button
            className="cal-nav-btn"
            aria-label="Next week"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          >
            ›
          </button>
          <span className="cal-range">{weekLabel(weekStart)}</span>
        </div>

        <div className="cal-actions">
          {eventsQuery.isFetching && <span className="cal-sync">Syncing…</span>}
          <button className="small-btn" onClick={() => setDialogOpen(true)}>
            Calendars
          </button>
          <button
            className="small-btn"
            onClick={() => void refreshNow()}
            disabled={refreshAll.isPending}
          >
            {refreshAll.isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="cal-error" role="status">
          {error instanceof Error ? error.message : "Could not load calendars"}
        </div>
      )}

      <div className="cal-body">
        <aside className="cal-due">
          <div className="cal-due-head">
            <h3>Due</h3>
            <span>This week</span>
          </div>
          <div className="cal-due-body">
            {overdue.length > 0 && (
              <div className="cal-due-group overdue">
                <h4>Overdue</h4>
                {overdue.map((task) => (
                  <DueTask
                    key={task.id}
                    task={task}
                    threshold={threshold}
                    selected={task.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}

            {dueGroups.map((day) => (
              <div className="cal-due-group" key={day.key}>
                <h4>
                  {day.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  })}
                </h4>
                {day.due.map((task) => (
                  <DueTask
                    key={task.id}
                    task={task}
                    threshold={threshold}
                    selected={task.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ))}

            {overdue.length === 0 && dueGroups.length === 0 && (
              <p className="cal-due-empty">No due tasks this week.</p>
            )}
          </div>
        </aside>

        <div className="cal-main">
          <div className="cal-scroll" ref={scrollRef}>
            <div
              className="cal-grid"
              style={{ ["--hour-height" as string]: `${hourHeight}px` }}
            >
              <div className="cal-head-gutter" />
              {dayData.map((day) => (
                <div
                  className={`cal-day-head${
                    day.key === todayKey ? " today" : ""
                  }`}
                  key={`head-${day.key}`}
                >
                  <span>
                    {day.date.toLocaleDateString("en-US", {
                      weekday: "short"
                    })}
                  </span>
                  <strong>{day.date.getDate()}</strong>
                </div>
              ))}

              <div className="cal-allday-label">All-day</div>
              {dayData.map((day) => (
                <div className="cal-allday-cell" key={`allday-${day.key}`}>
                  {day.allDay.map((event) => (
                    <button
                      key={event.id}
                      className="cal-allday-event"
                      style={
                        {
                          ["--cal-color" as string]:
                            calendarsById.get(event.subscriptionId)?.color ??
                            "#4EA8FF"
                        } as CSSProperties
                      }
                      onClick={() => setSelectedEvent(event)}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              ))}

              <div
                className="cal-time-axis"
                ref={axisRef}
                style={{ height: gridHeight }}
              >
                {DAY_HOURS.map((hour) => (
                  <span
                    key={hour}
                    className="cal-hour-label"
                    style={{ top: (hour - CALENDAR_START_HOUR) * hourHeight }}
                  >
                    {formatHour(hour)}
                  </span>
                ))}
                <span
                  className="cal-hour-label split"
                  style={{ top: restTop }}
                >
                  {formatHour(CALENDAR_END_HOUR)}
                </span>
                {REST_HOURS.map((hour) => (
                  <span
                    key={`rest-${hour}`}
                    className={`cal-hour-label rest${
                      hour === REST_END_HOUR ? " last" : ""
                    }`}
                    style={{
                      top:
                        (CALENDAR_END_HOUR -
                          CALENDAR_START_HOUR +
                          hour) *
                        hourHeight
                    }}
                  >
                    {formatHour(hour)}
                  </span>
                ))}
                <span
                  className="cal-rest-band"
                  style={{ top: restTop, height: restHeight }}
                  aria-hidden="true"
                />
              </div>

              {dayData.map((day) => (
                <div
                  className={`cal-day-col${
                    day.key === todayKey ? " today" : ""
                  }`}
                  key={`col-${day.key}`}
                  style={{ height: gridHeight }}
                >
                  <div
                    className="cal-rest-zone"
                    style={{ top: restTop, height: restHeight }}
                    aria-hidden="true"
                  />
                  {day.timed.map((positioned) => {
                    const segment = positioned.item;
                    const width = 100 / positioned.columns;
                    const style: CSSProperties = {
                      ...blockStyle(segment, day.windowStartMs, hourHeight),
                      left: `${positioned.column * width}%`,
                      width: `calc(${width}% - 4px)`,
                      ["--cal-color" as string]:
                        segment.kind === "event"
                          ? segment.color
                          : "var(--q)"
                    };
                    const conflict = positioned.conflict ? " conflict" : "";
                    const compact =
                      (style.height as number) < compactBelow
                        ? " compact"
                        : "";

                    if (segment.kind === "task") {
                      return (
                        <button
                          key={segment.id}
                          className={`cal-block task ${segment.qClass}${conflict}${compact}${
                            segment.task.id === selectedId ? " selected" : ""
                          }`}
                          style={style}
                          onClick={() => onSelect(segment.task)}
                          title={`${segment.task.title} · ${formatTime(
                            segment.start
                          )}–${formatTime(segment.end)}`}
                        >
                          <span className="cal-block-time">
                            {formatTime(segment.start)}
                          </span>
                          <span className="cal-block-title">
                            {segment.task.title}
                          </span>
                          <span className="cal-block-due">
                            {segment.task.dueDate
                              ? dueLabel(segment.task.dueDate)
                              : ""}
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={segment.id}
                        className={`cal-block event${conflict}${compact}`}
                        style={style}
                        onClick={() => setSelectedEvent(segment.event)}
                        title={`${segment.event.title} · ${formatTime(
                          segment.start
                        )}–${formatTime(segment.end)}`}
                      >
                        <span className="cal-block-time">
                          {formatTime(segment.start)}
                        </span>
                        <span className="cal-block-title">
                          {segment.event.title}
                        </span>
                        {segment.event.location && (
                          <span className="cal-block-location">
                            {segment.event.location}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <CalendarsDialog
          onClose={() => setDialogOpen(false)}
          onError={onError}
        />
      )}

      {selectedEvent && (
        <EventDialog
          event={selectedEvent}
          calendarName={
            calendarsById.get(selectedEvent.subscriptionId)?.name ?? "Calendar"
          }
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

function DueTask({
  task,
  threshold,
  selected,
  onSelect
}: {
  task: Task;
  threshold: number;
  selected: boolean;
  onSelect: (task: Task) => void;
}) {
  const quadrant = quadrantOf(task, threshold);
  const qClass = quadrant === "pending" ? "pending" : `q${quadrant}`;
  const state = dueState(task.dueDate);

  return (
    <button
      className={`cal-due-item ${qClass}${selected ? " selected" : ""}`}
      onClick={() => onSelect(task)}
    >
      <i aria-hidden="true" />
      <span className="cal-due-copy">
        <strong>{task.title}</strong>
        <span className={state === "overdue" ? "overdue" : ""}>
          {task.scheduledStart ? "Scheduled · " : ""}
          {task.dueDate ? dueLabel(task.dueDate) : ""}
        </span>
      </span>
    </button>
  );
}

function EventDialog({
  event,
  calendarName,
  onClose
}: {
  event: CalendarEvent;
  calendarName: string;
  onClose: () => void;
}) {
  const dateLabel = new Date(event.start).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  const range = event.allDay
    ? "All day"
    : `${formatTime(event.start)} – ${formatTime(event.end)}`;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        className="modal cal-event-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Calendar event"
      >
        <div className="modal-header">
          <div>
            <h2>{event.title}</h2>
            <p>
              {calendarName} · {dateLabel} · {range}
            </p>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cal-event-details">
          {event.location && (
            <p>
              <strong>Location</strong>
              {event.location}
            </p>
          )}
          {event.notes && <p className="cal-event-notes">{event.notes}</p>}
          {event.url && (
            <a href={event.url} target="_blank" rel="noreferrer">
              Open event link
            </a>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
