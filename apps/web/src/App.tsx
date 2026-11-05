import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_SETTINGS,
  QUADRANTS,
  quadrantOf,
  type KnownQuadrant,
  type Settings,
  type Tag,
  type Task,
  type TaskView
} from "@eisenhower/shared";
import { Matrix } from "./components/Matrix";
import {
  AddTaskModal,
  ConfirmDialog,
  SettingsDialog
} from "./components/Modals";
import { CalendarView } from "./components/CalendarView";
import { QuadrantFocus } from "./components/QuadrantFocus";
import type { QuadrantViewMode } from "./components/QuadrantFocus";
import { TaskDrawer } from "./components/TaskDrawer";
import { TaskLists } from "./components/TaskLists";
import { Select } from "./components/Select";
import {
  useCreateTag,
  useCreateTask,
  useDeleteTag,
  useDeleteTask,
  useCalendarEvents,
  useSettings,
  useTags,
  useTaskPreview,
  useTasks,
  useUpdateSettings,
  useUpdateTask
} from "./hooks";
import { localDayRange, overlaps } from "./lib/calendar";
import { applyTheme, resolveTheme, useSystemTheme } from "./lib/theme";

interface ToastState {
  message: string;
  undo?: () => void;
}

type AppView = TaskView | "calendar";

interface NavItem {
  view: AppView;
  label: string;
  icon: ReactNode;
  count?: "active" | "completed" | "archived";
}

const NAV_ITEMS: NavItem[] = [
  {
    view: "active",
    label: "In progress",
    count: "active",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
      </svg>
    )
  },
  {
    view: "completed",
    label: "Completed",
    count: "completed",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.4 12.4 2.6 2.6 4.6-5.2" />
      </svg>
    )
  },
  {
    view: "archived",
    label: "Archived",
    count: "archived",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4.4" rx="1.2" />
        <path d="M5 8.4V19a1.4 1.4 0 0 0 1.4 1.4h11.2A1.4 1.4 0 0 0 19 19V8.4" />
        <path d="M10 12.4h4" />
      </svg>
    )
  },
  {
    view: "calendar",
    label: "Calendar",
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2.4" />
        <path d="M8 3v4M16 3v4M3 10.5h18" />
      </svg>
    )
  }
];

const SIDEBAR_KEY = "eisenhower.sidebarCollapsed";

