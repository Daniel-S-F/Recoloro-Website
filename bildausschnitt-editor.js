/* RECOLORO – lokaler Hero-Bildworkflow mit loopback-gebundener Speicherfunktion. */
'use strict';

const clone = value => JSON.parse(JSON.stringify(value));
const sourceConfig = window.RECOLORO_IMAGE_CONFIG;
const sourceEditorConfig = window.RECOLORO_IMAGE_EDITOR_CONFIG || { schemaVersion: 1, pairs: {} };

if (!sourceConfig || !Array.isArray(sourceConfig.pairs)) {
  throw new Error('Die zentrale Bildkonfiguration image-config.js fehlt oder ist ungültig.');
}

let config = clone(sourceConfig);
let savedConfig = clone(sourceConfig);
let editorConfig = clone(sourceEditorConfig);
let savedEditorConfig = clone(sourceEditorConfig);
let activePair = config.pairs[0];
let activeSide = 'before';
let websiteRoot = null;
let localSaveAvailable = false;
let working = false;
const imageCache = new Map();
const bitmapCache = new Map();
const sliderPositions = { desktop: 50, mobile: 50 };
let processingRevision = 0;
const alignedCanvasCache = new Map();
let selectedPointIndex = 0;
let comparisonMode = 'slider';
let blinkPhase = false;
let blinkTimer = null;
let selectedMaskId = null;
let maskInteraction = null;
let maskDrawEnabled = false;
let pipetteEnabled = false;
let activeStepId = 'stepOrientation';

const elements = {
  pairSelect: document.querySelector('#pairSelect'),
  pairId: document.querySelector('#pairId'),
  component: document.querySelector('#component'),
  group: document.querySelector('#group'),
  displayTitle: document.querySelector('#displayTitle'),
  beforeAlt: document.querySelector('#beforeAlt'),
  afterAlt: document.querySelector('#afterAlt'),
  publicApproved: document.querySelector('#publicApproved'),
  heroEligible: document.querySelector('#heroEligible'),
  heroActive: document.querySelector('#heroActive'),
  heroOrder: document.querySelector('#heroOrder'),
  pairWarning: document.querySelector('#pairWarning'),
  rootStatus: document.querySelector('#rootStatus'),
  workflowOutput: document.querySelector('#workflowOutput'),
  chooseRoot: document.querySelector('#chooseRoot'),
  saveApply: document.querySelector('#saveApply'),
  downloadFallback: document.querySelector('#downloadFallback'),
  reset: document.querySelector('#reset'),
  desktopPreview: document.querySelector('#desktopPreview'),
  mobilePreview: document.querySelector('#mobilePreview'),
  desktopControls: document.querySelector('#desktopControls'),
  desktopCurtainStatus: document.querySelector('#desktopCurtainStatus'),
  mobileControls: document.querySelector('#mobileControls'),
  stepNav: document.querySelector('#stepNav'),
  orientationCanvas: document.querySelector('#orientationCanvas'),
  orientationInfo: document.querySelector('#orientationInfo'),
  orientationStatus: document.querySelector('#orientationStatus'),
  orientationChecked: document.querySelector('#orientationChecked'),
  referenceSide: document.querySelector('#referenceSide'),
  simpleTargetLabel: document.querySelector('#simpleTargetLabel'),
  simpleControls: document.querySelector('#simpleControls'),
  resetSimple: document.querySelector('#resetSimple'),
  perspectiveEnabled: document.querySelector('#perspectiveEnabled'),
  pointSide: document.querySelector('#pointSide'),
  pointCanvas: document.querySelector('#pointCanvas'),
  pointStatus: document.querySelector('#pointStatus'),
  resetPerspective: document.querySelector('#resetPerspective'),
  comparisonCanvas: document.querySelector('#comparisonCanvas'),
  comparisonSlider: document.querySelector('#comparisonSlider'),
  comparisonSliderOutput: document.querySelector('#comparisonSliderOutput'),
  overlayOpacity: document.querySelector('#overlayOpacity'),
  overlayOpacityOutput: document.querySelector('#overlayOpacityOutput'),
  alignmentChecked: document.querySelector('#alignmentChecked'),
  comparisonStatus: document.querySelector('#comparisonStatus'),
  maskCanvas: document.querySelector('#maskCanvas'),
  maskPreviewSide: document.querySelector('#maskPreviewSide'),
  maskType: document.querySelector('#maskType'),
  maskScope: document.querySelector('#maskScope'),
  maskLabel: document.querySelector('#maskLabel'),
  maskColor: document.querySelector('#maskColor'),
  maskPixelSize: document.querySelector('#maskPixelSize'),
  maskBlurRadius: document.querySelector('#maskBlurRadius'),
  sampleColor: document.querySelector('#sampleColor'),
  newMask: document.querySelector('#newMask'),
  resetMasks: document.querySelector('#resetMasks'),
  maskList: document.querySelector('#maskList'),
  maskStatus: document.querySelector('#maskStatus'),
  anonymizationChecked: document.querySelector('#anonymizationChecked'),
  desktopCropChecked: document.querySelector('#desktopCropChecked'),
  mobileCropChecked: document.querySelector('#mobileCropChecked'),
  exportDevice: document.querySelector('#exportDevice'),
  exportSide: document.querySelector('#exportSide'),
  refreshExportPreview: document.querySelector('#refreshExportPreview'),
  exportPreviewCanvas: document.querySelector('#exportPreviewCanvas'),
  exportPreviewStatus: document.querySelector('#exportPreviewStatus'),
  exportPreviewChecked: document.querySelector('#exportPreviewChecked'),
};

function defaultEditorState(legacy = true) {
  const complete = Boolean(legacy);
  return {
    sourceOrientation: null,
    alignment: {
      reference: 'after',
      simple: {
        before: { x: 0, y: 0, scale: 1, rotation: 0 },
        after: { x: 0, y: 0, scale: 1, rotation: 0 },
      },
      perspective: {
        enabled: false,
        pointOrder: ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
        before: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }],
        after: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }],
        gridSize: 16,
      },
    },
    anonymization: { masks: [] },
    workflow: {
      orientationChecked: complete,
      alignmentChecked: complete,
      anonymizationChecked: complete,
      desktopCropChecked: complete,
      mobileCropChecked: complete,
      exportPreviewChecked: complete,
      technicalApproved: complete,
    },
  };
}

function currentEditorState() {
  editorConfig.pairs ||= {};
  editorConfig.pairs[activePair.id] ||= defaultEditorState(activePair.id !== 'orig-001');
  return editorConfig.pairs[activePair.id];
}

function isEnhancedPair() {
  return activePair.id === 'orig-001' || Boolean(currentEditorState().sourceOrientation);
}

function invalidateProcessing() {
  processingRevision += 1;
  alignedCanvasCache.clear();
}

function currentFrame(device) {
  activePair.crop ||= {};
  activePair.crop[device] ||= { x: 50, y: 50, zoom: 1, ...(device === 'desktop' ? { curtain: 0 } : {}) };
  if (device === 'desktop' && !Number.isFinite(activePair.crop[device].curtain)) activePair.crop[device].curtain = 0;
  return activePair.crop[device];
}

function actionableError(message) {
  const text = String(message || 'Unbekannter Fehler.').trim();
  if (/Lösung:/i.test(text)) return text;
  if (/ungültige Randflächen|ohne gültige Bildinformation/i.test(text)) {
    return `Fehler im Bildausschnitt: ${text} Lösung: Seitenrahmen vergrössern oder Bildausschnitt, Skalierung beziehungsweise Perspektivpunkte anpassen und die 100%-Vorschau erneut prüfen.`;
  }
  if (/Ordner|Schreibzugriff|Website-Root/i.test(text)) {
    return `Fehler beim Website-Ordner: ${text} Lösung: Den Ordner Website_Arbeitsstand_2026-07-01 erneut wählen und den Schreibzugriff bestätigen.`;
  }
  if (/fehlt|nicht gefunden|unvollständig/i.test(text)) {
    return `Fehler bei einer Datei oder Angabe: ${text} Lösung: Den genannten Pfad beziehungsweise das markierte Feld prüfen und danach erneut ausführen.`;
  }
  if (/Hero-Reihenfolge|aktiv, aber|doppelte Hero/i.test(text)) {
    return `Fehler bei der Hero-Freigabe: ${text} Lösung: Freigabestufen und eine eindeutige positive Hero-Reihenfolge prüfen.`;
  }
  return `Fehler: ${text} Lösung: Den im Hinweis genannten Arbeitsschritt prüfen, korrigieren und erneut ausführen.`;
}

function setStatus(message, type = '') {
  elements.workflowOutput.textContent = type === 'error' ? actionableError(message) : message;
  elements.workflowOutput.className = `output${type ? ` is-${type}` : ''}`;
}

function setRootStatus(message, type = '') {
  elements.rootStatus.textContent = type === 'error' ? actionableError(message) : message;
  elements.rootStatus.className = `status${type ? ` is-${type}` : ''}`;
}

function setWorking(value) {
  working = value;
  elements.saveApply.disabled = value;
  elements.downloadFallback.disabled = value;
  elements.chooseRoot.disabled = value;
}

