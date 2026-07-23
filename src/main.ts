import "./styles.css";
import { DEFAULT_SETTINGS } from "./defaults";
import { generateGeometry, pointsToPath } from "./geometry";
import { loadSettings, saveSettings } from "./storage";
import { buildSvg } from "./svg";
import type { GeometryResult, Settings, ToolPass } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found.");

let settings = loadSettings();
let geometry = generateGeometry(settings);

const settingHelp: Record<keyof Settings, string> = {
  commonLength:
    "The horizontal distance between the left and right sides. This is shared by the top and bottom spans.",
  leftLength: "The exact vertical length of the board's left edge.",
  rightLength: "The exact vertical length of the board's right edge.",
  leftOffset:
    "Moves the complete left edge vertically. Negative values move it up; positive values move it down.",
  rightOffset:
    "Moves the complete right edge vertically. Negative values move it up; positive values move it down.",
  profileWidth:
    "The length of the sloped section, measured inward from the end of the flat edge tail.",
  edgeTailLength:
    "An optional flat section at d2 along the outer edge. It is added to the sloped profile width.",
  innerDepth:
    "Cut depth at the innermost toolpath, where the tapered profile meets the board face.",
  edgeDepth:
    "Cut depth at the outermost toolpath along the board edge.",
  toolDiameter:
    "Diameter of the flat end mill. Toolpaths are offset by half this value.",
  stepoverPercent:
    "Maximum spacing between adjacent passes as a percentage of the tool diameter. Lower values create more passes.",
};

