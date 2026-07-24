import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { coerceSettings, serializeSettings } from "./storage";

describe("coerceSettings", () => {
  it("round-trips serialized settings", () => {
    const settings = { ...DEFAULT_SETTINGS, commonLength: 812, edgeDepth: 3.5 };
    expect(coerceSettings(JSON.parse(serializeSettings(settings)))).toEqual(
      settings,
    );
  });

  it("fills missing or invalid keys from defaults", () => {
    const result = coerceSettings({ commonLength: 300, leftLength: "oops" });
    expect(result.commonLength).toBe(300);
    expect(result.leftLength).toBe(DEFAULT_SETTINGS.leftLength);
    expect(result.toolDiameter).toBe(DEFAULT_SETTINGS.toolDiameter);
  });

  it("unwraps a { settings } envelope from exported SVG metadata", () => {
    const result = coerceSettings({
      generator: "Edge Profile Cutter",
      settings: { ...DEFAULT_SETTINGS, profileWidth: 55 },
    });
    expect(result.profileWidth).toBe(55);
  });

  it("returns defaults for non-object input", () => {
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });
});