function buildHeroPreview(container, device) {
  container.innerHTML = `
    <div class="preview-side before"><canvas class="preview-image" data-preview-image="before"></canvas></div>
    <div class="preview-side after"><canvas class="preview-image" data-preview-image="after"></canvas></div>
    <div class="divider"><button class="handle" type="button" aria-label="Vorher-Nachher-Regler">↔</button></div>
    <div class="labels" aria-hidden="true"><span>Vorher</span><span>Nachher</span></div>
    <div class="hero-copy"><strong><img src="assets/images/recoloro-wordmark.svg" alt="RECOLORO">bringt die Farbe zurück.</strong><small data-preview-title></small><b>Offerte anfragen</b></div>`;
  bindCropDrag(container, device);
  bindSlider(container, device);
}

function getImage(src) {
  if (!src) return Promise.reject(new Error('Bildpfad fehlt.'));
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Bild nicht gefunden: ${src}`));
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function getBitmap(src) {
  if (!src) return Promise.reject(new Error('Bildpfad fehlt.'));
  if (bitmapCache.has(src)) return bitmapCache.get(src);
  const promise = (async () => {
    if ('createImageBitmap' in window) {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Bild nicht gefunden: ${src}`);
      return createImageBitmap(await response.blob(), { imageOrientation: 'from-image' });
    }
    return getImage(src);
  })();
  bitmapCache.set(src, promise);
  return promise;
}

function applySimple(point, simple) {
  const scale = Number(simple?.scale) || 1;
  const radians = (Number(simple?.rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = (point.x - 0.5) * scale;
  const y = (point.y - 0.5) * scale;
  return {
    x: x * cos - y * sin + 0.5 + (Number(simple?.x) || 0) / 100,
    y: x * sin + y * cos + 0.5 + (Number(simple?.y) || 0) / 100,
  };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) throw new Error('Perspektivpunkte ergeben keine gültige Transformation.');
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let item = column; item <= size; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) augmented[row][item] -= factor * augmented[column][item];
    }
  }
  return augmented.map(row => row[size]);
}

function calculateHomography(sourcePoints, destinationPoints) {
  const matrix = [];
  const vector = [];
  sourcePoints.forEach((point, index) => {
    const destination = destinationPoints[index];
    matrix.push([point.x, point.y, 1, 0, 0, 0, -destination.x * point.x, -destination.x * point.y]);
    vector.push(destination.x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -destination.y * point.x, -destination.y * point.y]);
    vector.push(destination.y);
  });
  const h = solveLinearSystem(matrix, vector);
  return [...h, 1];
}

function projectPoint(matrix, point) {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
}

function polygonArea(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function validPerspectivePoints(points) {
  if (!Array.isArray(points)
    || points.length !== 4
    || !points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
    || polygonArea(points) <= 0.01) return false;
  const turns = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const following = points[(index + 2) % points.length];
    return (next.x - point.x) * (following.y - next.y) - (next.y - point.y) * (following.x - next.x);
  });
  return turns.every(turn => turn > 0.0001) || turns.every(turn => turn < -0.0001);
}

function perspectiveStatus() {
  const perspective = currentEditorState().alignment.perspective;
  if (!perspective.enabled) return { valid: true, message: 'Perspektivische Ausrichtung ist deaktiviert.' };
  if (!validPerspectivePoints(perspective.before) || !validPerspectivePoints(perspective.after)) {
    return { valid: false, message: 'Je Bild müssen vier gültige, umlaufend gesetzte Perspektivpunkte vorhanden sein; die Punktlinien dürfen sich nicht kreuzen.' };
  }
  try {
    const reference = currentEditorState().alignment.reference;
    const target = reference === 'after' ? 'before' : 'after';
    const source = perspective[target].map(point => applySimple(point, currentEditorState().alignment.simple[target]));
    calculateHomography(source, perspective[reference]);
    return { valid: true, message: `${target === 'before' ? 'Vorher' : 'Nachher'} wird auf ${reference === 'before' ? 'Vorher' : 'Nachher'} als Referenz ausgerichtet.` };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

function drawImageTriangle(context, image, source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const determinant = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(determinant) < 1e-8) return;
  const solve = values => (
    (values[0] * (s1.y - s2.y) + values[1] * (s2.y - s0.y) + values[2] * (s0.y - s1.y)) / determinant
  );
  const solveY = values => (
    (values[0] * (s2.x - s1.x) + values[1] * (s0.x - s2.x) + values[2] * (s1.x - s0.x)) / determinant
  );
  const a = solve([d0.x, d1.x, d2.x]);
  const c = solveY([d0.x, d1.x, d2.x]);
  const e = d0.x - a * s0.x - c * s0.y;
  const b = solve([d0.y, d1.y, d2.y]);
  const d = solveY([d0.y, d1.y, d2.y]);
  const f = d0.y - b * s0.x - d * s0.y;
  const centre = {
    x: (d0.x + d1.x + d2.x) / 3,
    y: (d0.y + d1.y + d2.y) / 3,
  };
  const expanded = destination.map(point => {
    const dx = point.x - centre.x;
    const dy = point.y - centre.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + dx / length, y: point.y + dy / length };
  });
  context.save();
  context.beginPath();
  context.moveTo(expanded[0].x, expanded[0].y);
  context.lineTo(expanded[1].x, expanded[1].y);
  context.lineTo(expanded[2].x, expanded[2].y);
  context.closePath();
  context.clip();
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

function destinationMapper(width, height, referenceImage, frame = null) {
  if (!frame) return point => ({ x: point.x * width, y: point.y * height });
  const zoom = Math.max(0.7, Math.min(1.6, Number(frame.zoom) || 1));
  const scale = Math.max(width / referenceImage.width, height / referenceImage.height) * zoom;
  const drawWidth = referenceImage.width * scale;
  const drawHeight = referenceImage.height * scale;
  const x = Math.max(0, Math.min(100, Number(frame.x) || 50));
  const y = Math.max(0, Math.min(100, Number(frame.y) || 50));
  const drawX = -((drawWidth - width) * x / 100);
  const drawY = -((drawHeight - height) * y / 100);
  return point => ({ x: drawX + point.x * drawWidth, y: drawY + point.y * drawHeight });
}

function canvasHasTransparentPixels(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 32) return true;
  return false;
}

function maskApplies(mask, side) {
  return mask.scope === 'both' || mask.scope === side;
}

function applyMasks(context, canvas, side, mapper) {
  const masks = currentEditorState().anonymization?.masks || [];
  masks.filter(mask => maskApplies(mask, side)).forEach(mask => {
    const start = mapper({ x: mask.x, y: mask.y });
    const end = mapper({ x: mask.x + mask.width, y: mask.y + mask.height });
    const x = Math.max(0, Math.min(start.x, end.x));
    const y = Math.max(0, Math.min(start.y, end.y));
    const width = Math.min(canvas.width, Math.max(start.x, end.x)) - x;
    const height = Math.min(canvas.height, Math.max(start.y, end.y)) - y;
    if (width <= 1 || height <= 1) return;

    if (mask.type === 'cover') {
      context.fillStyle = mask.color || '#687275';
      context.fillRect(x, y, width, height);
      return;
    }

    const temporary = document.createElement('canvas');
    temporary.width = Math.max(1, Math.round(width));
    temporary.height = Math.max(1, Math.round(height));
    temporary.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, temporary.width, temporary.height);

    if (mask.type === 'pixelate') {
      const pixelSize = Math.max(12, Number(mask.pixelSize) || 24);
      const tiny = document.createElement('canvas');
      tiny.width = Math.max(1, Math.ceil(width / pixelSize));
      tiny.height = Math.max(1, Math.ceil(height / pixelSize));
      const tinyContext = tiny.getContext('2d');
      tinyContext.imageSmoothingEnabled = false;
      tinyContext.drawImage(temporary, 0, 0, tiny.width, tiny.height);
      context.save();
      context.imageSmoothingEnabled = false;
      context.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, width, height);
      context.restore();
      return;
    }

    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.filter = `blur(${Math.max(16, Number(mask.blurRadius) || 28)}px)`;
    context.drawImage(temporary, x - 20, y - 20, width + 40, height + 40);
    context.restore();
  });
}

function requiredSymmetricCurtain(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let requiredWidth = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] >= 32) continue;
    const pixelIndex = (index - 3) / 4;
    const x = pixelIndex % canvas.width;
    requiredWidth = Math.max(requiredWidth, x < canvas.width / 2 ? x + 1 : canvas.width - x);
  }
  return Math.ceil(requiredWidth / canvas.width * 1000) / 10;
}

function applyDesktopCurtain(context, canvas, frame) {
  const configured = Math.max(0, Math.min(49, Number(frame?.curtain) || 0));
  if (!configured) return { configured: 0, effective: 0, automatic: false };
  const required = requiredSymmetricCurtain(canvas);
  const effective = Math.min(49, Math.max(configured, required));
  const width = Math.ceil(canvas.width * effective / 100);
  context.fillStyle = config.heroDefaults.backgroundColor || '#F3F4F5';
  context.fillRect(0, 0, width, canvas.height);
  context.fillRect(canvas.width - width, 0, width, canvas.height);
  return { configured, effective, automatic: effective > configured + 0.01 };
}

