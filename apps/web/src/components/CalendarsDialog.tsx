import { useRef, useState, type ChangeEvent } from "react";
import { CALENDAR_PALETTE } from "@eisenhower/shared";
import { isStaticDataMode } from "../api";
import {
  useCalendars,
  useCreateCalendar,
  useDeleteCalendar,
  useImportCalendar,
  useRefreshAllCalendars,
  useRefreshCalendar,
  useUpdateCalendar
} from "../hooks";
import type { Locale } from "../lib/i18n";

interface CalendarsDialogProps {
  locale?: Locale;
  onClose: () => void;
  onError: (message: string) => void;
}

type AddMode = "url" | "file";

function formatSync(iso: string | null, locale: Locale): string {
  if (!iso) return locale === "zh" ? "尚未同步" : "Never synced";
  const formatted = new Date(iso).toLocaleString(
    locale === "zh" ? "zh-CN" : "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
  return locale === "zh" ? `同步于 ${formatted}` : `Synced ${formatted}`;
}

export function CalendarsDialog({
  locale = "zh",
  onClose,
  onError
}: CalendarsDialogProps) {
  const isZh = locale === "zh";
  const calendarsQuery = useCalendars();
  const calendars = calendarsQuery.data ?? [];
  const createCalendar = useCreateCalendar();
  const updateCalendar = useUpdateCalendar();
  const importCalendar = useImportCalendar();
  const deleteCalendar = useDeleteCalendar();
  const refreshCalendar = useRefreshCalendar();
  const refreshAll = useRefreshAllCalendars();

  const proxyUrl = import.meta.env.VITE_CALENDAR_PROXY_URL?.trim() ?? "";
  const showUrl = !isStaticDataMode || Boolean(proxyUrl);

  const [mode, setMode] = useState<AddMode>(showUrl ? "url" : "file");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [ics, setIcs] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setIcs("");
      setFileName("");
      return;
    }
    if (file.size > 5_000_000) {
      setError(
        isZh
          ? "该日历文件过大（最大支持 5 MB）。"
          : "This calendar file is too large (max 5 MB)."
      );
      setIcs("");
      setFileName("");
      return;
    }
    try {
      const text = await file.text();
      setIcs(text);
      setFileName(file.name);
      setError("");
      if (!name) setName(file.name.replace(/\.ics$/i, ""));
    } catch {
      setError(isZh ? "无法读取该文件。" : "Could not read this file.");
    }
  }

  async function submit() {
    const nextName = name.trim();
    if (!nextName) {
      setError(isZh ? "请先填写日历名称。" : "Give this calendar a name first.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (mode === "url") {
        if (!url.trim()) {
          setError(
            isZh ? "请粘贴日历订阅链接。" : "Paste a calendar subscription URL."
          );
          return;
        }
        if (isStaticDataMode && !proxyUrl) {
          setError(
            isZh
              ? "当前静态站点未配置日历代理，无法直接订阅链接，请上传 .ics 文件。"
              : "URL subscriptions are not configured on this site. Upload an .ics file instead."
          );
          return;
        }
        await createCalendar.mutateAsync({
          name: nextName,
          url: url.trim(),
          proxyUrl: isStaticDataMode ? proxyUrl : undefined
        });
        setUrl("");
      } else {
        if (!ics) {
          setError(isZh ? "请先选择一个 .ics 文件。" : "Choose an .ics file first.");
          return;
        }
        await importCalendar.mutateAsync({ name: nextName, ics });
        setIcs("");
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      setName("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isZh
            ? "添加日历失败"
            : "Could not add calendar"
      );
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    deleteCalendar.mutate(id, {
      onError: (caught) =>
        onError(
          caught instanceof Error
            ? caught.message
            : isZh
              ? "删除日历失败"
              : "Could not delete calendar"
        )
    });
  }

  function pickColor(id: string, color: string) {
    setColorPickerId(null);
    updateCalendar.mutate(
      { id, patch: { color } },
      {
        onError: (caught) =>
          onError(
            caught instanceof Error
              ? caught.message
              : isZh
                ? "更新日历颜色失败"
                : "Could not update calendar color"
          )
      }
    );
  }

  async function refreshAllNow() {
    try {
      const updated = await refreshAll.mutateAsync();
      const firstError = updated.find(
        (item) => item.sourceType === "url" && item.lastError
      )?.lastError;
      if (firstError) onError(firstError);
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : isZh
            ? "刷新日历失败"
            : "Could not refresh calendars"
      );
    }
  }

  async function refreshOne(id: string) {
    try {
      const calendar = await refreshCalendar.mutateAsync(id);
      if (calendar.lastError) onError(calendar.lastError);
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : isZh
            ? "刷新日历失败"
            : "Could not refresh calendar"
      );
    }
  }

  const countLabel = isZh
    ? `${calendars.length} 个日历源`
    : `${calendars.length} calendar${calendars.length === 1 ? "" : "s"}`;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal cal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "日历源管理" : "Calendars"}
      >
        <div className="modal-header">
          <div>
            <h2>{isZh ? "日历源管理" : "Calendars"}</h2>
            <p>
              {isZh
                ? "外部日历为只读展示。支持订阅 ICS 链接或导入 .ics 日历文件。"
                : "External calendars are read-only. Subscribe to a URL or upload an exported .ics file."}
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

        <div className="cal-dialog-list">
          <div className="cal-dialog-list-head">
            <span>{countLabel}</span>
            {calendars.some((calendar) => calendar.sourceType === "url") && (
              <button
                className="small-btn"
                onClick={() => void refreshAllNow()}
                disabled={refreshAll.isPending}
              >
                {refreshAll.isPending
                  ? isZh
                    ? "刷新中…"
                    : "Refreshing…"
                  : isZh
                    ? "全部刷新"
                    : "Refresh all"}
              </button>
            )}
          </div>

          {calendars.length === 0 ? (
            <p className="hint" style={{ marginTop: 0 }}>
              {isZh ? "暂未添加任何外部日历。" : "No calendars yet."}
            </p>
          ) : (
            calendars.map((calendar) => {
              const pickerOpen = colorPickerId === calendar.id;
              return (
                <div className="cal-sub" key={calendar.id}>
                  <div className="cal-sub-main">
                    <button
                      type="button"
                      className={`cal-sub-dot${pickerOpen ? " open" : ""}`}
                      style={{ background: calendar.color }}
                      onClick={() =>
                        setColorPickerId(pickerOpen ? null : calendar.id)
                      }
                      title={isZh ? "切换颜色" : "Change color"}
                      aria-label={
                        isZh
                          ? `切换 ${calendar.name} 的颜色`
                          : `Change color for ${calendar.name}`
                      }
                      aria-expanded={pickerOpen}
                    />
                    <div className="cal-sub-copy">
                      <strong>{calendar.name}</strong>
                      <span
                        title={
                          calendar.sourceType === "url"
                            ? calendar.url ?? undefined
                            : undefined
                        }
                      >
                        {calendar.sourceType === "url"
                          ? calendar.url
                          : isZh
                            ? "已上传的 .ics 文件"
                            : "Uploaded .ics file"}
                      </span>
                      {calendar.lastError ? (
                        <span className="cal-sub-error">{calendar.lastError}</span>
                      ) : (
                        <span className="cal-sub-sync">
                          {formatSync(calendar.lastFetchedAt, locale)}
                        </span>
                      )}
                    </div>
                    <div className="cal-sub-actions">
                      {calendar.sourceType === "url" && (
                        <button
                          className="small-btn"
                          onClick={() => void refreshOne(calendar.id)}
                          disabled={refreshCalendar.isPending || refreshAll.isPending}
                        >
                          {isZh ? "刷新" : "Refresh"}
                        </button>
                      )}
                      <button
                        className="cal-sub-delete"
                        onClick={() => remove(calendar.id)}
                        aria-label={
                          isZh
                            ? `删除 ${calendar.name}`
                            : `Delete ${calendar.name}`
                        }
                      >
                        {isZh ? "删除" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {pickerOpen && (
                    <div className="cal-sub-colors">
                      <div
                        className="cal-color-row"
                        role="radiogroup"
                        aria-label={isZh ? "日历颜色" : "Calendar color"}
                      >
                        {CALENDAR_PALETTE.map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            className={`cal-color-dot${
                              calendar.color.toLowerCase() === swatch.toLowerCase()
                                ? " active"
                                : ""
                            }`}
                            style={{ background: swatch }}
                            onClick={() => pickColor(calendar.id, swatch)}
                            aria-label={swatch}
                            aria-checked={
                              calendar.color.toLowerCase() === swatch.toLowerCase()
                            }
                            role="radio"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="cal-dialog-add">
          {showUrl ? (
            <div
              className="cal-add-tabs"
              role="tablist"
              aria-label={isZh ? "添加日历方式" : "Add calendar"}
            >
              <button
                type="button"
                className={mode === "url" ? "active" : ""}
                role="tab"
                aria-selected={mode === "url"}
                onClick={() => {
                  setMode("url");
                  setError("");
                }}
              >
                {isZh ? "订阅 URL" : "Subscribe to URL"}
              </button>
              <button
                type="button"
                className={mode === "file" ? "active" : ""}
                role="tab"
                aria-selected={mode === "file"}
                onClick={() => {
                  setMode("file");
                  setError("");
                }}
              >
                {isZh ? "上传 .ics 文件" : "Upload .ics"}
              </button>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 0 }}>
              {isZh
                ? "当前静态部署未配置跨域代理，暂仅支持上传导出的 .ics 文件。"
                : "URL subscriptions are not configured on this static site. Upload an .ics file instead."}
            </p>
          )}

          <div className="field">
            <label htmlFor="cal-name">{isZh ? "日历名称" : "Name"}</label>
            <input
              id="cal-name"
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isZh ? "工作、个人、课程表…" : "Work, Personal…"}
              maxLength={60}
            />
          </div>

          {mode === "url" ? (
            <div className="field">
              <label htmlFor="cal-url">{isZh ? "订阅地址" : "Calendar URL"}</label>
              <input
                id="cal-url"
                className="text-input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="webcal://… 或 https://…"
                spellCheck={false}
              />
              <p className="hint">
                {isZh
                  ? "iCloud 日历需先设为「公共日历」并使用公开链接；Google / Outlook 请使用私密或公开 iCal 地址。"
                  : "For iCloud, publish the calendar and use the public link — private calendars are not supported."}
              </p>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="cal-file">{isZh ? ".ics 文件" : ".ics file"}</label>
              <input
                ref={fileInputRef}
                id="cal-file"
                className="text-input cal-file-input"
                type="file"
                accept=".ics,text/calendar"
                onChange={(event) => void readFile(event)}
              />
              {fileName && <p className="hint">{fileName}</p>}
            </div>
          )}

          {error && <p className="hint form-error">{error}</p>}

          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              {isZh ? "关闭" : "Close"}
            </button>
            <button
              className="btn primary"
              onClick={() => void submit()}
              disabled={busy || createCalendar.isPending || importCalendar.isPending}
            >
              {busy || createCalendar.isPending || importCalendar.isPending
                ? isZh
                  ? "添加中…"
                  : "Adding…"
                : isZh
                  ? "添加日历"
                  : "Add calendar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
