# Windows 3.11 reference study

Historical exploration, superseded by the [NeXTSTEP design system](nextstep/design-system.md). Retained as the record of the earlier requested direction; do not use it to skin current components.

The first draft mixed a warm editorial palette with Windows 95-style window controls and a fixed mobile desktop. This revision starts from 20 inspected screenshots of Windows for Workgroups 3.11, then distinguishes historical appearance from deliberate adaptations for reading on the web.

## Collection and method

The 20 original 640×480 PNGs are in [references/windows311](references/windows311/), with source URLs and SHA-256 hashes in [screenshots.json](references/windows311/screenshots.json). They come from ZXnet's first-hand [Windows for Workgroups 3.11 walkthrough](https://www.zx.net.nz/netware/client/wfwnet/doswin32-wfw311.shtml). Every image was opened and visually inspected. This is a utility-heavy sample of one installation, not evidence of every possible Windows color scheme. GUIdebook's 3.11 gallery was also located, but its images could not be downloaded, so it is not counted in the collection.

## Screenshot observations

| # | Screenshot | Observed design evidence |
| --- | --- | --- |
| 01 | [Program Manager / Network group](references/windows311/01-c32-32-01.png) | White icon field; centered labels; blue selection behind label only; left control box and right triangles. |
| 02 | [Network Setup](references/windows311/02-c32-32-02.png) | Thin outlined groups, white dialog body, aligned gray action buttons. |
| 03 | [Networks, disabled options](references/windows311/03-c32-32-03.png) | White inactive title bar; blue belongs to active title/selection; controls keep their geometry when disabled. |
| 04 | [Networks, selected option](references/windows311/04-c32-32-04.png) | Selection is a solid blue rectangle; no pill, rounded card, or soft shadow. |
| 05 | [Information dialog](references/windows311/05-c32-32-05.png) | Centered bold title, compact white content, discrete OK button; underlying windows remain readable. |
| 06 | [Drivers, selected row](references/windows311/06-c32-32-07.png) | Inset white list, tiny icons, horizontal scrolling inside the list. |
| 07 | [Drivers, empty list](references/windows311/07-c32-32-08.png) | Empty content does not gain decorative empty-state artwork; frame and action alignment remain stable. |
| 08 | [Add Network Adapter](references/windows311/08-c32-32-09.png) | Long names occupy a scrollable list; selected text is white on blue. |
| 09 | [Driver hierarchy](references/windows311/09-c32-32-10.png) | Indentation communicates actual parent/child relationships rather than arbitrary date buckets. |
| 10 | [Adapter properties](references/windows311/10-c32-32-11.png) | Labels and values share alignment; outlined grouping and restrained spacing. |
| 11 | [Configured driver list](references/windows311/11-c32-32-12.png) | Dense useful content, stable controls, selection at the item level. |
| 12 | [Network names](references/windows311/12-c32-32-15.png) | Black-edged white fields; compact grid of labels, fields, and buttons. |
| 13 | [Replace files](references/windows311/13-c32-32-16.png) | Equal action sizes; dotted keyboard focus; no large promotional headings. |
| 14 | [Missing file](references/windows311/14-c32-32-17.png) | Body text wraps within the dialog; broad input uses the available width. |
| 15 | [Install Driver](references/windows311/15-c32-32-18.png) | Shared control geometry remains consistent even in a narrower dialog. |
| 16 | [Setup confirmation](references/windows311/16-c32-32-20.png) | A small informational window; large unused desktop remains an ordinary neutral field. |
| 17 | [Notepad / STARTNET.BAT](references/windows311/17-c32-32-21.png) | Reading surface dominates; thin title/menu bands; local scrollbars at the document boundary. |
| 18 | [Notepad / NET.CFG](references/windows311/18-c32-32-24.png) | Monospace is for file content, not a mandatory font for all interface text. |
| 19 | [Maximized Notepad](references/windows311/19-c32-32-26.png) | Maximizing removes surrounding desktop and spends almost all space on the document. |
| 20 | [Network login](references/windows311/20-wfwnetlogin.png) | A compact centered application over a flat gray field; bevels belong to controls, not content cards. |

## Derived system and implementation decisions

| Role | Screenshot evidence | Blog decision |
| --- | --- | --- |
| Palette | Pixel analysis across the collection: white, `#c0c7c8`, `#0000a8`, black, then shadow gray `#87888f` | Use these five shared tokens for the skin. Preserve maroon article links as an intentional blog identity exception. |
| Title bars | Centered bold text; left system box; down/up triangles; white inactive titles | Keep the left control-box shape; make it Close directly per mobile feedback (an intentional interaction adaptation). Put minimize/maximize at the right on desktop. No Windows 95 close-X row. |
| Edges | Thin dark rules, white highlights, compact bevels | Replace warm panel colors, gradients, transparency, and diffuse shadows with a consistent two-tone edge. |
| Documents | White fields dominate Notepad and Program Manager | Use white article and archive panes. Keep the existing serif article headings, 17px body, and a readable line measure. |
| Archive | Row-major icon fields with labels below icons | Render all posts in one continuous newest-first icon grid. Dates are metadata, not folders. No year filter or sidebar. |
| Window switching | Program Manager organizes windows without a Windows 95 taskbar | Use Recents for the three newest published posts, with full titles; use Archive for older posts. Retain independent document windows in desktop mode. |
| Mobile | Historical screenshots provide no phone interaction model; maximized Notepad does provide a useful spatial principle | Use ordinary page scrolling, one active document, a compact header and a vertical Recents list. Remove absolute window coordinates, fixed reader heights, nested vertical scrolling, and the horizontal taskbar. |
| Input | Historic controls are mouse-sized | Use 44px touch targets in compact mode and visible keyboard focus. Preserve native links and modifier-click. |

## Responsive acceptance criteria

- At 320, 390, 540, 768, and 960px, and on coarse-pointer tablets, render one active window in normal document flow. Read the article by scrolling the page; scroll only code/tables horizontally.
- The archive has all 26 icons without year segmentation. Its grid adapts to available width; long titles wrap and remain visible.
- Recents shows complete titles for the three newest published posts in a vertical list; Archive opens or restores any other document. It must not require horizontal scrolling.
- On a desktop pointer above 960px, retain three recent windows in left-to-right order and the archive window. Resize transitions must preserve desktop geometry and document identity.
- Reopening a retained compact reader restores its page position. Browser Back/Forward must select the correct document and restore its position.
- Run actual viewport, touch scrolling, menu, and zoom checks when the review browser is available. DOM tests alone do not certify visual behavior.
