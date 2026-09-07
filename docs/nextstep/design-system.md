# NeXTSTEP blog design system

Status: specification written before the NeXTSTEP implementation, 2026-09-07. This document supersedes `docs/windows311-study.md` for the desktop skin. The [36-image corpus](README.md) is the visual source of truth. The blog is a reading workspace built from greyUI, not an operating-system emulator.

## Evidence and interpretation

Target the consistent monochrome vocabulary of NeXTSTEP 3.3 as illustrated in NeXT’s 1995 guidelines. The corpus is deliberately primary-source: original screenshots and diagrams, with source URLs, checksums and observation-to-design mappings. Some figures include annotations or multiple states; count each original GIF once. Six contact sheets are review aids, not extra source images.

Rules below cite corpus IDs. Colors are measurements of downloaded GIF pixels, not claims about every original display. Geometry is a modern CSS translation because the manual mixes illustration scales. Hard-edge shadows are an interpretation of the visible perimeter, not a claim that every NeXT application used an identical shadow algorithm. Do not import modern macOS gloss, Windows blue title bars, rounded web cards, or Window Maker-specific behavior into this specification.

## Palette and materials

| Token | Value | Role and evidence |
| --- | --- | --- |
| `--ns-workspace` | `#808080` | Flat desktop behind windows (NS01, NS07, NS11). |
| `--ns-face` | `#c6c6c6` | Menus, controls, inactive titles, dock and panels (NS03, NS10, NS26). |
| `--ns-paper` | `#ffffff` | Document surface, input fill, selected/pressed menu row and bevel highlight (NS14, NS32, NS33). |
| `--ns-ink` | `#000000` | Active title, text, perimeter and bevel dark edge (NS10, NS14). |
| `--ns-muted` | `#505050` | Modern readable secondary text on gray; deliberate contrast adaptation, not a sampled historic color. |
| `--ns-edge` | `#808080` | Recessed upper/left edges and secondary bevel shading (NS03, NS33). |

Representative counts: NS01 contains 34,317 pixels of `#808080` and 23,700 of `#c6c6c6`; NS10 contains 61,775 pixels of `#c6c6c6`; NS03 contains 64,525 pixels of `#c6c6c6`. Near-white `#fffffe` is the manual illustration background and is excluded from product tokens. No blue, teal, maroon, gradients, translucent panels or backdrop blur in system chrome. Article illustrations and syntax highlighting retain their content colors.

A raised control has a white top/left inner edge and dark bottom/right edge. A pressed control reverses those edges and uses white fill. An input is white with dark top/left and light bottom/right edges. These recipes live once in `desktop/nextstep-theme.css`. Use a one-pixel black outer boundary; floating windows and menus may have a one-pixel hard black offset, zero blur, zero spread. Never use a shadow to imply more layers than the actual stacking order.

## Typography and scale

System labels: Helvetica, Arial, sans-serif; 14px regular, title bars bold. NeXT's compact labels are the reference, but do not use tiny bitmap text on modern phones. Desktop title height is 26px, widget hit area 24px, menu row at least 32px. Touch rows and Close are at least 44px. The 64px tile face sits inside a slightly taller labeled tile. Window perimeter stays thin even when controls enlarge.

Document content is a different material: white page, existing editorial headings, 17px text and 1.65 line height, maximum 74ch, responsive margins. NS34 supports the distinction between system typography and readable serif documents. Links are underlined black; article code can retain syntax colors. Never dim an inactive article’s body or reduce text to fit a window.

## Windows, focus and layers