async function renderProcessedSide(side, width, height, options = {}) {
  const frame = options.frame || null;
  const withMasks = options.withMasks !== false;
  const state = currentEditorState();
  const reference = state.alignment.reference || 'after';
  const [image, referenceImage] = await Promise.all([getBitmap(activePair.source[side]), getBitmap(activePair.source[reference])]);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  const allowLegacyBackground = Boolean(frame && !isEnhancedPair());
  if (allowLegacyBackground) {
    context.fillStyle = '#f3f4f5';
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  const mapper = destinationMapper(canvas.width, canvas.height, referenceImage, frame);
  const perspective = state.alignment.perspective;
  const simple = state.alignment.simple[side] || { x: 0, y: 0, scale: 1, rotation: 0 };
  let homography = null;
  if (perspective.enabled && side !== reference && perspectiveStatus().valid) {
    const sourcePoints = perspective[side].map(point => applySimple(point, simple));
    homography = calculateHomography(sourcePoints, perspective[reference]);
  }
  const project = point => {
    const transformed = applySimple(point, simple);
    const destination = homography ? projectPoint(homography, transformed) : transformed;
    return mapper(destination);
  };
  const gridSize = homography ? Math.max(8, Math.min(32, Number(perspective.gridSize) || 20)) : 1;
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const normalized = [
        { x: column / gridSize, y: row / gridSize },
        { x: (column + 1) / gridSize, y: row / gridSize },
        { x: (column + 1) / gridSize, y: (row + 1) / gridSize },
        { x: column / gridSize, y: (row + 1) / gridSize },
      ];
      const source = normalized.map(point => ({ x: point.x * image.width, y: point.y * image.height }));
      const destination = normalized.map(project);
      drawImageTriangle(context, image, [source[0], source[1], source[2]], [destination[0], destination[1], destination[2]]);
      drawImageTriangle(context, image, [source[0], source[2], source[3]], [destination[0], destination[2], destination[3]]);
    }
  }
  if (withMasks) applyMasks(context, canvas, side, mapper);
  const curtain = frame ? applyDesktopCurtain(context, canvas, frame) : { configured: 0, effective: 0, automatic: false };
  const hasInvalidArea = canvasHasTransparentPixels(canvas);
  return { canvas, hasInvalidArea, mapper, curtain };
}

async function getAlignedPreviewCanvas(side, withMasks = true) {
  const key = `${processingRevision}:${activePair.id}:${side}:${withMasks}`;
  if (alignedCanvasCache.has(key)) return alignedCanvasCache.get(key);
  const promise = (async () => {
    const reference = currentEditorState().alignment.reference || 'after';
    const referenceImage = await getBitmap(activePair.source[reference]);
    const width = 694;
    const height = Math.max(1, Math.round(width * referenceImage.height / referenceImage.width));
    return renderProcessedSide(side, width, height, { withMasks });
  })();
  alignedCanvasCache.set(key, promise);
  return promise;
}

function applyBackground(element, image, frame) {
  const rect = element.parentElement.parentElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const zoom = Math.max(0.7, Math.min(1.6, Number(frame.zoom) || 1));
  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight) * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = Math.max(0, Math.min(100, Number(frame.x) || 50));
  const y = Math.max(0, Math.min(100, Number(frame.y) || 50));
  element.style.backgroundImage = `url("${image.src}")`;
  element.style.backgroundSize = `${width}px ${height}px`;
  element.style.backgroundPosition = `${-((width - rect.width) * x / 100)}px ${-((height - rect.height) * y / 100)}px`;
}

async function paintPreview(container, device) {
  const pairId = activePair.id;
  const revision = processingRevision;
  const frame = currentFrame(device);
  const afterLayer = container.querySelector('.preview-side.after');
  const divider = container.querySelector('.divider');
  const slider = sliderPositions[device];
  afterLayer.style.clipPath = `inset(0 0 0 ${slider}%)`;
  divider.style.left = `${slider}%`;
  container.querySelector('[data-preview-title]').textContent = activePair.displayTitle || '';

  const rect = container.getBoundingClientRect();
  const ratio = Math.min(1.5, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  const invalidSides = [];
  const curtainResults = [];
  await Promise.all(['before', 'after'].map(async side => {
    const target = container.querySelector(`[data-preview-image="${side}"]`);
    try {
      const rendered = await renderProcessedSide(side, width, height, { frame, withMasks: true });
      if (activePair.id !== pairId || processingRevision !== revision) return;
      target.width = width;
      target.height = height;
      target.getContext('2d').drawImage(rendered.canvas, 0, 0);
      if (rendered.hasInvalidArea) invalidSides.push(side);
      curtainResults.push(rendered.curtain);
    } catch (error) {
      showPairWarnings([error.message]);
    }
  }));
  if (activePair.id === pairId && processingRevision === revision) {
    container.classList.toggle('has-invalid', invalidSides.length > 0);
    container.dataset.invalidSides = invalidSides.join(',');
    if (device === 'desktop') {
      const configured = Number(frame.curtain) || 0;
      const effective = Math.max(configured, ...curtainResults.map(result => Number(result?.effective) || 0));
      if (!configured) {
        elements.desktopCurtainStatus.textContent = 'Seitenrahmen ist nicht aktiv. Seitliche Leerflächen müssen durch Ausschnitt oder Ausrichtung ausgeschlossen werden.';
      } else if (invalidSides.length) {
        elements.desktopCurtainStatus.textContent = `Fehler im Desktop-Rahmen: Auch bei ${effective.toFixed(1)}% je Seite bleibt eine Leerfläche sichtbar. Lösung: Bildgrösse erhöhen oder Perspektivpunkte korrigieren.`;
      } else if (effective > configured + 0.01) {
        elements.desktopCurtainStatus.textContent = `Seitenrahmen automatisch von ${configured.toFixed(0)}% auf ${effective.toFixed(1)}% je Seite erweitert, damit keine seitliche Leerfläche sichtbar bleibt.`;
      } else {
        elements.desktopCurtainStatus.textContent = `Seitenrahmen: ${configured.toFixed(0)}% je Seite; beide Ränder sind vollständig abgedeckt.`;
      }
      elements.desktopCurtainStatus.classList.toggle('is-error', invalidSides.length > 0);
    }
  }
}

function controlMarkup(device, key, label, min, max, step) {
  const value = currentFrame(device)[key] ?? 0;
  const shown = key === 'zoom' ? Number(value).toFixed(2) : Math.round(value);
  return `<div class="control"><span><b>${label}</b><output>${shown}${key === 'zoom' ? '×' : '%'}</output></span><div class="control-row"><button type="button" data-adjust="-1" data-device="${device}" data-key="${key}" aria-label="${label} verkleinern">−</button><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-device="${device}" data-key="${key}"><button type="button" data-adjust="1" data-device="${device}" data-key="${key}" aria-label="${label} vergrössern">+</button></div></div>`;
}

function renderControls(device) {
  const controls = [
    controlMarkup(device, 'x', 'Horizontal', 0, 100, 1),
    controlMarkup(device, 'y', 'Vertikal', 0, 100, 1),
    controlMarkup(device, 'zoom', 'Bildgrösse', 0.7, 1.6, 0.05),
  ];
  if (device === 'desktop') controls.push(controlMarkup(device, 'curtain', 'Seitenrahmen', 0, 49, 1));
  elements[`${device}Controls`].innerHTML = controls.join('');
}

function renderPreviews() {
  paintPreview(elements.desktopPreview, 'desktop');
  paintPreview(elements.mobilePreview, 'mobile');
  renderControls('desktop');
  renderControls('mobile');
  document.querySelectorAll('[data-side]').forEach(button => button.classList.toggle('is-active', button.dataset.side === activeSide));
}

function drawImageContain(context, image, boxX, boxY, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = boxX + (boxWidth - width) / 2;
  const y = boxY + (boxHeight - height) / 2;
  context.drawImage(image, x, y, width, height);
  return { x, y, width, height };
}

async function paintOrientationCanvas() {
  const pairId = activePair.id;
  try {
    const [before, after] = await Promise.all([getBitmap(activePair.source.before), getBitmap(activePair.source.after)]);
    if (activePair.id !== pairId) return;
    const canvas = elements.orientationCanvas;
    canvas.width = 1000;
    canvas.height = 660;
    const context = canvas.getContext('2d');
    context.fillStyle = '#c8ccd0';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawImageContain(context, before, 10, 40, 480, 600);
    drawImageContain(context, after, 510, 40, 480, 600);
    context.fillStyle = '#1e2428';
    context.font = '600 20px Segoe UI, sans-serif';
    context.fillText('Vorher', 20, 28);
    context.fillText('Nachher', 520, 28);
    const orientation = currentEditorState().sourceOrientation;
    elements.orientationInfo.textContent = orientation
      ? `EXIF Vorher ${orientation.before.exifOrientation}, Nachher ${orientation.after.exifOrientation}. Browsernormalisiert erwartet: ${orientation.before.orientedWidth} × ${orientation.before.orientedHeight} Pixel.`
      : `Browserdekodierung: Vorher ${before.width} × ${before.height}, Nachher ${after.width} × ${after.height} Pixel.`;
    const expected = orientation?.before;
    const orientationValid = !expected || (before.width === expected.orientedWidth && before.height === expected.orientedHeight && after.width === orientation.after.orientedWidth && after.height === orientation.after.orientedHeight);
    elements.orientationStatus.textContent = orientationValid
      ? `Orientierung korrekt dekodiert: Vorher ${before.width} × ${before.height}, Nachher ${after.width} × ${after.height}.`
      : `Fehler in der Orientierung: Browserdekodierung (${before.width} × ${before.height}) weicht von der erwarteten EXIF-Normalisierung ab. Lösung: Bildquelle ausserhalb des Editors korrekt drehen und als neue Arbeitskopie einlesen.`;
    elements.orientationStatus.classList.toggle('is-error', !orientationValid);
  } catch (error) {
    elements.orientationStatus.textContent = actionableError(error.message);
    elements.orientationStatus.classList.add('is-error');
  }
}

function simpleControlMarkup(key, label, min, max, step, unit) {
  const reference = currentEditorState().alignment.reference;
  const target = reference === 'after' ? 'before' : 'after';
  const value = currentEditorState().alignment.simple[target][key];
  return `<label class="simple-control"><span>${label}</span><button type="button" data-simple-adjust="-1" data-simple-key="${key}" aria-label="${label} verkleinern">−</button><input type="range" data-simple-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"><button type="button" data-simple-adjust="1" data-simple-key="${key}" aria-label="${label} vergrössern">+</button><output>${Number(value).toFixed(key === 'scale' ? 2 : 1)}${unit}</output></label>`;
}

function renderSimpleControls() {
  const reference = currentEditorState().alignment.reference;
  const target = reference === 'after' ? 'before' : 'after';
  elements.simpleTargetLabel.textContent = target === 'before' ? 'Vorher' : 'Nachher';
  elements.simpleControls.innerHTML = [
    simpleControlMarkup('x', 'Horizontal', -25, 25, 0.1, '%'),
    simpleControlMarkup('y', 'Vertikal', -25, 25, 0.1, '%'),
    simpleControlMarkup('scale', 'Skalierung', 0.75, 1.35, 0.005, '×'),
    simpleControlMarkup('rotation', 'Drehung', -15, 15, 0.1, '°'),
  ].join('');
}

async function paintPointCanvas() {
  const pairId = activePair.id;
  const side = elements.pointSide.value;
  try {
    const image = await getBitmap(activePair.source[side]);
    if (activePair.id !== pairId || elements.pointSide.value !== side) return;
    const canvas = elements.pointCanvas;
    canvas.width = 694;
    canvas.height = Math.max(1, Math.round(canvas.width * image.height / image.width));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const points = currentEditorState().alignment.perspective[side];
    const labels = ['OL', 'OR', 'UR', 'UL'];
    points.forEach((point, index) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      context.beginPath();
      context.arc(x, y, index === selectedPointIndex ? 13 : 10, 0, Math.PI * 2);
      context.fillStyle = index === selectedPointIndex ? '#0f46d4' : '#ffffff';
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = index === selectedPointIndex ? '#ffffff' : '#0f46d4';
      context.stroke();
      context.fillStyle = index === selectedPointIndex ? '#ffffff' : '#0f46d4';
      context.font = '700 10px Segoe UI, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(labels[index], x, y);
    });
    const status = perspectiveStatus();
    elements.pointStatus.textContent = `${status.message} Aktiver Punkt: ${labels[selectedPointIndex]}.`;
    elements.pointStatus.classList.toggle('is-error', !status.valid);
  } catch (error) {
    elements.pointStatus.textContent = actionableError(error.message);
    elements.pointStatus.classList.add('is-error');
  }
}

