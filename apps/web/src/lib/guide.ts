import type { Locale } from "./i18n";

export interface GuideItem {
  title: string;
  body: string;
}

export interface GuideSection {
  id: string;
  /** Small kicker above the section title (e.g. 01 · 矩阵). */
  eyebrow: string;
  title: string;
  lead: string;
  items: GuideItem[];
}

export interface GuideContent {
  title: string;
  subtitle: string;
  back: string;
  tocLabel: string;
  versionLabel: string;
  sections: GuideSection[];
}

export const GUIDE_CONTENT: Record<Locale, GuideContent> = {
  zh: {
    title: "功能介绍",
    subtitle:
      "从「这件事到底该不该现在做」开始，把注意力留给真正重要的四分之一。以下是当前版本的全部能力。",
    back: "返回矩阵",
    tocLabel: "目录",
    versionLabel: "版本",
    sections: [
      {
        id: "matrix",
        eyebrow: "01 · 矩阵",
        title: "四象限优先级画布",
        lead: "每个任务都由重要度与紧迫度两个 0–100 的分数定位，分数决定它落在哪个象限、以什么形态出现。",
        items: [
          {
            title: "两个分数，四个象限",
            body: "重要度决定纵向位置，紧迫度决定横向位置。右上做、左上排、右下批、左下放，颜色与面积随象限自动变化。"
          },
          {
            title: "阈值可调",
            body: "设置里的阈值（默认 50）决定十字线的位置，也决定「重要 / 紧迫」的分界；恰好等于阈值的任务进入待评估。"
          },
          {
            title: "直接拖拽改分",
            body: "长按卡片约 0.2 秒或按住 Option 拖动，松手即写入新的重要度与紧迫度，靠近阈值时会自动吸附，避免踩在分界线上。"
          },
          {
            title: "卡片形态随分值变化",
            body: "高分任务铺开成完整卡片，低分任务收成胶囊或聚合成一个簇，点击簇可展开查看全部条目。"
          }
        ]
      },
      {
        id: "views",
        eyebrow: "02 · 视图",
        title: "双空间与全景地图",
        lead: "同一份数据，两种阅读方式：一个强调「今天做什么」，一个强调「整体分布」。",
        items: [
          {
            title: "双空间视图",
            body: "上半屏只留重要的 Q1 / Q2 任务作为工作台，下半屏把 Q3 批处理与 Q4 冷冻区分成两条流，减少无关干扰。"
          },
          {
            title: "全景地图",
            body: "完整四象限同屏显示，适合快速扫一眼全局分布，或把任务拖到另一象限重新定性。"
          },
          {
            title: "象限聚焦",
            body: "点击任一角标进入该象限的独立视图，可在列表与地图之间切换，专注处理这一格里的任务。"
          }
        ]
      },
      {
        id: "tasks",
        eyebrow: "03 · 任务",
        title: "任务详情与推进",
        lead: "点开任务后，右侧抽屉覆盖在画布之上，矩阵尺寸不变，你的空间记忆不会被打断。",
        items: [
          {
            title: "分值微调",
            body: "抽屉内可直接拖动滑块或输入数字；选中卡片后也可以用方向键微调，Shift 加速，改完即时保存。"
          },
          {
            title: "首要物理动作",
            body: "给任务写下一个「毫无心理阻力的第一动作」，把启动成本降到最低，是打破拖延最有效的一栏。"
          },
          {
            title: "子任务清单",
            body: "把大任务拆成 2 分钟以内的小步，勾选进度会显示在任务标题旁。"
          },
          {
            title: "习惯与周期",
            body: "单次 / 每日 / 工作日 / 每周四种节奏，周期任务在完成时自动推进到下一周期并累计连续次数。"
          }
        ]
      },
      {
        id: "calendar",
        eyebrow: "04 · 日历",
        title: "把优先级落到时间上",
        lead: "象限负责排序，日历负责兑现。高价值任务可以直接拖进时间轴变成时间块。",
        items: [
          {
            title: "拖拽排期",
            body: "从待排期列表把任务拖到日历的空档即可创建时间块，也可以点击「排入今日」一键安排。"
          },
          {
            title: "冲突提醒",
            body: "与已有日程或任务时间块重叠时，抽屉里会直接列出冲突对象，避免一天被排成两遍。"
          },
          {
            title: "日历源",
            body: "支持订阅 .ics 链接或上传本地日历文件，把外部日程与自己的任务放在同一个时间轴上对照。"
          }
        ]
      },
      {
        id: "data",
        eyebrow: "05 · 数据",
        title: "本地优先，不联网也在",
        lead: "默认把数据存在本机，断网、离线、换浏览器都不会丢；静态部署时则写入浏览器本地存储。",
        items: [
          {
            title: "本机数据库",
            body: "桌面运行时任务写入本机 SQLite 数据库，退出应用不会清空，也不会自动过期删除。"
          },
          {
            title: "浏览器本地存储",
            body: "静态站点模式下数据保存在当前浏览器，换设备需要自行导出备份，清除站点数据会一并清空。"
          },
          {
            title: "主题跟随",
            body: "浅色、深色或跟随系统；选择跟随系统时会实时响应系统的外观切换。"
          }
        ]
      },
      {
        id: "keys",
        eyebrow: "06 · 快捷键",
        title: "不离开键盘的操作",
        lead: "高频动作用键盘完成，鼠标只负责拖拽和浏览。",
        items: [
          { title: "N", body: "新建任务。" },
          { title: "/", body: "聚焦搜索框，输入即筛选标题与备注。" },
          { title: "方向键", body: "选中卡片后微调重要度（↑↓）与紧迫度（←→）。" },
          { title: "Esc", body: "关闭抽屉、弹窗或退出象限聚焦。" }
        ]
      }
    ]
  },
  en: {
    title: "Feature guide",
    subtitle:
      "Start from “should this happen now?” and spend your attention on the quarter that actually matters. Everything this version can do is below.",
    back: "Back to matrix",
    tocLabel: "Contents",
    versionLabel: "Version",
    sections: [
      {
        id: "matrix",
        eyebrow: "01 · Matrix",
        title: "The four-quadrant canvas",
        lead: "Every task is placed by two 0–100 scores: importance vertically, urgency horizontally. The scores decide where it lands and how it renders.",
        items: [
          {
            title: "Two scores, four quadrants",
            body: "Do now, schedule, batch, drop. Colour and footprint follow the quadrant, so the canvas reads at a glance."
          },
          {
            title: "Tunable threshold",
            body: "The threshold in settings (default 50) moves the crosshair and defines the important/urgent split. Tasks exactly on it are flagged for review."
          },
          {
            title: "Drag to rescore",
            body: "Hold a card for ~0.2s or Option-drag to reposition it, then drop to save both scores. Values snap away from the threshold to avoid sitting on the line."
          },
          {
            title: "Cards scale with weight",
            body: "High-scoring tasks open into full cards, low-scoring ones collapse into pills or clusters; click a cluster to expand it."
          }
        ]
      },
      {
        id: "views",
        eyebrow: "02 · Layouts",
        title: "Dual-space and full map",
        lead: "One dataset, two ways to read it: what to do today, or how the whole board is shaped.",
        items: [
          {
            title: "Dual-space view",
            body: "The upper half keeps only important Q1/Q2 work as your bench, while the lower tray splits Q3 batching from the Q4 icebox."
          },
          {
            title: "Full map",
            body: "All four quadrants at once — good for scanning the distribution or dragging something across the line."
          },
          {
            title: "Quadrant focus",
            body: "Click any corner label to open that quadrant on its own, with a list or map layout to choose from."
          }
        ]
      },
      {
        id: "tasks",
        eyebrow: "03 · Tasks",
        title: "Details and execution",
        lead: "Opening a task slides a drawer over the canvas instead of shrinking it, so your spatial memory stays intact.",
        items: [
          {
            title: "Fine-tune scores",
            body: "Drag the sliders or type a number in the drawer. With a card focused, arrow keys nudge it — hold Shift for bigger steps. Changes save instantly."
          },
          {
            title: "First physical action",
            body: "Write the smallest possible opening move. It is the cheapest way to break the initiation friction."
          },
          {
            title: "Checklist",
            body: "Split work into steps you can finish in a couple of minutes; progress shows next to the task title."
          },
          {
            title: "Routines",
            body: "One-off, daily, weekdays or weekly — recurring tasks roll forward on completion and keep a streak."
          }
        ]
      },
      {
        id: "calendar",
        eyebrow: "04 · Calendar",
        title: "Turn priority into time",
        lead: "The matrix decides order, the calendar makes it real. Drag high-value work straight onto a time slot.",
        items: [
          {
            title: "Drag to schedule",
            body: "Drop a task from the unscheduled list into any free slot, or block it into today with one click."
          },
          {
            title: "Conflict hints",
            body: "When a block overlaps an event or another task, the drawer lists exactly what it collides with."
          },
          {
            title: "Calendar sources",
            body: "Subscribe to an .ics feed or upload a local calendar file to read external events on the same timeline."
          }
        ]
      },
      {
        id: "data",
        eyebrow: "05 · Data",
        title: "Local first — works offline",
        lead: "Your data stays on this machine by default; the static build keeps it in browser storage.",
        items: [
          {
            title: "Local database",
            body: "The desktop runtime writes tasks to a local SQLite file. Quitting never clears it and nothing expires."
          },
          {
            title: "Browser storage",
            body: "In static mode everything lives in this browser. Clearing site data clears the board, so export a backup when switching devices."
          },
          {
            title: "Themes",
            body: "Light, dark, or follow the system — the system option reacts live to appearance changes."
          }
        ]
      },
      {
        id: "keys",
        eyebrow: "06 · Shortcuts",
        title: "Never leave the keyboard",
        lead: "The frequent moves are on keys; the mouse is for dragging and browsing.",
        items: [
          { title: "N", body: "Create a task." },
          { title: "/", body: "Focus search — filters titles and notes as you type." },
          { title: "Arrows", body: "Nudge importance (↑↓) and urgency (←→) on a focused card." },
          { title: "Esc", body: "Close the drawer, a dialog, or leave quadrant focus." }
        ]
      }
    ]
  }
};
