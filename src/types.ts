export interface Settings {
  commonLength: number;
  leftLength: number;
  rightLength: number;
  leftOffset: number;
  rightOffset: number;
  profileWidth: number;
  edgeTailLength: number;
  innerDepth: number;
  edgeDepth: number;
  toolDiameter: number;
  stepoverPercent: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ToolPass {
  index: number;
  inset: number;
  depth: number;
  points: Point[];
  color: string;
}

export interface GeometryResult {
  outline: Point[];
  innerBoundary: Point[];
  passes: ToolPass[];
  bottomLength: number;
  warnings: string[];
}
