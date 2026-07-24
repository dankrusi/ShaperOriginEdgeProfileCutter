# Edge Profile Cutter

## Live website

**[Open the Shaper Origin Edge Profile Cutter](https://dankrusi.github.io/ShaperOriginEdgeProfileCutter/)**

A small browser-based SVG generator for cutting tapered depth profiles around
recessed panels, coffered ceilings, and other four-sided boards. It uses
TypeScript and Vite with no runtime dependencies.

Each exported contour is a tool-centre path, encoded for Shaper Origin:

- Toolpaths are **on-line cuts** (grey `#7F7F7F` stroke, no fill), so Origin
  cuts exactly on the line.
- The outer shape and the inner profile boundary are exported as **guides**
  (blue `#0068FF`) for on-tool alignment; they are not cut.
- Each toolpath's intended depth is written with Shaper's
  `shaper:cutDepth="<n>mm"` attribute (namespace
  `http://www.shapertools.com/namespaces/shaper`), so Origin picks it up
  automatically. The depth is also mirrored in the SVG layer name, `<title>`,
  and `data-depth-mm` attribute.

SVG itself is a 2D format, so always verify each depth on the cutting tool
before machining.

## Geometry

- The **top / bottom span** is the shared horizontal distance between the sides.
- Left and right edge lengths are exact vertical lengths.
- Left and right offsets move their complete sides vertically. Negative offsets
  move up and positive offsets move down. The resulting sloped top and bottom
  edge lengths are derived from these values.
- The flat mill is centred inside the profiled band. Pass spacing is calculated
  from the tool diameter and stepover.
- An optional edge tail stays flat at the edge depth before the taper begins.
  Its length is added outside the sloped profile width.
- After the tail, depth is linearly interpolated from the edge depth to the
  inner depth.

## Development

```sh
pnpm install
pnpm dev
```

Run checks and create the production site:

```sh
pnpm test
pnpm build
```

## GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. The included workflow tests, builds, and deploys the site on every push to
   `main`.

Vite uses relative asset URLs, so the build works both at a user domain and
under a repository subpath.
