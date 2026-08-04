# Google Search Console Setup

把站点接入 Google Search Console（GSC），获得 impressions / CTR / 关键词数据，为 Phase 3 增长决策提供依据。

## Verification

### 推荐：DNS TXT 验证（域名级，一次覆盖所有子域与语言路径）

1. GSC → 添加资源 → **域名**（Domain）→ 输入你的域名（如 `pdf-tools-7q5.pages.dev` 或自定义域名）。
2. 复制验证 TXT 值：`google-site-verification=YOUR_TOKEN`。
3. Cloudflare Dashboard → 对应域 → **DNS → Add record**：
   - Type: `TXT`
   - Name: `@`
   - Content: `google-site-verification=YOUR_TOKEN`
   - TTL: Auto
4. 保存后回 GSC 点「验证」。DNS 传播通常几分钟内完成。

> 域名级验证的另一个好处：今后新增任意子路径/子域都自动验证，无需重复操作。

### 备用：HTML 文件验证（无 DNS 权限时）

1. GSC → 添加资源 → **网址前缀**（URL prefix）→ `https://pdf-tools-7q5.pages.dev/`。
2. GSC 提供 HTML 验证文件（`googleXXXX.html`）与下载。
3. 将文件放到 `public/` 目录（替换/改名占位文件），重新构建部署后访问 `https://<域>/googleXXXX.html` 确认 200。
4. 回 GSC 点「验证」。

> 仓库中已有占位文件 `public/google-site-verification.html`（内容 `google-site-verification: REPLACE_ME`），实际验证时请用 GSC 下发的 token 文件；该占位文件不进入 sitemap，不影响 robots/canonical。

## Sitemap submission

1. GSC 左侧 → **站点地图**（Sitemaps）。
2. 提交：`sitemap.xml`（index 会自动展开 9 个子 sitemap：tools/blog/pages × 3 语言）。
3. 状态显示「成功」后，等待抓取与 Coverage 数据（24h–数日）。

## First checks

验证后检查以下页面状态（URL 检查 → 输入 URL → 看「网址在 Google 上」/收录状态）：

- 首页：`/de/` · `/en/` · `/zh-CN/`
- 8 个工具页（各语言）：
  - merge → `/de/pdf-zusammenfuegen`
  - split → `/de/pdf-aufteilen`
  - rotate → `/de/pdf-drehen`
  - pdf-to-jpg → `/de/pdf-in-jpg`
  - compress → `/de/pdf-komprimieren`
  - protect → `/de/pdf-schuetzen`
  - unlock → `/de/pdf-entsperren`
  - watermark → `/de/pdf-wasserzeichen`

每页确认：
- **canonical**：`<link rel="canonical">` 指向当前语言绝对 URL
- **hreflang**：de / en / zh-CN / x-default 四个 alternate 齐全
- **structured data**：SoftwareApplication + FAQPage + HowTo + BreadcrumbList 无错误（GSC「增强功能」报告）

## Indexing workflow（新页面发布后）

1. GSC → **URL 检查**（URL Inspection）→ 粘贴新页面 URL。
2. 若未收录 → 点 **请求编入索引**（Request indexing）。
3. 等待 Coverage 报告更新（通常 1–14 天）；关注「页面编入索引」状态。

> 批量发布时（如 Programmatic SEO 变体页），提交 sitemap 后 Google 会自行抓取，无需逐页请求。

## 关联 Analytics

- 若使用 GA4：GSC 设置 → 关联 → Google Analytics。
- 若使用 **Plausible**（本项目推荐）：无需关联，二者独立；用 Plausible 看行为事件、GSC 看搜索表现，交叉分析。
