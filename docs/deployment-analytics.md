# Plausible Analytics — 上线配置

Plausible 已完全接入代码层（`src/components/analytics/Analytics.astro` + `src/lib/analytics.ts`）。
本文件说明如何在 Cloudflare Pages 上启用，以及生产/预览环境的推荐配置。

## 前置确认（代码已支持）

- `PUBLIC_ANALYTICS_PROVIDER=plausible` → 注入 `<script defer data-domain="…" src="https://plausible.io/js/script.js">`
- `PUBLIC_PLAUSIBLE_DOMAIN` → 覆盖 `data-domain`；**默认** = `Astro.site` host（当前 `pdf-tools-7q5.pages.dev`）
- 未设置/`none` → **零脚本**（默认关闭，本地与预览不产生任何请求）
- 事件体系与兼容层见 `docs/analytics.md`

## Cloudflare Pages 配置

1. Cloudflare Dashboard → Workers & Pages → `pdf-tools-7q5` → **Settings → Environment variables**。
2. 添加（**Production** 环境）：

| 变量 | 值 | 说明 |
|---|---|---|
| `PUBLIC_ANALYTICS_PROVIDER` | `plausible` | 开启脚本注入 |
| `PUBLIC_PLAUSIBLE_DOMAIN` | `pdf-tools-7q5.pages.dev`（或自定义域名） | 必填正确，否则 Plausible 统计不到页面 |

3. **Preview 环境保持不设置**（或设为 `none`）→ 预览构建不含 analytics 脚本，避免脏数据。

> Astro 构建时读取 `PUBLIC_*` 并内联到产物：改环境变量后必须**重新构建部署**才生效（Cloudflare 每次 push 自动重建）。

## 推荐：Production enabled / Preview disabled

- **Production**：设置 `PUBLIC_ANALYTICS_PROVIDER=plausible` → 线上开始采集。
- **Preview**：不设置（默认 none）→ 预览链接零脚本、零数据污染。
- 本地方/CI：不设置，保持默认关闭。

## 验证上线是否生效

1. 部署后访问线上任意页面 → 查看 HTML `<head>` 应含 `plausible.io/js/script.js`（`defer`）。
2. 打开 Plausible Dashboard → 对应 site → 应开始出现 pageviews（IP 与来源自动匿名聚合）。
3. 检查工具页交互后，Events 面板出现 `processing_started` / `processing_completed` 等自定义事件。

## 隐私承诺（同步到站点文案）

- **无 Cookie**：Plausible 不使用 cookie，不跟踪个人身份信息。
- **无个人数据**：仅聚合统计（页面、来源、设备、地区）。
- **无 PDF 内容**：事件参数仅含 `tool / files / size_bytes / duration_ms` 等聚合值，**从不发送**文件名、文件内容或 PDF metadata（见 `docs/analytics.md` 隐私红线）。
