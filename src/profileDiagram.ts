import type { Settings } from "./types";

export interface ProfileDiagramLayout {
  scale: number;
  surfaceY: number;
  boardBottomY: number;
  boardStartX: number;
  profileStartX: number;
  taperEndX: number;
  edgeX: number;
  innerY: number;
  edgeY: number;
}

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 78;
const PLOT = {
  left: 10,
  right: 350,
  top: 9,
  bottom: 58,
};

function safePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function calculateProfileDiagramLayout(
  settings: Settings,
): ProfileDiagramLayout {
  const profileWidth = safePositive(settings.profileWidth, 1);
  const tailLength = safeNonNegative(settings.edgeTailLength);
  const innerDepth = safeNonNegative(settings.innerDepth);
  const edgeDepth = safeNonNegative(settings.edgeDepth);
  const totalProfileWidth = profileWidth + tailLength;

  // A short untouched lead-in makes the d1 drop-off visible without changing
  // the profile's width-to-depth proportions.
  const leadLength = totalProfileWidth * 0.18;
  const drawingWidth = leadLength + totalProfileWidth;
  const deepestCut = Math.max(innerDepth, edgeDepth);
  const stockMargin = Math.max(
    deepestCut * 0.18,
    totalProfileWidth * 0.03,
    0.5,
  );
  const drawingHeight = deepestCut + stockMargin;
  const availableWidth = PLOT.right - PLOT.left;
  const availableHeight = PLOT.bottom - PLOT.top;
  const scale = Math.min(
    availableWidth / drawingWidth,
    availableHeight / drawingHeight,
  );

  const renderedWidth = drawingWidth * scale;
  const renderedHeight = drawingHeight * scale;
  const boardStartX =
    PLOT.left + (availableWidth - renderedWidth) / 2;
  const surfaceY = PLOT.top + (availableHeight - renderedHeight) / 2;
  const profileStartX = boardStartX + leadLength * scale;
  const taperEndX = profileStartX + profileWidth * scale;
  const edgeX = taperEndX + tailLength * scale;

  return {
    scale,
    surfaceY,
    boardBottomY: surfaceY + renderedHeight,
    boardStartX,
    profileStartX,
    taperEndX,
    edgeX,
    innerY: surfaceY + innerDepth * scale,
    edgeY: surfaceY + edgeDepth * scale,
  };
}

export function buildProfileDiagramSvg(settings: Settings): string {
  const profileWidth = safePositive(settings.profileWidth, 1);
  const tailLength = safeNonNegative(settings.edgeTailLength);
  const innerDepth = safeNonNegative(settings.innerDepth);
  const edgeDepth = safeNonNegative(settings.edgeDepth);
  const showTail = tailLength > 0;
  const layout = calculateProfileDiagramLayout(settings);
  const {
    surfaceY,
    boardBottomY,
    boardStartX,
    profileStartX,
    taperEndX,
    edgeX,
    innerY,
    edgeY,
  } = layout;
  const number = (value: number) => value.toFixed(2);
  const labelY = (depthY: number) =>
    Math.max(8, Math.min(PLOT.bottom - 2, depthY - 4));

  return `
    <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img">
      <title>Dimensionally proportional profile: ${profileWidth.toFixed(1)} mm slope, from ${innerDepth.toFixed(1)} mm to ${edgeDepth.toFixed(1)} mm deep${showTail ? `, followed by a ${tailLength.toFixed(1)} mm flat edge tail` : ""}</title>
      <path class="profile-stock" d="M${number(boardStartX)} ${number(surfaceY)}H${number(edgeX)}V${number(boardBottomY)}H${number(boardStartX)}Z"/>
      ${showTail ? `<rect class="profile-tail-zone" x="${number(taperEndX)}" y="${number(surfaceY)}" width="${number(edgeX - taperEndX)}" height="${number(boardBottomY - surfaceY)}"/>` : ""}
      <path class="profile-cut" d="M${number(profileStartX)} ${number(surfaceY)}H${number(edgeX)}V${number(edgeY)}H${number(taperEndX)}L${number(profileStartX)} ${number(innerY)}Z"/>
      <path class="profile-line" d="M${number(boardStartX)} ${number(surfaceY)}H${number(profileStartX)}V${number(innerY)}L${number(taperEndX)} ${number(edgeY)}H${number(edgeX)}"/>
      <path class="profile-marker" d="M${number(profileStartX)} 61V67M${number(taperEndX)} 61V67M${number(edgeX)} 61V67"/>
      <text x="${number(profileStartX - 4)}" y="${number(labelY(innerY))}" text-anchor="end">d1 ${innerDepth.toFixed(1)}</text>
      <text x="${number(edgeX - 2)}" y="${number(labelY(edgeY))}" text-anchor="end">d2 ${edgeDepth.toFixed(1)}</text>
      <text class="profile-dimension" x="${number((profileStartX + taperEndX) / 2)}" y="74" text-anchor="middle">${profileWidth.toFixed(1)} mm taper</text>
      ${showTail ? `<text class="profile-tail-label" x="${number((taperEndX + edgeX) / 2)}" y="${number(Math.min(PLOT.bottom, edgeY + 9))}" text-anchor="middle">${tailLength.toFixed(1)} mm tail</text>` : ""}
      <text class="profile-proportion-label" x="348" y="8" text-anchor="end">PROPORTIONAL</text>
    </svg>`;
}
