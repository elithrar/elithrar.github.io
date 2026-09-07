# A desktop for Questionable Services

The blog has a deep technical archive, but its homepage asks readers to scroll through five full articles. Make recent writing immediately visible and make the archive feel browsable, without sacrificing reading, canonical URLs, or the existing Jekyll publishing workflow.

## Direction and references

- [greyUI](https://github.com/elithrar/greyUI): actual Window, Button, Input, and Layer primitives; retain its neutral panels and beveled control geometry.
- [WorkbenchOS](https://workbench.questionable.services/): independent document windows, a recoverable workspace, and compact useful chrome.
- [PostHog](https://posthog.com/): the desktop as the site itself, with recognizable document/app affordances. Avoid unrelated games, fake system diagnostics, or novelty that obstructs reading.
- Windows 3.11: full-width navy active title bars, gray inactive title bars, rectangular controls and inset document surfaces. This is a coherent consumer skin, not a modification of greyUI.

## Design system

| Role | Decision |
| --- | --- |
| Desktop | Muted teal `#557575`; a quiet field behind documents |
| Chrome | Warm gray `#d4d1c8`, white highlight, dark gray shadow, 1px outline |
| Active window | Navy `#253d65`, white title; no faded article text in inactive windows |
| Document | Existing warm paper `#fbf7ef`, dark ink `#282623` |
| Links | Existing maroon `#8b3a49`; underlined in article text |
| Typography | Arial UI, existing Newsreader italic titles, Georgia section heads, Helvetica body, monospace code |
| Reading | 17px body / 1.65, maximum 68ch measure, left aligned, local horizontal code/table scroll |
| Spacing | 4/8/12/16/24/32px rhythm; compact chrome controls, 44px window buttons on phone layouts |
| Icons | One original geometric document/folder/info icon vocabulary; decorative icons have no redundant accessible names |
| Focus | Visible 2px outline; native links and buttons; window activation on keyboard focus |

All chrome tokens and skin selectors live in `desktop/desktop.css`. Article typography retains the existing fonts and links, with explicit reading measures for window interiors. No per-post styles.

## Interaction plan

- On wide screens, open the latest three posts left to right in a staggered row, newest at the left. Open the archive below them. Recent titles and opening paragraphs are visible immediately.
- Provide Archive and About desktop launchers. Show all open/minimized windows in a bottom switcher. Bring existing windows forward instead of duplicating them.
- Use single-click/Enter document links. Preserve modifier-click, open-in-new-tab, copy-link, and canonical article URLs.
- Archive: document icons in row-major newest-first order, visible dates, year folders and title search. Scrolling stays inside the explorer. Empty search results offer a clear reset.
- Each article has its own scroll position and close/minimize/maximize controls. Drag title bars; keyboard users can read maximized or reset window positions without dragging. Resizing the browser must never strand a window offscreen.
- Narrow/touch layouts show one active window at a time, with the same document and archive controls and the open-window switcher. No tiny desktop scaled down onto a phone.
- Preserve Jekyll article HTML, permalink metadata, RSS, pagination, and a functional no-JavaScript fallback. Fetch only opened articles; reject errors with a retry and ordinary article link.
- Support browser Back/Forward, anchored headings/footnotes, local image paths, and print of the active article.

## Implementation gates

1. Integrate greyUI as a bundled React enhancement with a separate browser TypeScript target. Keep Worker security behavior unchanged. Exclude tooling and dependencies from Jekyll's public output.
2. Generate the archive catalog from Jekyll, not a hand-maintained list. Keep content in its canonical static HTML; load it on demand into article windows.
3. Review actual renders at wide desktop, laptop, tablet, 390px and 320px, plus enlarged text. Check title wrapping, viewport bounds, contrast, control consistency, independent scroll, and long code.
4. Exercise opening/reopening, minimize/restore, maximize, close/focus return, archive search/year filtering, URL history and anchors. Test fallback and build output; fix findings before opening the draft PR.

## Review record

Record observed findings, fixes, and remaining limitations here before handoff. Do not describe unavailable checks as passed.

### Review pass 1 — implementation and generated output

- Fixed a missing archive catalog: Jekyll's `desktop` exclusion also matched a source named `desktop-catalog.json`. The template now lives at `post-catalog.json` and explicitly emits `/desktop-catalog.json`.
- Fixed incorrect content reuse on cold permalinks: a static article body now carries its own `data-post-url`, and the reader only reuses it for that exact article.
- Namespaced article IDs so headings and footnotes in simultaneous documents cannot collide. Resolved relative content links against the canonical article, and retained iframe heights.
- Kept code blocks and tables in keyboard-focusable local scroll containers. Retained reader nodes and their scroll state when minimizing or maximizing.
- Added focus return on close/minimize and window activation on keyboard focus. Made the browser URL follow a window selected by pointer or keyboard.
- Centralized the skin, removed opacity from inactive documents, kept full article titles in the document, and enlarged phone window controls to 44px.
- Split the reader, explorer, icons, formatting, and geometry from desktop state management. History listeners use React's effect-event API so dragging does not continually resubscribe them.

### Review pass 2 — validation

- `npm run build`: passed, including the actual Jekyll build and both TypeScript targets. Existing Liquid warnings remain in two unchanged historical posts containing Go template syntax.
- `npm test`: 8 tests passed against the generated HTML and real post catalog. Covers all 26 published articles and canonical links; date/year/title filtering; geometry bounds from 320 to 1440px; initial ordering; window deduplication; minimize/restore; focus return; history; cold permalink content isolation; fetch failure/retry; in-article anchors; maximize/restore; feed/assets; and exclusion of source/tooling from public output.
- `git diff --check`: passed.
- Production desktop bundle: approximately 73 KB JavaScript and 13 KB CSS, gzipped. Article bodies are loaded only for opened documents, and reopening an existing window does not refetch its content.

### Open gate — rendered design and browser interaction review

**Not passed.** The available browser connection repeatedly timed out while refreshing tabs, before a page could be inspected. No screenshots, real viewport renders, physical scroll/drag checks, 200% zoom review, or visual comparison to PostHog were possible. The source review and DOM tests above do not substitute for those checks. Keep this PR in draft until the following review loop is completed:

- Inspect at 1440×900, 1280×800, 1024×768, 768×1024, 390×844, and 320×720. Confirm recent windows read left to right, opening paragraphs remain useful, and archive navigation is discoverable.
- Read the latest logging article and an older code-heavy article to the end. Scroll code horizontally, follow an anchor and its backlink, and switch between readers to confirm independent scroll positions.
- Drag and arrange windows, maximize/restore, minimize/restore from the switcher, close everything, and reopen Archive/About. Test keyboard-only opening, focus visibility, and focus return.
- Inspect phone portrait/landscape and desktop at 200% zoom for clipping, touch targets, usable text, and reachability of the horizontal open-window switcher.
- Check print of the active article and a no-JavaScript load. Fix findings and repeat the affected viewport/interaction before moving the PR out of draft.

Run `npm ci`, `bundle install`, `npm run build`, `npm test`, then `npm run dev` to review the generated site locally. The existing main-branch deployment remains unchanged; this draft does not publish the redesign.
