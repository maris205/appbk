# App 决策服务 MVP1

## 0. 品牌信息

- 产品名称：`appbk`
- 官方网站：`https://appbk.com`
- Logo：`https://kkamazon.oss-cn-hongkong.aliyuncs.com/appbk_logo.png`
- 产品描述：大模型时代的 App 决策服务。

网站页面、SEO 元数据、API 文档以及后续 Codex、WorkBuddy 和 MCP 接入统一使用 `appbk` 品牌名称。开发时应将 Logo 保存为项目内的静态资源，避免生产页面长期直接依赖外部 OSS 地址；上述地址作为品牌源文件地址保留。

## 1. 产品定义

### 1.1 一句话定位

连接公开 App Store 数据，通过大模型把 App 信息、榜单、评论和关键词排名转化为可解释、可追问的产品与增长决策。

### 1.2 MVP1 目标

MVP1 验证以下闭环：

1. 用户搜索一个 iOS App 或关键词。
2. 系统从第三方 API 获取并保存结构化数据。
3. 用户查看 App、榜单、评论和关键词搜索排名。
4. 系统基于真实数据生成简洁的 AI 分析。
5. 所有能力通过统一内部 API 暴露，为后续 Codex、WorkBuddy 和 MCP 接入做准备。

### 1.3 MVP1 不做

- 不做 App Store 客户端逆向或大规模爬虫。
- 不建立全量 App 数据库，只保存用户查询和追踪的数据。
- 不估算竞品下载量、收入或广告花费。
- 不提供未经验证的关键词搜索指数。
- 不接入 App Store Connect 和 Apple Ads。
- 不执行广告、元数据或商店后台修改。
- 不做 Android、多组织权限、复杂账单和完整历史数据导入。

## 2. 用户与核心场景

### 2.1 目标用户

- 独立开发者和小型 App 团队。
- 产品负责人和增长投放人员。
- 需要快速研究竞品、评论和市场机会的创业者。

### 2.2 核心问题

- 某个 App 当前表现如何？
- 某个榜单有哪些新进入、快速上涨或下降的 App？
- 用户最近集中抱怨什么？
- 某个关键词下有哪些竞品，竞争是否激烈？
- 今天最值得关注和处理的事情是什么？

## 3. 数据范围

### 3.1 平台和地区

- 平台：仅 Apple App Store / iPhone。
- 首批国家或地区：中国（CN）、美国（US）、日本（JP）。
- 语言：界面使用简体中文；保留原始 App 和评论语言。

### 3.2 第一阶段数据源

RapidAPI：`app-store-google-play-data-api.p.rapidapi.com`

计划使用的上游能力：

- iOS App 搜索。
- iOS App 详情。
- iOS App 评论。
- iOS 分类。
- iOS Top 榜单。

RapidAPI 返回值必须先经过 Provider 适配层转换，页面和业务逻辑不得直接依赖供应商字段。

### 3.3 数据原则

- 保存标准化数据，同时保留必要的原始响应用于调试。
- 页面标明数据国家、来源和最后更新时间。
- 榜单与关键词排名从首次查询开始自行积累快照。
- AI 只能分析已经获取的数据；缺少数据时明确说明，不推测为事实。
- 外部 API 失败时优先展示缓存数据及其更新时间。

## 4. 页面与功能

### 4.1 首页 `/`

主要内容：

- App 或关键词统一搜索框。
- 今日决策卡片。
- 已追踪 App 的明显变化。
- 榜单新进入、快速上涨和快速下降摘要。
- 最近评论中的新增问题摘要。

未登录用户可搜索和查看有限结果。MVP1 可先实现单机默认工作区，不要求完整账户体系。

### 4.2 App 搜索 `/apps/search`

- 输入 App 名称或 App ID。
- 选择国家或地区。
- 展示图标、名称、开发者、分类、评分、价格和更新时间。
- 支持进入 App 详情和加入追踪。

### 4.3 App 详情 `/apps/[appId]`

顶部展示：

- 图标、名称、开发者和 App ID。
- 当前版本、发布日期、价格和分类。
- 评分、评分数量和 App Store 链接。
- 数据国家和最后更新时间。

内容标签：

1. 概览：描述、截图和版本信息。
2. 榜单：当前排名及已有历史曲线。
3. 评论：评论列表、筛选和 AI 摘要。
4. 关键词：已追踪关键词下的当前排名及历史。

AI 决策区：

- 输出 1 至 3 条结论。
- 每条结论包含数据依据、时间范围和置信度。
- 支持“为什么”“查看数据”和“生成建议”等追问入口。

### 4.4 榜单 `/rankings`

筛选项：

- 国家或地区。
- 分类。
- 榜单类型：免费、付费、畅销；具体值以上游 API 实测为准。
- 日期；MVP1 只展示系统已保存的日期。

