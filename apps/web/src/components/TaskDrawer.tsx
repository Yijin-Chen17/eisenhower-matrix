import { useEffect, useRef, useState } from "react";
import {
  QUADRANTS,
  clampScore,
  dueLabel,
  dueState,
  quadrantOf,
  type RecurrenceRule,
  type Tag,
  type Task,
  type TaskChecklistItem
} from "@eisenhower/shared";
import type { UpdateTaskInput } from "../api";
import { DateInput } from "./DateInput";
import { translations, type Locale } from "../lib/i18n";
import {
  addHoursIso,
  combineLocal,
  dateKeyFromIso,
  localDateKey,
  timeFromIso
} from "../lib/calendar";

interface TaskDrawerProps {
  task: Task;
  tags: Tag[];
  threshold: number;
  conflicts: string[];
  locale?: Locale;
  onClose: () => void;
  onPreview: (patch: UpdateTaskInput) => void;
  onSave: (patch: UpdateTaskInput) => void;
  onComplete: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCreateTag: (name: string) => Promise<Tag | undefined>;
}

export function TaskDrawer({
  task,
  tags,
  threshold,
  conflicts,
  locale = "zh",
  onClose,
  onPreview,
  onSave,
  onComplete,
  onArchive,
  onDelete,
  onCreateTag
}: TaskDrawerProps) {
  const t = translations[locale];
  const [titleText, setTitleText] = useState(task.title);
  const [impText, setImpText] = useState(String(task.importance));
  const [urgText, setUrgText] = useState(String(task.urgency));
  const [scheduleDate, setScheduleDate] = useState(
    task.scheduledStart ? dateKeyFromIso(task.scheduledStart) : ""
  );
  const [startTime, setStartTime] = useState(
    task.scheduledStart ? timeFromIso(task.scheduledStart) : "09:00"
  );
  const [endTime, setEndTime] = useState(
    task.scheduledEnd ? timeFromIso(task.scheduledEnd) : "10:00"
  );
  const [tagName, setTagName] = useState("");
  const [tagError, setTagError] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [firstActionText, setFirstActionText] = useState(task.firstAction ?? "");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(task.recurrence ?? "none");

  const pendingRef = useRef<UpdateTaskInput>({});
  const timerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(pending).length > 0) onSaveRef.current(pending);
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    setTitleText(task.title);
    setImpText(String(task.importance));
    setUrgText(String(task.urgency));
    setScheduleDate(
      task.scheduledStart ? dateKeyFromIso(task.scheduledStart) : ""
    );
    setStartTime(
      task.scheduledStart ? timeFromIso(task.scheduledStart) : "09:00"
    );
    setEndTime(task.scheduledEnd ? timeFromIso(task.scheduledEnd) : "10:00");
    setFirstActionText(task.firstAction ?? "");
    setRecurrence(task.recurrence ?? "none");
  }, [
    task.id,
    task.title,
    task.importance,
    task.urgency,
    task.scheduledStart,
    task.scheduledEnd,
    task.firstAction,
    task.recurrence
  ]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      flushRef.current();
    };
  }, []);

  const queue = (patch: UpdateTaskInput, immediate = false) => {
    onPreview(patch);
    pendingRef.current = { ...pendingRef.current, ...patch };

    if (immediate) {
      flush();
      return;
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = {};
      if (Object.keys(pending).length > 0) onSaveRef.current(pending);
    }, 320);
  };

  const commitTitle = () => {
    const next = titleText.trim();
    if (!next) {
      setTitleText(task.title);
      return;
    }
    if (next !== task.title) queue({ title: next }, true);
  };

  const commitScore = (kind: "importance" | "urgency") => {
    const raw = kind === "importance" ? impText : urgText;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      if (kind === "importance") setImpText(String(task.importance));
      else setUrgText(String(task.urgency));
      return;
    }
    const next = clampScore(parsed);
    if (kind === "importance") setImpText(String(next));
    else setUrgText(String(next));
    if (next !== task[kind]) {
      queue(
        kind === "importance"
          ? { importance: next }
          : { urgency: next },
        true
      );
    }
  };

  const toggleTag = (tagId: string) => {
    const ids = task.tags.map((tag) => tag.id);
    const next = ids.includes(tagId)
      ? ids.filter((id) => id !== tagId)
      : [...ids, tagId];
    queue({ tagIds: next }, true);
  };

  const addTag = async () => {
    const name = tagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    setTagError("");
    try {
      const tag = await onCreateTag(name);
      if (tag) {
        const ids = task.tags.map((item) => item.id);
        queue({ tagIds: [...ids, tag.id] }, true);
        setTagName("");
      }
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not create tag");
    } finally {
      setCreatingTag(false);
    }
  };

  const commitFirstAction = () => {
    const next = firstActionText.trim();
    if (next !== (task.firstAction ?? "")) {
      queue({ firstAction: next || null }, true);
    }
  };

  const toggleChecklist = (id: string) => {
    const next = (task.checklists ?? []).map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    queue({ checklists: next }, true);
  };

  const deleteChecklist = (id: string) => {
    const next = (task.checklists ?? []).filter((item) => item.id !== id);
    queue({ checklists: next }, true);
  };

  const addChecklist = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      done: false
    };
    queue({ checklists: [...(task.checklists ?? []), newItem] }, true);
    setNewChecklistText("");
  };

  const changeRecurrence = (rule: RecurrenceRule) => {
    setRecurrence(rule);
    queue({ recurrence: rule }, true);
  };

  const addSchedule = () => {
    const date = task.dueDate ?? localDateKey(new Date());
    const start = combineLocal(date, "09:00");
    const end = combineLocal(date, "10:00");
    setScheduleDate(date);
    setStartTime("09:00");
    setEndTime("10:00");
    queue({ scheduledStart: start, scheduledEnd: end }, true);
  };

  const changeScheduleDate = (value: string | null) => {
    if (!value) {
      clearSchedule();
      return;
    }
    const start = combineLocal(value, startTime || "09:00");
    let end = combineLocal(value, endTime || "10:00");
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      end = addHoursIso(start, 1);
      setEndTime(timeFromIso(end));
    }
    setScheduleDate(value);
    queue({ scheduledStart: start, scheduledEnd: end }, true);
  };

  const changeStartTime = (value: string) => {
    if (!scheduleDate) return;
    setStartTime(value);
    const start = combineLocal(scheduleDate, value);
    let end = combineLocal(scheduleDate, endTime || "10:00");
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      end = addHoursIso(start, 1);
      setEndTime(timeFromIso(end));
    }
    queue({ scheduledStart: start, scheduledEnd: end }, true);
  };

  const changeEndTime = (value: string) => {
    if (!scheduleDate) return;
    setEndTime(value);
    const start = combineLocal(scheduleDate, startTime || "09:00");
    let end = combineLocal(scheduleDate, value);
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      end = addHoursIso(start, 1);
      setEndTime(timeFromIso(end));
    }
    queue({ scheduledStart: start, scheduledEnd: end }, true);
  };

  const clearSchedule = () => {
    setScheduleDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    queue({ scheduledStart: null, scheduledEnd: null }, true);
  };

  const quadrant = quadrantOf(task, threshold);
  const pending = quadrant === "pending";
  const badgeName = pending
    ? "Pending review"
    : QUADRANTS[quadrant as 1 | 2 | 3 | 4].name;
  const visibility = pending
    ? "Pending review"
    : quadrant === 1 || quadrant === 2
      ? "Independent card"
      : "Not important";
  const due = task.dueDate ? dueLabel(task.dueDate) : "";
  const dueClass =
    task.dueDate && dueState(task.dueDate) === "overdue"
      ? "overdue"
      : task.dueDate && ["today", "soon"].includes(dueState(task.dueDate))
        ? "soon"
        : "";
  const otherTags = tags.filter(
    (tag) => !task.tags.some((assigned) => assigned.id === tag.id)
  );

  return (
    <aside className="drawer" aria-label="Task details">
      <div className="drawer-header">
        <input
          className="drawer-title-input"
          value={titleText}
          onChange={(event) => setTitleText(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          aria-label="Task title"
        />
        <button
          className="drawer-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className="drawer-meta">
        <span className={`badge ${pending ? "pending" : `q${quadrant}`}`}>
          {badgeName}
        </span>
        {due && <span className={`due ${dueClass}`}>{due}</span>}
        <span className="hint" style={{ marginTop: 0 }}>
          {visibility}
        </span>
      </div>

      <div className="detail-section">
        <label htmlFor="drawer-importance">
          {locale === "zh" ? translations.zh.importance : "Importance"} <output>{task.importance}</output>
        </label>
        <div className="score-row">
          <input
            id="drawer-importance"
            type="range"
            min={0}
            max={100}
            step={1}
            value={task.importance}
            onChange={(event) =>
              queue({ importance: Number(event.target.value) })
            }
          />
          <input
            className="number-input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={impText}
            onChange={(event) => setImpText(event.target.value)}
            onBlur={() => commitScore("importance")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitScore("importance");
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>

      <div className="detail-section">
        <label htmlFor="drawer-urgency">
          {locale === "zh" ? "紧迫度" : "Urgency"} <output>{task.urgency}</output>
        </label>
        <div className="score-row">
          <input
            id="drawer-urgency"
            type="range"
            min={0}
            max={100}
            step={1}
            value={task.urgency}
            onChange={(event) => queue({ urgency: Number(event.target.value) })}
          />
          <input
            className="number-input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={urgText}
            onChange={(event) => setUrgText(event.target.value)}
            onBlur={() => commitScore("urgency")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitScore("urgency");
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>

      <div className="detail-section">
        <label htmlFor="drawer-due">{t.dueDateLabel}</label>
        <DateInput
          id="drawer-due"
          value={task.dueDate}
          onChange={(dueDate) => queue({ dueDate }, true)}
        />
      </div>

      <div className="detail-section">
        <label>{t.scheduleLabel}</label>
        {task.scheduledStart ? (
          <div className="schedule-editor">
            <DateInput
              id="drawer-schedule-date"
              value={scheduleDate || null}
              onChange={changeScheduleDate}
            />
            <div className="schedule-times">
              <label htmlFor="drawer-start">{t.startLabel}</label>
              <input
                id="drawer-start"
                className="time-input"
                type="time"
                value={startTime}
                onChange={(event) => changeStartTime(event.target.value)}
              />
              <label htmlFor="drawer-end">{t.endLabel}</label>
              <input
                id="drawer-end"
                className="time-input"
                type="time"
                value={endTime}
                onChange={(event) => changeEndTime(event.target.value)}
              />
            </div>
            {conflicts.length > 0 && (
              <p className="schedule-conflict">
                {t.overlapsNotice}: {conflicts.join(", ")}
              </p>
            )}
            <button className="schedule-clear" onClick={clearSchedule}>
              {t.clearScheduleBtn}
            </button>
          </div>
        ) : (
          <button className="schedule-add" onClick={addSchedule}>
            {t.addScheduleBtn}
          </button>
        )}
      </div>

      <div className="detail-section">
        <label>Tags</label>
        <div className="tag-list">
          {task.tags.map((tag) => (
            <span className="tag active" key={tag.id}>
              <i style={{ background: tag.color }} />
              {tag.name}
              <button
                onClick={() => toggleTag(tag.id)}
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
          {otherTags.map((tag) => (
            <button
              className="tag"
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              title={`Add ${tag.name}`}
            >
              <i style={{ background: tag.color }} />
              {tag.name}
            </button>
          ))}
          {!task.tags.length && !otherTags.length && (
            <span className="hint" style={{ marginTop: 0 }}>
              {t.noTagsYet}
            </span>
          )}
        </div>
        <div className="tag-add">
          <input
            className="text-input"
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addTag();
              }
            }}
            placeholder={locale === "zh" ? "新建标签…" : "New tag…"}
            maxLength={30}
            aria-label="New tag name"
          />
          <button
            className="small-btn"
            onClick={() => void addTag()}
            disabled={creatingTag}
          >
            {creatingTag ? (locale === "zh" ? "添加中…" : "Adding…") : (locale === "zh" ? "添加" : "Add")}
          </button>
        </div>
        {tagError && <p className="hint form-error">{tagError}</p>}
      </div>

      <div className="detail-section">
        <label htmlFor="drawer-first-action">{t.firstActionLabel}</label>
        <input
          id="drawer-first-action"
          className="text-input"
          value={firstActionText}
          onChange={(e) => setFirstActionText(e.target.value)}
          onBlur={commitFirstAction}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitFirstAction();
              e.currentTarget.blur();
            }
          }}
          placeholder={t.firstActionPlaceholder}
        />
        <span className="hint" style={{ marginTop: 4 }}>
          {t.firstActionHint}
        </span>
      </div>

      <div className="detail-section">
        <label>
          <span>{t.checklistLabel}</span>
          {(task.checklists?.length ?? 0) > 0 && (
            <output>
              {task.checklists.filter((i) => i.done).length} / {task.checklists.length}
            </output>
          )}
        </label>
        <div className="checklist-items">
          {(task.checklists ?? []).map((item) => (
            <div key={item.id} className={`checklist-row${item.done ? " done" : ""}`}>
              <button
                type="button"
                className="checklist-check-btn"
                onClick={() => toggleChecklist(item.id)}
                aria-label={item.done ? "Mark undone" : "Mark done"}
              >
                {item.done ? "✓" : ""}
              </button>
              <span className="checklist-text">{item.text}</span>
              <button
                type="button"
                className="checklist-del-btn"
                onClick={() => deleteChecklist(item.id)}
                aria-label="Delete subtask"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="checklist-add">
          <input
            className="text-input"
            value={newChecklistText}
            onChange={(e) => setNewChecklistText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addChecklist();
              }
            }}
            placeholder={t.addChecklistPlaceholder}
          />
          <button
            type="button"
            className="small-btn"
            onClick={addChecklist}
            disabled={!newChecklistText.trim()}
          >
            {locale === "zh" ? "添加" : "Add"}
          </button>
        </div>
      </div>

      <div className="detail-section">
        <label>
          <span>{t.routineCadence}</span>
          {task.streak > 0 && <output>🔥 {locale === "zh" ? `连续坚持: ${task.streak} 次` : `Streak: ${task.streak}`}</output>}
        </label>
        <div className="recurrence-pills">
          {(["none", "daily", "weekdays", "weekly"] as const).map((rule) => (
            <button
              key={rule}
              type="button"
              className={`rec-pill${recurrence === rule ? " active" : ""}`}
              onClick={() => changeRecurrence(rule)}
            >
              {rule === "none" ? t.oneOff : rule === "daily" ? t.daily : rule === "weekdays" ? t.weekdays : t.weekly}
            </button>
          ))}
        </div>
        <span className="hint" style={{ marginTop: 4 }}>
          {locale === "zh" ? "习惯与周期任务在点击完成时自动推移到下一个周期，不会直接进入归档。" : "Recurring tasks advance due dates on completion rather than leaving active status."}
        </span>
      </div>

      <div className="detail-section">
        <label htmlFor="drawer-notes">{t.notesLabel}</label>
        <textarea
          id="drawer-notes"
          value={task.notes}
          onChange={(event) => queue({ notes: event.target.value })}
          placeholder={t.notesPlaceholder}
        />
      </div>

      <div className="detail-actions">
        <button
          className="btn primary"
          onClick={() => {
            flush();
            onComplete();
          }}
        >
          {t.completeBtn}
        </button>
        <button
          className="btn"
          onClick={() => {
            flush();
            onArchive();
          }}
        >
          {t.archiveBtn}
        </button>
        <button
          className="btn danger"
          onClick={() => {
            flush();
            onDelete();
          }}
        >
          {t.deleteBtn}
        </button>
      </div>

      <p className="hint">
        {locale === "zh"
          ? "拖动滑块或直接输入分值。选中任务卡片后亦可直接使用键盘方向键微调重要度与紧迫度。"
          : "Use the sliders or type a number. Arrow keys on a focused card also nudge importance and urgency."}
      </p>
    </aside>
  );
}
