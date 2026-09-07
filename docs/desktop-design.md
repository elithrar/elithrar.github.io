# A desktop for Questionable Services

The homepage presents recent writing as independent documents and the complete archive as a browsable file collection. Jekyll remains the content source; canonical article URLs, metadata, RSS, and the static fallback remain available.

## Revised direction

The initial draft divided a small archive into unnecessary year folders and kept too much fixed desktop geometry on mobile. This revision removes the folders and treats compact reading as a separate layout. Its visual system follows [20 individually inspected Windows for Workgroups 3.11 screenshots](windows311-study.md), collected and analyzed before the skin was applied.

WorkbenchOS supplies the independent-window interaction model; PostHog supplies the idea of a website as a playful desktop. The installed greyUI package supplies Window, Button, Input, Collapsible, and Layer primitives. The blog owns the Windows 3.11 skin in `desktop/desktop.css`.

## Design system

| Role | Decision |
| --- | --- |
| Desktop / controls | Cool gray `#c0c7c8` |
| Documents / inactive titles | White `#fff` |
| Active titles / selected labels | Blue `#0000a8`, white text |
| Edges | Black 1px outline, white highlight, `#87888f` bevel; square corners |
| Title bars | Centered bold label, left system-menu dash, desktop down/up triangles |
| Typography | Arial UI; existing serif article headings; 17px body / 1.65; maximum 74ch reader |
| Links | Existing maroon `#8b3a49`, underlined article links |
| Icons | Shared original document/folder/info vocabulary; labels below icons |
| Controls | Visible keyboard focus; at least 44px compact touch controls |
| Spacing | 4/8/12/16/24/32px rhythm; reader padding adapts to available width |

The reference study explains which decisions are historically observed and which deliberately adapt the design for web reading. The archive and reader share the same chrome and tokens; individual posts do not introduce styles.

## Interaction and responsive plan

- **Desktop pointer, above 960px:** three recent posts open left to right, newest at the left, with Archive below. Readers scroll independently. Drag, maximize, minimize, restore, arrange, and close remain available.
- **960px and below, or coarse pointer:** one active document in normal page flow. The page owns vertical scrolling. A compact sticky header exposes Archive, Windows, About, and RSS. Desktop positioning and min/max controls are removed from this mode.
- **Archive:** one continuous row-major collection of all 26 posts, newest-first. Search filters titles; dates remain metadata. Icons and full titles wrap into as many columns as the available width supports. No year folders or sidebar.
- **Window switching:** the Windows disclosure lists complete titles vertically, including minimized windows. Opening an existing document selects it. Compact reader page positions are restored when switching or using browser history.
- **Controls:** shared greyUI Collapsible disclosures provide the Windows list and left system actions, with expanded state, ordinary keyboard tab order, Escape/focus return, and outside-pointer dismissal. These are navigation disclosures, not ARIA menus requiring arrow-key behavior.
- **Reading:** code and tables scroll horizontally within the article. Heading anchors target the correct reader. Modifier-click and canonical links retain native browser behavior. The article content dominates; the compact title bar says “Article” and the full title appears in the reading surface.
- **Recovery:** closing everything leaves an Open Archive action. Fetch errors offer retry and a canonical page link. Enhancement failure leaves the original static blog usable.

## Review record

### Initial implementation review

Fixed catalog generation, cold-permalink content isolation, duplicate article IDs, relative links, iframe sizing, local code/table scrolling, retained reader nodes, focus return, and public-output exclusions. Tests exercise the real generated Jekyll pages and catalog.

### Screenshot and responsive revision

1. Collected 20 original 640×480 PNGs, inspected each, recorded per-image observations and source URLs, measured palette frequencies, and wrote the design study before applying the revised skin.
2. Replaced warm panels, teal desktop, Windows 95-style controls, and the bottom taskbar with the studied palette, centered title bars, system control, triangles, and Windows navigation.
3. Removed year metadata and folders. All 26 documents appear in one chronological icon grid.
4. Replaced the fixed compact workspace and nested reader scrolling with ordinary document flow. Hidden retained windows use the DOM `hidden` attribute. Desktop coordinates survive mode changes; page positions are retained per compact reader.
5. Found a potential narrow-screen overflow in the Windows list: anchoring a wide popup to its small trigger could extend beyond the left viewport edge. The compact list now anchors to both sides of the header, wraps full titles, and allows vertical scrolling when needed.
6. Replaced floating-positioned menu primitives after their geometry-dependent behavior stalled the DOM harness. Shared inline greyUI Collapsible disclosures avoid that positioning dependency and explicitly support dismissal and focus return.

### Validation

- `npm run build`: passed, including Jekyll and both TypeScript targets. Pre-existing Liquid warnings remain in two unchanged historical Go posts.
- `npm test`: **12 passed**. Covers all published posts and canonical output, chronological filtering, desktop order and bounds, deduplication, minimize/restore, focus return, history, cold permalinks, fetch failure/retry, anchors, maximize/restore, feed/assets, output exclusions, compact mode at 320/390/540/768/960px and a 1024px touch tablet, all-post archive availability, scroll restoration, mode changes, complete window titles, Escape, close-all recovery, and the 20 screenshot hashes/dimensions.
- These responsive tests simulate media-query transitions and DOM state. They do not measure browser layout or certify physical scrolling.
- `git diff --check`: passed.

### Open gate: actual rendered review

**Still blocked.** The supplied browser connection repeatedly times out while refreshing tabs, before a page can open. There are no claimed passing viewport screenshots, physical touch-scroll tests, or zoom results. Keep this PR in draft until this loop is completed:

| Viewport / input | Required observation |
| --- | --- |
| 1440×900 and 1280×800, mouse | Recent windows left to right; useful visible content; independent scrolling; drag and arrange controls reachable |
| 1024×768, mouse and touch | Correct mode per input; mode transitions preserve open documents |
| 960×720, 768×1024, 540×720 | One active document; native page scrolling; adaptive icon columns; no clipped controls |
| 390×844 and 320×720, touch | Read long posts to the end; switch and restore position; full-title window list fits; all archive icons reachable |
| Landscape and 200% zoom | No page-width overflow; header and controls fit; article remains readable |
| Keyboard and print | Open/switch/close, Escape and focus; anchor/backlink; active article prints cleanly |

For each viewport, open an older code-heavy post, horizontally scroll code, follow a heading anchor, return through browser history, close everything, and reopen Archive. Capture the render, record findings, fix them, and repeat the affected check.

Run `npm ci`, `bundle install`, `npm run build`, `npm test`, and `npm run dev` to review the generated site locally. This draft does not publish the redesign.
