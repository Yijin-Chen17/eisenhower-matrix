import { useEffect, useMemo, useRef, useState } from "react";
import {
  countExportableCalendarEvents,
  exportTasksToIcs,
  getDefaultCalendarExportRange,
  type CalendarExportScope,
  type Task
} from "@eisenhower/shared";
import { buildCalendarExportPath, isStaticDataMode } from "../api";
import { useCalendarEvents } from "../hooks";
import type { Locale } from "../lib/i18n";
import { localDateKey } from "../lib/calendar";

interface ExportCalendarDialogProps {
  tasks: Task[];
  locale?: Locale;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ExportCalendarDialog({
  tasks,
  locale = "zh",
  onClose,
  onSuccess,
  onError
}: ExportCalendarDialogProps) {
  const isZh = locale === "zh";
  const [scope, setScope] = useState<CalendarExportScope>("scheduled_and_due");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const exportRange = useMemo(() => getDefaultCalendarExportRange(), []);
  const { data: loadedExternalEvents = [] } = useCalendarEvents(
    includeExternal ? exportRange.start.toISOString() : null,
    includeExternal ? exportRange.end.toISOString() : null
  );
  const externalEvents = includeExternal ? loadedExternalEvents : [];

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const counts = useMemo(
    () =>
      countExportableCalendarEvents(tasks, {
        scope,
        includeCompleted,
        externalEvents
      }),
    [tasks, scope, includeCompleted, externalEvents]
  );

  const feedUrl = useMemo(() => {
    if (isStaticDataMode) return "";
    const path = buildCalendarExportPath({
      scope,
      includeCompleted,
      includeExternal
    });
    return typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path;
  }, [scope, includeCompleted, includeExternal]);

  function downloadIcs() {
    try {
      const ics = exportTasksToIcs(tasks, {
        calendarName: isZh ? "艾森豪威尔矩阵" : "Eisenhower Matrix",
        scope,
        includeCompleted,
        externalEvents
      });
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `eisenhower-calendar-${localDateKey(new Date())}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      onSuccess(
        isZh
          ? `已导出 ${counts.total} 条日程到 .ics 文件`
          : `Exported ${counts.total} event${counts.total === 1 ? "" : "s"} to .ics`
      );
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : isZh
            ? "导出日历失败"
            : "Could not export calendar"
      );
    }
  }

  async function copyFeedUrl() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, 2200);
    } catch {
      onError(
        isZh
          ? "无法访问剪贴板，请手动复制链接。"
          : "Could not copy to clipboard. Please copy the URL manually."
      );
    }
  }

  const summaryText = useMemo(() => {
    if (counts.total === 0) {
      return isZh
        ? "当前条件下暂无可导出的排程时间块、截止任务或外部日历日程。"
        : "No scheduled blocks, due dates, or external events match these options.";
    }
    const parts: string[] = [];
    if (isZh) {
      parts.push(`${counts.scheduled} 个排程时间块`);
      if (scope === "scheduled_and_due") parts.push(`${counts.due} 个截止日期`);
      if (includeExternal) parts.push(`${counts.external} 条外部日程`);
      return `共 ${counts.total} 条日程（${parts.join(" · ")}）`;
    }
    parts.push(`${counts.scheduled} scheduled`);
    if (scope === "scheduled_and_due") parts.push(`${counts.due} due`);
    if (includeExternal) parts.push(`${counts.external} external`);
    return `${counts.total} event${counts.total === 1 ? "" : "s"} ready (${parts.join(" · ")})`;
  }, [counts, includeExternal, isZh, scope]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal cal-export-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "导出日历" : "Export calendar"}
      >
        <div className="modal-header">
          <div>
            <h2>{isZh ? "导出日历 (.ics)" : "Export Calendar (.ics)"}</h2>
            <p>
              {isZh
                ? "将任务时间块与截止日期导出为标准 iCalendar 文件，导入到 Apple 日历、Google Calendar 或 Outlook。"
                : "Export scheduled time blocks and due dates as a standard iCalendar file for Apple, Google, or Outlook."}
            </p>
          </div>
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label={isZh ? "关闭" : "Close"}
          >
            ×
          </button>
        </div>

        <div className="field" style={{ marginTop: 0 }}>
          <label>{isZh ? "导出内容范围" : "What to include"}</label>
          <div
            className="cal-add-tabs"
            role="radiogroup"
            aria-label={isZh ? "导出范围" : "Export scope"}
          >
            <button
              type="button"
              className={scope === "scheduled_and_due" ? "active" : ""}
              role="radio"
              aria-checked={scope === "scheduled_and_due"}
              onClick={() => setScope("scheduled_and_due")}
            >
              {isZh ? "排程 + 截止日期" : "Scheduled + Due dates"}
            </button>
            <button
              type="button"
              className={scope === "scheduled" ? "active" : ""}
              role="radio"
              aria-checked={scope === "scheduled"}
              onClick={() => setScope("scheduled")}
            >
              {isZh ? "仅已排程时间块" : "Scheduled blocks only"}
            </button>
          </div>
        </div>

        <label className="cal-export-toggle">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(event) => setIncludeCompleted(event.target.checked)}
          />
          <span>
            {isZh
              ? "包含已完成任务（已归档任务始终排除）"
              : "Include completed tasks (archived tasks are excluded)"}
          </span>
        </label>

        <label className="cal-export-toggle">
          <input
            type="checkbox"
            checked={includeExternal}
            onChange={(event) => setIncludeExternal(event.target.checked)}
          />
          <span>
            {isZh
              ? "包含已导入的外部日历日程（近一年范围）"
              : "Include imported external calendar events"}
          </span>
        </label>

        <div
          className={`cal-export-summary${counts.total === 0 ? " is-empty" : ""}`}
        >
          {summaryText}
        </div>

        {!isStaticDataMode ? (
          <div className="field">
            <label htmlFor="cal-export-feed">
              {isZh ? "本地实时订阅地址" : "Live subscription URL"}
            </label>
            <div className="cal-export-url-row">
              <input
                id="cal-export-feed"
                className="text-input"
                value={feedUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                spellCheck={false}
              />
              <button
                type="button"
                className="small-btn"
                onClick={() => void copyFeedUrl()}
              >
                {copied
                  ? isZh
                    ? "已复制 ✓"
                    : "Copied ✓"
                  : isZh
                    ? "复制"
                    : "Copy"}
              </button>
            </div>
            <p className="hint">
              {isZh
                ? "本地服务运行时，可在 Apple 日历（文件 → 新建日历订阅）中添加此链接，建议将自动刷新设为每 15 分钟（或按 ⌘R 手动刷新）。"
                : "While the local server is running, subscribe in Apple Calendar (File → New Calendar Subscription) and set Auto-refresh to every 15 minutes (or press ⌘R to refresh)."}
            </p>
          </div>
        ) : (
          <p className="hint">
            {isZh
              ? "当前为纯前端静态模式，支持一键下载标准 .ics 文件导入到任意日历应用。"
              : "Static mode exports an offline .ics file directly from your browser data."}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {isZh ? "关闭" : "Close"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={downloadIcs}
            disabled={counts.total === 0}
          >
            {isZh ? "下载 .ics 文件" : "Download .ics"}
          </button>
        </div>
      </div>
    </div>
  );
}