const icons = {
  download: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5.1 15a8 8 0 0 0 13.2 2M18.9 9A8 8 0 0 0 5.7 7"/></svg>`,
  info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>`,
};

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Edge Profile Cutter home">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36"><path d="M5 10h26v16H5z"/><path d="M7 22c7 0 7-8 14-8 4 0 6 2 8 4"/></svg>
      </span>
      <span>Edge Profile <strong>Cutter</strong></span>
    </a>
    <span class="save-status"><span></span> Saved locally</span>
  </header>

  <main class="workspace">
    <aside class="controls">
      <div class="intro">
        <p class="eyebrow">SVG TOOLPATH GENERATOR</p>
        <h1>Shape the edge,<br><em>pass by pass.</em></h1>
        <p>Build depth-labelled contours for a flat mill. Adjust the board, tune the profile, then export a clean SVG.</p>
      </div>

      <form id="settings-form" novalidate>
        <section class="control-section">
          <div class="section-heading">
            <span>01</span>
            <div><h2>Board geometry</h2><p>Dimensions in millimetres</p></div>
          </div>
          <div class="field-grid">
            ${numberField("commonLength", "Top / bottom span", "mm", 10, 5000, 1)}
            ${numberField("leftLength", "Left length", "mm", 10, 5000, 1)}
            ${numberField("rightLength", "Right length", "mm", 10, 5000, 1)}
            ${numberField("leftOffset", "Left offset", "mm", -2000, 2000, 1)}
            ${numberField("rightOffset", "Right offset", "mm", -2000, 2000, 1)}
          </div>
          <p class="field-note">${icons.info} Offsets move each full side vertically. Negative moves up; positive moves down.</p>
        </section>

        <section class="control-section">
          <div class="section-heading">
            <span>02</span>
            <div><h2>Edge profile</h2><p>Linear taper across the edge</p></div>
          </div>
          <div class="field-grid">
            ${numberField("profileWidth", "Profile width", "mm", 1, 1000, 0.5)}
            ${numberField("edgeTailLength", "Edge tail length", "mm", 0, 1000, 0.5)}
            ${numberField("innerDepth", "Inner depth d1", "mm", 0, 100, 0.1)}
            ${numberField("edgeDepth", "Edge depth d2", "mm", 0, 100, 0.1)}
          </div>
          <div
            class="profile-diagram"
            id="profile-diagram"
            aria-label="Live cross-section of the edge profile"
          >
            ${profileDiagramSvg(settings)}
          </div>
        </section>

        <section class="control-section">
          <div class="section-heading">
            <span>03</span>
            <div><h2>Tool settings</h2><p>Flat end mill</p></div>
          </div>
          <div class="field-grid">
            ${numberField("toolDiameter", "Mill diameter", "mm", 0.1, 100, 0.1)}
            <label class="field range-field">
              <span class="range-label">
                <span class="field-label">Stepover ${settingTooltip("stepoverPercent")}</span>
                <output id="stepover-output">${settings.stepoverPercent}%</output>
              </span>
              <input type="range" name="stepoverPercent" data-key="stepoverPercent" min="10" max="100" step="5" value="${settings.stepoverPercent}">
              <span class="range-scale"><span>Fine</span><span>Fast</span></span>
            </label>
          </div>
        </section>
      </form>

      <div class="control-actions">
        <button type="button" class="button button-secondary" id="reset-button">${icons.reset}<span>Reset</span></button>
        <button type="button" class="button button-primary" id="export-button">${icons.download}<span>Export SVG</span></button>
      </div>
    </aside>

    <section class="preview-panel">
      <div class="preview-header">
        <div>
          <p class="eyebrow">LIVE PREVIEW</p>
          <h2>Board &amp; toolpaths</h2>
        </div>
        <div class="view-toggle" role="group" aria-label="Preview style">
          <button type="button" class="active" data-view="depth">Depth map</button>
          <button type="button" data-view="lines">Cut lines</button>
        </div>
      </div>

      <div class="preview-stage" id="preview-stage">
        <div id="preview-canvas"></div>
        <div class="preview-tooltip" id="preview-tooltip" hidden></div>
        <div class="orientation" aria-hidden="true"><span></span> TOP EDGE</div>
      </div>

      <div id="validation-message" role="status" aria-live="polite"></div>

      <div class="preview-footer">
        <div class="stats" id="stats"></div>
        <div class="pass-list-wrap">
          <div class="pass-list-heading">
            <div><span class="legend-gradient"></span><strong>Cut sequence</strong></div>
            <small>Hover a pass to inspect</small>
          </div>
          <div
            class="pass-list"
            id="pass-list"
            tabindex="0"
            aria-label="Cut sequence. Scroll horizontally to inspect all passes."
          ></div>
        </div>
        <p class="safety-note">${icons.info} SVG stores the intended depth as path metadata. Set each depth manually on your cutting tool and make a safe test cut.</p>
      </div>
    </section>
  </main>
`;

function numberField(
  key: keyof Settings,
  label: string,
  suffix: string,
  min: number,
  max: number,
  step: number,
): string {
  return `
    <label class="field">
      <span class="field-label">${label} ${settingTooltip(key)}</span>
      <span class="input-wrap">
        <input type="number" name="${key}" data-key="${key}" value="${settings[key]}" min="${min}" max="${max}" step="${step}" inputmode="decimal">
        <span>${suffix}</span>
      </span>
    </label>
  `;
}

function settingTooltip(key: keyof Settings): string {
  return `
    <span class="help-tip" tabindex="0" role="img" aria-label="${settingHelp[key]}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M6.5 6.2a1.65 1.65 0 0 1 3.15.7c0 1.4-1.65 1.45-1.65 2.65M8 12h.01"/></svg>
      <span class="help-tip-content" role="tooltip">${settingHelp[key]}</span>
    </span>`;
}

function profileDiagramSvg(current: Settings): string {
  const profileWidth =
    Number.isFinite(current.profileWidth) && current.profileWidth > 0
      ? current.profileWidth
      : 1;
  const tailLength = Math.max(
    Number.isFinite(current.edgeTailLength) ? current.edgeTailLength : 0,
    0,
  );
  const innerDepth = Math.max(
    Number.isFinite(current.innerDepth) ? current.innerDepth : 0,
    0,
  );
  const edgeDepth = Math.max(
    Number.isFinite(current.edgeDepth) ? current.edgeDepth : 0,
    0,
  );

  const profileStartX = 70;
  const edgeX = 348;
  const profilePixels = edgeX - profileStartX;
  const totalWidth = profileWidth + tailLength;
  const tailPixels = (tailLength / totalWidth) * profilePixels;
  const taperEndX = edgeX - tailPixels;
  const depthScale = Math.max(10, innerDepth, edgeDepth);
  const depthToY = (depth: number) => 17 + (depth / depthScale) * 39;
  const innerY = depthToY(innerDepth);
  const edgeY = depthToY(edgeDepth);
  const showTail = tailLength > 0;

  return `
    <svg viewBox="0 0 360 78" role="img">
      <title>${profileWidth.toFixed(1)} mm sloped profile, from ${innerDepth.toFixed(1)} mm to ${edgeDepth.toFixed(1)} mm deep${showTail ? `, followed by a ${tailLength.toFixed(1)} mm flat edge tail` : ""}</title>
      <path class="profile-stock" d="M8 12H352V66H8Z"/>
      ${showTail ? `<rect class="profile-tail-zone" x="${taperEndX.toFixed(2)}" y="12" width="${tailPixels.toFixed(2)}" height="54"/>` : ""}
      <path class="profile-cut" d="M8 12H352V${edgeY.toFixed(2)}H${taperEndX.toFixed(2)}L${profileStartX} ${innerY.toFixed(2)}H8Z"/>
      <path class="profile-line" d="M8 ${innerY.toFixed(2)}H${profileStartX}L${taperEndX.toFixed(2)} ${edgeY.toFixed(2)}H348"/>
      <path class="profile-marker" d="M${profileStartX} 62V68M${taperEndX.toFixed(2)} 62V68M348 62V68"/>
      <text x="${profileStartX - 4}" y="${Math.max(16, innerY - 4).toFixed(2)}" text-anchor="end">d1 ${innerDepth.toFixed(1)}</text>
      <text x="346" y="${Math.max(16, edgeY - 4).toFixed(2)}" text-anchor="end">d2 ${edgeDepth.toFixed(1)}</text>
      <text class="profile-dimension" x="${((profileStartX + taperEndX) / 2).toFixed(2)}" y="74" text-anchor="middle">${profileWidth.toFixed(1)} mm taper</text>
      ${showTail ? `<text class="profile-tail-label" x="${((taperEndX + edgeX) / 2).toFixed(2)}" y="${Math.min(61, edgeY + 10).toFixed(2)}" text-anchor="middle">${tailLength.toFixed(1)} mm tail</text>` : ""}
    </svg>`;
}

const form = document.querySelector<HTMLFormElement>("#settings-form")!;
const previewCanvas = document.querySelector<HTMLDivElement>("#preview-canvas")!;
const profileDiagram =
  document.querySelector<HTMLDivElement>("#profile-diagram")!;
const passList = document.querySelector<HTMLDivElement>("#pass-list")!;
const stats = document.querySelector<HTMLDivElement>("#stats")!;
const validationMessage =
  document.querySelector<HTMLDivElement>("#validation-message")!;
const exportButton =
  document.querySelector<HTMLButtonElement>("#export-button")!;
const tooltip = document.querySelector<HTMLDivElement>("#preview-tooltip")!;
let previewMode: "depth" | "lines" = "depth";

passList.addEventListener(
  "wheel",
  (event) => {
    if (passList.scrollWidth <= passList.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    passList.scrollLeft += event.deltaY;
  },
  { passive: false },
);

function getBounds(points: GeometryResult["outline"]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function previewSvg(result: GeometryResult): string {
  if (result.outline.length === 0) return "";

  const box = getBounds(result.outline);
  const pad = Math.max(
    settings.commonLength,
    settings.leftLength,
    settings.rightLength,
  ) * 0.08;
  const viewBox = [
    box.minX - pad,
    box.minY - pad,
    box.maxX - box.minX + pad * 2,
    box.maxY - box.minY + pad * 2,
  ].join(" ");
  const outlinePath = pointsToPath(result.outline);

  const passes = result.passes
    .map((pass) => {
      const title = `Pass ${pass.index} · ${pass.inset.toFixed(1)} mm inset · ${pass.depth.toFixed(2)} mm depth`;
      return `
        <g class="preview-pass" data-pass="${pass.index}" tabindex="0" role="button" aria-label="${title}">
          <path class="pass-band" d="${pointsToPath(pass.points)}" stroke="${pass.color}" stroke-width="${settings.toolDiameter}" />
          <path class="pass-line" d="${pointsToPath(pass.points)}" stroke="${pass.color}" />
          <title>${title}</title>
        </g>`;
    })
    .join("");

  return `
    <svg class="board-preview ${previewMode}" viewBox="${viewBox}" role="img" aria-label="Board outline with ${result.passes.length} toolpaths">
      <defs>
        <filter id="board-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="${pad * 0.035}" stdDeviation="${pad * 0.04}" flood-opacity=".16"/>
        </filter>
        <clipPath id="board-clip"><path d="${outlinePath}"/></clipPath>
        <pattern id="grain" width="42" height="26" patternUnits="userSpaceOnUse">
          <path d="M-8 20C7 8 17 7 38 15S59 14 68 5" fill="none" stroke="currentColor" stroke-width=".65" opacity=".18"/>
        </pattern>
      </defs>
      <path class="board-shape" d="${outlinePath}" filter="url(#board-shadow)"/>
      <path class="board-grain" d="${outlinePath}"/>
      <g clip-path="url(#board-clip)">${passes}</g>
      <path class="board-outline" d="${outlinePath}"/>
    </svg>`;
}

function passItem(pass: ToolPass): string {
  return `
    <button type="button" class="pass-item" data-pass="${pass.index}" style="--pass-color:${pass.color}">
      <span class="pass-index">${String(pass.index).padStart(2, "0")}</span>
      <span class="pass-swatch"></span>
      <span><strong>${pass.depth.toFixed(2)} mm</strong><small>${pass.inset.toFixed(1)} mm from edge</small></span>
    </button>`;
}

function render(): void {
  geometry = generateGeometry(settings);
  saveSettings(settings);
  profileDiagram.innerHTML = profileDiagramSvg(settings);
  previewCanvas.innerHTML = previewSvg(geometry);
  passList.innerHTML = geometry.passes.map(passItem).join("");

  const valid = geometry.warnings.length === 0;
  exportButton.disabled = !valid;
  validationMessage.className = valid ? "" : "validation-error";
  validationMessage.innerHTML = valid
    ? ""
    : `${icons.info}<span>${geometry.warnings.join(" ")}</span>`;

  const averageStep =
    geometry.passes.length > 1
      ? (geometry.passes.at(-1)!.inset - geometry.passes[0]!.inset) /
        (geometry.passes.length - 1)
      : 0;

  stats.innerHTML = `
    <div><span>Passes</span><strong>${geometry.passes.length || "—"}</strong></div>
    <div><span>Avg. stepover</span><strong>${geometry.passes.length ? `${averageStep.toFixed(1)} mm` : "—"}</strong></div>
    <div><span>Derived bottom</span><strong>${geometry.bottomLength ? `${geometry.bottomLength.toFixed(1)} mm` : "—"}</strong></div>
    <div><span>Depth range</span><strong>${geometry.passes.length ? `${Math.min(settings.innerDepth, settings.edgeDepth).toFixed(1)}–${Math.max(settings.innerDepth, settings.edgeDepth).toFixed(1)} mm` : "—"}</strong></div>`;
}

function syncInputs(): void {
  form.querySelectorAll<HTMLInputElement>("[data-key]").forEach((input) => {
    const key = input.dataset.key as keyof Settings;
    input.value = String(settings[key]);
  });
  document.querySelector<HTMLOutputElement>("#stepover-output")!.value =
    `${settings.stepoverPercent}%`;
}

form.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  const key = input.dataset.key as keyof Settings | undefined;
  if (!key) return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  settings = { ...settings, [key]: value };
  if (key === "stepoverPercent") {
    document.querySelector<HTMLOutputElement>("#stepover-output")!.value =
      `${value}%`;
  }
  render();
});

document.querySelector("#reset-button")!.addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  syncInputs();
  render();
});

