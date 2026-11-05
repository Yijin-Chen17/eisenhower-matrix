import { useEffect, useRef, useState } from "react";
import {
  IMPORTANCE_TIERS,
  calculateUrgencyFromDueDate,
  dueLabel,
  dueState,
  toDateKey,
  type ImportanceTierKey,
  type RecurrenceRule,
  type Settings,
  type Tag,
  type Theme
} from "@eisenhower/shared";
import { DateInput } from "./DateInput";
import { translations, type Locale } from "../lib/i18n";
import { useSystemTheme } from "../lib/theme";

interface AddTaskModalProps {
  locale?: Locale;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    importance?: number;
    urgency?: number;
    dueDate: string | null;
    recurrence?: RecurrenceRule;
  }) => Promise<void>;
}

function getQuickDate(key: "today" | "tomorrow" | "weekend" | "nextWeek"): string {
  const now = new Date();
  if (key === "today") return toDateKey(now);
  if (key === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  }
  if (key === "weekend") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return toDateKey(d);
  }
  if (key === "nextWeek") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = ((1 - day + 7) % 7) || 7;
    d.setDate(d.getDate() + diff);
    return toDateKey(d);
  }
  return toDateKey(now);
}

export function AddTaskModal({ locale = "zh", onClose, onCreate }: AddTaskModalProps) {
  const t = translations[locale];
  const [title, setTitle] = useState("");
  const [hasDue, setHasDue] = useState(true);
  const [importanceTier, setImportanceTier] = useState<ImportanceTierKey>("support");
  const [urgencyTier, setUrgencyTier] = useState<"urgent" | "soon" | "later">("soon");
  const [dueDate, setDueDate] = useState<string>(() => toDateKey(new Date()));
  const [recurrence, setRecurrence] = useState<RecurrenceRule>("none");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const calculatedUrgency = hasDue && dueDate ? calculateUrgencyFromDueDate(dueDate) : null;
  const effectiveUrgency = calculatedUrgency ?? (
    urgencyTier === "urgent" ? 85 : urgencyTier === "soon" ? 60 : 30
  );
  const effectiveImportance = IMPORTANCE_TIERS[importanceTier];

  const submit = async () => {
    const next = title.trim();
    if (!next) {
      setError(locale === "zh" ? "请先输入任务名称。" : "Give the task a title first.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onCreate({
        title: next,
        importance: effectiveImportance,
        urgency: effectiveUrgency,
        dueDate: hasDue && dueDate ? dueDate : null,
        recurrence
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={t.addTaskTitle}>
        <div className="modal-header">
          <div>
            <h2>{t.addTaskTitle}</h2>
            <p>{t.addTaskSubtitle}</p>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label={t.cancel}>
            ×
          </button>
        </div>

        <div className="field">
          <label htmlFor="add-title">{t.titleLabel}</label>
          <input
            id="add-title"
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={t.titlePlaceholder}
            autoFocus
            maxLength={200}
          />
        </div>

        <div className="field">
          <label>{t.importanceLevel}</label>
          <div className="tier-pills" role="radiogroup" aria-label="Importance tier">
            <button
              type="button"
              className={`tier-pill vital${importanceTier === "vital" ? " active" : ""}`}
              onClick={() => setImportanceTier("vital")}
              role="radio"
              aria-checked={importanceTier === "vital"}
            >
              <span className="tier-pill-icon">⭐</span>
              <span className="tier-pill-label">{t.vital}</span>
              <span className="tier-pill-score">85</span>
            </button>
            <button
              type="button"
              className={`tier-pill support${importanceTier === "support" ? " active" : ""}`}
              onClick={() => setImportanceTier("support")}
              role="radio"
              aria-checked={importanceTier === "support"}
            >
              <span className="tier-pill-icon">💼</span>
              <span className="tier-pill-label">{t.support}</span>
              <span className="tier-pill-score">60</span>
            </button>
            <button
              type="button"
              className={`tier-pill minor${importanceTier === "minor" ? " active" : ""}`}
              onClick={() => setImportanceTier("minor")}
              role="radio"
              aria-checked={importanceTier === "minor"}
            >
              <span className="tier-pill-icon">📎</span>
              <span className="tier-pill-label">{t.minor}</span>
              <span className="tier-pill-score">25</span>
            </button>
          </div>
        </div>

        {/* 关键改进：先让用户明确选择有无截止时间，消除认知模糊 */}
        <div className="field">
          <label>{t.deadlineBranch}</label>
          <div className="deadline-branch-selector" role="radiogroup">
            <button
              type="button"
              className={`branch-pill${hasDue ? " active" : ""}`}
              onClick={() => {
                setHasDue(true);
                if (!dueDate) setDueDate(toDateKey(new Date()));
              }}
              role="radio"
              aria-checked={hasDue}
            >
              {t.hasDeadline}
            </button>
            <button
              type="button"
              className={`branch-pill${!hasDue ? " active" : ""}`}
              onClick={() => {
                setHasDue(false);
              }}
              role="radio"
              aria-checked={!hasDue}
            >
              {t.noDeadline}
            </button>
          </div>

          {hasDue ? (
            <div className="branch-content-box">
              <div className="quick-dates-row">
                <button
                  type="button"
                  className={`quick-date-btn${dueDate === getQuickDate("today") ? " active" : ""}`}
                  onClick={() => setDueDate(getQuickDate("today"))}
                >
                  {t.quickDates.today}
                </button>
                <button
                  type="button"
                  className={`quick-date-btn${dueDate === getQuickDate("tomorrow") ? " active" : ""}`}
                  onClick={() => setDueDate(getQuickDate("tomorrow"))}
                >
                  {t.quickDates.tomorrow}
                </button>
                <button
                  type="button"
                  className={`quick-date-btn${dueDate === getQuickDate("weekend") ? " active" : ""}`}
                  onClick={() => setDueDate(getQuickDate("weekend"))}
                >
                  {t.quickDates.weekend}
                </button>
                <button
                  type="button"
                  className={`quick-date-btn${dueDate === getQuickDate("nextWeek") ? " active" : ""}`}
                  onClick={() => setDueDate(getQuickDate("nextWeek"))}
                >
                  {t.quickDates.nextWeek}
                </button>
              </div>
              <DateInput
                id="add-due"
                value={dueDate}
                onChange={(next) => setDueDate(next ?? "")}
              />
              {calculatedUrgency !== null && (
                <div className="auto-urgency-card">
                  <span>💡 {t.autoUrgencyNotice}:</span>
                  <strong>{calculatedUrgency}分</strong>
                  <span>({dueLabel(dueDate)})</span>
                </div>
              )}
            </div>
          ) : (
            <div className="branch-content-box">
              <label style={{ marginBottom: 6, display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                {t.urgencyTendencyLabel}
              </label>
              <div className="tier-pills" role="radiogroup" aria-label="Urgency tendency">
                <button
                  type="button"
                  className={`tier-pill urgent${urgencyTier === "urgent" ? " active" : ""}`}
                  onClick={() => setUrgencyTier("urgent")}
                  role="radio"
                  aria-checked={urgencyTier === "urgent"}
                >
                  <span className="tier-pill-icon">🔥</span>
                  <span className="tier-pill-label">{t.urgencyPills.urgent}</span>
                </button>
                <button
                  type="button"
                  className={`tier-pill soon${urgencyTier === "soon" ? " active" : ""}`}
                  onClick={() => setUrgencyTier("soon")}
                  role="radio"
                  aria-checked={urgencyTier === "soon"}
                >
                  <span className="tier-pill-icon">⏱️</span>
                  <span className="tier-pill-label">{t.urgencyPills.soon}</span>
                </button>
                <button
                  type="button"
                  className={`tier-pill later${urgencyTier === "later" ? " active" : ""}`}
                  onClick={() => setUrgencyTier("later")}
                  role="radio"
                  aria-checked={urgencyTier === "later"}
                >
                  <span className="tier-pill-icon">☕</span>
                  <span className="tier-pill-label">{t.urgencyPills.later}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <label>{t.routineCadence}</label>
          <div className="recurrence-pills">
            {(["none", "daily", "weekdays", "weekly"] as const).map((rule) => (
              <button
                key={rule}
                type="button"
                className={`rec-pill${recurrence === rule ? " active" : ""}`}
                onClick={() => setRecurrence(rule)}
              >
                {rule === "none"
                  ? t.oneOff
                  : rule === "daily"
                    ? t.daily
                    : rule === "weekdays"
                      ? t.weekdays
                      : t.weekly}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="hint form-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className="btn primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? t.adding : t.confirmAdd}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SettingsDialogProps {
  settings: Settings;
  tags: Tag[];
  locale?: Locale;
  onToggleLocale: () => void;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onDeleteTag: (tag: Tag) => void;
}

const THEME_OPTIONS: Array<{
  value: Theme;
  label: string;
  description: string;
  swatches: string[];
}> = [
  {
    value: "light",
    label: "Light",
    description: "Soft gray daylight.",
    swatches: ["#E9EDF3", "#E03A47", "#007FD4", "#E0A100"]
  },
  {
    value: "dark",
    label: "Dark",
    description: "Calm, easy on the eyes.",
    swatches: ["#1A1D23", "#F04452", "#0087EE", "#FFB020"]
  },
  {
    value: "system",
    label: "System",
    description: "Match your device.",
    swatches: ["#1A1D23", "#E9EDF3", "#007FD4", "#FFB020"]
  }
];

export function SettingsDialog({
  settings,
  tags,
  locale = "zh",
  onToggleLocale,
  onClose,
  onUpdateSettings,
  onDeleteTag
}: SettingsDialogProps) {
  const [threshold, setThreshold] = useState(settings.threshold);
  const timerRef = useRef<number | null>(null);
  const systemTheme = useSystemTheme();

  useEffect(() => {
    setThreshold(settings.threshold);
  }, [settings.threshold]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const changeThreshold = (value: number) => {
    setThreshold(value);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onUpdateSettings({ threshold: value });
    }, 180);
  };

  const close = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      onUpdateSettings({ threshold });
    }
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="modal-header">
          <div>
            <h2>{locale === "zh" ? "系统设置" : "Settings"}</h2>
            <p>{locale === "zh" ? "象限阈值与主题模式保存在本地数据库中。" : "Thresholds and themes are saved locally in your database."}</p>
          </div>
          <button className="drawer-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="field">
          <label>{locale === "zh" ? "界面语言" : "Language"}</label>
          <div className="recurrence-pills" role="radiogroup" aria-label="Language">
            <button
              type="button"
              className={`rec-pill${locale === "zh" ? " active" : ""}`}
              role="radio"
              aria-checked={locale === "zh"}
              onClick={() => {
                if (locale !== "zh") onToggleLocale();
              }}
            >
              中文
            </button>
            <button
              type="button"
              className={`rec-pill${locale === "en" ? " active" : ""}`}
              role="radio"
              aria-checked={locale === "en"}
              onClick={() => {
                if (locale !== "en") onToggleLocale();
              }}
            >
              English
            </button>
          </div>
        </div>

        <div className="field threshold-field">
          <div className="field-head">
            <label htmlFor="settings-threshold">
              {locale === "zh" ? "象限划分阈值" : "Quadrant threshold"}
            </label>
            <output htmlFor="settings-threshold">{threshold}</output>
          </div>
          <input
            id="settings-threshold"
            type="range"
            min={30}
            max={70}
            step={1}
            value={threshold}
            onChange={(event) =>
              changeThreshold(Number(event.target.value))
            }
          />
          <div className="range-labels">
            <span>30</span>
            <span>50</span>
            <span>70</span>
          </div>
          <p className="hint">
            {locale === "zh"
              ? "重要度或紧迫度恰好等于阈值的任务将被归类为待评估 (Pending review)。"
              : "A task exactly on the threshold is shown as Pending review."}
          </p>
        </div>

        <div className="field">
          <label>{locale === "zh" ? "主题外观" : "Theme"}</label>
          <div className="theme-switch">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`theme-btn${
                  settings.theme === option.value ? " active" : ""
                }`}
                onClick={() => onUpdateSettings({ theme: option.value })}
              >
                <span className="theme-swatch">
                  {option.swatches.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <strong>
                  {locale === "zh"
                    ? option.value === "light"
                      ? "浅色 (Light)"
                      : option.value === "dark"
                        ? "深色 (Dark)"
                        : "跟随系统 (System)"
                    : option.label}
                </strong>
                <span>
                  {option.value === "system"
                    ? (locale === "zh"
                        ? `跟随设备 · ${systemTheme === "dark" ? "深色" : "浅色"}`
                        : `Your device · ${systemTheme}`)
                    : (locale === "zh"
                        ? (option.value === "light"
                            ? "柔和明亮，清爽通透"
                            : "低对比度，沉浸护眼")
                        : option.description)}
                </span>
              </button>
            ))}
          </div>
          {settings.theme === "system" && (
            <p className="hint">
              {locale === "zh"
                ? `跟随系统外观 — 当前为${systemTheme === "dark" ? "深色" : "浅色"}。`
                : `Following the system color scheme — currently ${systemTheme}.`}
            </p>
          )}
        </div>

        <div className="field">
          <label>Tags</label>
          <div className="tag-manager">
            {tags.map((tag) => (
              <div className="tag-manager-row" key={tag.id}>
                <span className="tag-manager-name">
                  <i style={{ background: tag.color }} />
                  {tag.name}
                </span>
                <button
                  className="danger-link"
                  onClick={() => onDeleteTag(tag)}
                >
                  Delete
                </button>
              </div>
            ))}
            {!tags.length && (
              <p className="hint" style={{ marginTop: 0 }}>
                No tags yet. Create them from a task detail panel.
              </p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
