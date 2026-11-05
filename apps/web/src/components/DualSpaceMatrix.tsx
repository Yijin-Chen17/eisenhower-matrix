import { useMemo } from "react";
import {
  QUADRANTS,
  dueLabel,
  dueState,
  quadrantOf,
  type KnownQuadrant,
  type Task
} from "@eisenhower/shared";
import { Matrix } from "./Matrix";
import { translations, type Locale } from "../lib/i18n";

interface DualSpaceMatrixProps {
  tasks: Task[];
  threshold: number;
  selectedId: string | null;
  forceIndividual: boolean;
  locale?: Locale;
  onSelect: (task: Task) => void;
  onComplete: (task: Task) => void;
  onNudge: (task: Task, patch: { importance?: number; urgency?: number }) => void;
  onFocusQuadrant: (quadrant: KnownQuadrant) => void;
  emptyMessage: string;
  emptyHint: string;
}

export function DualSpaceMatrix({
  tasks,
  threshold,
  selectedId,
  forceIndividual,
  locale = "zh",
  onSelect,
  onComplete,
  onNudge,
  onFocusQuadrant,
  emptyMessage,
  emptyHint
}: DualSpaceMatrixProps) {
  const t = translations[locale];
  // 分离任务：上半区 (重要: Q1, Q2 及 Pending)，下半区 (不重要: Q3, Q4)
  const upperTasks = useMemo(() => {
    return tasks.filter((task) => {
      const q = quadrantOf(task, threshold);
      return q === 1 || q === 2 || q === "pending";
    });
  }, [tasks, threshold]);

  const q3Tasks = useMemo(() => {
    return tasks
      .filter((task) => quadrantOf(task, threshold) === 3)
      .sort((a, b) => {
        // 临期的排在前面
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.urgency - a.urgency;
      });
  }, [tasks, threshold]);

  const q4Tasks = useMemo(() => {
    return tasks
      .filter((task) => quadrantOf(task, threshold) === 4)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tasks, threshold]);

  return (
    <div className="dual-space-layout">
      {/* 上半区：Q1 & Q2 战略核心黄金工作台 (70%) */}
      <section className="dual-space-upper" aria-label={t.highLeverageCanvas}>
        <Matrix
          tasks={upperTasks}
          threshold={threshold}
          selectedId={selectedId}
          forceIndividual={forceIndividual}
          locale={locale}
          onSelect={onSelect}
          onComplete={onComplete}
          onNudge={onNudge}
          onFocusQuadrant={onFocusQuadrant}
          emptyMessage={upperTasks.length === 0 ? (locale === "zh" ? "暂无高价值战略任务" : "No high-leverage tasks yet") : emptyMessage}
          emptyHint={locale === "zh" ? "在上方工作台专注推进 Q1 (立即执行) 与 Q2 (排期规划) 核心任务。" : "Focus on high-impact Q1 (Do now) and Q2 (Schedule) initiatives here."}
        />
      </section>

      {/* 下半区：Q3 & Q4 行动流托盘 (30%) */}
      <footer className="dual-space-tray" aria-label="Action tray">
        {/* Q4 冷冻库 / 断舍离 */}
        <div className="tray-column q4-icebox">
          <header className="tray-col-header" onClick={() => onFocusQuadrant(4)}>
            <div className="tray-col-title">
              <span className="tray-mark q4-mark" />
              <h3>{locale === "zh" ? translations.zh.q4Name : QUADRANTS[4].name}</h3>
              <span className="tray-count">{q4Tasks.length}</span>
            </div>
            <span className="tray-hint">{t.dropIcebox}</span>
          </header>
          <div className="tray-items-scroll">
            {q4Tasks.length === 0 ? (
              <div className="tray-empty">{t.noBacklogNotice}</div>
            ) : (
              q4Tasks.map((task) => (
                <div
                  key={task.id}
                  className={`tray-item q4-item${task.id === selectedId ? " selected" : ""}`}
                  onClick={() => onSelect(task)}
                >
                  <span className="tray-item-title">{task.title}</span>
                  <button
                    className="tray-item-complete"
                    title={locale === "zh" ? "完成/丢弃" : "Complete / Dismiss"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onComplete(task);
                    }}
                  >
                    ✓
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Q3 杂务批处理传送带 */}
        <div className="tray-column q3-conveyor">
          <header className="tray-col-header" onClick={() => onFocusQuadrant(3)}>
            <div className="tray-col-title">
              <span className="tray-mark q3-mark" />
              <h3>{locale === "zh" ? translations.zh.q3Name : `${QUADRANTS[3].name} (Batch Clearing)`}</h3>
              <span className="tray-count">{q3Tasks.length}</span>
            </div>
            <span className="tray-hint">{t.q3Hint}</span>
          </header>
          <div className="tray-items-conveyor">
            {q3Tasks.length === 0 ? (
              <div className="tray-empty">{t.cleanDeskNotice}</div>
            ) : (
              q3Tasks.map((task) => {
                const due = task.dueDate ? dueLabel(task.dueDate) : "";
                const state = task.dueDate ? dueState(task.dueDate) : "none";
                const isOverdue = state === "overdue";
                const isSoon = state === "today" || state === "soon";

                return (
                  <article
                    key={task.id}
                    className={`conveyor-card q3-card${task.id === selectedId ? " selected" : ""}${isOverdue ? " overdue" : ""}${isSoon ? " soon" : ""}`}
                    onClick={() => onSelect(task)}
                  >
                    <div className="conveyor-card-main">
                      <h4 className="conveyor-card-title">{task.title}</h4>
                      {due && <span className={`due ${state}`}>{due}</span>}
                    </div>
                    <button
                      className="conveyor-complete-btn"
                      title={locale === "zh" ? "快速完成" : "Quick Complete"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onComplete(task);
                      }}
                    >
                      ✓
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
