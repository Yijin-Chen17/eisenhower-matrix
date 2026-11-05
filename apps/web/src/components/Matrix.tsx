import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import {
  QUADRANTS,
  clampScore,
  dueLabel,
  dueState,
  type KnownQuadrant,
  type Task
} from "@eisenhower/shared";
import {
  layoutMatrix,
  layoutQuadrant,
  pointToScore,
  quadrantBounds,
  type CardLayout,
  type ClusterLayout,
  type MatrixLayout,
  type Rect
} from "../lib/layout";
import { translations, type Locale } from "../lib/i18n";

interface MatrixProps {
  tasks: Task[];
  threshold: number;
  selectedId: string | null;
  forceIndividual: boolean;
  focusQuadrant?: KnownQuadrant | null;
  locale?: Locale;
  onSelect: (task: Task) => void;
  onComplete: (task: Task) => void;
  onNudge: (task: Task, patch: { importance?: number; urgency?: number }) => void;
  onFocusQuadrant: (quadrant: KnownQuadrant) => void;
  emptyMessage: string;
  emptyHint: string;
}

interface HoverState {
  x: number;
  y: number;
  task?: Task;
  cluster?: ClusterLayout;
}

interface DragState {
  task: Task;
  originRect: Rect;
  startPointer: { x: number; y: number };
  currentPointer: { x: number; y: number };
  isActivated: boolean;
  hasBrokenDeadband: boolean;
}

const QUAD_ORDER: Array<{
  quadrant: 1 | 2 | 3 | 4;
  position: "tl" | "tr" | "bl" | "br";
}> = [
  { quadrant: 2, position: "tl" },
  { quadrant: 1, position: "tr" },
  { quadrant: 4, position: "bl" },
  { quadrant: 3, position: "br" }
];

