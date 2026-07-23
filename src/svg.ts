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
      <path d="${pointsToPath(pass.points)}" fill="none" stroke="${pass.color}" stroke-width="0.25" vector-effect="non-scaling-stroke" data-pass="${pass.index}" data-inset-mm="${pass.inset.toFixed(3)}" data-depth-mm="${pass.depth.toFixed(3)}">
        <title>Pass ${pass.index}: ${pass.inset.toFixed(2)} mm from edge, ${pass.depth.toFixed(2)} mm deep</title>
      </path>
    </g>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${width.toFixed(3)}mm"
     height="${height.toFixed(3)}mm"
     viewBox="${minX.toFixed(3)} ${minY.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}">
  <title>Edge profile toolpaths</title>
  <desc>${geometry.passes.length} toolpaths for a ${settings.toolDiameter} mm flat mill. Read data-depth-mm on each path before cutting.</desc>
  <metadata>${metadata}</metadata>
  <g id="cut-passes">
${paths}
  </g>
</svg>
`;
}