NS02, NS10, NS13–16 and the [window chapter](https://www.nextop.de/NeXTstep_3.3_Developer_Documentation/UserInterface/04_Window/Window.htmld/index.html) establish the anatomy: miniaturize at left, centered title, X Close at right, narrow frame, white document, divided bottom resize bar. A black title marks the active document; an inactive gray title has black lettering. The full NeXT key/main distinction appears in NS16; this single-app blog has one active document and nonmodal navigation, not a simulated multiprocess key-window model.

Clicking a body or title raises and activates that window. Clicking a title-bar control must not first activate an unrelated window. Close removes that window immediately, including on mobile. Closing an inactive window preserves the active reader. Closing the active window selects the most recently active remaining window; if none remain, show the desktop launchers and put keyboard focus on Archive. Miniaturize retains content and reading position and creates a titled miniwindow tile; restoring it activates the retained window.

Desktop windows can move by title and resize using three bottom zones: left adjusts left edge and height; middle adjusts height; right adjusts width and height. Bounds and minimum readable size apply. Keyboard users can focus resize zones and use arrow keys. A menu Zoom command toggles available reading space; this is an explicit reading convenience, not an extra historical title-bar widget. Double-click title may perform the same convenience. Compact mode omits move/resize/miniaturize widgets because its page is the reading viewport.

Layer order: workspace, document windows by activation order, persistent app dock and main menu, attached submenus. Minimized document tiles sit above documents at the bottom of the work area. Navigation cannot be buried by a maximized document. Do not give inactive bodies reduced opacity. Avoid click-through where closing one window also opens the window behind it.

## Menu system

NS05, NS25–30 and the [menu chapter](https://www.nextop.de/NeXTstep_3.3_Developer_Documentation/UserInterface/06_Menu/Menu.htmld/index.html) show a vertical floating palette with black header, joined gray command rows, thin seams, white chosen parents and right-side submenu triangles. A main menu is not a browser navigation bar. The blog palette is titled “Blog”; the full identity belongs in About. It contains Recents, Archive, About, Zoom, Arrange and RSS. Only functional commands appear. No pretend Save, Quit, Preferences or filesystem paths.

Recents opens one attached submenu with a black heading and exactly the three latest post titles. It is chronological and independent of open-window history. The desktop submenu opens right; the dock version opens left to stay in view. Avoid deeper nesting. There are no fake keyboard equivalents or decorative document icons in command rows. Arrow-key navigation, Home/End, Escape and ordinary Tab work; Escape returns focus to the disclosure trigger. Opening an item closes the palette disclosure and focuses its document. Pointer selection and keyboard focus both receive clear feedback.

The historical main menu could move and submenus could detach. This blog fixes the palette to a reserved desktop area and keeps its only submenu attached; therefore it shows neither a drag cursor nor a tear-off Close control. On mobile a “Blog” disclosure opens the vertical command stack beneath its black header. This is an explicit space-saving adaptation. Touch activates on one tap; no hover-only content. No menu claims ARIA menu semantics without implementing the associated keyboard model; semantic navigation and native buttons remain valid.

## Dock, miniwindows and Archive

NS06–07 and NS22 establish separate application tiles and minimized documents. Recents, Archive and About are always discoverable in a three-tile right-edge dock on desktop. On a closed mobile workspace, the same three launchers form a row. Miniwindows have their own black caption and document thumbnail; they do not become extra entries in Recents.

The user specifically requested WorkbenchOS/Haiku icons. Keep the matching MIT-licensed Haiku document, folder and information artwork in NeXT-style square bevels. This is an intentional cross-project asset exception, **not historic NeXT artwork**; full attribution is in `public/icons/haiku/ATTRIBUTION.md`. Do not recolor source images ad hoc. Icons are decorative within accessible labeled buttons; labels and hit areas remain consistent.

Archive is a single scrollable set of all published posts, descending by date, newest at top left. No year buckets, fake drives or artificial folders. Fuzzy search remains the primary filter. NS19 informs the gray surrounding chrome and inset content; the flat grid and fuzzy title matching are deliberate user-requested adaptations. File names wrap; dates use one muted style; focus does not alter item geometry. The search field has a persistent label and a distinct inset border. No browser-blue outlines, but never suppress keyboard visibility.

## Reading and compact mode

At <=960px or a coarse pointer, display one active window with natural document height, page scrolling and preserved per-window positions. A short About panel wraps its content and reveals desktop below; do not set viewport min-height on the window or body. Closed windows are removed, not immediately replaced by an Archive placeholder. The desktop itself fills the screen. Sticky compact navigation remains small; the article title is in the document and the frame may simply say “Article.”

Retain native selection, browser zoom, history, canonical links, hash navigation, copy and modifier-click. These are useful browser capabilities, not decorative UI leaks. Remove redundant “Open page ↗” toolbars, horizontal site navigation and empty-desktop call-to-action cards. Keep real RSS and author/source links in appropriate command/About surfaces. Scrollbars remain native, with a restrained gray skin where supported: the historic left-side custom scroller is intentionally not emulated, because native touch/keyboard scrolling is more reliable. Code and tables can scroll horizontally within the paper; the page itself must not overflow horizontally.

## Focus and state contract

| State | Required rendering and behavior |
| --- | --- |
| Rest | Gray raised face, black text, square edges. |
| Pointer pressed | White face, inset bevel, no label jump. |
| Expanded parent | White face, black text, arrow retained. |
| Keyboard focus | Visible dotted inset outline; white outline on black title/header. No global outline removal. |
| Disabled | Muted label on same gray geometry; native disabled semantics, no activation. |
| Active document | Black title, white label; opaque readable content. |
| Inactive document | Gray title, black label; identical readable content. |
| No documents | Three app tiles; no dead end or replacement message. |

NS32, NS33 and NS36 distinguish pressed state, entry state and actual default actions. Do not add a Return symbol without a real default-action contract. Do not intercept operating-system shortcuts. Navigation focus should not silently change the active document; moving focus into a document body does activate it. Closing the focused document transfers focus deliberately.

## Implementation and review gates

Retain real greyUI `Window`, `Button`, `Input`, `Collapsible` and `Layer` components. Shared NeXT tokens, bevel recipes and component chrome belong in `nextstep-theme.css`; layout, responsive rules and article typography belong in `desktop.css`. React owns window order, geometry, minimized state, history and reading positions. Do not replace greyUI with static lookalike markup.

Review against NS14 (active/inactive and hard borders), NS26 (menu alignment), NS32 (pressed state), NS20/24 (content-fitting About), NS34 (reading), and NS06 (restoration). Verify 320/390/768 compact widths and a wide desktop, keyboard navigation, focus after inactive/active Close, minimization recovery, resize limits, search, long title wrapping, native scroll state, local table/code overflow and no horizontal page overflow. Record which checks actually ran. DOM tests cannot certify visual layout or touch scrolling; any unavailable browser review remains an explicit limitation. Corrections and remaining limits belong in `review.md` before the PR update.
