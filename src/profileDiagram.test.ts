import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { calculateProfileDiagramLayout } from "./profileDiagram";

describe("profile diagram proportions", () => {
  it("uses the same scale for profile width and depth", () => {
    const layout = calculateProfileDiagramLayout(DEFAULT_SETTINGS);
    const renderedSlopeWidth = layout.taperEndX - layout.profileStartX;
    const renderedDepthChange = layout.edgeY - layout.innerY;

    expect(renderedSlopeWidth / renderedDepthChange).toBeCloseTo(
      DEFAULT_SETTINGS.profileWidth /
        (DEFAULT_SETTINGS.edgeDepth - DEFAULT_SETTINGS.innerDepth),
    );
  });

  it("makes a wider profile look proportionally shallower", () => {
    const narrow = calculateProfileDiagramLayout(DEFAULT_SETTINGS);
    const wideSettings = {
      ...DEFAULT_SETTINGS,
      profileWidth: DEFAULT_SETTINGS.profileWidth * 2,
    };
    const wide = calculateProfileDiagramLayout(wideSettings);
    const narrowRatio =
      (narrow.taperEndX - narrow.profileStartX) /
      (narrow.edgeY - narrow.innerY);
    const wideRatio =
      (wide.taperEndX - wide.profileStartX) /
      (wide.edgeY - wide.innerY);

    expect(wideRatio).toBeCloseTo(narrowRatio * 2);
  });

  it("renders the tail in proportion to the sloped width", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      edgeTailLength: 12,
    };
    const layout = calculateProfileDiagramLayout(settings);
    const renderedTail = layout.edgeX - layout.taperEndX;
    const renderedSlope = layout.taperEndX - layout.profileStartX;

    expect(renderedTail / renderedSlope).toBeCloseTo(
      settings.edgeTailLength / settings.profileWidth,
    );
  });
});
