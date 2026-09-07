# NeXTSTEP blog design system

Status: revised against the user-supplied color screenshots before the corrective implementation, 2026-09-07. The first specification over-relied on grayscale manual figures. This document supersedes `docs/windows311-study.md` for the desktop skin. The [40-image corpus](README.md) is the source of truth: [NS37–NS40](color-references/README.md) govern appearance; NS01–NS36 govern component anatomy and behavior. The blog is a reading workspace built from greyUI, not an operating-system emulator.

## Evidence and interpretation

Target the color desktop in the supplied screenshots: a muted-purple workspace, medium-gray applications, black titles and detailed, shaded icons. Retain NeXT’s 1995 guidelines as primary evidence for behavior, not as the sole source of color or composition. The corpus contains 36 original-manual illustrations plus four user-supplied color desktop screenshots. Six earlier contact sheets do not add to the count.

Rules below cite corpus IDs. Colors are measurements of flat regions shared across the supplied color screenshots, not claims about every original display. Geometry is a modern CSS translation because the manual mixes illustration scales. Hard-edge shadows are an interpretation of the visible perimeter, not a claim that every NeXT application used an identical shadow algorithm. Do not import modern macOS gloss, Windows blue title bars, rounded web cards, or Window Maker-specific behavior into this specification.

## Palette and materials

| Token | Value | Role and evidence |
| --- | --- | --- |
| `--ns-workspace` | `#555577` | Purple desktop behind windows (NS37–NS40). |
| `--ns-face` | `#aaaaaa` | Gray menus, inactive titles, dock and panels (NS37–NS39). |
| `--ns-paper` | `#ffffff` | Document surface, input fill, selected/pressed menu row and bevel highlight (NS14, NS32, NS33). |
| `--ns-ink` | `#000000` | Active title, text, perimeter and bevel dark edge (NS10, NS14). |
| `--ns-muted` | `#333333` | Readable secondary text on #AAAAAA (5.44:1); darker than the first revision to retain contrast on the corrected panel. |
| `--ns-edge` | `#555555` | Recessed edges and dark bevel shading (NS38–NS39). |

NS38 contains 441,180 pixels of `#555577`, 232,509 of `#AAAAAA` and 15,651 of `#555555`. The same purple and panel gray dominate NS37 and NS39. The previous `#808080` / `#C6C6C6` measurements describe the manual GIFs, but are **not** the product palette. White paper, black text and a readable secondary `#333333` complete the system. Article images and syntax colors remain content exceptions.

Use distinct material recipes: shallow menu rows have a one-pixel white upper/left seam and dark lower/right seam; raised action buttons add a black boundary; white input fields and the gray Archive well are recessed; dock tiles have a stronger two-stage bevel; title widgets use their own small inset square and SVG glyph. Pressed commands turn white without moving labels. A menu header stays black in every interaction state. Generic button states must resolve component-specific material tokens, never overwrite them.

Floating edges are hard, one-pixel boundaries, with at most a one-pixel black offset. No blur, rounded cards, translucent panels or chrome gradients. Rich icon shading is an exception to flat chrome. System palette tokens live on `:root` so the body behind changing mobile browser bars shares the desktop color.


## Typography and scale

System labels: Helvetica, Arial, sans-serif; 13px desktop commands and 14px compact commands, title bars bold. NeXT's compact labels are the reference, but do not use tiny bitmap text on modern phones. Desktop title height is 22px, widget hit area 20px, and menu rows are 24px. The desktop palette is 132px wide with an equally wide heading. Touch rows and Close are at least 44px. Dock tiles are 64px squares with 40px shaded artwork and a 12px caption inside the lower edge. Window perimeter stays thin even when controls enlarge.

Document content is a different material: white page, existing editorial headings, 17px text and 1.65 line height, maximum 74ch, responsive margins. NS34 supports the distinction between system typography and readable serif documents. Links are underlined black; article code can retain syntax colors. Never dim an inactive article’s body or reduce text to fit a window.

