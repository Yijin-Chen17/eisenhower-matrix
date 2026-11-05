export type Locale = "zh" | "en";

export const translations = {
  zh: {
    appTitle: "艾森豪威尔矩阵",
    appSubtitle: "本地优先优先级看板",
    searchPlaceholder: "搜索任务…",
    inProgress: "进行中",
    calendar: "日历",
    completed: "已完成",
    archived: "已归档",
    allQuadrants: "所有象限",
    addTask: "+ 新建任务",
    settings: "设置",
    tags: "标签",
    noTagsYet: "暂无标签 — 从任务中添加",
    pendingReview: "待评估",
    clearFilters: "清空筛选",
    spatialView: "⊞ 全景地图",
    dualSpaceView: "⊟ 双空间",
    importance: "重要度",
    urgency: "紧迫度 →",
    // 象限
    q1Name: "立即执行 (Do now)",
    q1Hint: "今日必办 · 保持专注",
    q2Name: "排期规划 (Schedule)",
    q2Hint: "高杠杆产出 · 保障专注时间",
    q3Name: "批量处理 (Batch)",
    q3Hint: "批量集中清空 · 尽量精简",
    q4Name: "放弃归档 (Drop)",
    q4Hint: "直接放弃或归档",
    // 弹窗
    addTaskTitle: "新建任务",
    addTaskSubtitle: "清晰确定时间属性，三阶直觉极速定级",
    titleLabel: "任务名称",
    titlePlaceholder: "接下来要做什么？",
    deadlineBranch: "时间属性 (是否有截止时间)",
    hasDeadline: "📅 有具体截止时间",
    noDeadline: "♾️ 无固定截止日 (随缘/待排)",
    quickDates: {
      today: "今天",
      tomorrow: "明天",
      weekend: "周末",
      nextWeek: "下周一"
    },
    dueDateLabel: "截止日期",
    autoUrgencyNotice: "系统根据时间衰减自动推导紧迫度",
    urgencyTendencyLabel: "期望处理节奏 (无截止日)",
    urgencyPills: {
      urgent: "🔥 尽快/今日攻坚 (85分)",
      soon: "⏱️ 近日规划推进 (60分)",
      later: "☕ 远期/随缘备忘 (30分)"
    },
    importanceLevel: "重要度等级 (战略杠杆)",
    vital: "⭐ 核心战略 (Vital)",
    support: "💼 日常推进 (Support)",
    minor: "📎 琐碎杂务 (Minor)",
    routineCadence: "习惯与周期循环",
    oneOff: "单次任务",
    daily: "每日循环 🔥",
    weekdays: "每个工作日",
    weekly: "每周一次",
    cancel: "取消",
    confirmAdd: "添加任务",
    adding: "添加中…",
    // 抽屉详情
    firstActionLabel: "首要物理动作 (启动微步)",
    firstActionPlaceholder: "如：打开终端、新建空白文档、登录后台…",
    firstActionHint: "用一个毫无心理阻力的第一动作打破拖延",
    checklistLabel: "子任务清单 (Checklist)",
    addChecklistPlaceholder: "添加子步骤 (按 Enter 确认)…",
    notesLabel: "备注与说明",
    notesPlaceholder: "添加详细背景与上下文…",
    scheduleLabel: "排程与时间块",
    addScheduleBtn: "+ 添加排程时间块",
    clearScheduleBtn: "清除排程",
    startLabel: "开始",
    endLabel: "结束",
    overlapsNotice: "存在冲突排程",
    completeBtn: "✓ 完成",
    archiveBtn: "归档",
    deleteBtn: "删除",
    // 双空间
    highLeverageCanvas: "核心战略推进工作台",
    batchClearingConveyor: "杂务集中清空流",
    dropIcebox: "断舍离冷冻库",
    cleanDeskNotice: "当前没有等待处理的紧急杂务，桌面清爽！",
    noBacklogNotice: "暂无断舍离备忘任务",
    // 日历
    dueTab: "临期截止",
    unscheduledTab: "待排期高价值",
    blockTodayBtn: "+ 排入今日",
    allScheduledNotice: "所有高价值战略任务均已完成排期！",
    dragHint: "拖拽卡片至日历时间槽，或点击快速排期。",
    syncing: "同步中…",
    refreshBtn: "刷新",
    calendarsBtn: "日历源管理",
    todayBtn: "今天",
    langSwitch: "中 / EN"
  },
  en: {
    appTitle: "Eisenhower Matrix",
    appSubtitle: "Local priority board",
    searchPlaceholder: "Search tasks…",
    inProgress: "In progress",
    calendar: "Calendar",
    completed: "Completed",
    archived: "Archived",
    allQuadrants: "All quadrants",
    addTask: "+ Add task",
    settings: "Settings",
    tags: "Tags",
    noTagsYet: "No tags yet — add them from a task.",
    pendingReview: "Pending review",
    clearFilters: "Clear filters",
    spatialView: "⊞ Spatial",
    dualSpaceView: "⊟ Dual-Space",
    importance: "Importance",
    urgency: "Urgency →",
    q1Name: "Do now",
    q1Hint: "Handle today · keep it small",
    q2Name: "Schedule",
    q2Hint: "Highest leverage · protect time",
    q3Name: "Batch",
    q3Hint: "Clear in batches · delete what you can",
    q4Name: "Drop",
    q4Hint: "Delete or let go",
    addTaskTitle: "Add task",
    addTaskSubtitle: "Branch by deadline, intuitive 3-tier cognitive sizing.",
    titleLabel: "Title",
    titlePlaceholder: "What needs doing?",
    deadlineBranch: "Time Framing (Deadline)",
    hasDeadline: "📅 With Due Date",
    noDeadline: "♾️ No Deadline (Someday/Flexible)",
    quickDates: {
      today: "Today",
      tomorrow: "Tomorrow",
      weekend: "Weekend",
      nextWeek: "Next Mon"
    },
    dueDateLabel: "Due date",
    autoUrgencyNotice: "System auto-derives urgency from time decay",
    urgencyTendencyLabel: "Urgency Tendency (No Due Date)",
    urgencyPills: {
      urgent: "🔥 Today / Urgent (85)",
      soon: "⏱️ This Week / Soon (60)",
      later: "☕ Backlog / Later (30)"
    },
    importanceLevel: "Importance (Cognitive Level)",
    vital: "⭐ Vital",
    support: "💼 Support",
    minor: "📎 Minor",
    routineCadence: "Routine / Habit Cadence",
    oneOff: "One-off",
    daily: "Daily 🔥",
    weekdays: "Weekdays",
    weekly: "Weekly",
    cancel: "Cancel",
    confirmAdd: "Add task",
    adding: "Adding…",
    firstActionLabel: "First Physical Action (Micro-step)",
    firstActionPlaceholder: "e.g. Open terminal, create blank doc…",
    firstActionHint: "Break initiation friction with an effortless immediate next step.",
    checklistLabel: "Checklist / Subtasks",
    addChecklistPlaceholder: "Add subtask (press Enter)…",
    notesLabel: "Notes",
    notesPlaceholder: "Add context…",
    scheduleLabel: "Schedule",
    addScheduleBtn: "+ Add time block",
    clearScheduleBtn: "Clear schedule",
    startLabel: "Start",
    endLabel: "End",
    overlapsNotice: "Overlaps with existing schedules",
    completeBtn: "✓ Complete",
    archiveBtn: "Archive",
    deleteBtn: "Delete",
    highLeverageCanvas: "High leverage work canvas",
    batchClearingConveyor: "Batch Clearing Conveyor",
    dropIcebox: "Drop / Backlog Icebox",
    cleanDeskNotice: "No urgent chores waiting. Clean desk!",
    noBacklogNotice: "No backlog items to drop.",
    dueTab: "Due",
    unscheduledTab: "Unscheduled",
    blockTodayBtn: "+ Block Today",
    allScheduledNotice: "All high-leverage tasks are scheduled!",
    dragHint: "Drag cards into calendar time slots or click to block time.",
    syncing: "Syncing…",
    refreshBtn: "Refresh",
    calendarsBtn: "Calendars",
    todayBtn: "Today",
    langSwitch: "中 / EN"
  }
} as const;

export function getInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem("eisenhower.locale");
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // Ignore storage failure
  }
  return typeof navigator !== "undefined" && navigator.language.startsWith("zh")
    ? "zh"
    : "en";
}

export function saveLocale(locale: Locale): void {
  try {
    window.localStorage.setItem("eisenhower.locale", locale);
  } catch {
    // Ignore storage failure
  }
}
