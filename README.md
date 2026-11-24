# Eisenhower Matrix（已停止维护 / 已由新项目取代）

> **重要提示**：当前项目 **Eisenhower Matrix** 已经停止维护，并被功能更完善的全新版本 **[Clawbot Agent](https://github.com/Yijin-Chen17/clawbot-agent)** 取代。
>
> **Notice**: This project has been superseded by **[Yijin-Chen17/clawbot-agent](https://github.com/Yijin-Chen17/clawbot-agent)**. For the original Eisenhower Matrix documentation, see [README.legacy.md](./README.legacy.md).

---

## 👉 前往新项目：[Yijin-Chen17/clawbot-agent](https://github.com/Yijin-Chen17/clawbot-agent)

**Clawbot Agent（微信智能时间规划助手）** 是基于本项目理念进一步演进的全新一代智能日程规划与时间管理系统，专为微信 Clawbot 打造（Node.js + TypeScript 全栈架构）。

### 🌟 新版本核心特性

1. **统一管理控制台（默认运行在 `5178` 端口）**
   - **用户注册与账号管理**：支持邮箱验证码注册与自动审批（`approved`），管理员可在后台进行用户审核、封禁、解封与角色管理。
   - **微信 Clawbot 对接**：提供专属 Webhook 回调地址、Token 自动生成/重置、Outbound 发送端点配置，并内置「对话模拟」标签页方便联调。
   - **LLM 大模型集成**：支持自定义 API 端点与 Key（默认预设 DeepSeek `https://api.deepseek.com/v1`，模型 `deepseek-chat`）。
   - **日历双向同步**：支持导入 Apple / Google / Outlook 的 `webcal://` 或 `https://` ICS 订阅以自动规避忙碌时间段；同时提供 HTTP(S) / Webcal 专用 TODO 日历导出订阅，实时同步至系统日历。
   - **日历全景视图与 TODO 看板**：周视图/日视图展示外部日程与规划待办，支持一键完成、延时与重新计算排程。

2. **自然语言处理与排程闭环**
   - **轻量低成本**：仅在用户发送微信消息时调用 LLM 进行结构化抽取，回复消息通过高确定性模板拼接完成，避免幻觉与高额费用。
   - **多轮槽位补齐**：未一次性提供耗时、截止时间（DDL）、紧急程度或重要度时，自动使用规范模板反问补齐。
   - **智能排程算法**：支持多段工作时间段计算，扣除外部日历事件与已有待办后，基于动态评分在空闲槽位中智能安排任务。

3. **主动提醒与用户状态汇报闭环**
   - **开始前提醒 & 结束前核对**：事件开始前自动推送微信提醒，快结束时主动询问是否完成。
   - **交互反馈**：支持直接回复「已完成」、「延长30分钟」、「重新安排」等指令，动态调整日程并校验冲突。

🔗 **点击跳转新项目仓库**：[https://github.com/Yijin-Chen17/clawbot-agent](https://github.com/Yijin-Chen17/clawbot-agent)

---

## 📄 原项目文档（Eisenhower Matrix）

**Eisenhower Matrix** 是一个本地优先（Local-first）的个人任务四象限优先级矩阵应用，采用 React + Vite 与 Hono + SQLite 构建，支持 0–100 连续评分、可调阈值、ICS 只读日历订阅与 GitHub Pages 静态部署。

🔗 **点击查看原项目完整介绍与使用说明**：[README.legacy.md](./README.legacy.md)
