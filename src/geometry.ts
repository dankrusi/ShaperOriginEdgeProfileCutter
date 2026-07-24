import type { GeometryResult, Point, Settings, ToolPass } from "./types";

const EPSILON = 1e-8;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function signedArea(points: Point[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function lineIntersection(
  a: Point,
  directionA: Point,
  b: Point,
  directionB: Point,
): Point | null {
  const denominator =
    directionA.x * directionB.y - directionA.y * directionB.x;

  if (Math.abs(denominator) < EPSILON) return null;

  const delta = { x: b.x - a.x, y: b.y - a.y };
  const t =
    (delta.x * directionB.y - delta.y * directionB.x) / denominator;

  return {
    x: a.x + t * directionA.x,
    y: a.y + t * directionA.y,
  };
}

export function offsetPolygon(points: Point[], inset: number): Point[] {
  if (inset === 0) return points.map((point) => ({ ...point }));

  const orientation = signedArea(points) >= 0 ? 1 : -1;

  const lines = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    const direction = { x: next.x - point.x, y: next.y - point.y };
    const length = Math.hypot(direction.x, direction.y);
    const inwardNormal = {
      x: (-direction.y / length) * orientation,
      y: (direction.x / length) * orientation,
    };

    return {
      point: {
        x: point.x + inwardNormal.x * inset,
        y: point.y + inwardNormal.y * inset,
      },
      direction,
    };
  });

  return lines.map((line, index) => {
    const previous = lines[(index - 1 + lines.length) % lines.length]!;
    return (
      lineIntersection(
        previous.point,
        previous.direction,
        line.point,
        line.direction,
      ) ?? line.point
    );
  });
}

function depthColor(depth: number, minDepth: number, maxDepth: number): string {
  const range = Math.max(maxDepth - minDepth, EPSILON);
  const ratio = (depth - minDepth) / range;
  const shallow = { r: 231, g: 141, b: 98 };
  const deep = { r: 169, g: 66, b: 32 };
  const channel = (start: number, end: number) =>
    Math.round(start + (end - start) * ratio)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(shallow.r, deep.r)}${channel(shallow.g, deep.g)}${channel(shallow.b, deep.b)}`;
}

export function makeInsetPositions(
  profileWidth: number,
  toolDiameter: number,
  stepoverPercent: number,
): number[] {
  if (profileWidth <= toolDiameter) return [profileWidth / 2];

  const radius = toolDiameter / 2;
  const first = radius;
  const last = profileWidth - radius;
  const stepover = toolDiameter * (stepoverPercent / 100);
  const gap = last - first;
  const intervals = Math.max(1, Math.ceil(gap / stepover));

  return Array.from(
    { length: intervals + 1 },
    (_, index) => first + (gap * index) / intervals,
  );
}

export function validateSettings(settings: Settings): string[] {
  const warnings: string[] = [];
  const positiveFields: Array<[string, number]> = [
    ["Common length", settings.commonLength],
    ["Left length", settings.leftLength],
    ["Right length", settings.rightLength],
    ["Profile width", settings.profileWidth],
    ["Tool diameter", settings.toolDiameter],
  ];

  for (const [label, value] of positiveFields) {
    if (!Number.isFinite(value) || value <= 0) {
      warnings.push(`${label} must be greater than zero.`);
    }
  }

  if (
    !Number.isFinite(settings.leftOffset) ||
    !Number.isFinite(settings.rightOffset)
  ) {
    warnings.push("Left and right offsets must be valid numbers.");
  }
  if (!Number.isFinite(settings.edgeTailLength) || settings.edgeTailLength < 0) {
    warnings.push("Edge tail length cannot be negative.");
  }
  if (settings.innerDepth < 0 || settings.edgeDepth < 0) {
    warnings.push("Cut depths cannot be negative.");
  }
  if (settings.stepoverPercent < 10 || settings.stepoverPercent > 100) {
    warnings.push("Stepover must be between 10% and 100%.");
  }

  return warnings;
}

function isConvex(points: Point[]): boolean {
  let direction = 0;

  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    const c = points[(index + 2) % points.length]!;
    const cross =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < EPSILON) continue;
    const currentDirection = Math.sign(cross);
    if (direction !== 0 && currentDirection !== direction) return false;
    direction = currentDirection;
  }

  return direction !== 0;
}

export function generateGeometry(settings: Settings): GeometryResult {
  const warnings = validateSettings(settings);
  if (warnings.length > 0) {
    return {
      outline: [],
      innerBoundary: [],
      passes: [],
      bottomLength: 0,
      warnings,
    };
  }

  // Offsets position each vertical side. Negative values move up on screen.
  // Clockwise: top-left, top-right, bottom-right, bottom-left.
  const outline: Point[] = [
    { x: 0, y: settings.leftOffset },
    { x: settings.commonLength, y: settings.rightOffset },
    {
      x: settings.commonLength,
      y: settings.rightOffset + settings.rightLength,
    },
    { x: 0, y: settings.leftOffset + settings.leftLength },
  ];

  const bottomLength = distance(outline[2]!, outline[3]!);

  if (!isConvex(outline)) {
    warnings.push(
      "These dimensions make a folded or concave board. Reduce the corner offsets.",
    );
    return { outline, innerBoundary: [], passes: [], bottomLength, warnings };
  }

  const maxSafeInset =
    Math.min(
      settings.commonLength,
      settings.leftLength,
      settings.rightLength,
      bottomLength,
    ) / 2;

  const totalProfileWidth =
    settings.profileWidth + settings.edgeTailLength;

  if (totalProfileWidth >= maxSafeInset) {
    warnings.push(
      `Combined profile and edge tail width must be less than ${maxSafeInset.toFixed(1)} mm for this shape.`,
    );
    return {
      outline,
      innerBoundary: [],
      passes: [],
      bottomLength,
      warnings,
    };
  }

  const minDepth = Math.min(settings.innerDepth, settings.edgeDepth);
  const maxDepth = Math.max(settings.innerDepth, settings.edgeDepth);
  const positions = makeInsetPositions(
    totalProfileWidth,
    settings.toolDiameter,
    settings.stepoverPercent,
  );
  const firstPosition = positions[0]!;
  const positionRange = positions.at(-1)! - firstPosition;

  const passes: ToolPass[] = positions.map((inset, index) => {
    const profileRatio =
      positionRange > EPSILON ? (inset - firstPosition) / positionRange : 0;
    const distanceFromEdge = profileRatio * totalProfileWidth;
    const taperRatio = Math.max(
      0,
      (distanceFromEdge - settings.edgeTailLength) /
        settings.profileWidth,
    );
    const depth =
      settings.edgeDepth +
      (settings.innerDepth - settings.edgeDepth) * taperRatio;

    return {
      index: index + 1,
      inset,
      depth,
      points: offsetPolygon(outline, inset),
      color: depthColor(depth, minDepth, maxDepth),
    };
  });

  return {
    outline,
    innerBoundary: offsetPolygon(outline, totalProfileWidth),
    passes,
    bottomLength,
    warnings,
  };
}

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return [
    `M ${first!.x.toFixed(3)} ${first!.y.toFixed(3)}`,
    ...rest.map((point) => `L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`),
    "Z",
  ].join(" ");
}