async function paintComparisonCanvas() {
  const pairId = activePair.id;
  const revision = processingRevision;
  try {
    const [before, after] = await Promise.all([getAlignedPreviewCanvas('before', false), getAlignedPreviewCanvas('after', false)]);
    if (activePair.id !== pairId || processingRevision !== revision) return;
    const canvas = elements.comparisonCanvas;
    canvas.width = before.canvas.width;
    canvas.height = before.canvas.height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    const slider = Number(elements.comparisonSlider.value) / 100;
    const opacity = Number(elements.overlayOpacity.value) / 100;
    if (comparisonMode === 'before' || (comparisonMode === 'blink' && !blinkPhase)) {
      context.drawImage(before.canvas, 0, 0);
    } else if (comparisonMode === 'after' || (comparisonMode === 'blink' && blinkPhase)) {
      context.drawImage(after.canvas, 0, 0);
    } else if (comparisonMode === 'overlay') {
      context.drawImage(before.canvas, 0, 0);
      context.globalAlpha = opacity;
      context.drawImage(after.canvas, 0, 0);
      context.globalAlpha = 1;
    } else {
      context.drawImage(before.canvas, 0, 0);
      context.save();
      context.beginPath();
      context.rect(canvas.width * slider, 0, canvas.width * (1 - slider), canvas.height);
      context.clip();
      context.drawImage(after.canvas, 0, 0);
      context.restore();
      context.fillStyle = '#ffffff';
      context.fillRect(canvas.width * slider - 1, 0, 2, canvas.height);
    }
    const invalid = before.hasInvalidArea || after.hasInvalidArea;
    elements.comparisonStatus.textContent = invalid
      ? 'Schachbrettflächen markieren Bereiche ohne gültige Bildinformation. Der endgültige Ausschnitt muss sie vollständig ausschliessen.'
      : 'Beide ausgerichteten Aufnahmen decken den dargestellten Arbeitsbereich vollständig ab.';
    elements.comparisonStatus.classList.toggle('is-error', invalid);
  } catch (error) {
    elements.comparisonStatus.textContent = error.message;
    elements.comparisonStatus.classList.add('is-error');
  }
}

function stopBlinking() {
  clearInterval(blinkTimer);
  blinkTimer = null;
}

function updateBlinking() {
  stopBlinking();
  if (comparisonMode !== 'blink') return;
  blinkTimer = setInterval(() => {
    blinkPhase = !blinkPhase;
    paintComparisonCanvas();
  }, 550);
}

function getSelectedMask() {
  return (currentEditorState().anonymization?.masks || []).find(mask => mask.id === selectedMaskId) || null;
}

function maskDescription(mask) {
  const type = { pixelate: 'Verpixeln', cover: 'Abdecken', blur: 'Stark weichzeichnen' }[mask.type] || mask.type;
  const scope = { both: 'Beide', before: 'Vorher', after: 'Nachher' }[mask.scope] || mask.scope;
  return `${type} · ${scope}`;
}

function renderMaskList() {
  const masks = currentEditorState().anonymization?.masks || [];
  if (!selectedMaskId && masks.length) selectedMaskId = masks[0].id;
  elements.maskList.replaceChildren();
  masks.forEach(mask => {
    const item = document.createElement('div');
    item.className = `mask-item${mask.id === selectedMaskId ? ' is-active' : ''}`;
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = mask.label || 'Maske';
    const detail = document.createElement('small');
    detail.textContent = maskDescription(mask);
    text.append(title, detail);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Entfernen';
    remove.addEventListener('click', event => {
      event.stopPropagation();
      const index = masks.findIndex(candidate => candidate.id === mask.id);
      masks.splice(index, 1);
      selectedMaskId = masks[0]?.id || null;
      markMasksChanged();
      renderMaskList();
      syncMaskForm();
      renderMaskCanvas();
      elements.maskStatus.textContent = masks.length
        ? 'Maske absichtlich entfernt. Verbleibende Masken prüfen und die Anonymisierungsprüfung erneut bestätigen.'
        : 'Alle Masken wurden absichtlich entfernt. Das ist zulässig; bitte den bewussten Verzicht im Ergebnis prüfen und danach bestätigen.';
    });
    item.append(text, remove);
    item.addEventListener('click', () => {
      selectedMaskId = mask.id;
      renderMaskList();
      syncMaskForm();
      renderMaskCanvas();
    });
    elements.maskList.append(item);
  });
}

function syncMaskForm() {
  const mask = getSelectedMask();
  if (!mask) {
    elements.maskType.value = 'pixelate';
    elements.maskScope.value = 'both';
    elements.maskLabel.value = 'Neue Maske';
    elements.maskColor.value = '#687275';
    elements.maskPixelSize.value = 24;
    elements.maskBlurRadius.value = 28;
    return;
  }
  elements.maskType.value = mask.type;
  elements.maskScope.value = mask.scope;
  elements.maskLabel.value = mask.label || 'Maske';
  elements.maskColor.value = mask.color || '#687275';
  elements.maskPixelSize.value = mask.pixelSize || 24;
  elements.maskBlurRadius.value = mask.blurRadius || 28;
}

function updateSelectedMaskFromForm() {
  const mask = getSelectedMask();
  if (!mask) return;
  mask.type = elements.maskType.value;
  mask.scope = elements.maskScope.value;
  mask.label = elements.maskLabel.value.trim() || 'Maske';
  mask.color = elements.maskColor.value;
  mask.pixelSize = Number(elements.maskPixelSize.value) || 24;
  mask.blurRadius = Number(elements.maskBlurRadius.value) || 28;
  invalidateProcessing();
  renderMaskList();
  renderMaskCanvas();
}

async function renderMaskCanvas() {
  const pairId = activePair.id;
  const revision = processingRevision;
  const side = elements.maskPreviewSide.value;
  try {
    const rendered = await getAlignedPreviewCanvas(side, true);
    if (activePair.id !== pairId || processingRevision !== revision || elements.maskPreviewSide.value !== side) return;
    const canvas = elements.maskCanvas;
    canvas.width = rendered.canvas.width;
    canvas.height = rendered.canvas.height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(rendered.canvas, 0, 0);
    const masks = currentEditorState().anonymization?.masks || [];
    masks.forEach(mask => {
      const x = mask.x * canvas.width;
      const y = mask.y * canvas.height;
      const width = mask.width * canvas.width;
      const height = mask.height * canvas.height;
      context.strokeStyle = mask.id === selectedMaskId ? '#0f46d4' : '#ffffff';
      context.lineWidth = mask.id === selectedMaskId ? 4 : 2;
      context.setLineDash(maskApplies(mask, side) ? [] : [8, 6]);
      context.strokeRect(x, y, width, height);
      if (mask.id === selectedMaskId) {
        context.fillStyle = '#0f46d4';
        context.fillRect(x + width - 9, y + height - 9, 18, 18);
      }
    });
    context.setLineDash([]);
    elements.maskStatus.classList.remove('is-error');
  } catch (error) {
    elements.maskStatus.textContent = actionableError(error.message);
    elements.maskStatus.classList.add('is-error');
  }
}

