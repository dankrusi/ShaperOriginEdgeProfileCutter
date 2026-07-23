import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  generateGeometry,
  makeInsetPositions,
  offsetPolygon,
} from "./geometry";

describe("makeInsetPositions", () => {
  it("covers the profile without exceeding the requested stepover", () => {
    const positions = makeInsetPositions(42, 6, 75);
    expect(positions[0]).toBe(3);
    expect(positions.at(-1)).toBe(39);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]! - positions[index - 1]!).toBeLessThanOrEqual(4.5);
    }
  });

  it("centres one oversized tool in a narrow profile", () => {
    expect(makeInsetPositions(4, 6, 75)).toEqual([2]);
  });
});

describe("offsetPolygon", () => {
  it("insets a rectangle by an exact distance", () => {
    const result = offsetPolygon(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      5,
    );
    expect(result).toEqual([
      { x: 5, y: 5 },
      { x: 95, y: 5 },
      { x: 95, y: 45 },
      { x: 5, y: 45 },
    ]);
  });
});

describe("generateGeometry", () => {
  it("positions vertical sides by their offsets and slopes depth inward", () => {
    const result = generateGeometry(DEFAULT_SETTINGS);
    const topLeft = result.outline[0]!;
    const topRight = result.outline[1]!;
    const left = result.outline[3]!;
    const right = result.outline[2]!;

    expect(topLeft.y).toBe(DEFAULT_SETTINGS.leftOffset);
    expect(topRight.y).toBe(DEFAULT_SETTINGS.rightOffset);
    expect(left.y - topLeft.y).toBe(DEFAULT_SETTINGS.leftLength);
    expect(right.y - topRight.y).toBe(DEFAULT_SETTINGS.rightLength);
    expect(left.x).toBe(0);
    expect(right.x).toBe(DEFAULT_SETTINGS.commonLength);
    expect(result.passes[0]!.depth).toBeGreaterThan(
      result.passes.at(-1)!.depth,
    );
    expect(result.passes[0]!.depth).toBe(DEFAULT_SETTINGS.edgeDepth);
    expect(result.passes.at(-1)!.depth).toBe(DEFAULT_SETTINGS.innerDepth);
  });
});
