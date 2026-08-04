# Analytics — 事件与接入文档

> Privacy-first 定位：无 Cookie、无个人信息、仅聚合参数。默认**完全关闭**（零脚本、零 CWV 影响），通过环境变量开启。

## 1. 如何开启

| 环境变量 | 取值 | 说明 |
|---|---|---|
| `PUBLIC_ANALYTICS_PROVIDER` | `none`（默认）\| `plausible` \| `umami` \| `ga4` | 未设置 = `none`，构建产物**不含任何 analytics 脚本** |
| `PUBLIC_PLAUSIBLE_DOMAIN` | 站点域名（默认 `Astro.site` host） | Plausible `data-domain` |
| `PUBLIC_UMAMI_SRC` / `PUBLIC_UMAMI_WEBSITE_ID` | — | Umami（预留） |
| `PUBLIC_GA4_MEASUREMENT_ID` | — | GA4（预留，不推荐） |

- 脚本注入：`src/components/analytics/Analytics.astro`（Plausible 为 `defer` + 外部脚本，不阻塞渲染）。
- Cloudflare Pages 中在 **Settings → Environment variables** 配置（构建时内联）。
- 本地：`PUBLIC_ANALYTICS_PROVIDER=plausible pnpm dev`（构建期读取）。

## 2. 事件体系（`EVENTS` 常量，`src/lib/analytics.ts`）

### Landing
| 事件 | 触发 | 参数 |
|---|---|---|
| `view_home` | 预留（首页 pageview 已由 provider 自动统计） | `locale` |
| `click_tool_card` | 点击工具卡（`[data-analytics="tool_card"]`） | `locale`, `tool`(toolType) |
| `click_category` | 点击分类标签 | `locale`, `category`(toolType) |

### Tool（工具页交互，PdfDropZone）
| 事件 | 触发 | 参数 |
|---|---|---|
| `upload_started` | 拖拽/选择文件 | `locale`, `tool`, `files` |
| `file_selected` | 文件列表确认 | `locale`, `tool`, `files`, `size_bytes` |
| `processing_started` | 点击处理 | `locale`, `tool`, `files` |
| `processing_completed` | 处理成功 | `locale`, `tool`, `files`, `results`, `duration_ms` |
| `processing_failed` | 处理异常 | `locale`, `tool`, `duration_ms` |
| `download_clicked` | 点击下载（主按钮/列表） | `locale`, `tool` |
| `process_again_clicked` | 点击 "Process another file" | `locale`, `tool` |
| `unsupported_file` | 预留（非 PDF/不可读） | `locale`, `tool` |

### Feedback
| 事件 | 触发 | 参数 |
|---|---|---|
| `feedback_positive` | 点赞 | `locale`, `tool` |
| `feedback_negative` | 点踩 | `locale`, `tool` |

**隐私红线**：事件参数**禁止**包含文件名、文件内容、PDF metadata。仅聚合计数/体积/耗时。

### 页面级
- `trackPageView({ locale, pathname, pageType })`：BaseLayout 在浏览器端调用（SSR 安全，`typeof window` 守卫）。`pageType ∈ home | tool | blog | legal | other`，由 URL 推断。
- 静态站页面浏览由 Plausible 脚本自动统计；`trackPageView` 用于补充上下文参数。

## 3. 兼容层（勿新增调用）

| 旧事件 | 新事件 |
|---|---|
| `tool_started` | `processing_started` |
| `tool_completed` | `processing_completed` |
| `tool_failed` | `processing_failed` |
| `feedback` + `vote` | `feedback_positive` / `feedback_negative` |

`trackToolEvent()` 保留为兼容入口（自动映射），仅用于历史代码，**不再新增调用**。

## 4. 转化漏斗（事件组合）

```
首页 ──click_tool_card──► 工具页 ──upload_started/file_selected──► 上传
   ──processing_started──► 处理 ──processing_completed──► 成功
   ──download_clicked──► 下载
```

可分析指标：每工具卡 CTR、上传发起率、处理成功率、`duration_ms` 中位数、下载/成功比、失败率、反馈正负比。

## 5. 未来接入新 Provider

1. `analytics.ts`：实现 `AnalyticsProvider`（`track` + `pageView`），加入 `resolveProviderName()` switch 与 `createXxxProvider()`。
2. `Analytics.astro`：按 provider 注入脚本（`defer`/`async`，不阻塞渲染）。
3. Cloudflare：配置对应环境变量。
4. 事件名/参数无需改动（provider 无关）。
