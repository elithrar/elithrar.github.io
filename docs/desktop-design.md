# A desktop for Questionable Services

The homepage presents recent writing as independent documents and the complete archive as a browsable file collection. Jekyll remains the content source; canonical article URLs, metadata, RSS, and the static fallback remain available.

## Current direction: NeXTSTEP over greyUI

The [NeXTSTEP design system](nextstep/design-system.md), written before the skin implementation, is now the visual specification. Its [36-image primary-source corpus](nextstep/README.md) includes original NeXTSTEP 3.3 workspace captures, application windows, menus and control-state illustrations, with exact provenance and checksums. The earlier Windows 3.11 study is historical context.

WorkbenchOS supplies the independent-window model; actual greyUI Window, Button, Input, Collapsible and Layer primitives supply the component foundation. `desktop/nextstep-theme.css` owns shared tokens and component chrome; `desktop/desktop.css` owns geometry, compact layout and reader typography. The [current review record](nextstep/review.md) maps findings back to corpus IDs and distinguishes verified behavior from the blocked browser review.

- Desktop: three newest posts open left to right, Archive below, a floating vertical palette at left and Recents/Archive/About dock tiles at right. Windows move, resize, zoom, minimize and close independently. Separate miniwindow tiles restore minimized older posts.
- Compact (<=960px or coarse pointer): one active content-fitting window in native page flow, a small sticky Blog disclosure, and three app launchers when all windows are closed. Close always removes the window. About reveals the gray desktop below its content.
- Recents always contains exactly the three newest published posts. Archive contains every post in one descending-date icon grid. Subsequence title search accepts abbreviations without reordering chronology. No year folders.
- Canonical URLs, RSS, browser history, modifier-click, local table/code scrolling, anchors, static fallback and retained reading positions remain available. The redundant document-level web toolbar is removed.
- Haiku document/folder/info artwork follows the user's WorkbenchOS icon request, inside NeXT-style tiles. Its MIT license and attribution are committed; it is explicitly documented as a cross-project asset exception.

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

### Mobile feedback revision

Reviewed the three supplied phone screenshots (`IMG_0605.png` through `IMG_0607.png`) and WorkbenchOS's current source before changing the blog:

- [App.tsx](https://github.com/elithrar/workbenchOS/blob/main/apps/workbench/src/App.tsx) selects a dedicated mobile presentation. [MobileStack.tsx](https://github.com/elithrar/workbenchOS/blob/main/apps/workbench/src/desktop/MobileStack.tsx) renders ordinary panels and invokes Close directly; [desktop-store.ts](https://github.com/elithrar/workbenchOS/blob/main/apps/workbench/src/store/desktop-store.ts) removes the window and selects a remaining one.
- [styles.css](https://github.com/elithrar/workbenchOS/blob/main/apps/workbench/src/styles.css) packs the mobile stack with `grid-auto-rows: max-content` and `align-content: start`. It also reserves minimum height for tool applets. Adopt the separation of desktop surface and panel bounds, but omit those applet minimums for blog prose and About.
- The About screenshot exposes the blog frame's own `min-height: calc(100svh - 94px)`. Remove it; retain the viewport minimum on the background only. Long readers still use page scrolling, while short About/search results end at their content.
- Replace the left system-actions popup with a direct, labeled Close button in both modes. Remove closed windows from stacking state and clear their page position after focus transfer so reopening starts at the top.
- Replace the open-window list with exactly the three newest published posts under Recents. Open/close actions and older archive posts do not change this list.
- The screenshots also show Arrange on mobile: the generic compact button rule outweighed its CSS hiding rule. Render Arrange only in desktop mode.

The Workbench comparison is a source inspection, not a live rendered comparison; browser tab discovery still times out.

### Current validation and remaining gate

See [NeXTSTEP review](nextstep/review.md) for current build/test evidence, fixes and the outstanding real-browser viewport matrix. Earlier counts and visual direction above describe previous revisions only.

Run `npm ci`, `bundle install`, `npm run build`, `npm test`, and `npm run dev` to review the generated site locally. The PR remains a draft; nothing has been merged or deployed.