## Windows, focus and layers

NS02, NS10, NS13–16 and the [window chapter](https://www.nextop.de/NeXTstep_3.3_Developer_Documentation/UserInterface/04_Window/Window.htmld/index.html) establish the anatomy: miniaturize at left, centered title, X Close at right, narrow frame, white document, divided bottom resize bar. A black title marks the active document; an inactive gray title has black lettering. The full NeXT key/main distinction appears in NS16; this single-app blog has one active document and nonmodal navigation, not a simulated multiprocess key-window model.

Clicking a body or title raises and activates that window. Clicking a title-bar control must not first activate an unrelated window. Close removes that window immediately, including on mobile. Closing an inactive window preserves the active reader. Closing the active window selects the most recently active remaining window; if none remain, show the desktop launchers and put keyboard focus on Archive. Miniaturize retains content and reading position and creates a titled miniwindow tile; restoring it activates the retained window.

Desktop windows can move by title and resize using three bottom zones: left adjusts left edge and height; middle adjusts height; right adjusts width and height. Bounds and minimum readable size apply. Keyboard users can focus resize zones and use arrow keys. A menu Zoom command toggles available reading space; this is an explicit reading convenience, not an extra historical title-bar widget. Double-click title may perform the same convenience. Compact mode omits move/resize/miniaturize widgets because its page is the reading viewport.

Layer order: workspace, document windows by activation order, persistent app dock and main menu, attached submenus. Minimized document tiles sit above documents at the bottom of the work area. Navigation cannot be buried by a maximized document. Do not give inactive bodies reduced opacity. Avoid click-through where closing one window also opens the window behind it.

## Menu system

NS05, NS25–30 and the [menu chapter](https://www.nextop.de/NeXTstep_3.3_Developer_Documentation/UserInterface/06_Menu/Menu.htmld/index.html) show a vertical floating palette with black header, joined gray command rows, thin seams, white chosen parents and right-side submenu triangles. A main menu is not a browser navigation bar. The blog palette is titled “Blog”; the full identity belongs in About. It contains Recents, Archive, About, Zoom, Arrange and RSS. Only functional commands appear. No pretend Save, Quit, Preferences or filesystem paths.

Recents opens one attached submenu with a black heading and exactly the three latest post titles. It is chronological and independent of open-window history. The desktop submenu opens right; the dock version opens left to stay in view. Avoid deeper nesting. There are no fake keyboard equivalents or decorative document icons in command rows. Arrow-key navigation, Home/End, Escape and ordinary Tab work; Escape returns focus to the disclosure trigger. Opening an item closes the palette disclosure and focuses its document. Pointer selection and keyboard focus both receive clear feedback.

The historical main menu could move and submenus could detach. This blog fixes the palette to a reserved desktop area and keeps its only submenu attached; therefore it shows neither a drag cursor nor a tear-off Close control. On mobile a 132px-wide “Blog” disclosure opens commands of the same width under its black header. Recents replaces that command page with a second, 288px-wide palette containing full titles and an actual Back control; returning restores focus to Recents. Do not stack a full-width submenu inside a full-width command list. This is an explicit space-saving adaptation. Touch activates on one tap; no hover-only content. No menu claims ARIA menu semantics without implementing the associated keyboard model; semantic navigation and native buttons remain valid.

## Dock, miniwindows and Archive

NS06–07 and NS22 establish separate application tiles and minimized documents. Recents, Archive and About are always discoverable in a three-tile right-edge dock on desktop. On a closed mobile workspace, the same three launchers form a row. During mobile reading, keep the title/menu/Close strip visible rather than placing a dock over the text. Miniwindows have their own black caption and document thumbnail; they do not become extra entries in Recents.

The earlier Haiku exception is superseded by the requested fidelity correction. Use one original 48-unit SVG family inspired by NS38–NS40: printed pages for Recents, a leather archive case for Archive, and a small CRT information terminal for About. Reuse document artwork in Archive and miniwindows. These are original interpretations, not authentic NeXT assets or extracted screenshot crops. Record provenance in `public/icons/nextstep/README.md`. Do not mix in the old Haiku or flat Windows-style icons.

Archive is a single scrollable set of all published posts, descending by date, newest at top left. No year buckets, fake drives or artificial folders. Fuzzy search remains the primary filter. NS38 and NS19 inform gray chrome and a recessed gray file field; the flat grid and fuzzy title matching are deliberate user-requested adaptations. File names wrap; dates use one muted style; focus does not alter item geometry. The search field has a persistent label and a distinct inset border. No browser-blue outlines, but never suppress keyboard visibility.

## Reading and compact mode

At <=960px or a coarse pointer, display one active window with natural document height, page scrolling and preserved per-window positions. A short About panel wraps its content and reveals desktop below; do not set viewport min-height on the window or body. Closed windows are removed, not immediately replaced by an Archive placeholder. The desktop itself fills the screen. Compact navigation and document controls share one persistent 44px row: Blog at left, Article/Archive/About in the remaining title region, Close at right. Reserve the menu width to avoid collisions. The window title sticks 8px from the viewport top while the page scrolls, with a purple top gutter. Do not reserve a second navigation row. The full post title remains on the paper.

Retain native selection, browser zoom, history, canonical links, hash navigation, copy and modifier-click. These are useful browser capabilities, not decorative UI leaks. Remove redundant “Open page ↗” toolbars, horizontal site navigation and empty-desktop call-to-action cards. Keep real RSS and author/source links in appropriate command/About surfaces. Scrollbars remain native, with a restrained gray skin where supported: the historic left-side custom scroller is intentionally not emulated, because native touch/keyboard scrolling is more reliable. Code and tables can scroll horizontally within the paper; the page itself must not overflow horizontally.

## Focus and state contract

| State | Required rendering and behavior |
| --- | --- |
| Rest | Gray raised face, black text, square edges. |
| Pointer pressed | White face, inset bevel, no label jump. |
| Expanded command parent | White face, black text, arrow retained. |
| Expanded menu header | Black face, white text and white focus cue; never white-on-white. |
| Keyboard focus | Visible dotted inset outline; white outline on black title/header. No global outline removal. |
| Disabled | Muted label on same gray geometry; native disabled semantics, no activation. |
| Active document | Black title, white label; opaque readable content. |
| Inactive document | Gray title, black label; identical readable content. |
| No documents | Three app tiles; no dead end or replacement message. |

NS32, NS33 and NS36 distinguish pressed state, entry state and actual default actions. Do not add a Return symbol without a real default-action contract. Do not intercept operating-system shortcuts. Navigation focus should not silently change the active document; moving focus into a document body does activate it. Closing the focused document transfers focus deliberately.

## Implementation and review gates

Retain real greyUI `Window`, `Button`, `Input`, `Collapsible` and `Layer` components. Shared NeXT tokens, bevel recipes and component chrome belong in `nextstep-theme.css`; layout, responsive rules and article typography belong in `desktop.css`. React owns window order, geometry, minimized state, history and reading positions. Do not replace greyUI with static lookalike markup.

Review composition against NS37–NS40, then against NS14 (active/inactive and hard borders), NS26 (menu alignment), NS32 (pressed state), NS20/24 (content-fitting About), NS34 (reading), and NS06 (restoration). Verify 320/390/768 compact widths and a wide desktop, keyboard navigation, focus after inactive/active Close, minimization recovery, resize limits, search, long title wrapping, native scroll state, local table/code overflow and no horizontal page overflow. Record which checks actually ran. DOM tests cannot certify visual layout or touch scrolling; any unavailable browser review remains an explicit limitation. Corrections and remaining limits belong in `review.md` before the PR update.