export default function App() {
  const [view, setView] = useState<AppView>("active");
  const [focusQuadrant, setFocusQuadrant] = useState<KnownQuadrant | null>(null);
  const [focusMode, setFocusMode] = useState<QuadrantViewMode>(() => {
    try {
      return window.localStorage.getItem("eisenhower.focusMode") === "map"
        ? "map"
        : "list";
    } catch {
      return "list";
    }
  });
  const [search, setSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const activeQuery = useTasks("active");
  const completedQuery = useTasks("completed");
  const archivedQuery = useTasks("archived");
  const tagsQuery = useTags();
  const settingsQuery = useSettings();

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const updateSettings = useUpdateSettings();
  const previewTask = useTaskPreview();

  const settings: Settings = settingsQuery.data ?? DEFAULT_SETTINGS;
  const tags = tagsQuery.data ?? [];
  const systemTheme = useSystemTheme();
  const resolvedTheme = resolveTheme(settings.theme, systemTheme);

  const tasks =
    view === "active" || view === "calendar"
      ? activeQuery.data ?? []
      : view === "completed"
        ? completedQuery.data ?? []
        : archivedQuery.data ?? [];

  const counts = {
    active: activeQuery.data?.length ?? 0,
    completed: completedQuery.data?.length ?? 0,
    archived: archivedQuery.data?.length ?? 0
  };

  const isFiltering =
    search.trim().length > 0 || selectedTagIds.length > 0;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (query) {
        const matches =
          task.title.toLowerCase().includes(query) ||
          task.notes.toLowerCase().includes(query);
        if (!matches) return false;
      }

      if (
        selectedTagIds.length > 0 &&
        !task.tags.some((tag) => selectedTagIds.includes(tag.id))
      ) {
        return false;
      }

      return true;
    });
  }, [tasks, search, selectedTagIds]);

  const pendingCount = useMemo(
    () =>
      view === "active"
        ? filteredTasks.filter(
            (task) => quadrantOf(task, settings.threshold) === "pending"
          ).length
        : 0,
    [filteredTasks, settings.threshold, view]
  );

  const quadrantCounts = useMemo(() => {
    const counts: Record<KnownQuadrant, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (view !== "active") return counts;
    for (const task of filteredTasks) {
      const quadrant = quadrantOf(task, settings.threshold);
      if (quadrant !== "pending") counts[quadrant]++;
    }
    return counts;
  }, [filteredTasks, settings.threshold, view]);

  const focusTasks = useMemo(
    () =>
      focusQuadrant === null
        ? []
        : filteredTasks.filter(
            (task) => quadrantOf(task, settings.threshold) === focusQuadrant
          ),
    [filteredTasks, focusQuadrant, settings.threshold]
  );

  const selectedTask =
    view === "active" || view === "calendar"
      ? activeQuery.data?.find((task) => task.id === selectedId) ?? null
      : null;

  const conflictRange = selectedTask?.scheduledStart
    ? localDayRange(selectedTask.scheduledStart)
    : null;
  const conflictEventsQuery = useCalendarEvents(
    conflictRange?.start ?? null,
    conflictRange?.end ?? null
  );

  const conflictTitles = useMemo(() => {
    if (!selectedTask?.scheduledStart || !selectedTask.scheduledEnd) return [];
    const start = selectedTask.scheduledStart;
    const end = selectedTask.scheduledEnd;
    const titles = new Set<string>();

    for (const event of conflictEventsQuery.data ?? []) {
      if (event.allDay) continue;
      if (overlaps(event.start, event.end, start, end)) {
        titles.add(event.title);
      }
    }
    for (const task of activeQuery.data ?? []) {
      if (
        task.id === selectedTask.id ||
        !task.scheduledStart ||
        !task.scheduledEnd
      ) {
        continue;
      }
      if (overlaps(task.scheduledStart, task.scheduledEnd, start, end)) {
        titles.add(task.title);
      }
    }

    return [...titles].slice(0, 5);
  }, [selectedTask, conflictEventsQuery.data, activeQuery.data]);

  useEffect(() => {
    applyTheme(resolvedTheme, settings.theme);
  }, [resolvedTheme, settings.theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (selectedId && !activeQuery.data?.some((task) => task.id === selectedId)) {
      setSelectedId(null);
    }
  }, [activeQuery.data, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        target.matches("input, textarea, select, [contenteditable='true']");

      if (event.key === "Escape") {
        if (
          !document.querySelector(".modal-backdrop") &&
          !document.querySelector(".drawer")
        ) {
          setFocusQuadrant(null);
        }
        setAddOpen(false);
        setSettingsOpen(false);
        setDeleteTarget(null);
        setSelectedId(null);
        return;
      }

      if (typing || document.querySelector(".modal-backdrop")) return;

      if (event.key === "n") {
        event.preventDefault();
        setAddOpen(true);
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  function showToast(message: string, undo?: () => void) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, 5000);
  }

  function runUndo() {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    const action = toast?.undo;
    setToast(null);
    action?.();
  }

  function changeView(next: AppView) {
    setView(next);
    setFocusQuadrant(null);
    setSelectedId(null);
  }

  function changeFocus(next: KnownQuadrant | null) {
    setFocusQuadrant(next);
    setSelectedId(null);
  }

  function changeFocusMode(next: QuadrantViewMode) {
    setFocusMode(next);
    try {
      window.localStorage.setItem("eisenhower.focusMode", next);
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }

  function pushError(error: unknown) {
    showToast(error instanceof Error ? error.message : "Something went wrong");
  }

  function showError(message: string) {
    showToast(message);
  }

  function handleSelect(task: Task) {
    setSelectedId(task.id);
  }

  function handlePreview(id: string, patch: Parameters<typeof previewTask>[1]) {
    previewTask(id, patch);
  }

  function handleSave(id: string, patch: Parameters<typeof previewTask>[1]) {
    updateTask.mutate(
      { id, patch },
      { onError: (error) => pushError(error) }
    );
  }

  function handleNudge(
    task: Task,
    patch: { importance?: number; urgency?: number }
  ) {
    updateTask.mutate(
      { id: task.id, patch },
      { onError: (error) => pushError(error) }
    );
  }

  function handleComplete(task: Task) {
    setSelectedId(null);
    updateTask.mutate(
      { id: task.id, patch: { status: "completed" } },
      { onError: (error) => pushError(error) }
    );
    showToast(`Completed “${task.title}”`, () => {
      updateTask.mutate(
        { id: task.id, patch: { status: "active" } },
        { onError: (error) => pushError(error) }
      );
    });
  }

  function handleArchive(task: Task) {
    setSelectedId(null);
    updateTask.mutate(
      { id: task.id, patch: { archived: true } },
      { onError: (error) => pushError(error) }
    );
    showToast(`Archived “${task.title}”`, () => {
      updateTask.mutate(
        { id: task.id, patch: { archived: false } },
        { onError: (error) => pushError(error) }
      );
    });
  }

  function requestDelete(task: Task) {
    setDeleteTarget(task);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const task = deleteTarget;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setSelectedId(null);
        showToast(`Deleted “${task.title}”`);
      },
      onError: (error) => {
        setDeleteTarget(null);
        pushError(error);
      }
    });
  }

  function handleRestore(task: Task) {
    if (view === "archived") {
      updateTask.mutate(
        { id: task.id, patch: { archived: false } },
        { onError: (error) => pushError(error) }
      );
      showToast(`Restored “${task.title}”`, () => {
        updateTask.mutate(
          { id: task.id, patch: { archived: true } },
          { onError: (error) => pushError(error) }
        );
      });
    } else {
      updateTask.mutate(
        { id: task.id, patch: { status: "active" } },
        { onError: (error) => pushError(error) }
      );
      showToast(`Restored “${task.title}”`, () => {
        updateTask.mutate(
          { id: task.id, patch: { status: "completed" } },
          { onError: (error) => pushError(error) }
        );
      });
    }
  }

  function handleArchiveFromList(task: Task) {
    updateTask.mutate(
      { id: task.id, patch: { archived: true } },
      { onError: (error) => pushError(error) }
    );
    showToast(`Archived “${task.title}”`, () => {
      updateTask.mutate(
        { id: task.id, patch: { archived: false } },
        { onError: (error) => pushError(error) }
      );
    });
  }

  function handleToggleTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  }

  function clearFilters() {
    setSearch("");
    setSelectedTagIds([]);
  }

  async function handleCreateTask(input: {
    title: string;
    dueDate: string | null;
  }) {
    const task = await createTask.mutateAsync({
      title: input.title,
      dueDate: input.dueDate
    });
    setView("active");
    setFocusQuadrant(null);
    setSearch("");
    setSelectedTagIds([]);
    setSelectedId(task.id);
  }

  async function handleCreateTag(name: string): Promise<Tag | undefined> {
    try {
      return await createTag.mutateAsync(name);
    } catch (error) {
      pushError(error);
      return undefined;
    }
  }

  function handleDeleteTag(tag: Tag) {
    setSelectedTagIds((current) => current.filter((id) => id !== tag.id));
    deleteTag.mutate(tag.id, {
      onSuccess: () => showToast(`Deleted tag “${tag.name}”`),
      onError: (error) => pushError(error)
    });
  }

  function handleUpdateSettings(patch: Partial<Settings>) {
    updateSettings.mutate(patch, {
      onError: (error) => pushError(error)
    });
  }

  const loading =
    view === "active" || view === "calendar"
      ? activeQuery.isLoading
      : view === "completed"
        ? completedQuery.isLoading
        : archivedQuery.isLoading;

  const emptyMessage = loading
    ? "Loading…"
    : tasks.length === 0
      ? view === "active"
        ? "No tasks yet"
        : "Nothing here"
      : "No matches";

  const emptyHint = loading
    ? "Fetching your local tasks."
    : tasks.length === 0
      ? view === "active"
        ? "Add your first task to start mapping priorities."
        : "Tasks will appear here when their status changes."
      : "Try another search or clear the filters.";

  return (
    <div className={`app-frame${sidebarCollapsed ? " is-collapsed" : ""}`}>
      <aside
        className={`sidebar${sidebarOpen ? " open" : ""}`}
      >
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="brand-copy">
              <h1>Eisenhower Matrix</h1>
            </div>
          </div>

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Views">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`nav-item${view === item.view ? " active" : ""}`}
              aria-current={view === item.view ? "page" : undefined}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={() => {
                changeView(item.view);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {item.count !== undefined && (
                <span className="nav-count">{counts[item.count]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="nav-item"
            title={sidebarCollapsed ? "Settings" : undefined}
            aria-label="Settings"
            onClick={() => {
              setSettingsOpen(true);
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className="nav-label">Settings</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <label className="search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
            />
          </label>

          <span className="topbar-spacer" />

          <button className="add-btn" onClick={() => setAddOpen(true)}>
            + Add task
          </button>
        </header>

        <div className="filterbar">
          {tags.length > 0 ? (
            <>
              <span className="filter-label">Tags</span>
              {tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    className={`tag-chip${active ? " active" : ""}`}
                    onClick={() => handleToggleTag(tag.id)}
                    aria-pressed={active}
                  >
                    <i style={{ background: tag.color }} />
                    {tag.name}
                  </button>
                );
              })}
            </>
          ) : (
            <span className="filter-empty">
              No tags yet — add them from a task.
            </span>
          )}
          {pendingCount > 0 && (
            <span className="pending-pill">
              Pending review {pendingCount}
            </span>
          )}
          <span className="filter-spacer" />
          {isFiltering && (
            <button className="clear-filter" onClick={clearFilters}>
              Clear filters
            </button>
          )}
          {view === "active" && (
            <Select
              className="quad-select"
              label="Focus quadrant"
              align="right"
              value={focusQuadrant === null ? "" : String(focusQuadrant)}
              onChange={(value) =>
                changeFocus(value === "" ? null : (Number(value) as KnownQuadrant))
              }
              leading={
                <span
                  className={`quad-mark${focusQuadrant ? ` q${focusQuadrant}` : ""}`}
                  aria-hidden="true"
                />
              }
              options={[
                {
                  value: "",
                  label: "All quadrants",
                  hint: String(
                    quadrantCounts[1] +
                      quadrantCounts[2] +
                      quadrantCounts[3] +
                      quadrantCounts[4]
                  ),
                  dot: "conic-gradient(var(--q2) 0 25%, var(--q1) 0 50%, var(--q4) 0 75%, var(--q3) 0)",
                  dotShape: "square"
                },
                ...([1, 2, 3, 4] as const).map((quadrant) => ({
                  value: String(quadrant),
                  label: QUADRANTS[quadrant].name,
                  hint: String(quadrantCounts[quadrant]),
                  dot: `var(--q${quadrant})`
                }))
              ]}
            />
          )}
        </div>

        <main
          className={`workspace${selectedTask ? " has-drawer" : ""}`}
        >
          {view === "active" ? (
            focusQuadrant === null ? (
              <Matrix
                tasks={filteredTasks}
                threshold={settings.threshold}
                selectedId={selectedId}
                forceIndividual={isFiltering}
                onSelect={handleSelect}
                onComplete={handleComplete}
                onNudge={handleNudge}
                onFocusQuadrant={changeFocus}
                emptyMessage={emptyMessage}
                emptyHint={emptyHint}
              />
            ) : (
              <QuadrantFocus
                quadrant={focusQuadrant}
                tasks={focusTasks}
                threshold={settings.threshold}
                selectedId={selectedId}
                isFiltering={isFiltering}
                mode={focusMode}
                onModeChange={changeFocusMode}
                onSelect={handleSelect}
                onComplete={handleComplete}
                onNudge={handleNudge}
                onExit={() => changeFocus(null)}
              />
            )
          ) : view === "calendar" ? (
            <CalendarView
              tasks={filteredTasks}
              threshold={settings.threshold}
              selectedId={selectedId}
              onSelect={handleSelect}
              onError={showError}
            />
          ) : (
            <TaskLists
              view={view}
              tasks={filteredTasks}
              onRestore={handleRestore}
              onArchive={handleArchiveFromList}
              onDelete={requestDelete}
            />
          )}

          {selectedTask && (
            <>
              <div
                className="drawer-backdrop"
                onClick={() => setSelectedId(null)}
              />
              <TaskDrawer
                key={selectedTask.id}
                task={selectedTask}
                tags={tags}
                threshold={settings.threshold}
                conflicts={conflictTitles}
                onClose={() => setSelectedId(null)}
                onPreview={(patch) => handlePreview(selectedTask.id, patch)}
                onSave={(patch) => handleSave(selectedTask.id, patch)}
                onComplete={() => handleComplete(selectedTask)}
                onArchive={() => handleArchive(selectedTask)}
                onDelete={() => requestDelete(selectedTask)}
                onCreateTag={handleCreateTag}
              />
            </>
          )}
        </main>
      </div>

      {addOpen && (
        <AddTaskModal
          onClose={() => setAddOpen(false)}
          onCreate={handleCreateTask}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          tags={tags}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={handleUpdateSettings}
          onDeleteTag={handleDeleteTag}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete task?"
          message={`“${deleteTarget.title}” will be permanently deleted. This cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && (
        <div className="toast show" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button className="toast-action" onClick={runUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
