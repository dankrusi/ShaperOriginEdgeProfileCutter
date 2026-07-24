import { pointsToPath } from "./geometry";
import type { GeometryResult, Point, Settings } from "./types";

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character]!,
  );
}

function bounds(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

// Shaper Origin auto-detects cut types by colour. A tool-centre toolpath is an
// on-line cut (grey stroke, no fill); reference geometry is a guide (blue).
// See https://support.shapertools.com/hc/en-us/articles/115002721473-cut-type-encoding
const ON_LINE_STROKE = "#7F7F7F";
const GUIDE_STROKE = "#0068FF";
const SHAPER_NS = "http://www.shapertools.com/namespaces/shaper";

function guidePath(id: string, label: string, points: Point[]): string {
  return `      <path id="${id}" d="${pointsToPath(points)}" fill="none" stroke="${GUIDE_STROKE}" stroke-width="0.25" vector-effect="non-scaling-stroke" shaper:cutType="guide">
        <title>${label}</title>
      </path>`;
}

export function buildSvg(
  settings: Settings,
  geometry: GeometryResult,
): string {
  if (geometry.outline.length === 0 || geometry.passes.length === 0) return "";

  const box = bounds(geometry.outline);
  const padding = settings.toolDiameter / 2 + 2;
  const minX = box.minX - padding;
  const minY = box.minY - padding;
  const width = box.maxX - box.minX + padding * 2;
  const height = box.maxY - box.minY + padding * 2;
  const generatedAt = new Date().toISOString();
  const metadata = escapeXml(
    JSON.stringify({ generator: "Edge Profile Cutter", generatedAt, settings }),
  );

  const paths = geometry.passes
    .map(
      (pass) => `    <g id="pass-${pass.index}" inkscape:groupmode="layer" inkscape:label="Pass ${pass.index} - depth ${pass.depth.toFixed(2)} mm">
      <path d="${pointsToPath(pass.points)}" fill="none" stroke="${ON_LINE_STROKE}" stroke-width="0.25" vector-effect="non-scaling-stroke" shaper:cutType="online" shaper:cutDepth="${pass.depth.toFixed(2)}mm" data-pass="${pass.index}" data-inset-mm="${pass.inset.toFixed(3)}" data-depth-mm="${pass.depth.toFixed(3)}">
        <title>Pass ${pass.index}: ${pass.inset.toFixed(2)} mm from edge, ${pass.depth.toFixed(2)} mm deep</title>
      </path>
    </g>`,
    )
    .join("\n");

  const guides = [
    guidePath("guide-outer", "Outer shape (guide)", geometry.outline),
    geometry.innerBoundary.length > 0
      ? guidePath(
          "guide-inner",
          "Inner profile boundary (guide)",
          geometry.innerBoundary,
        )
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:shaper="${SHAPER_NS}"
     width="${width.toFixed(3)}mm"
     height="${height.toFixed(3)}mm"
     viewBox="${minX.toFixed(3)} ${minY.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}">
  <title>Edge profile toolpaths</title>
  <desc>${geometry.passes.length} on-line toolpaths for a ${settings.toolDiameter} mm flat mill. Cut depth is encoded per path with shaper:cutDepth; verify each depth before cutting.</desc>
  <metadata>${metadata}</metadata>
  <g id="guides">
${guides}
  </g>
  <g id="cut-passes">
${paths}
  </g>
</svg>
`;
}