export function Matrix({
  tasks,
  threshold,
  selectedId,
  forceIndividual,
  focusQuadrant = null,
  locale = "zh",
  onSelect,
  onComplete,
  onNudge,
  onFocusQuadrant,
  emptyMessage,
  emptyHint
}: MatrixProps) {
  const matrixRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDragState((current) => {
        if (!current) return null;
        const dx = event.clientX - current.startPointer.x;
        const dy = event.clientY - current.startPointer.y;
        const dist = Math.hypot(dx, dy);

        // 未激活前如果快速滑动手势，取消蓄力长按
        if (!current.isActivated && dist > 8) {
          if (dragTimerRef.current !== null) {
            window.clearTimeout(dragTimerRef.current);
            dragTimerRef.current = null;
          }
          return null;
        }

        const broken = current.isActivated && (current.hasBrokenDeadband || dist >= 15);
        return {
          ...current,
          currentPointer: { x: event.clientX, y: event.clientY },
          hasBrokenDeadband: broken
        };
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragTimerRef.current !== null) {
        window.clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }

      setDragState((current) => {
        if (!current) return null;
        if (current.isActivated && current.hasBrokenDeadband && matrixRef.current) {
          const matrixRect = matrixRef.current.getBoundingClientRect();
          const dropX = event.clientX - matrixRect.left;
          const dropY = event.clientY - matrixRect.top;
          let { importance, urgency } = pointToScore(
            { x: dropX, y: dropY },
            matrixRect.width,
            matrixRect.height
          );
          // 语义磁吸
          if (Math.abs(importance - threshold) <= 2) {
            importance = importance >= threshold ? threshold + 3 : threshold - 3;
          }
          if (Math.abs(urgency - threshold) <= 2) {
            urgency = urgency >= threshold ? threshold + 3 : threshold - 3;
          }
          onNudge(current.task, { importance, urgency });
        }
        return null;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, onNudge, threshold]);

  function handleStartDrag(
    event: React.PointerEvent,
    task: Task,
    originRect: Rect
  ) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".complete-btn") || target.closest("input, textarea, button.complete-btn")) {
      return;
    }

    if (dragTimerRef.current !== null) {
      window.clearTimeout(dragTimerRef.current);
    }

    const isModifier = event.altKey || Boolean(target.closest(".card-drag-handle"));

    const initialDrag: DragState = {
      task,
      originRect,
      startPointer: { x: event.clientX, y: event.clientY },
      currentPointer: { x: event.clientX, y: event.clientY },
      isActivated: isModifier,
      hasBrokenDeadband: false
    };

    setDragState(initialDrag);

    if (!isModifier) {
      dragTimerRef.current = window.setTimeout(() => {
        setDragState((curr) => (curr ? { ...curr, isActivated: true } : null));
        dragTimerRef.current = null;
      }, 220);
    }
  }

  useLayoutEffect(() => {
    const element = matrixRef.current;
    if (!element) return;

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const focused = focusQuadrant ?? null;

  const layout = useMemo<MatrixLayout>(() => {
    if (focused !== null) {
      return layoutQuadrant({
        tasks,
        quadrant: focused,
        threshold,
        width: size.width,
        height: size.height
      });
    }
    return layoutMatrix({
      tasks,
      threshold,
      width: size.width,
      height: size.height,
      selectedId,
      forceIndividual
    });
  }, [
    tasks,
    threshold,
    size.width,
    size.height,
    selectedId,
    forceIndividual,
    focused
  ]);

  const narrow = size.width < 960;

  useEffect(() => {
    if (!focusTaskId) return;
    const element = matrixRef.current?.querySelector<HTMLElement>(
      `[data-task-id="${focusTaskId}"]`
    );
    element?.focus();
    setFocusTaskId(null);
  }, [focusTaskId, layout]);

  /**
   * A hovered card can leave the layout (completion, deletion, filtering)
   * before the pointer ever leaves it, so `mouseleave` never fires and the
   * tooltip would stay pinned to the screen. Drop hover state for anything
   * that is no longer rendered.
   */
  useEffect(() => {
    setHover((current) => {
      if (!current) return current;

      const taskId = current.task?.id;
      if (taskId && !layout.cards.some((card) => card.task.id === taskId)) {
        return null;
      }

      const clusterId = current.cluster?.id;
      if (
        clusterId &&
        !layout.clusters.some((cluster) => cluster.id === clusterId)
      ) {
        return null;
      }

      return current;
    });
  }, [layout]);

  /**
   * Opening the detail drawer covers the card the pointer is still resting on,
   * so its tooltip would float on top of the panel. Drop it on selection.
   */
  useEffect(() => {
    setHover(null);
  }, [selectedId]);

  function handleComplete(task: Task) {
    setHover(null);
    onComplete(task);
  }

  useEffect(() => {
    if (!openClusterId) return;
    if (!layout.clusters.some((cluster) => cluster.id === openClusterId)) {
      setOpenClusterId(null);
    }
  }, [layout.clusters, openClusterId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenClusterId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const labelWidthMax = narrow ? 180 : 250;
  const leftLabelWidth = Math.max(
    150,
    Math.min(labelWidthMax, (threshold / 100) * size.width - 24)
  );
  const rightLabelWidth = Math.max(
    150,
    Math.min(labelWidthMax, ((100 - threshold) / 100) * size.width - 24)
  );
  const leftPct = `${threshold}%`;
  const rightPct = `${100 - threshold}%`;
  const topPct = `${100 - threshold}%`;
  const bottomPct = `${threshold}%`;

  const bounds = focused === null ? null : quadrantBounds(focused, threshold);
  const yTicks = bounds
    ? [
        bounds.importanceMax,
        Math.round((bounds.importanceMin + bounds.importanceMax) / 2),
        bounds.importanceMin
      ]
    : [100, 50, 0];
  const xTicks = bounds
    ? [
        bounds.urgencyMin,
        Math.round((bounds.urgencyMin + bounds.urgencyMax) / 2),
        bounds.urgencyMax
      ]
    : [0, 50, 100];

  function showTaskHover(event: ReactMouseEvent, task: Task) {
    setHover({
      x: event.clientX,
      y: event.clientY,
      task
    });
  }

  function moveHover(event: ReactMouseEvent) {
    setHover((current) =>
      current ? { ...current, x: event.clientX, y: event.clientY } : current
    );
  }

  function showClusterHover(event: ReactMouseEvent, cluster: ClusterLayout) {
    setHover({
      x: event.clientX,
      y: event.clientY,
      cluster
    });
  }

  function handleNudge(event: ReactKeyboardEvent, task: Task) {
    const step = event.shiftKey ? 10 : 1;
    let patch: { importance?: number; urgency?: number } | null = null;

    if (event.key === "ArrowUp") {
      patch = { importance: clampScore(task.importance + step) };
    } else if (event.key === "ArrowDown") {
      patch = { importance: clampScore(task.importance - step) };
    } else if (event.key === "ArrowRight") {
      patch = { urgency: clampScore(task.urgency + step) };
    } else if (event.key === "ArrowLeft") {
      patch = { urgency: clampScore(task.urgency - step) };
    }

    if (patch) {
      event.preventDefault();
      event.stopPropagation();
      setFocusTaskId(task.id);
      onNudge(task, patch);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onSelect(task);
    }
  }

  const openCluster =
    layout.clusters.find((cluster) => cluster.id === openClusterId) ?? null;
  const hoverTask = hover?.task;
  const hoverCluster = hover?.cluster;
  const tooltipWidth = 280;
  const tooltipLeft = hover
    ? Math.max(
        8,
        Math.min(hover.x + 14, window.innerWidth - tooltipWidth - 12)
      )
    : 0;
  const tooltipTop = hover
    ? Math.max(8, Math.min(hover.y + 14, window.innerHeight - 180))
    : 0;

  return (
    <div className="matrix-wrap">
      <div className="axis axis-y" aria-hidden="true">
        <span className="arrow">↑</span>
        <span className="axis-title">
          {locale === "zh" ? translations.zh.importance : "Importance"}
        </span>
        <span className="tick top">{yTicks[0]}</span>
        <span className="tick mid">{yTicks[1]}</span>
        <span className="tick bottom">{yTicks[2]}</span>
      </div>

      {/* The urgency axis sits above the canvas so both axis titles frame the
          matrix from the top-left corner instead of bracketing it. */}
      <div className="axis axis-x" aria-hidden="true">
        <span className="axis-title">
          {locale === "zh" ? translations.zh.urgency : "Urgency →"}
        </span>
        <div className="ticks">
          <span className="tick left">{xTicks[0]}</span>
          <span className="tick mid">{xTicks[1]}</span>
          <span className="tick right">{xTicks[2]}</span>
        </div>
      </div>

      <div
        className={`matrix${narrow ? " narrow" : ""}${
          focused === null ? "" : ` focused q${focused}`
        }`}
        ref={matrixRef}
        aria-label={
          focused === null
            ? "Eisenhower matrix"
            : `${QUADRANTS[focused].name} quadrant map`
        }
      >
        {focused === null && (
          <>
            <div
              className="quad-bg q1-bg"
              style={{
                left: leftPct,
                top: 0,
                width: rightPct,
                height: topPct
              }}
            />
            <div
              className="quad-bg q2-bg"
              style={{
                left: 0,
                top: 0,
                width: leftPct,
                height: topPct
              }}
            />
            <div
              className="quad-bg q3-bg"
              style={{
                left: leftPct,
                top: topPct,
                width: rightPct,
                height: bottomPct
              }}
            />
            <div
              className="quad-bg q4-bg"
              style={{
                left: 0,
                top: topPct,
                width: leftPct,
                height: bottomPct
              }}
            />

            <div className="crosshair v" style={{ left: leftPct }} />
            <div className="crosshair h" style={{ top: topPct }} />

            {QUAD_ORDER.map(({ quadrant, position }) => {
              const meta = QUADRANTS[quadrant];
              const qKey = `q${quadrant}Name` as "q1Name" | "q2Name" | "q3Name" | "q4Name";
              const hKey = `q${quadrant}Hint` as "q1Hint" | "q2Hint" | "q3Hint" | "q4Hint";
              const qName = locale === "zh" ? translations.zh[qKey] : meta.name;
              const qHint = locale === "zh" ? translations.zh[hKey] : meta.hint;
              const width =
                position === "tl" || position === "bl"
                  ? leftLabelWidth
                  : rightLabelWidth;
              return (
                <div
                  key={quadrant}
                  className={`quad-label ${position} q${quadrant}${
                    width < 196 ? " compact" : ""
                  }`}
                  style={{ width }}
                  role="button"
                  tabIndex={0}
                  title={`Open ${qName}`}
                  aria-label={`Open ${qName}, ${layout.counts[quadrant]} tasks`}
                  onClick={() => onFocusQuadrant(quadrant)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onFocusQuadrant(quadrant);
                    }
                  }}
                >
                  <span className="quad-accent" />
                  <div className="quad-copy">
                    <div className="quad-title-row">
                      <h2>{qName}</h2>
                      <span className="quad-count">
                        {layout.counts[quadrant]}
                      </span>
                      <span className="quad-expand" aria-hidden="true">
                        ↗
                      </span>
                    </div>
                    <p>{qHint}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <svg
          className="leaders"
          viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
          aria-hidden="true"
        >
          {layout.leaders.map((leader, index) => (
            <g key={`${leader.quadrant}-${index}`}>
              <line
                x1={leader.from.x}
                y1={leader.from.y}
                x2={leader.to.x}
                y2={leader.to.y}
                className={`leader ${leader.quadrant}`}
              />
              <circle
                cx={leader.from.x}
                cy={leader.from.y}
                r={2.8}
                className={`anchor ${leader.quadrant}`}
              />
            </g>
          ))}
        </svg>

        <div className="items-layer">
          {layout.clusters.map((cluster) => (
            <button
              key={cluster.id}
              className="cluster"
              style={{ left: cluster.rect.left, top: cluster.rect.top }}
              onClick={() => setOpenClusterId(cluster.id)}
              onMouseEnter={(event) => showClusterHover(event, cluster)}
              onMouseMove={moveHover}
              onMouseLeave={() => setHover(null)}
              aria-label={`${cluster.tasks.length} unimportant items, ${cluster.urgent} urgent`}
            >
              {cluster.urgent > 0 && <i className="urgent-dot" />}
              <span className="cluster-label">
                {cluster.tasks.length} items
              </span>
              {cluster.overdue > 0 && <i className="overdue-dot" />}
            </button>
          ))}

          {layout.dots.map((dot) => {
            const selected = dot.task.id === selectedId;
            const due = dot.task.dueDate ? dueState(dot.task.dueDate) : "none";
            const isSoon = due === "soon" || due === "today";
            const isOverdue = due === "overdue";
            const qNum = dot.task.urgency >= threshold ? 3 : 4;
            const isDraggingThis = dragState?.task.id === dot.task.id;
            const offsetX = isDraggingThis && dragState.hasBrokenDeadband ? dragState.currentPointer.x - dragState.startPointer.x : 0;
            const offsetY = isDraggingThis && dragState.hasBrokenDeadband ? dragState.currentPointer.y - dragState.startPointer.y : 0;

            return (
              <button
                key={dot.task.id}
                className={`micro-pill q${qNum}${selected ? " selected" : ""}${isSoon ? " temp-warm" : ""}${isOverdue ? " temp-critical" : ""}${isDraggingThis && dragState.isActivated ? " dragging-activated" : ""}`}
                style={{
                  left: dot.rect.left + offsetX,
                  top: dot.rect.top + offsetY,
                  zIndex: isDraggingThis ? 9999 : 15
                }}
                data-task-id={dot.task.id}
                onClick={() => {
                  if (dragState?.hasBrokenDeadband) return;
                  onSelect(dot.task);
                }}
                onPointerDown={(event) => handleStartDrag(event, dot.task, dot.rect)}
                onKeyDown={(event) => handleNudge(event, dot.task)}
                onMouseEnter={(event) => showTaskHover(event, dot.task)}
                onMouseMove={moveHover}
                onMouseLeave={() => setHover(null)}
                aria-label={`${dot.task.title}, importance ${dot.task.importance}, urgency ${dot.task.urgency}`}
              >
                <span className="micro-pill-dot" />
                <span className="micro-pill-text">{dot.task.title}</span>
              </button>
            );
          })}

          {dragState?.isActivated && dragState.hasBrokenDeadband && (
            <div
              className="ghost-card-placeholder"
              style={{
                left: dragState.originRect.left,
                top: dragState.originRect.top,
                width: dragState.originRect.width,
                height: dragState.originRect.height
              }}
            />
          )}

          {layout.cards.map((card) => (
            <TaskCard
              key={card.task.id}
              card={card}
              threshold={threshold}
              selected={card.task.id === selectedId}
              dragState={dragState}
              onStartDrag={handleStartDrag}
              onSelect={onSelect}
              onComplete={handleComplete}
              onKeyDown={handleNudge}
              onMouseEnter={showTaskHover}
              onMouseMove={moveHover}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>

        {!tasks.length && (
          <div className="matrix-empty">
            <strong>{emptyMessage}</strong>
            <span>{emptyHint}</span>
          </div>
        )}

        {openCluster && (
          <>
            <div
              className="cluster-backdrop"
              onClick={() => setOpenClusterId(null)}
            />
            <ClusterPopover
              cluster={openCluster}
              width={size.width}
              height={size.height}
              onClose={() => setOpenClusterId(null)}
              onSelect={(task) => {
                setOpenClusterId(null);
                onSelect(task);
              }}
            />
          </>
        )}
      </div>

      {hover && (
        <div
          className="tooltip"
          style={{
            left: tooltipLeft,
            top: tooltipTop,
            opacity: 1,
            visibility: "visible"
          }}
          role="tooltip"
        >
          {hoverTask && <TaskTooltipContent task={hoverTask} />}
          {hoverCluster && <ClusterTooltipContent cluster={hoverCluster} />}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  card,
  threshold,
  selected,
  dragState,
  onStartDrag,
  onSelect,
  onComplete,
  onKeyDown,
  onMouseEnter,
  onMouseMove,
  onMouseLeave
}: {
  card: CardLayout;
  threshold: number;
  selected: boolean;
  dragState: DragState | null;
  onStartDrag: (event: React.PointerEvent, task: Task, rect: Rect) => void;
  onSelect: (task: Task) => void;
  onComplete: (task: Task) => void;
  onKeyDown: (event: ReactKeyboardEvent, task: Task) => void;
  onMouseEnter: (event: ReactMouseEvent, task: Task) => void;
  onMouseMove: (event: ReactMouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const { task, rect, tier, kind, quadrant } = card;
  const qClass = quadrant === "pending" ? "pending" : `q${quadrant}`;
  const due = task.dueDate ? dueLabel(task.dueDate) : "";
  const dueClass =
    task.dueDate && dueState(task.dueDate) === "overdue"
      ? "overdue"
      : task.dueDate &&
          ["today", "soon"].includes(dueState(task.dueDate))
        ? "soon"
        : "";

  const isDraggingThis = dragState?.task.id === task.id;
  const isMoving = isDraggingThis && dragState.hasBrokenDeadband;
  const isActivated = isDraggingThis && dragState.isActivated;
  const dx = isMoving ? dragState.currentPointer.x - dragState.startPointer.x : 0;
  const dy = isMoving ? dragState.currentPointer.y - dragState.startPointer.y : 0;

  return (
    <article
      className={`task-card ${qClass} ${tier}${
        kind === "unimportant" ? " unimportant" : ""
      }${selected ? " selected" : ""}${isActivated ? " dragging-activated" : ""}${isMoving ? " dragging-moving" : ""}`}
      style={{
        left: rect.left + dx,
        top: rect.top + dy,
        width: rect.width,
        height: rect.height,
        zIndex: isMoving ? 9999 : kind === "pending" ? 60 : 20 + Math.round(task.importance / 2)
      }}
      tabIndex={0}
      role="button"
      data-task-id={task.id}
      aria-label={`${task.title}, importance ${task.importance}, urgency ${task.urgency}`}
      onClick={() => {
        if (dragState?.hasBrokenDeadband) return;
        onSelect(task);
      }}
      onPointerDown={(event) => onStartDrag(event, task, rect)}
      onKeyDown={(event) => onKeyDown(event, task)}
      onMouseEnter={(event) => onMouseEnter(event, task)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="card-top">
        <span
          className="card-drag-handle"
          title="Hold or Option-drag to reposition"
          aria-hidden="true"
        >
          ⋮⋮
        </span>
        <h3>{task.title}</h3>
        {task.recurrence !== "none" && (
          <span className="routine-badge" title={`Routine: ${task.recurrence}, streak: ${task.streak}`}>
            🔥{task.streak > 0 ? task.streak : ""}
          </span>
        )}
        <button
          className="complete-btn"
          title="Complete"
          aria-label="Complete"
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onComplete(task);
          }}
        >
          ✓
        </button>
      </div>
      <div className="card-meta">
        {due && <span className={`due ${dueClass}`}>{due}</span>}
        {kind === "pending" && <span className="pending-chip">Review</span>}
        <span className="tag-dots">
          {task.tags.slice(0, 3).map((tag) => (
            <i
              key={tag.id}
              style={{ background: tag.color }}
              title={tag.name}
            />
          ))}
        </span>
        {tier === "lg" && (
          <span className="score-mini">
            I {task.importance} · U {task.urgency}
          </span>
        )}
        {kind === "unimportant" && (
          <span className="score-mini">
            I {task.importance} · U {task.urgency}
          </span>
        )}
      </div>
    </article>
  );
}

function TaskTooltipContent({ task }: { task: Task }) {
  const due = task.dueDate ? dueLabel(task.dueDate) : "";
  const tags = task.tags.map((tag) => tag.name).join(" / ");
  return (
    <>
      <div className="tt-title">{task.title}</div>
      <div className="tt-meta">
        Importance {task.importance} · Urgency {task.urgency}
      </div>
      {(due || tags) && (
        <div className="tt-meta">{[due, tags].filter(Boolean).join(" · ")}</div>
      )}
    </>
  );
}

function ClusterTooltipContent({ cluster }: { cluster: ClusterLayout }) {
  return (
    <>
      <div className="tt-title">{cluster.tasks.length} items · not important</div>
      <div className="tt-meta">
        {cluster.urgent} urgent
        {cluster.overdue ? ` · ${cluster.overdue} overdue` : ""}
      </div>
      <div className="tt-list">
        {cluster.tasks.slice(0, 4).map((task) => (
          <div key={task.id}>
            {task.title}
            <span>
              I{task.importance} U{task.urgency}
            </span>
          </div>
        ))}
      </div>
      <div className="tt-foot">Click to expand</div>
    </>
  );
}

function ClusterPopover({
  cluster,
  width,
  height,
  onClose,
  onSelect
}: {
  cluster: ClusterLayout;
  width: number;
  height: number;
  onClose: () => void;
  onSelect: (task: Task) => void;
}) {
  const popWidth = Math.min(320, Math.max(220, width - 24));
  const popHeight = Math.min(300, 48 + cluster.tasks.length * 44);
  let left = Math.min(
    Math.max(cluster.center.x - popWidth / 2, 12),
    Math.max(12, width - popWidth - 12)
  );
  let top = cluster.rect.bottom + 8;
  if (top + popHeight > height - 12) top = cluster.rect.top - popHeight - 8;
  if (top < 12) top = 12;

  return (
    <div
      className="cluster-popover"
      style={{ left, top, width: popWidth }}
      onClick={(event) => event.stopPropagation()}
    >
      <header>
        <strong>{cluster.tasks.length} items · not important</strong>
        <span>
          {cluster.urgent} urgent
          {cluster.overdue ? ` · ${cluster.overdue} overdue` : ""}
        </span>
      </header>
      {cluster.tasks.map((task) => (
        <button
          key={task.id}
          className="popover-item"
          onClick={() => {
            onClose();
            onSelect(task);
          }}
        >
          <span className="pi-title">{task.title}</span>
          <span className="pi-meta">
            <span>
              Importance {task.importance} · Urgency {task.urgency}
            </span>
            {task.dueDate && (
              <span className={`due ${dueState(task.dueDate) === "overdue" ? "overdue" : ""}`}>
                {dueLabel(task.dueDate)}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