exportButton.addEventListener("click", () => {
  const svg = buildSvg(settings, geometry);
  if (!svg) return;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `edge-profile-${settings.commonLength}x${Math.round((settings.leftLength + settings.rightLength) / 2)}mm.svg`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    previewMode = button.dataset.view as "depth" | "lines";
    document
      .querySelectorAll("[data-view]")
      .forEach((item) => item.classList.toggle("active", item === button));
    previewCanvas.innerHTML = previewSvg(geometry);
  });
});

function highlightPass(passNumber: string | undefined, active: boolean): void {
  if (!passNumber) return;
  document
    .querySelectorAll(`[data-pass="${passNumber}"]`)
    .forEach((item) => item.classList.toggle("is-highlighted", active));
}

document.addEventListener("pointerover", (event) => {
  const target = (event.target as Element).closest<HTMLElement>("[data-pass]");
  if (!target) return;
  const pass = geometry.passes.find(
    (item) => item.index === Number(target.dataset.pass),
  );
  if (!pass) return;
  highlightPass(target.dataset.pass, true);
  tooltip.hidden = false;
  tooltip.innerHTML = `<strong>Pass ${pass.index}</strong><span>${pass.depth.toFixed(2)} mm deep</span><small>${pass.inset.toFixed(1)} mm from edge</small>`;
});

document.addEventListener("pointermove", (event) => {
  if (tooltip.hidden) return;
  const stage = document.querySelector("#preview-stage")!.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - stage.left + 14}px`;
  tooltip.style.top = `${event.clientY - stage.top + 14}px`;
});

document.addEventListener("pointerout", (event) => {
  const target = (event.target as Element).closest<HTMLElement>("[data-pass]");
  if (!target) return;
  const related = event.relatedTarget as Element | null;
  if (related?.closest(`[data-pass="${target.dataset.pass}"]`)) return;
  highlightPass(target.dataset.pass, false);
  tooltip.hidden = true;
});

render();
