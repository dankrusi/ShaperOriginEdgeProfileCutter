# Edge Profile Cutter

A small browser-based SVG generator for cutting a tapered depth profile around
the edge of a four-sided board. It uses TypeScript and Vite with no runtime
dependencies.

Each exported contour is a tool-centre path. Its intended cut depth is included
in the SVG layer name, `<title>`, and `data-depth-mm` attribute. SVG itself is a
2D format, so always set and verify each depth on the cutting tool before
machining.

## Geometry

- The **top / bottom span** is the shared horizontal distance between the sides.
- Left and right edge lengths are exact vertical lengths.
- Left and right offsets move their complete sides vertically. Negative offsets
  move up and positive offsets move down. The resulting sloped top and bottom
  edge lengths are derived from these values.
- The flat mill is centred inside the profiled band. Pass spacing is calculated
  from the tool diameter and stepover.
- Depth is linearly interpolated from the edge depth to the inner depth.

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
