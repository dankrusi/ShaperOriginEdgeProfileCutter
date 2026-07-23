import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  commonLength: 600,
  leftLength: 360,
  rightLength: 420,
  leftOffset: 0,
  rightOffset: 35,
  profileWidth: 42,
  innerDepth: 1,
  edgeDepth: 8,
  toolDiameter: 6,
  stepoverPercent: 75,
};

export const STORAGE_KEY = "edge-profile-cutter:settings:v1";