表格字段：

- 当前排名和排名变化。
- App 图标、名称和开发者。
- 分类、评分和评分数量。
- 新上榜标记。

### 4.5 关键词 `/keywords/[keyword]`

- 选择国家并查询关键词。
- 展示 App Store 搜索结果及当前名次。
- 展示评分、评分数量、更新时间等竞争信息。
- 支持收藏并每日追踪该关键词。
- 根据前排 App 的评分规模、集中度和变化生成竞争分析。

MVP1 的“关键词排名”指真实搜索结果中的自然排名，不等同于搜索量或广告热度。

### 4.6 评论 `/apps/[appId]/reviews`

- 按星级、国家和时间筛选。
- 展示评论标题、正文、评分、版本和时间。
- AI 将近期评论聚类为问题、需求和正面反馈。
- AI 结论可以追溯到对应评论，不生成虚构引用。

### 4.7 Agent 分析 `/agent`

MVP1 采用有限任务模板，不做无边界通用聊天：

- 分析一个 App。
- 比较两个 App。
- 总结近期评论。
- 分析一个关键词。
- 总结榜单变化。
- 生成今日决策。

## 5. 决策卡片设计

统一结构：

```text
标题：发生了什么
结论：为什么值得关注
证据：使用了哪些数据和时间范围
建议：下一步可以采取什么动作
置信度：高 / 中 / 低
状态：待处理 / 已查看 / 已忽略
```

MVP1 只给建议，不执行外部操作。

## 6. 技术概要设计

### 6.1 技术栈

- 前后端：Next.js + TypeScript。
- UI：Tailwind CSS。
- ORM：Drizzle ORM。
- 本地数据库：SQLite（开发环境使用本地 D1/SQLite 文件）。
- 数据验证：Zod。
- 图表：轻量图表库，选型时避免过重依赖。
- 定时任务：本机脚本或受保护的任务接口；部署后再替换为托管 Cron。
- AI：通过独立 `AIProvider` 接口接入模型，MVP1 不绑定单一模型供应商。

### 6.2 目录建议

```text
appbk/
  app/                  # Next.js 页面和 Route Handlers
  components/           # UI 组件
  lib/
    db/                 # Drizzle 客户端和查询
    providers/          # RapidAPI、AI Provider 适配层
    decisions/          # 规则、证据和决策生成
    schemas/             # Zod 输入输出模型
  db/
    schema.ts
  drizzle/              # 数据库迁移
  data/
    appbk.db             # 本地 SQLite，不提交 Git
  scripts/               # 数据测试和定时同步
  .env.local             # 本地密钥，不提交 Git
  .env.example
```

### 6.3 数据调用流程

```text
页面 / Agent
    ↓
内部 API
    ↓
业务服务与缓存判断
    ↓
统一 Provider 接口
    ↓
RapidAPI
    ↓
标准化并写入 SQLite
    ↓
返回结构化数据与更新时间
```

## 7. 数据库概要设计

SQLite 文件：`data/appbk.db`

数据库文件和 SQLite 临时文件必须加入 `.gitignore`。业务代码仅通过 Drizzle 数据访问层访问数据库，避免在业务层散落 SQLite 特有 SQL，以便后续迁移至 PostgreSQL 或 MySQL。

### 7.1 主要实体

#### `App`

- 内部 ID。
- Apple App ID。
- 默认名称、开发者和图标。
- 创建时间、更新时间。
- Apple App ID 唯一索引。

#### `AppSnapshot`

- App、国家和抓取时间。
- 名称、描述、版本、价格、分类。
- 评分和评分数量。
- 原始响应 JSON 字符串。
- App、国家和抓取时间索引。

#### `RankingSnapshot`

- App、国家、分类、榜单类型和排名。
- 抓取时间。
- 国家、分类、榜单类型和抓取时间索引。

#### `Review`

- 上游评论 ID。
- App、国家、星级、标题、正文、作者、版本和发布时间。
- App、国家和发布时间索引。
- 上游评论 ID 与国家组成唯一约束。

#### `Keyword`

- 标准化关键词。
- 国家和语言。
- 关键词与国家唯一约束。

#### `KeywordRankingSnapshot`

- 关键词、App、自然排名和抓取时间。
- 关键词与抓取时间索引。

#### `TrackedApp` / `TrackedKeyword`

- 被追踪对象。
- 是否启用。
- 同步频率和最近同步时间。

#### `Insight`

- 类型、标题、结论、建议。
- 证据 JSON、置信度和状态。
- 关联 App 或关键词。
- 使用的数据起止时间和生成时间。

#### `ProviderRequestLog`

- Provider、接口、参数摘要。
- 状态码、耗时、是否命中缓存。
- 错误摘要和调用时间。
- 不保存 RapidAPI Key 或其他密钥。

