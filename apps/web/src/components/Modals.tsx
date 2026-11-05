import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IMPORTANCE_TIERS,
  QUADRANTS,
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
  onOpenGuide: () => void;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onDeleteTag: (tag: Tag) => void;
}

type SettingsSectionId = "general" | "matrix" | "tags" | "about";

const THEME_VALUES: Theme[] = ["light", "dark", "system"];

const SETTINGS_ICONS: Record<SettingsSectionId, ReactNode> = {
  general: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  ),
  matrix: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.6" />
      <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.6" />
      <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.6" />
      <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.6" />
    </svg>
  ),
  tags: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h5.2a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-4.7 4.7a2 2 0 0 1-2.8 0L4.6 12.1a2 2 0 0 1-.6-1.4z" />
      <circle cx="8.6" cy="8.6" r="1.3" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
};

function SettingsRow({
  label,
  desc,
  stacked = false,
  children
}: {
  label: string;
  desc?: string;
  stacked?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`ds-row${stacked ? " is-stacked" : ""}`}>
      <div className="ds-row-copy">
        <span className="ds-row-label">{label}</span>
        {desc && <span className="ds-row-desc">{desc}</span>}
      </div>
      <div className="ds-row-control">{children}</div>
    </div>
  );
}

export function SettingsDialog({
  settings,
  tags,
  locale = "zh",
  onToggleLocale,
  onOpenGuide,
  onClose,
  onUpdateSettings,
  onDeleteTag
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSectionId>("general");
  const [threshold, setThreshold] = useState(settings.threshold);
  const timerRef = useRef<number | null>(null);
  const systemTheme = useSystemTheme();
  const zh = locale === "zh";

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const sections: Array<{
    id: SettingsSectionId;
    label: string;
    hint: string;
  }> = [
    {
      id: "general",
      label: zh ? "通用" : "General",
      hint: zh ? "语言与外观" : "Language and appearance"
    },
    {
      id: "matrix",
      label: zh ? "矩阵" : "Matrix",
      hint: zh ? "象限划分规则" : "How quadrants are split"
    },
    {
      id: "tags",
      label: zh ? "标签" : "Tags",
      hint: zh ? "管理已有标签" : "Manage your tags"
    },
    {
      id: "about",
      label: zh ? "关于与帮助" : "About",
      hint: zh ? "版本、存储与功能介绍" : "Version, storage and the guide"
    }
  ];

  const active = sections.find((item) => item.id === section) ?? sections[0];

  const themeLabel = (value: Theme) =>
    value === "light"
      ? zh
        ? "浅色"
        : "Light"
      : value === "dark"
        ? zh
          ? "深色"
          : "Dark"
        : zh
          ? "跟随系统"
          : "System";

  const QUAD_SPLIT = ([1, 2, 3, 4] as const).map((quadrant) => {
    const name = zh
      ? (() => {
          const full =
            translations.zh[`q${quadrant}Name` as keyof typeof translations.zh];
          return typeof full === "string" ? full.split(" (")[0] : "";
        })()
      : QUADRANTS[quadrant].name;
    const high = `≥ ${threshold}`;
    const low = `< ${threshold}`;
    const importance = quadrant === 1 || quadrant === 2 ? high : low;
    const urgency = quadrant === 1 || quadrant === 3 ? high : low;
    return {
      quadrant,
      name,
      rule: zh
        ? `重要度 ${importance} · 紧迫度 ${urgency}`
        : `I ${importance} · U ${urgency}`
    };
  });

  return (
    <div className="ds-overlay">
      <div className="ds-mask" onMouseDown={close} aria-hidden="true" />
      <div
        className="ds-panel"
        role="dialog"
        aria-modal="true"
        aria-label={zh ? "设置" : "Settings"}
      >
        <aside className="ds-nav">
          <div className="ds-nav-title">{zh ? "设置" : "Settings"}</div>
          <nav className="ds-nav-list">
            {sections.map((item) => (
              <button
                key={item.id}
                className={`ds-nav-cell${item.id === section ? " is-active" : ""}`}
                aria-current={item.id === section ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                <span className="ds-nav-icon" aria-hidden="true">
                  {SETTINGS_ICONS[item.id]}
                </span>
                <span className="ds-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="ds-content">
          <header className="ds-header">
            <div className="ds-heading">
              <h2>{active.label}</h2>
              <p>{active.hint}</p>
            </div>
            <button className="ds-close" onClick={close} aria-label={zh ? "关闭" : "Close"}>
              ×
            </button>
          </header>

          <div className="ds-body">
            {section === "general" && (
              <div className="ds-rows">
                <SettingsRow
                  label={zh ? "界面语言" : "Language"}
                  desc={zh ? "切换后所有界面文案立即更新。" : "Applies across the app right away."}
                >
                  <div className="ds-seg" role="group" aria-label="Language">
                    <button
                      className={locale === "zh" ? "is-active" : ""}
                      aria-pressed={locale === "zh"}
                      onClick={() => {
                        if (locale !== "zh") onToggleLocale();
                      }}
                    >
                      中文
                    </button>
                    <button
                      className={locale === "en" ? "is-active" : ""}
                      aria-pressed={locale === "en"}
                      onClick={() => {
                        if (locale !== "en") onToggleLocale();
                      }}
                    >
                      English
                    </button>
                  </div>
                </SettingsRow>

                <SettingsRow
                  label={zh ? "主题外观" : "Theme"}
                  desc={
                    settings.theme === "system"
                      ? zh
                        ? `跟随系统 · 当前为${systemTheme === "dark" ? "深色" : "浅色"}`
                        : `Following the system · currently ${systemTheme}`
                      : zh
                        ? "选择固定的浅色或深色配色。"
                        : "Pin the interface to light or dark."
                  }
                >
                  <div className="ds-seg" role="group" aria-label="Theme">
                    {THEME_VALUES.map((value) => (
                      <button
                        key={value}
                        className={settings.theme === value ? "is-active" : ""}
                        aria-pressed={settings.theme === value}
                        onClick={() => onUpdateSettings({ theme: value })}
                      >
                        {themeLabel(value)}
                      </button>
                    ))}
                  </div>
                </SettingsRow>
              </div>
            )}

            {section === "matrix" && (
              <div className="ds-rows">
                <SettingsRow
                  stacked
                  label={zh ? "象限阈值" : "Quadrant threshold"}
                  desc={
                    zh
                      ? "重要度或紧迫度高于阈值的任务进入「重要 / 紧迫」一侧。恰好等于阈值的任务标记为待评估。"
                      : "Scores above the threshold count as important or urgent. Values exactly on it are flagged for review."
                  }
                >
                  <div className="ds-slider-row">
                    <input
                      id="settings-threshold"
                      type="range"
                      min={30}
                      max={70}
                      step={1}
                      value={threshold}
                      aria-label={zh ? "象限阈值" : "Quadrant threshold"}
                      onChange={(event) => changeThreshold(Number(event.target.value))}
                    />
                    <output htmlFor="settings-threshold">{threshold}</output>
                  </div>
                  <div className="ds-slider-ticks">
                    <span>30</span>
                    <span>50</span>
                    <span>70</span>
                  </div>
                </SettingsRow>

                <SettingsRow
                  stacked
                  label={zh ? "当前分档" : "Current split"}
                  desc={
                    zh
                      ? "按当前阈值，四个象限的判定条件如下，卡片的颜色与形态随之一致。"
                      : "With this threshold each quadrant is resolved as follows — card colour and shape follow the same rule."
                  }
                >
                  <div className="ds-quad-list">
                    {QUAD_SPLIT.map(({ quadrant, name, rule }) => (
                      <div className={`ds-quad q${quadrant}`} key={quadrant}>
                        <i aria-hidden="true" />
                        <div>
                          <b>{name}</b>
                          <span>{rule}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsRow>
              </div>
            )}

            {section === "tags" && (
              <div className="ds-rows">
                <SettingsRow
                  stacked
                  label={zh ? "标签" : "Tags"}
                  desc={zh ? "标签在任务抽屉里创建，这里可以删除不再使用的标签。" : "Tags are created inside a task drawer; delete the ones you no longer use here."}
                >
                  <div className="ds-tag-list">
                    {tags.map((tag) => (
                      <div className="ds-tag-row" key={tag.id}>
                        <span className="ds-tag-name">
                          <i style={{ background: tag.color }} />
                          {tag.name}
                        </span>
                        <button className="ds-link danger" onClick={() => onDeleteTag(tag)}>
                          {zh ? "删除" : "Delete"}
                        </button>
                      </div>
                    ))}
                    {!tags.length && (
                      <p className="ds-empty">
                        {zh ? "还没有标签。打开任一任务，在标签一栏新建。" : "No tags yet. Open a task and add one in the tags field."}
                      </p>
                    )}
                  </div>
                </SettingsRow>
              </div>
            )}

            {section === "about" && (
              <div className="ds-rows">
                <SettingsRow
                  label={zh ? "功能介绍" : "Feature guide"}
                  desc={zh ? "图文介绍矩阵、双空间、日历排期与快捷键。" : "A visual tour of the matrix, layouts, calendar and shortcuts."}
                >
                  <button className="ds-btn" onClick={onOpenGuide}>
                    {zh ? "查看介绍" : "Open guide"}
                    <span aria-hidden="true">→</span>
                  </button>
                </SettingsRow>

                <SettingsRow
                  label={zh ? "版本" : "Version"}
                  desc={zh ? "当前安装的版本号。" : "Installed version."}
                >
                  <span className="ds-value">0.1.0</span>
                </SettingsRow>

                <SettingsRow
                  label={zh ? "数据存储" : "Storage"}
                  desc={zh ? "任务保存在本机，不会上传到任何服务器。" : "Tasks stay on this machine and are never uploaded."}
                >
                  <span className="ds-value">{zh ? "本机数据库" : "Local database"}</span>
                </SettingsRow>

                <SettingsRow
                  label={zh ? "快捷键" : "Shortcuts"}
                  desc={zh ? "不离开键盘的常用操作。" : "The frequent moves, without the mouse."}
                >
                  <div className="ds-keys">
                    <kbd>N</kbd>
                    <kbd>/</kbd>
                    <kbd>↑↓←→</kbd>
                    <kbd>Esc</kbd>
                  </div>
                </SettingsRow>
              </div>
            )}
          </div>
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