function workflowState() {
  currentEditorState().workflow ||= defaultEditorState(false).workflow;
  return currentEditorState().workflow;
}

function syncWorkflowControls() {
  const workflow = workflowState();
  elements.orientationChecked.checked = Boolean(workflow.orientationChecked);
  elements.alignmentChecked.checked = Boolean(workflow.alignmentChecked);
  elements.anonymizationChecked.checked = Boolean(workflow.anonymizationChecked);
  elements.desktopCropChecked.checked = Boolean(workflow.desktopCropChecked);
  elements.mobileCropChecked.checked = Boolean(workflow.mobileCropChecked);
  elements.exportPreviewChecked.checked = Boolean(workflow.exportPreviewChecked);
  [elements.orientationChecked, elements.alignmentChecked, elements.anonymizationChecked, elements.desktopCropChecked, elements.mobileCropChecked, elements.exportPreviewChecked]
    .forEach(input => input.closest('.checkline')?.classList.toggle('is-complete', input.checked));
}

function updateStepNav() {
  const workflow = workflowState();
  const completion = {
    stepOrientation: workflow.orientationChecked,
    stepAlignment: perspectiveStatus().valid,
    stepComparison: workflow.alignmentChecked,
    stepAnonymization: workflow.anonymizationChecked,
    stepCrop: workflow.desktopCropChecked && workflow.mobileCropChecked,
    stepExport: workflow.exportPreviewChecked,
  };
  elements.stepNav.querySelectorAll('[data-step-target]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.stepTarget === activeStepId);
    button.classList.toggle('is-complete', Boolean(completion[button.dataset.stepTarget]));
  });
  document.querySelectorAll('[data-workflow-step]').forEach(section => section.classList.toggle('is-active', section.id === activeStepId));
}

