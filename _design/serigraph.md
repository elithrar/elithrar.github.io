# Serigraph: a seeded design for Questionable Services

Seed: **76127219669286280526682769878634** (32 decimal digits, generated with Python `secrets`).

This experiment starts from main at `db6d0d94538813f68e84bf074bee193d14b837c1`. The following visual analysis was formed from the four supplied Jo Delahaut references before implementation. It describes the images, rather than making historical claims about the artist or the printmaking process.

## Reading the references

Across these four references, the first impression is of weight held in motion. Large, flat shapes occupy most of the surface, but their arrangement never quite settles into symmetry. Black forms act as anchors; strong colors push against them; narrow passages of pale ground keep the composition open. The images feel constructed from a small vocabulary, yet each uses that vocabulary differently. Their character comes from relationships between shapes, not from a profusion of individual details.

The geometry combines bluntness with carefully placed changes of direction. Rectangles become trapezoids; long bars terminate in broad curves; otherwise solid silhouettes contain sharp, triangular notches. In the turquoise composition, repeated forms hover between an abstract letter, a vessel, and a piece of machinery, without resolving into any one thing. In the red-and-blue composition, horizontal bars and upright curved blocks share a common construction logic. The curves are substantial and purposeful, rather than decorative softening applied uniformly to every corner.

The pale areas are active shapes. They divide, cut into, and sometimes become the subject of the image. In the blue-and-cream reference, a narrow gap splits a large blue mass, while a much larger cream wedge presses into its opposite side. The viewer can read the cream as background or as an independent figure. This exchange gives the work its visual tension: a gap can matter as much as the material surrounding it.

Color behaves like a limited set of printing inks. Ultramarine, turquoise, vermilion, deep red, green, and pale yellow appear in solid fields, usually opposed to black and a warm, imperfect white. Each composition restricts the selection rather than using every available color. Differences in area matter: a small red insertion can interrupt an enormous dark block, while a blue field can connect several otherwise separate elements. Color is structural, establishing emphasis and adjacency, rather than merely decorating outlines.

Repetition supplies rhythm, but variation prevents the work from becoming a pattern. Similar silhouettes change orientation, width, color, or spacing. Some edges align firmly; others lean away. A run of horizontal forms may be interrupted by vertical ones, or a familiar shape may appear in reversed colors. These are controlled departures from a recognizable order. Because the underlying order is legible, the interruption feels deliberate and earns attention.

The photographed surfaces also show material irregularity: slight softness at edges, variations in the dark areas, and the warmth of the support. Yet the images remain forceful at a distance. Their identity does not depend on distressing, shadows, or fine texture. The essential information lives in silhouette, proportion, spacing, and contrast. Their apparent simplicity makes every junction and margin unusually consequential.

For this blog, the page itself becomes a composition: a forceful, constructed masthead; an archive with the rhythm of a series of prints; and generous, quiet space for reading. Condensed upright headings pair with EB Garamond prose. Cobalt, vermilion, carbon, and warm paper carry the identity. The mechanical character is implicit in the construction, while the writing, Matt’s name, and direct navigation keep it personal.

## Translation into the site

| Element | Decision |
| --- | --- |
| Masthead | Oversized, two-line Barlow Condensed with an asymmetric original vector composition |
| Headings | Upright Barlow Condensed, substantial and narrow; never italicized |
| Body | Self-hosted EB Garamond, generous line height, a measured article column |
| Navigation | Writing, Archive, and RSS always visible; skip link and visible keyboard focus |
| Home | A cobalt lead article followed by numbered, dated editorial rows with short excerpts |
| Article | Quiet paper background, author and section index in a side rail, earlier/later reading links |
| Archive | Large alternating year numerals, chronological title rows, year anchors, progressive title/year search |
| Links | Cobalt with underlines in prose; familiar clear destinations and focus outlines |
| Footer | A wide geometric print band, Matt’s name, direct social/contact/feed links |
| Color | Paper `#ebe8e1`, carbon `#22221f`, cobalt `#243fa5`, vermilion `#c53c26` |
| Code | Existing monospace family, syntax palette, and local horizontal scrolling retained |

All article content, URLs, and the Atom feed remain intact. Decorative SVGs are hidden from assistive technology. The full archive works without JavaScript; JavaScript adds filtering and the article contents index. No animations or external font requests are needed. At narrow widths the composition rearranges into a single column. Print styling favors the article text.

## Reproducing the seed

```sh
python3 _design/generate.py
python3 _design/generate.py --check
```

`seed.json` is the source of truth. The generator uses `random.Random(int(seed))` to choose bounded negative-space gaps, split positions, notches, curve sizes, reflection, and footer proportions. It writes the SVG includes and `_data/serigraph.yml`. These are committed static assets; readers see the same design on every visit. The seed does not randomize navigation, content order, type sizes, or contrast.

The reference images are inspiration only: the site uses original vector constructions, with no copies of the supplied artwork. The three related article glyphs provide a restrained recurring alphabet. Font sources and licenses are recorded in `public/fonts/README.md`.