### 7.2 迁移策略

生产环境优先考虑 PostgreSQL，也允许选择 MySQL。迁移时：

1. 将 Drizzle 数据库驱动切换到生产数据库类型并配置 `DATABASE_URL`。
2. 为生产数据库生成并执行新的迁移。
3. 通过一次性导入脚本复制 SQLite 中需要保留的数据。
4. 运行数据数量、唯一键和抽样内容校验。

## 8. 内部 API

### 8.1 只读数据接口

```text
GET /api/v1/apps/search
GET /api/v1/apps/{appId}
GET /api/v1/apps/{appId}/rankings
GET /api/v1/apps/{appId}/reviews
GET /api/v1/rankings
GET /api/v1/keywords/search
GET /api/v1/keywords/{keyword}/rankings
```

### 8.2 分析接口

```text
POST /api/v1/analysis/app
POST /api/v1/analysis/reviews
POST /api/v1/analysis/keyword
POST /api/v1/analysis/compare
GET  /api/v1/decisions/daily
```

所有响应使用统一外壳：

```json
{
  "data": {},
  "meta": {
    "country": "us",
    "source": "rapidapi",
    "fetchedAt": "2026-08-09T00:00:00Z",
    "cached": false
  },
  "error": null
}
```

## 9. MCP 与 Agent 预留

MVP1 不要求正式发布 MCP，但内部 API 应能自然映射为以下工具：

```text
search_apps
get_app_overview
get_app_rankings
get_app_reviews
research_keyword
compare_apps
get_daily_decisions
```

后续网站负责注册、授权、账单和审计；Codex、WorkBuddy 等 Agent 通过 OAuth 和 MCP/API 使用相同能力。

## 10. 缓存与同步

建议初始策略：

- App 搜索：缓存 6 小时。
- App 详情：缓存 12 小时。
- 榜单：缓存并保存每日快照；开发期允许手动刷新。
- 评论：缓存 6 小时，只增量保存新评论。
- 关键词结果：缓存 12 小时；已追踪关键词每日保存一次。
- AI Insight：数据未变化时复用，避免重复消耗模型调用。

RapidAPI 超时或限流时返回最近缓存，并在页面标记为非实时数据。

## 11. 配置与安全

本地环境变量：

```dotenv
RAPIDAPI_KEY=
RAPIDAPI_HOST=app-store-google-play-data-api.p.rapidapi.com
AI_API_KEY=
```

- `.env.local`、数据库文件和日志不得提交 Git。
- RapidAPI Key 只能在服务端读取，不得发送给浏览器。
- 接口日志不得记录密钥或完整认证头。
- 当前测试 Key 在公开位置出现过，仅用于本地测试；正式环境必须轮换。
- 对刷新、分析和同步接口增加频率限制。

## 12. 开发阶段

### 阶段 A：数据验证

- 验证 App 搜索、详情、评论、分类和榜单接口。
- 确认 CN、US、JP 的参数行为。
- 确认榜单 collection、category 和分页合法值。
- 固化供应商响应样本和标准化字段。

### 阶段 B：数据与页面闭环

- 初始化 Next.js、Drizzle 和 SQLite。
- 实现 Provider 适配、缓存及日志。
- 完成搜索、App 详情、榜单、评论和关键词页面。
- 保存榜单与关键词排名快照。

### 阶段 C：AI 决策体验

- 评论聚类与摘要。
- App 和关键词分析。
- 今日决策卡片。
- 给每条结论附加证据、时间和置信度。

### 阶段 D：Agent 准备

- 固化 OpenAPI 文档。
- 将内部 API 映射为 MCP 工具定义。
- 准备后续账户、OAuth 和操作审计设计。

## 13. MVP1 验收标准

- 可以在 CN、US、JP 搜索并打开有效 iOS App。
- App 详情、评分、评论和更新时间可以正确展示。
- 至少一种真实榜单可以抓取、保存并展示排名变化。
- 可以查询关键词搜索结果并保存自然排名快照。
- 同一数据重复请求能命中本地缓存。
- 上游失败时能展示最近缓存和明确状态。
- AI 能基于评论或排名数据生成带证据的结论。
- RapidAPI Key 不出现在浏览器请求、日志和 Git 文件中。
- SQLite 数据库可通过 Drizzle 创建、迁移和读取。
- 内部 API 的输入输出足以支持后续 MCP 工具。

## 14. MVP1 完成后的下一步

- 接入账户、工作区和付费。
- 接入 App Store Connect 与 Apple Ads 授权。
- 发布 Codex、WorkBuddy 可使用的 MCP/API。
- 增加定时巡检、通知和用户确认后的外部执行能力。
- 根据真实使用情况决定是否采购更完整的关键词数据源。