function setActiveStep(stepId, scroll = false) {
  activeStepId = stepId;
  updateStepNav();
  if (scroll) document.getElementById(stepId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAdvancedEditor() {
  const state = currentEditorState();
  elements.referenceSide.value = state.alignment.reference;
  elements.perspectiveEnabled.checked = Boolean(state.alignment.perspective.enabled);
  renderSimpleControls();
  syncWorkflowControls();
  renderMaskList();
  syncMaskForm();
  paintOrientationCanvas();
  paintPointCanvas();
  paintComparisonCanvas();
  renderMaskCanvas();
  updateStepNav();
}

function renderFields() {
  elements.pairId.value = activePair.id;
  elements.component.value = activePair.component || '';
  elements.group.value = activePair.group || '';
  elements.displayTitle.value = activePair.displayTitle || '';
  elements.beforeAlt.value = activePair.alt?.before || '';
  elements.afterAlt.value = activePair.alt?.after || '';
  elements.publicApproved.checked = Boolean(activePair.publicApproved);
  elements.heroEligible.checked = Boolean(activePair.heroEligible);
  elements.heroActive.checked = Boolean(activePair.heroActive);
  elements.heroEligible.disabled = !activePair.publicApproved;
  elements.heroActive.disabled = !activePair.heroEligible || !activePair.publicApproved;
  elements.heroOrder.value = Number.isFinite(activePair.heroOrder) ? activePair.heroOrder : '';
  elements.heroOrder.disabled = !activePair.heroActive;
  inspectPair();
  renderPreviews();
  renderAdvancedEditor();
}

function showPairWarnings(messages) {
  const unique = [...new Set(messages.filter(Boolean))];
  elements.pairWarning.textContent = unique.join(' ');
  elements.pairWarning.classList.toggle('is-error', unique.some(message => /fehlt|nicht gefunden|darf nicht|unvollständig/i.test(message)));
}

async function inspectPair() {
  const inspectedPair = activePair;
  const warnings = [];
  if (inspectedPair.id === 'reco-107') warnings.push('Reco 107 weist nicht deckungsgleiche Aufnahmen und eine missverständliche Glaswirkung auf. Vor einer möglichen Freigabe bitte besonders sorgfältig visuell prüfen.');
  if (inspectedPair.id === 'orig-001') warnings.push('Orig 001 ist ein interner Pilot für Ausrichtung und Anonymisierung. Eine öffentliche Freigabe ist möglich, erfolgt aber nur bewusst über die drei Freigabestufen.');
  if (!inspectedPair.publicApproved) warnings.push('Dieses Paar ist nicht öffentlich freigegeben. Es kann im Editor bearbeitet werden, erscheint aber nicht in der öffentlichen Rotation.');

  try {
    const [before, after] = await Promise.all([getImage(inspectedPair.source?.before), getImage(inspectedPair.source?.after)]);
    const sameOrientation = (before.naturalWidth >= before.naturalHeight) === (after.naturalWidth >= after.naturalHeight);
    const beforeRatio = before.naturalWidth / before.naturalHeight;
    const afterRatio = after.naturalWidth / after.naturalHeight;
    if (!sameOrientation || Math.abs(beforeRatio - afterRatio) > 0.03) {
      warnings.push(`Achtung: Ausgangsbilder sind geometrisch nicht deckungsgleich (${before.naturalWidth}×${before.naturalHeight} / ${after.naturalWidth}×${after.naturalHeight}). Der Workflow verwendet trotzdem identische Crop-Werte und kaschiert die Abweichung nicht.`);
    }
  } catch (error) {
    warnings.push(error.message);
  }
  if (activePair === inspectedPair) showPairWarnings(warnings);
}

function syncFieldsToPair() {
  activePair.component = elements.component.value.trim();
  activePair.group = elements.group.value;
  activePair.displayTitle = elements.displayTitle.value.trim();
  activePair.alt ||= {};
  activePair.alt.before = elements.beforeAlt.value.trim();
  activePair.alt.after = elements.afterAlt.value.trim();
  activePair.publicApproved = elements.publicApproved.checked;
  activePair.heroEligible = elements.heroEligible.checked;
  activePair.heroActive = elements.heroActive.checked;
  if (!activePair.publicApproved) activePair.heroEligible = false;
  activePair.heroOrder = elements.heroOrder.value === '' ? null : Number(elements.heroOrder.value);
  if (!activePair.heroEligible) activePair.heroActive = false;
  if (!activePair.heroActive) activePair.heroOrder = activePair.heroOrder ?? null;
  renderFields();
}

function bindCropDrag(container, device) {
  let previous = null;
  container.addEventListener('pointerdown', event => {
    if (event.target.closest('.handle')) return;
    previous = { x: event.clientX, y: event.clientY };
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener('pointermove', event => {
    if (!previous) return;
    const rect = container.getBoundingClientRect();
    const frame = currentFrame(device);
    frame.x = Math.max(0, Math.min(100, frame.x - ((event.clientX - previous.x) / Math.max(1, rect.width)) * 100));
    frame.y = Math.max(0, Math.min(100, frame.y - ((event.clientY - previous.y) / Math.max(1, rect.height)) * 100));
    if (isEnhancedPair()) {
      workflowState()[`${device}CropChecked`] = false;
      workflowState().exportPreviewChecked = false;
      syncWorkflowControls();
      updateStepNav();
    }
    previous = { x: event.clientX, y: event.clientY };
    renderPreviews();
  });
  const stop = () => { previous = null; };
  container.addEventListener('pointerup', stop);
  container.addEventListener('pointercancel', stop);
}

function bindSlider(container, device) {
  const handle = container.querySelector('.handle');
  let sliding = false;
  const update = event => {
    const rect = container.getBoundingClientRect();
    sliderPositions[device] = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
    paintPreview(container, device);
  };
  handle.addEventListener('pointerdown', event => {
    event.stopPropagation();
    sliding = true;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!sliding) return;
    event.stopPropagation();
    update(event);
  });
  handle.addEventListener('pointerup', () => { sliding = false; });
  handle.addEventListener('pointercancel', () => { sliding = false; });
}

function validateConfig() {
  const errors = [];
  const validGroups = new Set(config.groups.map(group => group.id));
  const ids = new Set();
  const orders = new Map();

  config.pairs.forEach(pair => {
    if (!pair.id || ids.has(pair.id)) errors.push(`Doppelte oder fehlende ID: ${pair.id || '(leer)'}.`);
    ids.add(pair.id);
    if (!validGroups.has(pair.group)) errors.push(`${pair.id}: unzulässige Gruppe.`);
    if (!pair.component || !pair.displayTitle || !pair.alt?.before || !pair.alt?.after) errors.push(`${pair.id}: sichtbare Bildangaben sind unvollständig.`);
    if (!pair.source?.before || !pair.source?.after) errors.push(`${pair.id}: Ausgangspaar ist unvollständig.`);
    if (pair.heroActive) {
      if (!pair.publicApproved || !pair.heroEligible) errors.push(`${pair.id}: aktiv, aber nicht freigegeben oder nicht Hero-geeignet.`);
      if (!Number.isInteger(pair.heroOrder) || pair.heroOrder < 1) errors.push(`${pair.id}: Hero-Reihenfolge muss eine positive ganze Zahl sein.`);
      if (orders.has(pair.heroOrder)) errors.push(`${pair.id} und ${orders.get(pair.heroOrder)}: doppelte Hero-Reihenfolge ${pair.heroOrder}.`);
      orders.set(pair.heroOrder, pair.id);
    }
  });
  return errors;
}

async function validateReferencedFiles(selectedWillBeGenerated) {
  const errors = [];
  const checks = [];
  config.pairs.forEach(pair => {
    ['before', 'after'].forEach(side => {
      checks.push(getImage(pair.source?.[side]).catch(() => errors.push(`${pair.id}: Ausgangsbild ${side === 'before' ? 'Vorher' : 'Nachher'} fehlt (${pair.source?.[side] || 'kein Pfad'}).`)));
    });
    if (!pair.heroActive || (selectedWillBeGenerated && pair.id === activePair.id)) return;
    ['desktop', 'mobile'].forEach(device => ['before', 'after'].forEach(side => {
      const path = pair.generated?.[device]?.[side];
      checks.push(getImage(path).catch(() => errors.push(`${pair.id}: aktive ${device}-${side}-Datei fehlt (${path || 'kein Pfad'}).`)));
    }));
  });
  await Promise.all(checks);
  return errors;
}

function configText() {
  config.updatedAt = new Date().toISOString().slice(0, 10);
  return `/* RECOLORO – zentrale Bildkonfiguration für Website und internen Bildworkflow. */\n'use strict';\n\nwindow.RECOLORO_IMAGE_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
}

function editorConfigText() {
  editorConfig.updatedAt = new Date().toISOString().slice(0, 10);
  return `/* RECOLORO – interne, nicht öffentlich auszuliefernde Editor-Konfiguration. */\n'use strict';\n\nwindow.RECOLORO_IMAGE_EDITOR_CONFIG = ${JSON.stringify(editorConfig, null, 2)};\n`;
}

function outputNames(pair) {
  return {
    desktop: {
      before: `assets/images/bildpaare/${pair.id}-hero-desktop-vor.webp`,
      after: `assets/images/bildpaare/${pair.id}-hero-desktop-nach.webp`,
    },
    mobile: {
      before: `assets/images/bildpaare/${pair.id}-hero-mobile-vor.webp`,
      after: `assets/images/bildpaare/${pair.id}-hero-mobile-nach.webp`,
    },
  };
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('WebP-Ausgabe wird von diesem Browser nicht unterstützt.')), 'image/webp', quality));
}

function validatePilotWorkflow() {
  if (!isEnhancedPair()) return [];
  const workflow = workflowState();
  const labels = {
    orientationChecked: 'Orientierung',
    alignmentChecked: 'Ausrichtungsvergleich',
    anonymizationChecked: 'Anonymisierung',
    desktopCropChecked: 'Desktop-Ausschnitt',
    mobileCropChecked: 'Mobil-Ausschnitt',
    exportPreviewChecked: '100%-Exportvorschau',
  };
  const errors = Object.entries(labels)
    .filter(([key]) => !workflow[key])
    .map(([, label]) => `Fehler in der Prüfliste: ${label} ist noch nicht bestätigt. Lösung: Den zugehörigen Arbeitsschritt öffnen, Ergebnis prüfen und das Kontrollfeld markieren.`);
  const perspective = perspectiveStatus();
  if (!perspective.valid) errors.push(`Fehler in der Ausrichtung: ${perspective.message} Lösung: Die vier Punkte je Bild in der Reihenfolge oben links, oben rechts, unten rechts, unten links neu setzen.`);
  return errors;
}

async function generateSelectedPair() {
  if (!activePair.heroEligible && !isEnhancedPair()) return [];
  const workflowErrors = validatePilotWorkflow();
  if (workflowErrors.length) throw new Error(workflowErrors.join(' '));
  const defaults = config.heroDefaults;
  const names = outputNames(activePair);
  const results = [];

  for (const device of ['desktop', 'mobile']) {
    const size = defaults[device];
    for (const side of ['before', 'after']) {
      const rendered = await renderProcessedSide(side, size.width, size.height, { frame: currentFrame(device), withMasks: true });
      if (isEnhancedPair() && rendered.hasInvalidArea) {
        throw new Error(`Fehler in ${device === 'desktop' ? 'Desktop' : 'Mobil'} / ${side === 'before' ? 'Vorher' : 'Nachher'}: Ein sichtbarer Bereich enthält keine gültige Bildinformation. Lösung: ${device === 'desktop' ? 'Seitenrahmen vergrössern oder ' : ''}Bildgrösse, Ausschnitt beziehungsweise Perspektivpunkte anpassen und erneut prüfen.`);
      }
      const blob = await canvasBlob(rendered.canvas, defaults.quality);
      results.push({ device, side, path: names[device][side], blob, width: size.width, height: size.height });
    }
  }
  activePair.generated = names;
  return results;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('recoloro-hero-workflow', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeRootHandle(handle) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const request = db.transaction('handles', 'readwrite').objectStore('handles').put(handle, 'websiteRoot');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function restoreRootHandle() {
  try {
    const db = await openDatabase();
    const handle = await new Promise((resolve, reject) => {
      const request = db.transaction('handles').objectStore('handles').get('websiteRoot');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (handle && await handle.queryPermission({ mode: 'readwrite' }) === 'granted') {
      await verifyWebsiteRoot(handle);
      websiteRoot = handle;
      setRootStatus(`Verbunden: ${handle.name}`, 'ok');
    }
  } catch (error) {
    setRootStatus('Gespeicherte Ordnerfreigabe muss neu bestätigt werden');
  }
}

async function verifyWebsiteRoot(handle) {
  await handle.getFileHandle('index.html');
  await handle.getFileHandle('script.js');
  await handle.getFileHandle('image-config.js');
  await handle.getFileHandle('image-editor-config.js');
  const assets = await handle.getDirectoryHandle('assets');
  const images = await assets.getDirectoryHandle('images');
  await images.getDirectoryHandle('bildpaare');
}

async function chooseWebsiteRoot() {
  if (!window.showDirectoryPicker) {
    setRootStatus('Ordnerzugriff nicht unterstützt – Download-Fallback verwenden', 'error');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ id: 'recoloro-website-root', mode: 'readwrite' });
    await verifyWebsiteRoot(handle);
    websiteRoot = handle;
    await storeRootHandle(handle);
    setRootStatus(`Verbunden: ${handle.name}`, 'ok');
    setStatus('Website-Ordner geprüft. Die lokale Übernahme ist bereit.', 'ok');
  } catch (error) {
    if (error.name !== 'AbortError') setStatus(`Ordner konnte nicht verwendet werden: ${error.message}`, 'error');
  }
}

async function writePath(root, path, contents) {
  const parts = path.split('/');
  const fileName = parts.pop();
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  const file = await directory.getFileHandle(fileName, { create: true });
  const writer = await file.createWritable();
  await writer.write(contents);
  await writer.close();
}

function download(name, contents) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: 'text/javascript;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function detectLocalSaveApi(silent = false) {
  try {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) throw new Error('Kein lokaler Ursprung');
    const response = await fetch('/__recoloro/health', { cache: 'no-store' });
    const result = response.ok ? await response.json() : null;
    localSaveAvailable = Boolean(result?.ok && result?.directSave);
  } catch (error) {
    localSaveAvailable = false;
  }
  elements.chooseRoot.hidden = localSaveAvailable;
  elements.downloadFallback.hidden = localSaveAvailable;
  if (!silent) {
    setRootStatus(
      localSaveAvailable
        ? 'Direkte lokale Speicherung bereit · Hauptknopf schreibt ohne Downloads in die Website'
        : 'Direkte Speicherung nicht erreichbar – Ordnerfreigabe oder Download-Fallback verwenden',
      localSaveAvailable ? 'ok' : 'error',
    );
  }
  return localSaveAvailable;
}

async function blobBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function saveViaLocalApi(prepared) {
  const imageFiles = await Promise.all(prepared.images.map(async file => ({
    path: file.path,
    encoding: 'base64',
    content: await blobBase64(file.blob),
  })));
  const files = [
    ...imageFiles,
    { path: 'image-editor-config.js', encoding: 'utf8', content: prepared.editorConfiguration },
    { path: 'image-config.js', encoding: 'utf8', content: prepared.configuration },
  ];
  const response = await fetch('/__recoloro/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `Lokaler Speicherdienst antwortet mit HTTP ${response.status}.`);
  }
  return result;
}

async function prepareFiles() {
  syncFieldsToPair();
  const errors = validateConfig();
  if (errors.length) throw new Error(errors.join(' '));
  const images = await generateSelectedPair();
  const fileErrors = await validateReferencedFiles(images.length > 0);
  if (fileErrors.length) throw new Error(fileErrors.join(' '));
  return { images, configuration: configText(), editorConfiguration: editorConfigText() };
}

async function saveAndApply() {
  if (working) return;
  setWorking(true);
  setStatus('WebP-Dateien werden erzeugt und geprüft …');
  try {
    const prepared = await prepareFiles();
    if (!localSaveAvailable) await detectLocalSaveApi(true);
    if (localSaveAvailable) {
      const result = await saveViaLocalApi(prepared);
      savedConfig = clone(config);
      savedEditorConfig = clone(editorConfig);
      setStatus(`Direkt gespeichert: ${result.saved.length} Dateien wurden in die richtigen Website-Pfade übernommen. Website neu laden und Hero-Reihenfolge prüfen.`, 'ok');
      return;
    }
    if (!websiteRoot) {
      throw new Error('Direkter lokaler Speicherdienst ist nicht erreichbar und es wurde kein Website-Ordner freigegeben. Downloads werden nicht automatisch erzeugt.');
    }
    if (await websiteRoot.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Schreibzugriff auf den Website-Ordner wurde nicht erteilt.');
    await verifyWebsiteRoot(websiteRoot);
    for (const file of prepared.images) await writePath(websiteRoot, file.path, file.blob);
    await writePath(websiteRoot, 'image-config.js', prepared.configuration);
    await writePath(websiteRoot, 'image-editor-config.js', prepared.editorConfiguration);
    savedConfig = clone(config);
    savedEditorConfig = clone(editorConfig);
    const imageSummary = prepared.images.length ? `${prepared.images.length} WebP-Dateien und ` : '';
    setStatus(`${imageSummary}image-config.js wurden übernommen. Website neu laden und prüfen.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Übernahme fehlgeschlagen.', 'error');
  } finally {
    setWorking(false);
  }
}

async function downloadFiles() {
  if (working) return;
  setWorking(true);
  try {
    const prepared = await prepareFiles();
    prepared.images.forEach(file => download(file.path.split('/').pop(), file.blob));
    download('image-config.js', prepared.configuration);
    download('image-editor-config.js', prepared.editorConfiguration);
    setStatus(`${prepared.images.length} WebP-Dateien sowie die öffentliche und interne Konfiguration wurden heruntergeladen.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Download fehlgeschlagen.', 'error');
  } finally {
    setWorking(false);
  }
}

function markTransformChanged() {
  const workflow = workflowState();
  workflow.alignmentChecked = false;
  workflow.desktopCropChecked = false;
  workflow.mobileCropChecked = false;
  workflow.exportPreviewChecked = false;
  invalidateProcessing();
  syncWorkflowControls();
  updateStepNav();
}

function markMasksChanged() {
  const workflow = workflowState();
  workflow.anonymizationChecked = false;
  workflow.exportPreviewChecked = false;
  invalidateProcessing();
  syncWorkflowControls();
  updateStepNav();
}

function repaintAdvancedResults(includePoints = false) {
  if (includePoints) paintPointCanvas();
  paintComparisonCanvas();
  renderMaskCanvas();
  renderPreviews();
}

async function refreshActualExportPreview() {
  const device = elements.exportDevice.value;
  const side = elements.exportSide.value;
  const size = config.heroDefaults[device];
  elements.exportPreviewStatus.textContent = `${size.width} × ${size.height} Pixel werden berechnet …`;
  try {
    const rendered = await renderProcessedSide(side, size.width, size.height, { frame: currentFrame(device), withMasks: true });
    const canvas = elements.exportPreviewCanvas;
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(rendered.canvas, 0, 0);
    canvas.dataset.valid = String(!rendered.hasInvalidArea);
    const location = `${device === 'desktop' ? 'Desktop' : 'Mobil'} / ${side === 'before' ? 'Vorher' : 'Nachher'}`;
    elements.exportPreviewStatus.textContent = rendered.hasInvalidArea
      ? `Fehler in ${location}: Im sichtbaren Ergebnis bleibt eine Fläche ohne Bildinformation. Lösung: ${device === 'desktop' ? 'Seitenrahmen vergrössern oder ' : ''}Bildgrösse, Ausschnitt beziehungsweise Perspektivpunkte anpassen und die Vorschau erneut aktualisieren.`
      : rendered.curtain?.automatic
        ? `${location}, ${size.width} × ${size.height} Pixel: gültig. Der Seitenrahmen wurde automatisch von ${rendered.curtain.configured.toFixed(0)}% auf ${rendered.curtain.effective.toFixed(1)}% je Seite erweitert, um die Randlücke vollständig abzudecken.`
        : `${location}, ${size.width} × ${size.height} Pixel bei 100 Prozent: gültig; keine sichtbaren Leerflächen erkannt.`;
    elements.exportPreviewStatus.classList.toggle('is-error', rendered.hasInvalidArea);
    elements.exportPreviewChecked.disabled = rendered.hasInvalidArea;
    if (rendered.hasInvalidArea) {
      workflowState().exportPreviewChecked = false;
      syncWorkflowControls();
      updateStepNav();
    }
    return rendered;
  } catch (error) {
    elements.exportPreviewStatus.textContent = error.message;
    elements.exportPreviewStatus.classList.add('is-error');
    elements.exportPreviewChecked.disabled = true;
    throw error;
  }
}

function canvasCoordinates(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
  };
}

function hitMask(point) {
  const masks = currentEditorState().anonymization?.masks || [];
  return [...masks].reverse().find(mask => point.x >= mask.x && point.x <= mask.x + mask.width && point.y >= mask.y && point.y <= mask.y + mask.height) || null;
}

async function sampleMaskColor(point) {
  const rendered = await getAlignedPreviewCanvas(elements.maskPreviewSide.value, false);
  const x = Math.min(rendered.canvas.width - 1, Math.max(0, Math.round(point.x * rendered.canvas.width)));
  const y = Math.min(rendered.canvas.height - 1, Math.max(0, Math.round(point.y * rendered.canvas.height)));
  const pixel = rendered.canvas.getContext('2d').getImageData(x, y, 1, 1).data;
  const hex = `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  elements.maskColor.value = hex;
  const mask = getSelectedMask();
  if (mask) {
    mask.color = hex;
    markMasksChanged();
    renderMaskCanvas();
  }
  pipetteEnabled = false;
  elements.sampleColor.classList.remove('is-active');
  elements.maskStatus.textContent = `Farbe ${hex} wurde aus dem ausgerichteten Original aufgenommen.`;
}

function bindMaskCanvas() {
  const canvas = elements.maskCanvas;
  canvas.addEventListener('pointerdown', async event => {
    const point = canvasCoordinates(canvas, event);
    if (pipetteEnabled) {
      await sampleMaskColor(point);
      return;
    }
    const masks = currentEditorState().anonymization.masks;
    if (maskDrawEnabled) {
      const mask = {
        id: `mask-${Date.now()}`,
        label: elements.maskLabel.value.trim() || 'Neue Maske',
        type: elements.maskType.value || 'pixelate',
        scope: elements.maskScope.value || 'both',
        x: point.x,
        y: point.y,
        width: 0.01,
        height: 0.01,
        color: elements.maskColor.value || '#687275',
        pixelSize: Number(elements.maskPixelSize.value) || 24,
        blurRadius: Number(elements.maskBlurRadius.value) || 28,
      };
      masks.push(mask);
      selectedMaskId = mask.id;
      maskInteraction = { mode: 'draw', start: point, mask };
      maskDrawEnabled = false;
      elements.newMask.classList.remove('is-active');
    } else {
      const mask = hitMask(point);
      if (!mask) return;
      selectedMaskId = mask.id;
      const nearHandle = Math.abs(point.x - (mask.x + mask.width)) < 0.035 && Math.abs(point.y - (mask.y + mask.height)) < 0.035;
      maskInteraction = { mode: nearHandle ? 'resize' : 'move', start: point, mask, original: clone(mask) };
    }
    canvas.setPointerCapture(event.pointerId);
    renderMaskList();
    syncMaskForm();
    renderMaskCanvas();
  });
  canvas.addEventListener('pointermove', event => {
    if (!maskInteraction) return;
    const point = canvasCoordinates(canvas, event);
    const { mask, start, mode, original } = maskInteraction;
    if (mode === 'draw') {
      mask.x = Math.min(start.x, point.x);
      mask.y = Math.min(start.y, point.y);
      mask.width = Math.max(0.01, Math.abs(point.x - start.x));
      mask.height = Math.max(0.01, Math.abs(point.y - start.y));
    } else if (mode === 'move') {
      mask.x = Math.max(0, Math.min(1 - mask.width, original.x + point.x - start.x));
      mask.y = Math.max(0, Math.min(1 - mask.height, original.y + point.y - start.y));
    } else {
      mask.width = Math.max(0.01, Math.min(1 - mask.x, original.width + point.x - start.x));
      mask.height = Math.max(0.01, Math.min(1 - mask.y, original.height + point.y - start.y));
    }
    invalidateProcessing();
    renderMaskCanvas();
  });
  const finish = () => {
    if (!maskInteraction) return;
    maskInteraction = null;
    markMasksChanged();
    renderMaskList();
    renderMaskCanvas();
    elements.maskStatus.textContent = 'Maske aktualisiert. Position durch Ziehen, Grösse am blauen Griff unten rechts ändern.';
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}

function initialise() {
  config.groups.forEach(group => elements.group.add(new Option(group.label, group.id)));
  config.pairs.forEach(pair => elements.pairSelect.add(new Option(`${pair.id.toUpperCase()} · ${pair.internalLabel}`, pair.id)));
  buildHeroPreview(elements.desktopPreview, 'desktop');
  buildHeroPreview(elements.mobilePreview, 'mobile');

  elements.pairSelect.addEventListener('change', () => {
    activePair = config.pairs.find(pair => pair.id === elements.pairSelect.value);
    activeSide = 'before';
    currentEditorState();
    selectedPointIndex = 0;
    selectedMaskId = currentEditorState().anonymization?.masks?.[0]?.id || null;
    elements.pointSide.value = 'before';
    sliderPositions.desktop = 50;
    sliderPositions.mobile = 50;
    invalidateProcessing();
    renderFields();
  });

  elements.stepNav.querySelectorAll('[data-step-target]').forEach(button => button.addEventListener('click', () => setActiveStep(button.dataset.stepTarget, true)));

  elements.referenceSide.addEventListener('change', () => {
    currentEditorState().alignment.reference = elements.referenceSide.value;
    markTransformChanged();
    renderSimpleControls();
    repaintAdvancedResults(true);
  });

  elements.simpleControls.addEventListener('input', event => {
    const input = event.target.closest('[data-simple-key]');
    if (!input) return;
    const reference = currentEditorState().alignment.reference;
    const target = reference === 'after' ? 'before' : 'after';
    currentEditorState().alignment.simple[target][input.dataset.simpleKey] = Number(input.value);
    input.nextElementSibling.textContent = `${Number(input.value).toFixed(input.dataset.simpleKey === 'scale' ? 2 : 1)}${input.dataset.simpleKey === 'scale' ? '×' : input.dataset.simpleKey === 'rotation' ? '°' : '%'}`;
    markTransformChanged();
    repaintAdvancedResults();
  });
  elements.simpleControls.addEventListener('click', event => {
    const button = event.target.closest('[data-simple-adjust]');
    if (!button) return;
    const range = button.parentElement.querySelector('input[type="range"]');
    const next = Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + Number(button.dataset.simpleAdjust) * Number(range.step)));
    range.value = String(Math.round(next * 1000) / 1000);
    range.dispatchEvent(new Event('input', { bubbles: true }));
  });

  elements.resetSimple.addEventListener('click', () => {
    const reference = currentEditorState().alignment.reference;
    const target = reference === 'after' ? 'before' : 'after';
    currentEditorState().alignment.simple[target] = { x: 0, y: 0, scale: 1, rotation: 0 };
    markTransformChanged();
    renderSimpleControls();
    repaintAdvancedResults();
  });

  elements.perspectiveEnabled.addEventListener('change', () => {
    currentEditorState().alignment.perspective.enabled = elements.perspectiveEnabled.checked;
    markTransformChanged();
    repaintAdvancedResults(true);
  });

  elements.pointSide.addEventListener('change', paintPointCanvas);
  document.querySelectorAll('[data-point-index]').forEach(button => button.addEventListener('click', () => {
    selectedPointIndex = Number(button.dataset.pointIndex);
    document.querySelectorAll('[data-point-index]').forEach(candidate => candidate.classList.toggle('is-active', candidate === button));
    paintPointCanvas();
  }));
  elements.pointCanvas.addEventListener('click', event => {
    const point = canvasCoordinates(elements.pointCanvas, event);
    currentEditorState().alignment.perspective[elements.pointSide.value][selectedPointIndex] = point;
    markTransformChanged();
    repaintAdvancedResults(true);
  });
  elements.resetPerspective.addEventListener('click', () => {
    const saved = savedEditorConfig.pairs?.[activePair.id]?.alignment?.perspective || defaultEditorState(activePair.id !== 'orig-001').alignment.perspective;
    currentEditorState().alignment.perspective = clone(saved);
    elements.perspectiveEnabled.checked = Boolean(currentEditorState().alignment.perspective.enabled);
    markTransformChanged();
    repaintAdvancedResults(true);
  });

  document.querySelectorAll('[data-compare-mode]').forEach(button => button.addEventListener('click', () => {
    comparisonMode = button.dataset.compareMode;
    document.querySelectorAll('[data-compare-mode]').forEach(candidate => candidate.classList.toggle('is-active', candidate === button));
    updateBlinking();
    paintComparisonCanvas();
  }));
  elements.comparisonSlider.addEventListener('input', () => {
    elements.comparisonSliderOutput.textContent = `${elements.comparisonSlider.value}%`;
    paintComparisonCanvas();
  });
  elements.overlayOpacity.addEventListener('input', () => {
    elements.overlayOpacityOutput.textContent = `${elements.overlayOpacity.value}%`;
    paintComparisonCanvas();
  });

  [elements.orientationChecked, elements.alignmentChecked, elements.anonymizationChecked, elements.desktopCropChecked, elements.mobileCropChecked, elements.exportPreviewChecked]
    .forEach(input => input.addEventListener('change', () => {
      workflowState()[input.id] = input.checked;
      syncWorkflowControls();
      updateStepNav();
    }));

  elements.maskPreviewSide.addEventListener('change', renderMaskCanvas);
  [elements.maskType, elements.maskScope, elements.maskLabel, elements.maskColor, elements.maskPixelSize, elements.maskBlurRadius]
    .forEach(input => input.addEventListener('change', () => {
      updateSelectedMaskFromForm();
      markMasksChanged();
    }));
  elements.newMask.addEventListener('click', () => {
    maskDrawEnabled = !maskDrawEnabled;
    pipetteEnabled = false;
    elements.newMask.classList.toggle('is-active', maskDrawEnabled);
    elements.sampleColor.classList.remove('is-active');
    elements.maskStatus.textContent = maskDrawEnabled ? 'Auf dem Bild von einer Ecke zur gegenüberliegenden Ecke ziehen.' : 'Neue Maske abgebrochen.';
  });
  elements.sampleColor.addEventListener('click', () => {
    pipetteEnabled = !pipetteEnabled;
    maskDrawEnabled = false;
    elements.sampleColor.classList.toggle('is-active', pipetteEnabled);
    elements.newMask.classList.remove('is-active');
    elements.maskStatus.textContent = pipetteEnabled ? 'Gewünschte Abdeckfarbe im Bild anklicken.' : 'Pipette deaktiviert.';
  });
  elements.resetMasks.addEventListener('click', () => {
    currentEditorState().anonymization.masks = clone(savedEditorConfig.pairs?.[activePair.id]?.anonymization?.masks || []);
    selectedMaskId = currentEditorState().anonymization.masks[0]?.id || null;
    markMasksChanged();
    renderMaskList();
    syncMaskForm();
    renderMaskCanvas();
  });
  bindMaskCanvas();

  elements.refreshExportPreview.addEventListener('click', refreshActualExportPreview);
  [elements.exportDevice, elements.exportSide].forEach(input => input.addEventListener('change', () => {
    workflowState().exportPreviewChecked = false;
    elements.exportPreviewChecked.disabled = false;
    syncWorkflowControls();
    updateStepNav();
    refreshActualExportPreview();
  }));

  document.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => {
    activeSide = button.dataset.side;
    const position = activeSide === 'before' ? 98 : 2;
    sliderPositions.desktop = position;
    sliderPositions.mobile = position;
    renderPreviews();
  }));

  [elements.component, elements.group, elements.displayTitle, elements.beforeAlt, elements.afterAlt, elements.publicApproved, elements.heroEligible, elements.heroActive, elements.heroOrder]
    .forEach(input => input.addEventListener('change', syncFieldsToPair));

  document.addEventListener('input', event => {
    const input = event.target.closest('input[data-device]');
    if (!input) return;
    currentFrame(input.dataset.device)[input.dataset.key] = Number(input.value);
    if (isEnhancedPair()) {
      workflowState()[`${input.dataset.device}CropChecked`] = false;
      workflowState().exportPreviewChecked = false;
      syncWorkflowControls();
      updateStepNav();
    }
    const output = input.closest('.control')?.querySelector('output');
    if (output) output.textContent = `${input.dataset.key === 'zoom' ? Number(input.value).toFixed(2) : Math.round(input.value)}${input.dataset.key === 'zoom' ? '×' : '%'}`;
    paintPreview(elements.desktopPreview, 'desktop');
    paintPreview(elements.mobilePreview, 'mobile');
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-adjust]');
    if (!button) return;
    const range = button.closest('.control')?.querySelector('input[type="range"]');
    if (!range) return;
    const direction = Number(button.dataset.adjust);
    const next = Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + direction * Number(range.step)));
    currentFrame(button.dataset.device)[button.dataset.key] = Math.round(next * 100) / 100;
    if (isEnhancedPair()) {
      workflowState()[`${button.dataset.device}CropChecked`] = false;
      workflowState().exportPreviewChecked = false;
      syncWorkflowControls();
      updateStepNav();
    }
    renderControls(button.dataset.device);
    paintPreview(elements.desktopPreview, 'desktop');
    paintPreview(elements.mobilePreview, 'mobile');
  });

  elements.chooseRoot.addEventListener('click', chooseWebsiteRoot);
  elements.saveApply.addEventListener('click', saveAndApply);
  elements.downloadFallback.addEventListener('click', downloadFiles);
  elements.reset.addEventListener('click', () => {
    const restored = clone(savedConfig.pairs.find(pair => pair.id === activePair.id));
    const index = config.pairs.findIndex(pair => pair.id === activePair.id);
    config.pairs[index] = restored;
    activePair = restored;
    const restoredEditor = clone(savedEditorConfig.pairs?.[activePair.id] || defaultEditorState(activePair.id !== 'orig-001'));
    editorConfig.pairs[activePair.id] = restoredEditor;
    selectedMaskId = restoredEditor.anonymization?.masks?.[0]?.id || null;
    invalidateProcessing();
    renderFields();
    setStatus('Änderungen am ausgewählten Paar wurden verworfen.');
  });

  window.addEventListener('resize', () => {
    renderPreviews();
    paintOrientationCanvas();
    paintPointCanvas();
    paintComparisonCanvas();
    renderMaskCanvas();
  }, { passive: true });
  window.addEventListener('beforeunload', stopBlinking);
  renderFields();
  restoreRootHandle().finally(() => detectLocalSaveApi());
}

initialise();
