# Desktop blog performance review

Reviewed 2026-09-08 against baseline `883b8aa1cd9ff631b935945c8c90fe8aa1ef27ea`. The desktop previously waited for a catalog request before mounting, then fetched three complete article pages even though the homepage already contained those articles. Hidden mobile readers did the same work. This pass removes that dependency chain and reduces repeated interaction work while preserving the NeXTSTEP appearance and reading behavior.

## Findings and fixes

| Concern | Verified finding | Change |
| --- | --- | --- |
| LCP / startup | JavaScript → catalog → three article requests; the homepage already includes their bodies. | Embed the small catalog using the same Jekyll include as the JSON endpoint. Escape `<` in the JSON script. Identify each server article by canonical URL, clone its existing DOM, and seed visible readers before their first commit. The endpoint remains a compatibility path for older cached HTML. |
| Startup priority | Enhanced pages preload the 25,636-byte Newsreader font, which the desktop does not use. The module is discovered at the end of HTML. | Replace that font preload with a module preload on enhanced pages. Static-only pages retain their font preload. The fallback's CSS may still request Newsreader if displayed; this is removal of forced preload priority, not a guaranteed 25 KB transfer saving. |
| Mobile work | All three initial readers fetch and prepare content although only one is visible. | Defer each hidden reader until first shown. Keep prepared content mounted afterward so switching, minimization and reading-position retention continue working. |
| Interaction work | Geometry and menu state recreate callbacks and rerender article/Archive contents. Each date label constructs locale-formatting machinery. | Memoize the content components with stable navigation callbacks and reuse one Intl.DateTimeFormat. Search remains immediate and keeps the complete date-descending fuzzy results. |
| Drag / resize work | Each pointer sample queues a whole-desktop state update. | Coalesce samples to one animation frame. Flush the last pending sample on pointer end and cancel scheduled work on unmount. Continuous pointer movement is not itself an INP measurement; reducing this work improves responsiveness and leaves more main-thread time for qualifying input. |
| CLS / images | Five original article images lack intrinsic dimensions. | Add their exact PNG width/height to the source Markdown. Both the static and enhanced documents now reserve aspect ratio. Preserve responsive scaling, originals and alt text. |
| Image discovery | Article preparation forces every image to lazy-load. | Keep the leading image eligible for eager loading, lazily load subsequent unannotated images, and use async decoding. Preserve authored loading choices. |

These changes follow Google's guidance on removing resource-discovery delays for [LCP](https://web.dev/articles/optimize-lcp), reducing input-handler and rendering work for [INP](https://web.dev/articles/optimize-inp), and reserving image space for [CLS](https://web.dev/articles/optimize-cls). They are evidence-backed optimization candidates, not evidence that the prior site failed any specific field threshold.

## Measured results

The [raw measurements](performance-measurements.json) compare independent production builds of the baseline and this change. Compression is local gzip level 9, excluding HTTP headers. The startup subtotal includes homepage HTML, desktop JS/CSS, catalog and the first three article requests where applicable. It excludes shared legacy/syntax CSS, icons, fonts and hosting overhead, so it is not a total-page transfer figure.

| Measure | Before | After |
| --- | ---: | ---: |
| Homepage enhancement fetches: catalog + article HTML | 4 | 0 |
| Initial enhanced article bodies on mobile homepage | 3 | 1 |
| Initial enhanced article bodies on mobile Archive | 3 | 0 |
| Homepage HTML + desktop JS/CSS + startup data, gzip bytes | 134,504 | 114,302 |
| Homepage HTML, gzip bytes | 20,687 | 21,970 |
| Desktop JavaScript, gzip bytes | 78,425 | 78,654 |
| Desktop CSS, gzip bytes | 13,678 | 13,678 |
| Article images without width and height | 5 | 0 |
| Date formatting: median of three 2,600-call runs | 126.42 ms | 2.74 ms |

The measured startup subset is 20,202 gzip bytes smaller (15.0%). HTML grows by 1,283 gzip bytes to remove a dependent catalog request; JavaScript grows by 229 gzip bytes. The date microbenchmark runs in Node 24.19.0 and confirms identical displayed dates. Its approximately 46× improvement is isolated CPU work, not an application-wide speedup or an INP score. Exact results vary by runtime and host.

Reproduce by building both checkouts with `npm run build`, then running `node scripts/performance-report.mjs /path/to/built/baseline` from the revised checkout. The script compares the actual date-formatting implementations and checks that their output matches.

## Validation and remaining gates

- Production build, Jekyll generation and both TypeScript targets pass. The unchanged historical posts still emit their existing Liquid warnings.
- All 30 tests pass. New checks use real generated homepage, Archive and article HTML: embedded catalog equality, zero startup fetches, no re-parsing of seeded article HTML, no seeded loading intermediate, hidden-reader deferral and reuse, pointer coalescing/final-position preservation, no content date formatting during geometry changes, all image dimensions, and leading-image loading behavior.
- Existing checks retain Close/minimize/restore, focus, browser history, anchors, retry/fallback, scrolling state, responsive modes, typography and chrome contracts. CSS and the visual design system are unchanged. Intrinsic image dimensions are verified against the original PNGs.
- Browser tab discovery again timed out after 20 seconds. No Lighthouse run, rendered timing trace, CLS measurement or real-user percentile was obtained. DOM/cascade tests do not measure layout or paint.

The initial static-blog-to-desktop transition still replaces different markup and can shift visible content. Seeding removes the separate article-loader transition, but does not establish that overall CLS is below its target. The bundle still contains roughly 78.7 KB gzip of JavaScript and 13.7 KB of desktop CSS. A trace should determine whether matching server-rendered desktop markup or reducing library CSS is the next highest-value change; neither is silently treated as solved here.

Before performance sign-off, trace cold mobile and desktop homepage loads, a direct text article, the image-heavy VS Code article, and Archive search/open/close interactions. Check the static-to-desktop transition and delayed image layout specifically. Validate [field targets](https://web.dev/articles/vitals) at the 75th percentile when deployed data is available: LCP ≤2.5 seconds, INP ≤200 ms and CLS ≤0.1. Lab load metrics and the CPU microbenchmark cannot substitute for field INP.
