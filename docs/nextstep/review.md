# NeXTSTEP implementation review

Reviewed 2026-09-07 against [the design system](design-system.md), written before implementation, and [all 36 original reference images](README.md). This is a source, CSS-cascade and automated behavior review. The historical corpus was visually inspected; the implemented site has **not** passed a rendered-browser review.

## Research-to-implementation checks and corrections

| Reference / rule | Finding | Correction and evidence |
| --- | --- | --- |
| NS01, NS07: separate palette, dock and documents | The previous full-width white brand/navigation bar dominated the desktop. | Replaced with a black-headed vertical palette at left, reserved document area and three app tiles at right. Removed the decorative desktop caption. Geometry reviewed in CSS; rendered balance remains pending. |
| NS14: black active title, gray inactive title | Windows 3.11 blue/white title states and cool-gray chrome conflicted with the new target. | Central NeXTSTEP tokens use measured `#808080`, `#c6c6c6`, black and white. Shared component skin is separate from document/layout CSS. Earlier study marked historical. |
| NS13: miniaturize left, Close right | Moving markup alone was insufficient: greyUI's default widget `order: 1` would still place miniaturize at the right. | Explicitly set miniaturize's flex order to -1, retained the centered title, moved the direct X Close to the right. Removed the non-NeXT title-bar maximize triangle. |
| NS14, NS16: opaque inactive documents | greyUI's more-specific inactive body rule could override the skin and dim content. | Added a correctly scoped body rule; frame opacity remains 1 for both states. No soft shadow pseudo-element remains. |
| NS10, NS15: hard perimeter and bottom resizing | The old thick padded frame and title-bar maximize control followed the previous system. | One-pixel black boundary, zero-blur hard offset and three functional bottom resize zones. Arrow-key resizing tests verify width/height changes, minimum size and retained reader node/scroll state. Zoom is an explicit menu adaptation. |
| Window focus contract | Closing or minimizing an inactive window previously activated it first through pointer/focus capture. | Excluded title controls from activation capture. Inactive dismissal preserves the active reader and focuses it deliberately. Regression test models pointerdown, focus and click; scroll position remains intact. |
| NS06: real miniwindow restoration | A three-item Recents list cannot restore every older minimized document. | Separate black-captioned miniwindow tiles restore retained windows, including older posts, without refetching. Verified that Recents still contains exactly three newest posts. |
| NS26, NS28: menu command surfaces | Article icons inside commands, missing submenu heading and browser-like navigation obscured menu hierarchy. | Plain text commands, right-side submenu triangle, black Recents heading, attached desktop submenu and bounded compact palette. No invented Save/Quit actions or fake keyboard equivalents. |
| NS32: stable pressed controls | greyUI's active padding could move text; hover brightness could alter the sampled palette. | Shared padding custom property keeps rest/pressed geometry stable, including widgets, dock tiles, miniwindows and compact rows. Removed hover brightness. Pressed faces are white with reversed bevels. |
| Keyboard menu contract | Opening the submenu could attempt focus before its greyUI panel mounted. A broad selector also included the parent trigger inside an ancestor navigation element. | Focus through the mounted panel ref and scope item navigation to the submenu. Test covers opening Blog by keyboard, opening Recents, Home/End, Escape, Archive selection and focus transfer. |
| NS20, NS24: content-fitting panels | Fixed compact heights would reproduce the user's empty-space About screenshot. | Kept window/frame height auto and min-height zero; only the desktop has a viewport minimum. Existing computed-style tests cover 320/390/768/960 widths. Physical layout measurement remains pending. |
| Reading contract / NS34 | Every article had a redundant “Article / Open page ↗” toolbar. | Removed it. Preserved editorial type, line length, native links, canonical routes, modifier-click and article content. Tests verify no toolbar/brand leakage, anchors and retained reading nodes. |
| Archive contract | Existing title search was substring-only despite being described as fuzzy. | Added subsequence title matching for abbreviations while preserving date order. Search regression includes “lg mdw” for “Logging Middleware.” No year groups or additional sorting modes. |
| User-requested app icons | A text-only empty desktop had no application affordances. | Added matching Haiku document, folder and Info artwork, with MIT license and upstream/Workbench attribution. Desktop and 320/390/768 compact launcher tests cover all three apps. The design system explicitly labels the artwork as a modern cross-project exception. |

## Completed verification

- `npm run build` passes: esbuild desktop bundle, real Jekyll output and both TypeScript targets. The existing Liquid warnings in two unchanged Go posts remain.
- `npm test`: **21 passed**. Includes 26-post catalog/canonical completeness; date order and abbreviated search; geometry bounds; opening, deduplication, close/minimize/restore and focus; history and anchors; failure/retry/static fallback; output exclusions; 320/390/540/768/960 compact modes and 1024px coarse-pointer mode; retained page positions; mode transitions; complete Recents titles; closed desktop launchers; compact frame sizing; all 36 NeXTSTEP image checksums/dimensions; inactive title-control behavior; older miniwindow restoration; keyboard palette navigation; keyboard resizing. The retained historical 20-image corpus is also verified.
- `git diff --check` passes.
- Reviewed CSS inheritance against installed greyUI's actual styles, specifically widget order, inactive-body selectors, focus outlines, pressed padding, gradients, bevels and shadow pseudo-elements.
- Research files remain excluded from the generated public site. Only the MIT-licensed Haiku app icons are served as product artwork.

## Remaining required browser review

The supplied browser connection repeatedly returns `CDP operation refresh tabs timed out after 20000ms`, before any page can open. It failed again during this revision. No rendered implementation screenshots, pixel comparisons, real pointer-drag results, physical touch-scroll results or 200% zoom results are claimed. JSDOM does not perform layout or paint, and simulated scroll positions do not prove scrolling works on a device.

Keep PR #60 in draft until the following actual-render loop completes. Capture each state, compare to the listed corpus references, fix findings, then repeat only affected states.

| Viewport / input | Required rendered checks | Reference |
| --- | --- | --- |
| 1440×900 and 1280×800, mouse | Three latest windows left to right; usable visible paper; palette/dock unobscured; title-widget order; move/resize bounds; independent scroll; hard edges. | NS01, NS10, NS13–15 |
| 1024×768, mouse and touch | Correct desktop/compact mode; changing modes retains documents and positions; no unreachable older minimized reader. | Adaptation contract |
| 960×720, 768×1024 and 540×720 | One active frame, content-fitting About, full archive grid, menu height bounded. | NS20, NS24 |
| 390×844 and 320×720, touch | Close every window; three icons appear; reopen each app; scroll a long post to the end; switch/back restores position; Recents titles and all archive files reachable. | NS06–07, NS34 plus compact contract |
| Landscape and 200% zoom | No horizontal page overflow, clipped title controls or menu rows; local horizontal scrolling for code/tables. | Reading contract |
| Keyboard | Focus visible on gray/white/black surfaces; pressed labels stable; no hidden focus; submenu Home/End/Escape; inactive Close retains reader; miniwindow restores. | NS14, NS26, NS32, NS36 |
| Print | Only active article, no menu/dock/chrome, full prose and wrapping code. | Reading contract |

Intentional historical departures remain documented: fixed main menu, attached-only submenu, native right-side browser scrollbars, one-tap opening, mobile layout, keyboard accessibility, Zoom convenience, flat fuzzy Archive and Haiku artwork. These are explicit product decisions; remaining visual/scroll verification is an unfinished validation gate.
