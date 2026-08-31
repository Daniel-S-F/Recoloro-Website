/* RECOLORO – interner, vollständig lokaler Farbvorschau-Editor. */
'use strict';

const ENGINE = window.RecoloroColorEngine;
const ALGORITHM_VERSION = 'recoloro-local-lab-v1';
const PROJECT_SCHEMA_VERSION = 1;
const MAX_FILE_BYTES = 120 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 100_000_000;
const MAX_EXPORT_PIXELS = 32_000_000;
const WORKING_EDGE = 1600;
const WEB_EXPORT_EDGE = 2400;
const MASK_HISTORY_LIMIT = 30;
const DISCLAIMER = 'Unverbindliche Visualisierung. Das reale Ergebnis hängt unter anderem von Ausgangsbeschichtung, Zustand, Beleuchtung, Aufnahme, Bildschirmdarstellung und fachgerechter Ausführung ab.';

const elements = {
  engineStatus: document.querySelector('#engineStatus'),
  stepNav: document.querySelector('#stepNav'),
  steps: [...document.querySelectorAll('[data-workflow-step]')],
  photoInput: document.querySelector('#photoInput'),
  projectInput: document.querySelector('#projectInput'),
  paletteInput: document.querySelector('#paletteInput'),
  choosePhoto: document.querySelector('#choosePhoto'),
  rotateLeft: document.querySelector('#rotateLeft'),
  rotateRight: document.querySelector('#rotateRight'),
  clearPhoto: document.querySelector('#clearPhoto'),
  openProject: document.querySelector('#openProject'),
  importPalette: document.querySelector('#importPalette'),
  dropzone: document.querySelector('#dropzone'),
  photoMeta: document.querySelector('#photoMeta'),
  metaName: document.querySelector('#metaName'),
  metaFormat: document.querySelector('#metaFormat'),
  metaDimensions: document.querySelector('#metaDimensions'),
  metaWorking: document.querySelector('#metaWorking'),
  photoNotice: document.querySelector('#photoNotice'),
  maskTools: document.querySelector('#maskTools'),
  activeToolStatus: document.querySelector('#activeToolStatus'),
  finishPolygon: document.querySelector('#finishPolygon'),
  cancelPolygon: document.querySelector('#cancelPolygon'),
  undoMask: document.querySelector('#undoMask'),
  redoMask: document.querySelector('#redoMask'),
  resetMask: document.querySelector('#resetMask'),
  selectionMode: document.querySelector('#selectionMode'),
  colourTolerance: document.querySelector('#colourTolerance'),
  colourToleranceLabel: document.querySelector('#colourToleranceLabel'),
  lightTolerance: document.querySelector('#lightTolerance'),
  lightToleranceLabel: document.querySelector('#lightToleranceLabel'),
  edgeSensitivity: document.querySelector('#edgeSensitivity'),
  edgeSensitivityLabel: document.querySelector('#edgeSensitivityLabel'),
  brushSize: document.querySelector('#brushSize'),
  brushSizeLabel: document.querySelector('#brushSizeLabel'),
  feather: document.querySelector('#feather'),
  featherLabel: document.querySelector('#featherLabel'),
  rebuildMask: document.querySelector('#rebuildMask'),
  growMask: document.querySelector('#growMask'),
  shrinkMask: document.querySelector('#shrinkMask'),
  sampleList: document.querySelector('#sampleList'),
  maskNotice: document.querySelector('#maskNotice'),
  modeInputs: [...document.querySelectorAll('input[name="mode"]')],
  intensityField: document.querySelector('#intensityField'),
  intensity: document.querySelector('#intensity'),
  intensityLabel: document.querySelector('#intensityLabel'),
  freeColourFields: document.querySelector('#freeColourFields'),
  hexInput: document.querySelector('#hexInput'),
  redInput: document.querySelector('#redInput'),
  greenInput: document.querySelector('#greenInput'),
  blueInput: document.querySelector('#blueInput'),
  labLInput: document.querySelector('#labLInput'),
  labAInput: document.querySelector('#labAInput'),
  labBInput: document.querySelector('#labBInput'),
  targetSwatch: document.querySelector('#targetSwatch'),
  targetColourLabel: document.querySelector('#targetColourLabel'),
  targetLabLabel: document.querySelector('#targetLabLabel'),
  colourNotice: document.querySelector('#colourNotice'),
  referenceName: document.querySelector('#referenceName'),
  colourSource: document.querySelector('#colourSource'),
  colourVersion: document.querySelector('#colourVersion'),
  paletteField: document.querySelector('#paletteField'),
  paletteSelect: document.querySelector('#paletteSelect'),
  processingProgress: document.querySelector('#processingProgress'),
  processingStatus: document.querySelector('#processingStatus'),
  glossLevel: document.querySelector('#glossLevel'),
  glossEffect: document.querySelector('#glossEffect'),
  glossEffectLabel: document.querySelector('#glossEffectLabel'),
  viewButtons: document.querySelector('#viewButtons'),
  compareSlider: document.querySelector('#compareSlider'),
  compareLabel: document.querySelector('#compareLabel'),
  summaryMode: document.querySelector('#summaryMode'),
  summaryColour: document.querySelector('#summaryColour'),
  summaryGloss: document.querySelector('#summaryGloss'),
  summaryMask: document.querySelector('#summaryMask'),
  exportName: document.querySelector('#exportName'),
  exportSize: document.querySelector('#exportSize'),
  exportPng: document.querySelector('#exportPng'),
  exportWebp: document.querySelector('#exportWebp'),
  includeNotice: document.querySelector('#includeNotice'),
  saveProject: document.querySelector('#saveProject'),
  exportResult: document.querySelector('#exportResult'),
  exportProgress: document.querySelector('#exportProgress'),
  exportStatus: document.querySelector('#exportStatus'),
  fitView: document.querySelector('#fitView'),
  actualPixels: document.querySelector('#actualPixels'),
  zoomOut: document.querySelector('#zoomOut'),
  zoomIn: document.querySelector('#zoomIn'),
  viewBadge: document.querySelector('#viewBadge'),
  canvasShell: document.querySelector('#canvasShell'),
  workspace: document.querySelector('.workspace'),
  editorCanvas: document.querySelector('#editorCanvas'),
  canvasEmpty: document.querySelector('#canvasEmpty'),
  canvasStatus: document.querySelector('#canvasStatus'),
  zoomLabel: document.querySelector('#zoomLabel'),
};

const state = {
  sourceBitmap: null,
  sourceDataUrl: '',
  sourceMeta: null,
  manualQuarterTurns: 0,
  workCanvas: document.createElement('canvas'),
  workImageData: null,
  resultCanvas: document.createElement('canvas'),
  maskOverlayCanvas: document.createElement('canvas'),
  resultImageData: null,
  baseMask: new Uint8ClampedArray(),
  featherMask: new Uint8ClampedArray(),
  samples: [],
  maskHistory: [],
  maskFuture: [],
  activeTool: 'sample',
  polygon: [],
  brushInteraction: null,
  panInteraction: null,
  mode: 'refresh',
  targetLab: { l: 38.4, a: 13.9, b: -45.7 },
  targetRgb: { r: 31, g: 90, b: 166 },
  viewMode: 'compare',
  quickOriginal: false,
  view: { zoom: 1, panX: 0, panY: 0 },
  activeStep: 'stepPhoto',
  worker: null,
  workerJobs: new Map(),
  nextJobId: 1,
  sourceWorkerId: null,
  sourceSequence: 0,
  processingRevision: 0,
  busy: false,
  selectedPixels: 0,
  palette: null,
  lastExported: false,
};

const MASK_TOOL_INFO = Object.freeze({
  sample: { label: 'Pipette', instruction: 'Klicke im Foto auf eine repräsentative Stelle der gewünschten Oberfläche.' },
  'brush-add': { label: 'Pinsel +', instruction: 'Ziehe im Foto, um Bereiche zur Auswahl hinzuzufügen.' },
  'brush-subtract': { label: 'Pinsel −', instruction: 'Ziehe im Foto, um falsch ausgewählte Bereiche zu entfernen.' },
  'polygon-add': { label: 'Polygon +', instruction: 'Setze mindestens drei Eckpunkte und wähle danach „Polygon abschliessen“.' },
  'polygon-subtract': { label: 'Polygon −', instruction: 'Umschliesse den zu entfernenden Bereich mit mindestens drei Eckpunkten.' },
  pan: { label: 'Verschieben', instruction: 'Ziehe das Foto in der Arbeitsfläche an die gewünschte Position.' },
});

const debounce = (callback, delay = 160) => {
  let timer = 0;
  return (...argumentsList) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...argumentsList), delay);
  };
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unbekannt';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
}

function actionable(element, what, where, how, type = 'error') {
  element.className = `notice ${type}`.trim();
  element.textContent = `${what} · ${where} · ${how}`;
}

function setInlineStatus(element, message, type = '') {
  element.textContent = message;
  element.style.color = type === 'error' ? 'var(--error)' : type === 'ok' ? 'var(--ok)' : '';
}

function setProgress(element, percent) {
  element.style.width = `${ENGINE.clamp(percent, 0, 100)}%`;
}

function currentMaskSettings() {
  return {
    selectionMode: elements.selectionMode.value,
    colourTolerance: Number(elements.colourTolerance.value),
    lightTolerance: Number(elements.lightTolerance.value),
    edgeSensitivity: Number(elements.edgeSensitivity.value),
  };
}

function currentProcessOptions() {
  return {
    mode: state.mode,
    intensity: Number(elements.intensity.value) / 100,
    targetLab: state.targetLab,
    glossLevel: Number(elements.glossLevel.value),
    glossEffect: Number(elements.glossEffect.value) / 100,
  };
}

function initialiseWorker() {
  try {
    const worker = new Worker('farbvorschau-worker.js');
    worker.addEventListener('message', event => {
      const pending = state.workerJobs.get(event.data.id);
      if (!pending) return;
      state.workerJobs.delete(event.data.id);
      if (event.data.ok) pending.resolve(event.data.buffer);
      else pending.reject(new Error(event.data.error));
    });
    worker.addEventListener('error', event => {
      for (const pending of state.workerJobs.values()) pending.reject(new Error(event.message || 'Web Worker ist ausgefallen.'));
      state.workerJobs.clear();
      elements.engineStatus.textContent = 'Lokale Bildpipeline gestört';
      elements.engineStatus.className = 'badge error';
    });
    state.worker = worker;
    elements.engineStatus.textContent = 'Lokale Bildpipeline bereit';
    elements.engineStatus.className = 'badge ok';
  } catch (error) {
    elements.engineStatus.textContent = 'Lokale Bildpipeline nicht verfügbar';
    elements.engineStatus.className = 'badge error';
    actionable(elements.photoNotice, 'Bildpipeline konnte nicht gestartet werden', 'Browser', 'Seite über den lokalen Pilotserver in Chrome oder Edge öffnen.');
  }
}

function runWorker(type, payload, transferables = []) {
  if (!state.worker) return Promise.reject(new Error('Die lokale Bildpipeline ist nicht verfügbar.'));
  const id = state.nextJobId;
  state.nextJobId += 1;
  return new Promise((resolve, reject) => {
    state.workerJobs.set(id, { resolve, reject });
    state.worker.postMessage({ id, type, payload }, transferables);
  });
}

function setBusy(value) {
  state.busy = value;
  elements.exportResult.disabled = value || !hasValidExportState();
  elements.saveProject.disabled = value || !state.sourceBitmap;
  elements.rotateLeft.disabled = value || !state.sourceBitmap;
  elements.rotateRight.disabled = value || !state.sourceBitmap;
  elements.rebuildMask.disabled = value || !state.samples.length;
  elements.growMask.disabled = value || !state.selectedPixels;
  elements.shrinkMask.disabled = value || !state.selectedPixels;
  updateHistoryButtons();
  updatePolygonActions();
  updateActiveToolStatus();
}

function safeFileBase(value) {
  return String(value || 'objekt-farbvorschau')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'objekt-farbvorschau';
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Die Projektdatei enthält kein gültiges eingebettetes Originalbild.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Die Datei konnte nicht vollständig gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

async function jpegMetadata(blob) {
  const metadata = { orientation: 1, width: 0, height: 0 };
  if (blob.type !== 'image/jpeg') return metadata;
  try {
    const buffer = await blob.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return metadata;
    const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      offset += 2;
      if (marker === 0xd8 || marker === 0x01) continue;
      if (marker === 0xda || marker === 0xd9 || offset + 2 > view.byteLength) break;
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
      if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
        metadata.height = view.getUint16(offset + 3, false);
        metadata.width = view.getUint16(offset + 5, false);
      }
      if (marker === 0xe1 && segmentLength >= 14) {
        const payload = offset + 2;
        const isExif = view.getUint32(payload, false) === 0x45786966 && view.getUint16(payload + 4, false) === 0;
        if (isExif) {
          const tiff = payload + 6;
          const byteOrder = view.getUint16(tiff, false);
          const littleEndian = byteOrder === 0x4949;
          if (!littleEndian && byteOrder !== 0x4d4d) break;
          if (view.getUint16(tiff + 2, littleEndian) !== 42) break;
          const ifd = tiff + view.getUint32(tiff + 4, littleEndian);
          if (ifd + 2 > view.byteLength) break;
          const entries = view.getUint16(ifd, littleEndian);
          for (let index = 0; index < entries; index += 1) {
            const entry = ifd + 2 + (index * 12);
            if (entry + 12 > view.byteLength) break;
            if (view.getUint16(entry, littleEndian) !== 0x0112) continue;
            const orientation = view.getUint16(entry + 8, littleEndian);
            metadata.orientation = orientation >= 1 && orientation <= 8 ? orientation : 1;
            break;
          }
        }
      }
      offset += segmentLength;
    }
  } catch (error) {
    return metadata;
  }
  return metadata;
}

async function bitmapAtDimensions(bitmap, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const normalized = await createImageBitmap(canvas, { colorSpaceConversion: 'default' });
  bitmap.close?.();
  return normalized;
}

async function bitmapWithExifOrientation(bitmap, orientation) {
  if (orientation === 1) return bitmap;
  const swapDimensions = orientation >= 5 && orientation <= 8;
  const canvas = document.createElement('canvas');
  canvas.width = swapDimensions ? bitmap.height : bitmap.width;
  canvas.height = swapDimensions ? bitmap.width : bitmap.height;
  const context = canvas.getContext('2d');
  const transforms = {
    2: [-1, 0, 0, 1, bitmap.width, 0],
    3: [-1, 0, 0, -1, bitmap.width, bitmap.height],
    4: [1, 0, 0, -1, 0, bitmap.height],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, bitmap.height, 0],
    7: [0, -1, -1, 0, bitmap.height, bitmap.width],
    8: [0, -1, 1, 0, 0, bitmap.width],
  };
  context.setTransform(...transforms[orientation]);
  context.drawImage(bitmap, 0, 0);
  const oriented = await createImageBitmap(canvas, { colorSpaceConversion: 'default' });
  bitmap.close?.();
  return oriented;
}

async function orientedBitmap(blob) {
  try {
    const metadata = await jpegMetadata(blob);
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'none', colorSpaceConversion: 'default' });
    } catch (rawError) {
      return { bitmap: await createImageBitmap(blob, { imageOrientation: 'from-image', colorSpaceConversion: 'default' }), exifOrientation: metadata.orientation, orientationFallback: false };
    }
    const decoderMatchesFileDimensions = !metadata.width || !metadata.height || (bitmap.width === metadata.width && bitmap.height === metadata.height);
    if (!decoderMatchesFileDimensions) {
      return {
        bitmap: await bitmapAtDimensions(bitmap, metadata.width, metadata.height),
        exifOrientation: metadata.orientation,
        orientationFallback: true,
      };
    }
    return {
      bitmap: await bitmapWithExifOrientation(bitmap, metadata.orientation),
      exifOrientation: metadata.orientation,
      orientationFallback: false,
    };
  } catch (firstError) {
    try {
      return { bitmap: await createImageBitmap(blob), exifOrientation: 1, orientationFallback: false };
    } catch (secondError) {
      throw new Error('Das Bild ist defekt oder wird vom Browser nicht unterstützt.');
    }
  }
}

async function rotatedBitmap(bitmap, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (!turns) return bitmap;
  const swapDimensions = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = swapDimensions ? bitmap.height : bitmap.width;
  canvas.height = swapDimensions ? bitmap.width : bitmap.height;
  const context = canvas.getContext('2d');
  if (turns === 1) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (turns === 2) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(bitmap, 0, 0);
  return await createImageBitmap(canvas, { colorSpaceConversion: 'default' });
}

async function rotateLoadedPhoto(quarterTurns) {
  if (!state.sourceBitmap || state.busy) return;
  setBusy(true);
  setInlineStatus(elements.canvasStatus, 'Fotoausrichtung wird lokal angepasst …');
  try {
    const bitmap = await rotatedBitmap(state.sourceBitmap, quarterTurns);
    const manualQuarterTurns = ((state.manualQuarterTurns + quarterTurns) % 4 + 4) % 4;
    await installSource(bitmap, state.sourceDataUrl, { ...state.sourceMeta, manualQuarterTurns });
    actionable(elements.photoNotice, 'Fotoausrichtung angepasst', 'Schritt 1', 'Auswahl und Vorschau wurden für die neue Ausrichtung zurückgesetzt.', 'ok');
  } catch (error) {
    actionable(elements.photoNotice, error.message, 'Schritt 1 / Bildausrichtung', 'Foto erneut laden und die Drehung nochmals ausführen.');
  } finally {
    setBusy(false);
  }
}

function focusWorkspaceForTool() {
  if (!window.matchMedia('(max-width: 1050px)').matches) return;
  window.requestAnimationFrame(() => elements.workspace?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

function renderCanvasAfterLayout() {
  window.requestAnimationFrame(() => {
    renderCanvas();
    window.requestAnimationFrame(renderCanvas);
  });
}

function sourceTypeLabel(type) {
  return ({ 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' })[type] || type;
}

async function loadPhotoFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    actionable(elements.photoNotice, 'Dateiformat wird nicht unterstützt', 'Schritt 1', 'Bitte ein JPEG-, PNG- oder WebP-Foto auswählen.');
    return;
  }
  if (!file.size || file.size > MAX_FILE_BYTES) {
    actionable(elements.photoNotice, 'Datei ist leer oder grösser als 120 MB', 'Schritt 1', 'Bitte eine intakte, kleinere Bilddatei verwenden.');
    return;
  }
  setBusy(true);
  setInlineStatus(elements.canvasStatus, 'Foto wird lokal dekodiert …');
  try {
    const dataUrl = await fileToDataUrl(file);
    const decoded = await orientedBitmap(file);
    await installSource(decoded.bitmap, dataUrl, {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      exifOrientation: decoded.exifOrientation,
      orientationFallback: decoded.orientationFallback,
      manualQuarterTurns: 0,
    });
  } catch (error) {
    actionable(elements.photoNotice, error.message, 'Schritt 1 / Bilddekodierung', 'Datei erneut exportieren oder ein anderes Original verwenden.');
    setInlineStatus(elements.canvasStatus, error.message, 'error');
  } finally {
    setBusy(false);
  }
}

async function installSource(bitmap, dataUrl, meta) {
  const pixels = bitmap.width * bitmap.height;
  if (!bitmap.width || !bitmap.height || pixels > MAX_SOURCE_PIXELS) {
    bitmap.close?.();
    throw new Error('Das Foto überschreitet die sichere Verarbeitungsgrenze von 100 Megapixeln.');
  }
  state.sourceBitmap?.close?.();
  state.sourceBitmap = bitmap;
  state.sourceDataUrl = dataUrl;
  state.manualQuarterTurns = Number(meta.manualQuarterTurns) || 0;
  state.sourceMeta = { ...meta, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(1, WORKING_EDGE / Math.max(bitmap.width, bitmap.height));
  state.workCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
  state.workCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = state.workCanvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, state.workCanvas.width, state.workCanvas.height);
  context.drawImage(bitmap, 0, 0, state.workCanvas.width, state.workCanvas.height);
  state.workImageData = context.getImageData(0, 0, state.workCanvas.width, state.workCanvas.height);
  state.sourceSequence += 1;
  state.sourceWorkerId = `source-${state.sourceSequence}`;
  state.resultCanvas.width = state.workCanvas.width;
  state.resultCanvas.height = state.workCanvas.height;
  state.maskOverlayCanvas.width = state.workCanvas.width;
  state.maskOverlayCanvas.height = state.workCanvas.height;
  state.resultImageData = null;
  state.baseMask = new Uint8ClampedArray(state.workCanvas.width * state.workCanvas.height);
  state.featherMask = new Uint8ClampedArray(state.baseMask.length);
  state.samples = [];
  state.maskHistory = [];
  state.maskFuture = [];
  state.selectedPixels = 0;
  state.lastExported = false;
  state.view = { zoom: 1, panX: 0, panY: 0 };
  elements.metaName.textContent = meta.name;
  elements.metaFormat.textContent = `${sourceTypeLabel(meta.type)} · ${formatBytes(meta.size)}`;
  elements.metaDimensions.textContent = `${bitmap.width} × ${bitmap.height} px`;
  elements.metaWorking.textContent = `${state.workCanvas.width} × ${state.workCanvas.height} px`;
  elements.photoMeta.hidden = false;
  elements.canvasEmpty.hidden = true;
  elements.clearPhoto.disabled = false;
  elements.rotateLeft.disabled = false;
  elements.rotateRight.disabled = false;
  elements.exportName.value = `${safeFileBase(meta.name.replace(/\.[^.]+$/, ''))}-farbvorschau`;
  const workerPixels = new Uint8ClampedArray(state.workImageData.data);
  await runWorker('setSource', {
    sourceId: state.sourceWorkerId,
    buffer: workerPixels.buffer,
    width: state.workCanvas.width,
    height: state.workCanvas.height,
  }, [workerPixels.buffer]);
  const sizeMessage = scale < 1 ? 'Arbeitsvorschau ist verkleinert; Export bleibt bis zur sicheren Originalauflösung möglich.' : 'Originalauflösung wird auch als Arbeitsauflösung verwendet.';
  const orientationMessage = meta.orientationFallback
    ? `EXIF-Ausrichtung ${meta.exifOrientation} erkannt; wegen widersprüchlicher Browser-Dekodierung wurde das Foto unverzerrt in Dateiausrichtung geöffnet. Bei Bedarf 90° links oder rechts drehen. `
    : '';
  actionable(elements.photoNotice, 'Foto lokal geladen', 'Schritt 1', `${orientationMessage}${sizeMessage}`, 'ok');
  setInlineStatus(elements.canvasStatus, 'Foto geladen. Setze nun Farbpipetten in die gewünschte Oberfläche.', 'ok');
  setTool('sample');
  renderSamples();
  updateMaskStatistics();
  updateWorkflow();
  setActiveStep('stepMask');
  focusWorkspaceForTool();
  renderCanvasAfterLayout();
}

function clearPhoto() {
  state.sourceBitmap?.close?.();
  state.sourceBitmap = null;
  state.sourceDataUrl = '';
  state.sourceMeta = null;
  state.manualQuarterTurns = 0;
  state.workImageData = null;
  state.resultImageData = null;
  state.baseMask = new Uint8ClampedArray();
  state.featherMask = new Uint8ClampedArray();
  state.samples = [];
  state.maskHistory = [];
  state.maskFuture = [];
  state.selectedPixels = 0;
  elements.photoInput.value = '';
  elements.photoMeta.hidden = true;
  elements.canvasEmpty.hidden = false;
  elements.clearPhoto.disabled = true;
  elements.rotateLeft.disabled = true;
  elements.rotateRight.disabled = true;
  elements.photoNotice.className = 'notice';
  elements.photoNotice.textContent = 'Was nicht stimmt, wo es auftritt und wie es behoben wird, erscheint jeweils direkt an diesem Schritt.';
  updateActiveToolStatus();
  renderSamples();
  updateWorkflow();
  renderCanvas();
}

function maskSnapshot() {
  return {
    mask: new Uint8ClampedArray(state.baseMask),
    samples: state.samples.map(sample => ({ ...sample, lab: { ...sample.lab }, rgb: { ...sample.rgb } })),
  };
}

function restoreMaskSnapshot(snapshot) {
  state.baseMask = new Uint8ClampedArray(snapshot.mask);
  state.samples = snapshot.samples.map(sample => ({ ...sample, lab: { ...sample.lab }, rgb: { ...sample.rgb } }));
  state.polygon = [];
  renderSamples();
  refreshMaskResult();
}

function recordMaskHistory() {
  if (!state.baseMask.length) return;
  state.maskHistory.push(maskSnapshot());
  if (state.maskHistory.length > MASK_HISTORY_LIMIT) state.maskHistory.shift();
  state.maskFuture = [];
  updateHistoryButtons();
}

function undoMask() {
  if (!state.maskHistory.length) return;
  state.maskFuture.push(maskSnapshot());
  restoreMaskSnapshot(state.maskHistory.pop());
  updateHistoryButtons();
}

function redoMask() {
  if (!state.maskFuture.length) return;
  state.maskHistory.push(maskSnapshot());
  restoreMaskSnapshot(state.maskFuture.pop());
  updateHistoryButtons();
}

function updateHistoryButtons() {
  elements.undoMask.disabled = !state.maskHistory.length || state.busy;
  elements.redoMask.disabled = !state.maskFuture.length || state.busy;
  elements.resetMask.disabled = !state.baseMask.length || (!state.samples.length && !state.selectedPixels) || state.busy;
}

function toleranceWord(value, lower, upper) {
  if (value < lower) return 'enger';
  if (value > upper) return 'weiter';
  return 'normal';
}

function renderSamples() {
  elements.sampleList.replaceChildren();
  if (!state.samples.length) {
    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.textContent = 'Noch keine Probe. Aktiviere die Pipette und klicke in die gewünschte Oberfläche.';
    elements.sampleList.append(notice);
    return;
  }
  const sortedLightness = state.samples.map(sample => sample.lab.l).sort((a, b) => a - b);
  state.samples.forEach((sample, index) => {
    const item = document.createElement('div');
    item.className = 'sample';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = ENGINE.rgbToHex(sample.rgb.r, sample.rgb.g, sample.rgb.b);
    const text = document.createElement('span');
    const role = sample.lab.l === sortedLightness[0] ? 'dunkel' : sample.lab.l === sortedLightness.at(-1) ? 'hell' : 'mittel';
    text.innerHTML = `<strong>Probe ${index + 1} · ${role}</strong><small>Lab ${sample.lab.l.toFixed(1)} / ${sample.lab.a.toFixed(1)} / ${sample.lab.b.toFixed(1)}</small>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Entfernen';
    remove.addEventListener('click', () => {
      recordMaskHistory();
      state.samples.splice(index, 1);
      renderSamples();
      rebuildMask(false);
    });
    item.append(swatch, text, remove);
    elements.sampleList.append(item);
  });
}

async function rebuildMask(record = true) {
  if (!state.workImageData || !state.samples.length) {
    if (state.baseMask.length) state.baseMask.fill(0);
    await refreshMaskResult();
    actionable(elements.maskNotice, 'Mindestens eine Pipettenprobe fehlt', 'Schritt 2', 'Pipette aktivieren und in die gewünschte Oberfläche klicken.');
    return;
  }
  if (record) recordMaskHistory();
  const revision = ++state.processingRevision;
  setBusy(true);
  setProgress(elements.processingProgress, 18);
  setInlineStatus(elements.processingStatus, 'Farbbereich wird im lokalen Worker berechnet …');
  try {
    const buffer = await runWorker('deriveMask', {
      sourceId: state.sourceWorkerId,
      samples: state.samples,
      options: currentMaskSettings(),
    });
    if (revision !== state.processingRevision) return;
    state.baseMask = new Uint8ClampedArray(buffer);
    await refreshMaskResult(revision);
    const guidance = state.samples.length < 3
      ? 'Für eine robustere Auswahl zusätzlich helle, mittlere und dunkle Bereiche derselben Oberfläche beproben.'
      : 'Auswahl berechnet. Ähnliche Nachbarflächen lassen sich mit Pinsel oder Polygon abziehen.';
    actionable(elements.maskNotice, 'Farbbereich aktualisiert', 'Schritt 2', guidance, 'ok');
  } catch (error) {
    actionable(elements.maskNotice, error.message, 'Schritt 2 / Maskenberechnung', 'Toleranz reduzieren oder Foto neu laden.');
    setInlineStatus(elements.processingStatus, error.message, 'error');
  } finally {
    setBusy(false);
    updateHistoryButtons();
  }
}

async function refreshMaskResult(existingRevision = null) {
  if (!state.workImageData) return;
  const revision = existingRevision ?? ++state.processingRevision;
  setBusy(true);
  try {
    setProgress(elements.processingProgress, 35);
    const maskCopy = new Uint8ClampedArray(state.baseMask);
    const featherBuffer = await runWorker('feather', {
      mask: maskCopy.buffer,
      width: state.workCanvas.width,
      height: state.workCanvas.height,
      radius: Number(elements.feather.value),
    }, [maskCopy.buffer]);
    if (revision !== state.processingRevision) return;
    state.featherMask = new Uint8ClampedArray(featherBuffer);
    updateMaskStatistics();
    if (!state.selectedPixels) {
      state.resultImageData = null;
      setProgress(elements.processingProgress, 0);
      setInlineStatus(elements.processingStatus, 'Die Maske ist leer. Setze eine Probe oder füge mit dem Pinsel eine Fläche hinzu.');
      renderCanvas();
      updateWorkflow();
      return;
    }
    const maskForWorker = new Uint8ClampedArray(state.featherMask);
    await runWorker('setMask', {
      sourceId: state.sourceWorkerId,
      mask: maskForWorker.buffer,
    }, [maskForWorker.buffer]);
    if (revision !== state.processingRevision) return;
    setProgress(elements.processingProgress, 66);
    await processPreview(revision);
  } catch (error) {
    setInlineStatus(elements.processingStatus, `${error.message} · Schritt 5 · Foto oder Maske vereinfachen und erneut versuchen.`, 'error');
  } finally {
    setBusy(false);
  }
}

async function processPreview(existingRevision = null) {
  if (!state.workImageData || !state.selectedPixels || !state.featherMask.length) return;
  const revision = existingRevision ?? ++state.processingRevision;
  setBusy(true);
  const started = performance.now();
  try {
    setProgress(elements.processingProgress, 66);
    const outputBuffer = await runWorker('process', {
      sourceId: state.sourceWorkerId,
      options: currentProcessOptions(),
    });
    if (revision !== state.processingRevision) return;
    state.resultImageData = new ImageData(new Uint8ClampedArray(outputBuffer), state.workCanvas.width, state.workCanvas.height);
    state.resultCanvas.getContext('2d').putImageData(state.resultImageData, 0, 0);
    const duration = performance.now() - started;
    setProgress(elements.processingProgress, 100);
    setInlineStatus(elements.processingStatus, `Vorschau deterministisch berechnet · ${state.workCanvas.width} × ${state.workCanvas.height} px · ${Math.round(duration)} ms · ${state.selectedPixels.toLocaleString('de-CH')} ausgewählte Pixel`, duration < 1000 ? 'ok' : '');
    window.setTimeout(() => setProgress(elements.processingProgress, 0), 500);
    renderCanvas();
    updateWorkflow();
  } catch (error) {
    setInlineStatus(elements.processingStatus, `${error.message} · Schritt 5 · Foto oder Maske vereinfachen und erneut versuchen.`, 'error');
  } finally {
    setBusy(false);
  }
}

const debouncedProcess = debounce(() => processPreview(), 140);
const debouncedRebuildMask = debounce(() => rebuildMask(), 180);
const debouncedFeather = debounce(() => refreshMaskResult(), 140);

async function modifyMask(amount) {
  if (!state.baseMask.length || !state.selectedPixels) return;
  recordMaskHistory();
  setBusy(true);
  try {
    const mask = new Uint8ClampedArray(state.baseMask);
    const output = await runWorker('morphology', {
      mask: mask.buffer,
      width: state.workCanvas.width,
      height: state.workCanvas.height,
      amount,
    }, [mask.buffer]);
    state.baseMask = new Uint8ClampedArray(output);
    await refreshMaskResult();
  } catch (error) {
    actionable(elements.maskNotice, error.message, 'Schritt 2 / Maskenkante', 'Änderung rückgängig machen oder Maske neu berechnen.');
  } finally {
    setBusy(false);
  }
}

function updateMaskStatistics() {
  state.selectedPixels = 0;
  for (const value of state.baseMask) if (value) state.selectedPixels += 1;
  updateMaskOverlayCanvas();
  const percentage = state.baseMask.length ? (state.selectedPixels / state.baseMask.length) * 100 : 0;
  elements.summaryMask.textContent = `${percentage.toFixed(1)} %`;
  updateHistoryButtons();
  elements.exportResult.disabled = state.busy || !hasValidExportState();
}

function updateMaskOverlayCanvas() {
  if (!state.workCanvas.width || !state.workCanvas.height) return;
  if (state.maskOverlayCanvas.width !== state.workCanvas.width || state.maskOverlayCanvas.height !== state.workCanvas.height) {
    state.maskOverlayCanvas.width = state.workCanvas.width;
    state.maskOverlayCanvas.height = state.workCanvas.height;
  }
  const context = state.maskOverlayCanvas.getContext('2d');
  const image = context.createImageData(state.workCanvas.width, state.workCanvas.height);
  for (let index = 0; index < state.baseMask.length; index += 1) {
    if (!state.baseMask[index]) continue;
    const offset = index * 4;
    image.data[offset] = 0;
    image.data[offset + 1] = 183;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function updateActiveToolStatus() {
  const info = MASK_TOOL_INFO[state.activeTool];
  if (!info || !elements.activeToolStatus) return;
  const heading = document.createElement('strong');
  heading.textContent = `Aktives Werkzeug: ${info.label}`;
  const detail = document.createElement('span');
  if (state.busy) detail.textContent = 'Bildverarbeitung läuft. Das Werkzeug bleibt gewählt und ist danach wieder bereit.';
  else if (!state.workImageData) detail.textContent = 'Werkzeug ist gewählt. Lade zuerst ein Foto in Schritt 1.';
  else detail.textContent = info.instruction;
  elements.activeToolStatus.replaceChildren(heading, detail);
  elements.editorCanvas.setAttribute('aria-label', `${info.label}. ${detail.textContent}`);
}

function updatePolygonActions() {
  const isPolygon = state.activeTool.startsWith('polygon');
  elements.finishPolygon.disabled = state.busy || !isPolygon || state.polygon.length < 3;
  elements.cancelPolygon.disabled = state.busy || !isPolygon || state.polygon.length === 0;
}

function setTool(tool) {
  const info = MASK_TOOL_INFO[tool];
  const activeButton = elements.maskTools.querySelector(`button[data-tool="${tool}"]`);
  if (!info || !activeButton) return;
  state.activeTool = tool;
  state.polygon = [];
  for (const button of elements.maskTools.querySelectorAll('button[data-tool]')) {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  updatePolygonActions();
  elements.editorCanvas.classList.toggle('is-pan', tool === 'pan');
  updateActiveToolStatus();
  renderCanvas();
}

function workPointFromEvent(event) {
  if (!state.workImageData) return null;
  const rect = elements.editorCanvas.getBoundingClientRect();
  const displayX = event.clientX - rect.left;
  const displayY = event.clientY - rect.top;
  const geometry = viewGeometry(rect.width, rect.height);
  return {
    x: (displayX - geometry.x) / geometry.scale,
    y: (displayY - geometry.y) / geometry.scale,
    displayX,
    displayY,
    inside: displayX >= geometry.x && displayX <= geometry.x + geometry.width && displayY >= geometry.y && displayY <= geometry.y + geometry.height,
  };
}

function addSample(point) {
  if (!point?.inside) return;
  const x = ENGINE.clamp(Math.floor(point.x), 0, state.workCanvas.width - 1);
  const y = ENGINE.clamp(Math.floor(point.y), 0, state.workCanvas.height - 1);
  const offset = ((y * state.workCanvas.width) + x) * 4;
  const rgb = {
    r: state.workImageData.data[offset], g: state.workImageData.data[offset + 1], b: state.workImageData.data[offset + 2],
  };
  recordMaskHistory();
  state.samples.push({ id: `sample-${Date.now()}-${state.samples.length}`, x, y, rgb, lab: ENGINE.rgbToLab(rgb.r, rgb.g, rgb.b) });
  renderSamples();
  rebuildMask(false);
}

function paintCircle(point, value) {
  const radius = Number(elements.brushSize.value) / 2;
  const minimumX = Math.max(0, Math.floor(point.x - radius));
  const maximumX = Math.min(state.workCanvas.width - 1, Math.ceil(point.x + radius));
  const minimumY = Math.max(0, Math.floor(point.y - radius));
  const maximumY = Math.min(state.workCanvas.height - 1, Math.ceil(point.y + radius));
  const radiusSquared = radius ** 2;
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      if (((x - point.x) ** 2) + ((y - point.y) ** 2) <= radiusSquared) state.baseMask[(y * state.workCanvas.width) + x] = value;
    }
  }
  const overlayContext = state.maskOverlayCanvas.getContext('2d');
  overlayContext.save();
  overlayContext.globalCompositeOperation = value ? 'source-over' : 'destination-out';
  overlayContext.fillStyle = '#00b7ff';
  overlayContext.beginPath();
  overlayContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
  overlayContext.fill();
  overlayContext.restore();
}

function paintLine(from, to, value) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, Number(elements.brushSize.value) / 5)));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    paintCircle({ x: from.x + ((to.x - from.x) * progress), y: from.y + ((to.y - from.y) * progress) }, value);
  }
}

function finishPolygon() {
  if (!state.workImageData || state.polygon.length < 3) {
    actionable(elements.maskNotice, 'Polygon benötigt mindestens drei Punkte', 'Schritt 2', 'Weitere Eckpunkte setzen oder Polygon abbrechen.');
    return;
  }
  recordMaskHistory();
  const canvas = document.createElement('canvas');
  canvas.width = state.workCanvas.width;
  canvas.height = state.workCanvas.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.beginPath();
  context.moveTo(state.polygon[0].x, state.polygon[0].y);
  for (const point of state.polygon.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = '#fff';
  context.fill();
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const value = state.activeTool === 'polygon-subtract' ? 0 : 255;
  for (let index = 0; index < state.baseMask.length; index += 1) if (data[(index * 4) + 3]) state.baseMask[index] = value;
  state.polygon = [];
  updatePolygonActions();
  refreshMaskResult();
}

function handlePointerDown(event) {
  if (!state.workImageData) {
    actionable(elements.maskNotice, 'Noch kein Foto geladen', 'Schritt 1', 'Zuerst ein Foto laden; das gewählte Werkzeug bleibt aktiv.');
    setActiveStep('stepPhoto', true);
    return;
  }
  if (state.busy) {
    updateActiveToolStatus();
    return;
  }
  const point = workPointFromEvent(event);
  if (state.activeTool === 'sample') {
    addSample(point);
    return;
  }
  if (state.activeTool.startsWith('polygon')) {
    if (point?.inside) state.polygon.push({ x: point.x, y: point.y });
    updatePolygonActions();
    renderCanvas();
    return;
  }
  if (state.activeTool === 'pan') {
    state.panInteraction = { x: event.clientX, y: event.clientY, panX: state.view.panX, panY: state.view.panY };
    elements.editorCanvas.classList.add('is-panning');
    elements.editorCanvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.activeTool.startsWith('brush') && point?.inside) {
    recordMaskHistory();
    const value = state.activeTool === 'brush-subtract' ? 0 : 255;
    paintCircle(point, value);
    state.brushInteraction = { last: point, value };
    elements.editorCanvas.setPointerCapture(event.pointerId);
    renderCanvas();
  }
}

function handlePointerMove(event) {
  if (state.panInteraction) {
    state.view.panX = state.panInteraction.panX + (event.clientX - state.panInteraction.x);
    state.view.panY = state.panInteraction.panY + (event.clientY - state.panInteraction.y);
    renderCanvas();
    return;
  }
  if (!state.brushInteraction) return;
  const point = workPointFromEvent(event);
  if (!point) return;
  paintLine(state.brushInteraction.last, point, state.brushInteraction.value);
  state.brushInteraction.last = point;
  renderCanvas();
}

function handlePointerUp(event) {
  if (state.panInteraction) {
    state.panInteraction = null;
    elements.editorCanvas.classList.remove('is-panning');
    elements.editorCanvas.releasePointerCapture?.(event.pointerId);
  }
  if (state.brushInteraction) {
    state.brushInteraction = null;
    elements.editorCanvas.releasePointerCapture?.(event.pointerId);
    refreshMaskResult();
  }
}

function viewGeometry(displayWidth, displayHeight) {
  if (!state.workCanvas.width || !state.workCanvas.height) return { x: 0, y: 0, width: 0, height: 0, scale: 1, fit: 1 };
  const fit = Math.min(displayWidth / state.workCanvas.width, displayHeight / state.workCanvas.height);
  const scale = fit * state.view.zoom;
  const width = state.workCanvas.width * scale;
  const height = state.workCanvas.height * scale;
  return { x: ((displayWidth - width) / 2) + state.view.panX, y: ((displayHeight - height) / 2) + state.view.panY, width, height, scale, fit };
}

function drawMaskOverlay(context, geometry, opacity = 0.52) {
  if (!state.baseMask.length) return;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(state.maskOverlayCanvas, geometry.x, geometry.y, geometry.width, geometry.height);
  context.restore();
}

function renderCanvas() {
  const rect = elements.editorCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (elements.editorCanvas.width !== Math.round(width * ratio) || elements.editorCanvas.height !== Math.round(height * ratio)) {
    elements.editorCanvas.width = Math.round(width * ratio);
    elements.editorCanvas.height = Math.round(height * ratio);
  }
  const context = elements.editorCanvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!state.workImageData) {
    elements.zoomLabel.textContent = 'Zoom –';
    elements.viewBadge.textContent = 'Kein Foto';
    return;
  }
  const geometry = viewGeometry(width, height);
  context.save();
  context.beginPath();
  context.rect(geometry.x, geometry.y, geometry.width, geometry.height);
  context.clip();
  const result = state.resultImageData ? state.resultCanvas : state.workCanvas;
  const view = state.quickOriginal ? 'original' : state.viewMode;
  if (view === 'result') {
    context.drawImage(result, geometry.x, geometry.y, geometry.width, geometry.height);
  } else if (view === 'mask') {
    context.globalAlpha = 0.34;
    context.drawImage(state.workCanvas, geometry.x, geometry.y, geometry.width, geometry.height);
    context.globalAlpha = 1;
    drawMaskOverlay(context, geometry, 0.82);
  } else if (view === 'overlay') {
    context.drawImage(state.workCanvas, geometry.x, geometry.y, geometry.width, geometry.height);
    context.globalAlpha = 0.68;
    context.drawImage(result, geometry.x, geometry.y, geometry.width, geometry.height);
    context.globalAlpha = 1;
    drawMaskOverlay(context, geometry, 0.32);
  } else if (view === 'compare') {
    context.drawImage(state.workCanvas, geometry.x, geometry.y, geometry.width, geometry.height);
    const divider = geometry.x + (geometry.width * (Number(elements.compareSlider.value) / 100));
    context.save();
    context.beginPath();
    context.rect(divider, geometry.y, geometry.x + geometry.width - divider, geometry.height);
    context.clip();
    context.drawImage(result, geometry.x, geometry.y, geometry.width, geometry.height);
    context.restore();
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(divider, geometry.y);
    context.lineTo(divider, geometry.y + geometry.height);
    context.stroke();
  } else {
    context.drawImage(state.workCanvas, geometry.x, geometry.y, geometry.width, geometry.height);
  }
  if (state.activeStep === 'stepMask' && !['mask', 'overlay'].includes(view)) drawMaskOverlay(context, geometry, 0.4);
  context.restore();

  for (const [index, sample] of state.samples.entries()) {
    const x = geometry.x + (sample.x * geometry.scale);
    const y = geometry.y + (sample.y * geometry.scale);
    context.fillStyle = '#fff';
    context.strokeStyle = '#0f46d4';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#0f46d4';
    context.font = 'bold 10px Segoe UI';
    context.textAlign = 'center';
    context.fillText(String(index + 1), x, y + 3.5);
  }
  if (state.polygon.length) {
    context.strokeStyle = state.activeTool === 'polygon-subtract' ? '#e14949' : '#0f46d4';
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 2;
    context.beginPath();
    state.polygon.forEach((point, index) => {
      const x = geometry.x + (point.x * geometry.scale);
      const y = geometry.y + (point.y * geometry.scale);
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      context.fillRect(x - 3, y - 3, 6, 6);
    });
    context.stroke();
  }
  elements.zoomLabel.textContent = `Zoom ${Math.round(geometry.scale * 100)} %`;
  elements.viewBadge.textContent = ({ compare: 'Vorher / Nachher', original: 'Original', result: 'Ergebnis', mask: 'Maske', overlay: 'Überlagerung' })[view];
}

function setViewZoom(nextZoom, focal = null) {
  if (!state.workImageData) return;
  const rect = elements.editorCanvas.getBoundingClientRect();
  const before = viewGeometry(rect.width, rect.height);
  const focusX = focal?.x ?? rect.width / 2;
  const focusY = focal?.y ?? rect.height / 2;
  const imageX = (focusX - before.x) / before.scale;
  const imageY = (focusY - before.y) / before.scale;
  state.view.zoom = ENGINE.clamp(nextZoom, 0.12, 18);
  const after = viewGeometry(rect.width, rect.height);
  state.view.panX += focusX - (after.x + (imageX * after.scale));
  state.view.panY += focusY - (after.y + (imageY * after.scale));
  renderCanvas();
}

function setActiveStep(id, scroll = false) {
  state.activeStep = id;
  for (const step of elements.steps) step.classList.toggle('is-active', step.id === id);
  for (const button of elements.stepNav.querySelectorAll('button')) button.classList.toggle('is-active', button.dataset.step === id);
  if (scroll) document.querySelector(`#${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  renderCanvas();
}

function updateWorkflow() {
  const complete = {
    stepPhoto: Boolean(state.sourceBitmap),
    stepMask: state.selectedPixels > 0,
    stepMode: Boolean(state.resultImageData),
    stepReferences: true,
    stepTransfer: Boolean(state.resultImageData),
    stepGloss: Boolean(state.resultImageData),
    stepCompare: Boolean(state.resultImageData),
    stepExport: state.lastExported,
  };
  for (const button of elements.stepNav.querySelectorAll('button')) button.classList.toggle('is-complete', complete[button.dataset.step]);
  elements.saveProject.disabled = state.busy || !state.sourceBitmap;
  elements.exportResult.disabled = state.busy || !hasValidExportState();
}

function updateSummaries() {
  const glossLabel = elements.glossLevel.options[elements.glossLevel.selectedIndex].textContent;
  elements.summaryMode.textContent = state.mode === 'refresh' ? 'Recoloro-Auffrischung' : 'Hypothetische Farbvariante';
  elements.summaryColour.textContent = state.mode === 'refresh' ? 'vorhandene Farbfamilie' : ENGINE.rgbToHex(state.targetRgb.r, state.targetRgb.g, state.targetRgb.b);
  elements.summaryGloss.textContent = glossLabel;
}

function updateTargetUi() {
  const hex = ENGINE.rgbToHex(state.targetRgb.r, state.targetRgb.g, state.targetRgb.b);
  elements.targetSwatch.style.background = hex;
  elements.targetColourLabel.textContent = hex;
  elements.targetLabLabel.textContent = `Lab ${state.targetLab.l.toFixed(1)} / ${state.targetLab.a.toFixed(1)} / ${state.targetLab.b.toFixed(1)}`;
  elements.hexInput.value = hex;
  elements.redInput.value = String(state.targetRgb.r);
  elements.greenInput.value = String(state.targetRgb.g);
  elements.blueInput.value = String(state.targetRgb.b);
  elements.labLInput.value = state.targetLab.l.toFixed(1);
  elements.labAInput.value = state.targetLab.a.toFixed(1);
  elements.labBInput.value = state.targetLab.b.toFixed(1);
  elements.colourNotice.className = 'notice';
  elements.colourNotice.textContent = 'Hypothetische Farbvariante – nicht als erreichbares Recoloro-Ergebnis bestätigt.';
  updateSummaries();
}

function targetFromHex() {
  const rgb = ENGINE.hexToRgb(elements.hexInput.value);
  if (!rgb) {
    actionable(elements.colourNotice, 'HEX-Wert ist ungültig', 'Schritt 3', 'Sechs Hexadezimalstellen verwenden, zum Beispiel #1F5AA6.');
    return;
  }
  state.targetRgb = rgb;
  state.targetLab = ENGINE.rgbToLab(rgb.r, rgb.g, rgb.b);
  updateTargetUi();
  debouncedProcess();
}

function targetFromRgb() {
  const values = [elements.redInput, elements.greenInput, elements.blueInput].map(input => Number(input.value));
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 255)) {
    actionable(elements.colourNotice, 'RGB-Wert liegt ausserhalb 0 bis 255', 'Schritt 3', 'Alle drei Kanäle mit gültigen ganzen Zahlen ausfüllen.');
    return;
  }
  state.targetRgb = { r: Math.round(values[0]), g: Math.round(values[1]), b: Math.round(values[2]) };
  state.targetLab = ENGINE.rgbToLab(state.targetRgb.r, state.targetRgb.g, state.targetRgb.b);
  updateTargetUi();
  debouncedProcess();
}

function targetFromLab() {
  const l = Number(elements.labLInput.value);
  const a = Number(elements.labAInput.value);
  const b = Number(elements.labBInput.value);
  if (![l, a, b].every(Number.isFinite) || l < 0 || l > 100 || a < -128 || a > 127 || b < -128 || b > 127) {
    actionable(elements.colourNotice, 'Lab-Wert liegt ausserhalb des Eingabebereichs', 'Schritt 3', 'L* 0–100 sowie a* und b* −128 bis 127 verwenden.');
    return;
  }
  state.targetLab = { l, a, b };
  state.targetRgb = ENGINE.labToRgb(l, a, b);
  updateTargetUi();
  debouncedProcess();
}

async function importPalette(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.licenceAcknowledged !== true || typeof parsed.source !== 'string' || typeof parsed.version !== 'string') {
      throw new Error('Quelle, Version oder die ausdrückliche Lizenzbestätigung fehlt.');
    }
    if (!Array.isArray(parsed.colours) || !parsed.colours.length || parsed.colours.length > 5000) {
      throw new Error('Die Farbliste fehlt oder enthält mehr als 5’000 Einträge.');
    }
    const colours = parsed.colours.map((colour, index) => {
      let lab;
      let rgb;
      if (colour.lab && [colour.lab.l, colour.lab.a, colour.lab.b].every(Number.isFinite)) {
        lab = { l: colour.lab.l, a: colour.lab.a, b: colour.lab.b };
        rgb = ENGINE.labToRgb(lab.l, lab.a, lab.b);
      } else {
        rgb = ENGINE.hexToRgb(colour.hex);
        if (!rgb) throw new Error(`Farbwert ${index + 1} besitzt weder gültiges Lab noch HEX.`);
        lab = ENGINE.rgbToLab(rgb.r, rgb.g, rgb.b);
      }
      return { id: String(colour.id || index + 1), label: String(colour.label || colour.id || `Farbe ${index + 1}`), lab, rgb };
    });
    state.palette = { source: parsed.source, version: parsed.version, colours };
    elements.paletteSelect.replaceChildren(...colours.map((colour, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${colour.id} · ${colour.label}`;
      return option;
    }));
    elements.paletteField.hidden = false;
    elements.colourSource.value = parsed.source;
    elements.colourVersion.value = parsed.version;
    applyPaletteColour(0);
    actionable(elements.colourNotice, 'Lokale Farbdaten importiert', 'Schritt 4', `${colours.length} Werte aus ${parsed.source}, Version ${parsed.version}; Lizenzinhalt bleibt in Verantwortung des Nutzers.`, 'ok');
  } catch (error) {
    actionable(elements.colourNotice, error.message, 'Schritt 4 / Farbdatenimport', 'Nur autorisierte JSON-Daten mit source, version, licenceAcknowledged:true und colours verwenden.');
  }
}

function applyPaletteColour(index) {
  const colour = state.palette?.colours?.[index];
  if (!colour) return;
  state.targetLab = { ...colour.lab };
  state.targetRgb = { ...colour.rgb };
  elements.referenceName.value = `${colour.id} ${colour.label}`.trim();
  updateTargetUi();
  debouncedProcess();
}

function hasValidExportState() {
  return Boolean(state.sourceBitmap && state.resultImageData && state.selectedPixels && (elements.exportPng.checked || elements.exportWebp.checked));
}

function serializeProject() {
  if (!state.sourceBitmap || !state.sourceDataUrl) throw new Error('Es ist kein Originalfoto geladen.');
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    algorithmVersion: ALGORITHM_VERSION,
    savedAt: new Date().toISOString(),
    source: { ...state.sourceMeta, dataUrl: state.sourceDataUrl },
    working: { width: state.workCanvas.width, height: state.workCanvas.height },
    samples: state.samples.map(sample => ({
      id: sample.id,
      x: sample.x / state.workCanvas.width,
      y: sample.y / state.workCanvas.height,
      rgb: sample.rgb,
      lab: sample.lab,
    })),
    mask: {
      width: state.workCanvas.width,
      height: state.workCanvas.height,
      encoding: 'rle-count-value-v1',
      data: ENGINE.rleEncode(state.baseMask),
    },
    selection: { ...currentMaskSettings(), brushSize: Number(elements.brushSize.value), feather: Number(elements.feather.value) },
    visualization: {
      mode: state.mode,
      intensity: Number(elements.intensity.value),
      targetLab: state.targetLab,
      targetRgb: state.targetRgb,
      glossLevel: Number(elements.glossLevel.value),
      glossEffect: Number(elements.glossEffect.value),
    },
    colourReference: {
      projectName: elements.referenceName.value,
      source: elements.colourSource.value,
      version: elements.colourVersion.value,
      automaticConversionFromName: false,
    },
    export: {
      name: safeFileBase(elements.exportName.value),
      size: elements.exportSize.value,
      png: elements.exportPng.checked,
      webp: elements.exportWebp.checked,
      visibleDisclaimer: elements.includeNotice.checked,
      disclaimer: DISCLAIMER,
    },
  };
}

async function saveBlob(blob, suggestedName, types) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = suggestedName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return { method: 'download', name: suggestedName };
}

async function saveProject() {
  try {
    const project = serializeProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const name = `${safeFileBase(elements.exportName.value)}.recoloro.json`;
    const result = await saveBlob(blob, name, [{ description: 'RECOLORO-Projekt', accept: { 'application/json': ['.json'] } }]);
    if (result.method === 'cancelled') {
      setInlineStatus(elements.exportStatus, 'Speichern wurde abgebrochen. Der aktuelle Zustand im Browser bleibt erhalten.');
      return;
    }
    setInlineStatus(elements.exportStatus, `Projektdatei erstellt; Browser-Download ausgelöst: ${result.name} · ${formatBytes(blob.size)} · Original und Bearbeitungszustand sind gemeinsam wiederherstellbar.`, 'ok');
  } catch (error) {
    setInlineStatus(elements.exportStatus, `${error.message} · Schritt 8 / Projektspeicherung · Freien Speicher prüfen und erneut versuchen.`, 'error');
  }
}

function restoreInputs(project) {
  const selection = project.selection || {};
  elements.selectionMode.value = selection.selectionMode === 'global' ? 'global' : 'connected';
  elements.colourTolerance.value = String(selection.colourTolerance ?? 22);
  elements.lightTolerance.value = String(selection.lightTolerance ?? 25);
  elements.edgeSensitivity.value = String(selection.edgeSensitivity ?? 55);
  elements.brushSize.value = String(selection.brushSize ?? 40);
  elements.feather.value = String(selection.feather ?? 3);
  const visualization = project.visualization || {};
  state.mode = visualization.mode === 'free' ? 'free' : 'refresh';
  for (const input of elements.modeInputs) input.checked = input.value === state.mode;
  elements.intensity.value = String(visualization.intensity ?? 65);
  state.targetLab = visualization.targetLab || { l: 38.4, a: 13.9, b: -45.7 };
  state.targetRgb = visualization.targetRgb || ENGINE.labToRgb(state.targetLab.l, state.targetLab.a, state.targetLab.b);
  elements.glossLevel.value = String(visualization.glossLevel ?? 2);
  elements.glossEffect.value = String(visualization.glossEffect ?? 70);
  const reference = project.colourReference || {};
  elements.referenceName.value = reference.projectName || '';
  elements.colourSource.value = reference.source || 'Manuelle Eingabe';
  elements.colourVersion.value = reference.version || '';
  const exportSettings = project.export || {};
  elements.exportName.value = exportSettings.name || 'objekt-farbvorschau';
  elements.exportSize.value = exportSettings.size === 'web' ? 'web' : 'original';
  elements.exportPng.checked = exportSettings.png !== false;
  elements.exportWebp.checked = exportSettings.webp !== false;
  elements.includeNotice.checked = exportSettings.visibleDisclaimer !== false;
  syncControlLabels();
  syncModeUi();
  updateTargetUi();
}

async function openProjectFile(file) {
  setBusy(true);
  try {
    const project = JSON.parse(await file.text());
    if (project.schemaVersion !== PROJECT_SCHEMA_VERSION || !project.source?.dataUrl || !project.mask) {
      throw new Error('Die Datei ist kein unterstütztes RECOLORO-Projekt der Schema-Version 1.');
    }
    const blob = dataUrlToBlob(project.source.dataUrl);
    const decoded = await orientedBitmap(blob);
    const savedQuarterTurns = Number(project.source.manualQuarterTurns) || 0;
    const bitmap = savedQuarterTurns ? await rotatedBitmap(decoded.bitmap, savedQuarterTurns) : decoded.bitmap;
    if (savedQuarterTurns) decoded.bitmap.close?.();
    await installSource(bitmap, project.source.dataUrl, {
      name: project.source.name || 'projektbild',
      type: project.source.type || blob.type,
      size: project.source.size || blob.size,
      lastModified: project.source.lastModified || 0,
      exifOrientation: decoded.exifOrientation,
      orientationFallback: decoded.orientationFallback,
      manualQuarterTurns: savedQuarterTurns,
    });
    if (project.working.width !== state.workCanvas.width || project.working.height !== state.workCanvas.height || project.mask.width !== state.workCanvas.width || project.mask.height !== state.workCanvas.height) {
      throw new Error('Arbeitsauflösung und gespeicherte Maske stimmen nicht überein.');
    }
    restoreInputs(project);
    state.samples = (project.samples || []).map(sample => ({
      ...sample,
      x: sample.x * state.workCanvas.width,
      y: sample.y * state.workCanvas.height,
      rgb: { ...sample.rgb }, lab: { ...sample.lab },
    }));
    state.baseMask = ENGINE.rleDecode(project.mask.data, state.workCanvas.width * state.workCanvas.height);
    state.maskHistory = [];
    state.maskFuture = [];
    renderSamples();
    await refreshMaskResult();
    const versionNote = project.algorithmVersion === ALGORITHM_VERSION ? 'Algorithmusversion stimmt überein.' : `Projekt nutzt ${project.algorithmVersion}; neu berechnet mit ${ALGORITHM_VERSION}.`;
    setInlineStatus(elements.exportStatus, `Projekt vollständig wiederhergestellt. ${versionNote}`, project.algorithmVersion === ALGORITHM_VERSION ? 'ok' : '');
    setActiveStep('stepCompare', true);
  } catch (error) {
    setInlineStatus(elements.exportStatus, `${error.message} · Projekt öffnen · Eine unveränderte .recoloro.json-Datei auswählen.`, 'error');
  } finally {
    setBusy(false);
  }
}

function exportDimensions() {
  const { width, height } = state.sourceMeta;
  if (elements.exportSize.value === 'web') {
    const scale = Math.min(1, WEB_EXPORT_EDGE / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale), reduced: scale < 1 };
  }
  return { width, height, reduced: false };
}

function scaledBaseMask(width, height) {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = state.workCanvas.width;
  sourceCanvas.height = state.workCanvas.height;
  const context = sourceCanvas.getContext('2d');
  const image = context.createImageData(sourceCanvas.width, sourceCanvas.height);
  for (let index = 0; index < state.baseMask.length; index += 1) {
    const value = state.baseMask[index] ? 255 : 0;
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetContext = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetContext.imageSmoothingEnabled = false;
  targetContext.drawImage(sourceCanvas, 0, 0, width, height);
  const data = targetContext.getImageData(0, 0, width, height).data;
  const mask = new Uint8ClampedArray(width * height);
  for (let index = 0; index < mask.length; index += 1) mask[index] = data[index * 4] ? 255 : 0;
  return mask;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`${type}-Kodierung ist in diesem Browser fehlgeschlagen.`)), type, quality));
}

function drawVisibleNotice(canvas) {
  const context = canvas.getContext('2d');
  const barHeight = Math.max(34, Math.round(canvas.height * 0.055));
  context.fillStyle = 'rgba(20,24,28,.78)';
  context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
  context.fillStyle = '#fff';
  context.font = `${Math.max(16, Math.round(barHeight * 0.38))}px Segoe UI, Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Unverbindliche Visualisierung', canvas.width / 2, canvas.height - (barHeight / 2), canvas.width - 30);
}

async function exportResult() {
  if (!hasValidExportState()) {
    setInlineStatus(elements.exportStatus, 'Foto, nicht leere Maske oder Exportformat fehlt · Schritt 8 · Fehlenden Pflichtschritt ergänzen.', 'error');
    return;
  }
  const dimensions = exportDimensions();
  if (dimensions.width * dimensions.height > MAX_EXPORT_PIXELS) {
    setInlineStatus(elements.exportStatus, `Originalexport hätte ${(dimensions.width * dimensions.height / 1_000_000).toFixed(1)} Megapixel · Schritt 8 · Web-Vorschau wählen oder ein kleineres Original verwenden.`, 'error');
    return;
  }
  setBusy(true);
  setProgress(elements.exportProgress, 8);
  setInlineStatus(elements.exportStatus, `Vollauflösung ${dimensions.width} × ${dimensions.height} px wird lokal vorbereitet …`);
  try {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = dimensions.width;
    sourceCanvas.height = dimensions.height;
    const context = sourceCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(state.sourceBitmap, 0, 0, dimensions.width, dimensions.height);
    const sourceData = context.getImageData(0, 0, dimensions.width, dimensions.height);
    setProgress(elements.exportProgress, 24);
    let mask = scaledBaseMask(dimensions.width, dimensions.height);
    const featherScale = dimensions.width / state.workCanvas.width;
    const maskBuffer = mask.buffer;
    const feathered = await runWorker('feather', {
      mask: maskBuffer,
      width: dimensions.width,
      height: dimensions.height,
      radius: Math.round(Number(elements.feather.value) * featherScale),
    }, [maskBuffer]);
    mask = new Uint8ClampedArray(feathered);
    setProgress(elements.exportProgress, 44);
    const pixelBuffer = sourceData.data.buffer;
    const alphaBuffer = mask.buffer;
    const output = await runWorker('process', {
      buffer: pixelBuffer,
      mask: alphaBuffer,
      width: dimensions.width,
      height: dimensions.height,
      options: currentProcessOptions(),
    }, [pixelBuffer, alphaBuffer]);
    setProgress(elements.exportProgress, 76);
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = dimensions.width;
    outputCanvas.height = dimensions.height;
    outputCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(output), dimensions.width, dimensions.height), 0, 0);
    if (elements.includeNotice.checked) drawVisibleNotice(outputCanvas);
    const base = safeFileBase(elements.exportName.value);
    const saved = [];
    if (elements.exportPng.checked) {
      const png = await canvasToBlob(outputCanvas, 'image/png');
      const result = await saveBlob(png, `${base}.png`, [{ description: 'PNG-Vorschau', accept: { 'image/png': ['.png'] } }]);
      if (result.method !== 'cancelled') saved.push(`${result.name} (${formatBytes(png.size)})`);
    }
    setProgress(elements.exportProgress, 88);
    if (elements.exportWebp.checked) {
      const webp = await canvasToBlob(outputCanvas, 'image/webp', 0.92);
      const result = await saveBlob(webp, `${base}.webp`, [{ description: 'WebP-Vorschau', accept: { 'image/webp': ['.webp'] } }]);
      if (result.method !== 'cancelled') saved.push(`${result.name} (${formatBytes(webp.size)})`);
    }
    setProgress(elements.exportProgress, 100);
    state.lastExported = saved.length > 0;
    setInlineStatus(elements.exportStatus, saved.length ? `Export erstellt; Browser-Download ausgelöst: ${saved.join(' · ')} · ${dimensions.width} × ${dimensions.height} px.` : 'Export wurde abgebrochen; der Projektzustand bleibt erhalten.', saved.length ? 'ok' : '');
    window.setTimeout(() => setProgress(elements.exportProgress, 0), 650);
    updateWorkflow();
  } catch (error) {
    setInlineStatus(elements.exportStatus, `${error.message} · Schritt 8 / Vollauflösungsexport · Web-Vorschau wählen, Speicher freigeben oder erneut versuchen.`, 'error');
    setProgress(elements.exportProgress, 0);
  } finally {
    setBusy(false);
  }
}

function syncModeUi() {
  state.mode = elements.modeInputs.find(input => input.checked)?.value || 'refresh';
  elements.freeColourFields.hidden = state.mode !== 'free';
  elements.intensityField.hidden = state.mode !== 'refresh';
  updateSummaries();
  debouncedProcess();
}

function syncControlLabels() {
  elements.colourToleranceLabel.textContent = `${toleranceWord(Number(elements.colourTolerance.value), 17, 30)} · ΔE ${elements.colourTolerance.value}`;
  elements.lightToleranceLabel.textContent = `${toleranceWord(Number(elements.lightTolerance.value), 19, 35)} · ±${elements.lightTolerance.value} L*`;
  elements.edgeSensitivityLabel.textContent = `${toleranceWord(100 - Number(elements.edgeSensitivity.value), 30, 58)} · ${elements.edgeSensitivity.value} %`;
  elements.brushSizeLabel.textContent = `${elements.brushSize.value} px`;
  elements.featherLabel.textContent = `${elements.feather.value} px`;
  elements.intensityLabel.textContent = `${elements.intensity.value} %`;
  elements.glossEffectLabel.textContent = `${elements.glossEffect.value} %`;
  elements.compareLabel.textContent = `${elements.compareSlider.value} %`;
}

function bindEvents() {
  elements.choosePhoto.addEventListener('click', () => elements.photoInput.click());
  elements.photoInput.addEventListener('change', () => elements.photoInput.files[0] && loadPhotoFile(elements.photoInput.files[0]));
  elements.rotateLeft.addEventListener('click', () => rotateLoadedPhoto(-1));
  elements.rotateRight.addEventListener('click', () => rotateLoadedPhoto(1));
  elements.clearPhoto.addEventListener('click', clearPhoto);
  elements.openProject.addEventListener('click', () => elements.projectInput.click());
  elements.projectInput.addEventListener('change', () => elements.projectInput.files[0] && openProjectFile(elements.projectInput.files[0]));
  elements.dropzone.addEventListener('click', () => elements.photoInput.click());
  elements.dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') elements.photoInput.click(); });
  elements.dropzone.addEventListener('dragover', event => { event.preventDefault(); elements.dropzone.classList.add('is-dragging'); });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('is-dragging'));
  elements.dropzone.addEventListener('drop', event => {
    event.preventDefault();
    elements.dropzone.classList.remove('is-dragging');
    const file = event.dataTransfer.files[0];
    if (file) loadPhotoFile(file);
  });
  elements.stepNav.addEventListener('click', event => {
    const button = event.target.closest('button[data-step]');
    if (button) setActiveStep(button.dataset.step, true);
  });
  for (const step of elements.steps) step.addEventListener('click', () => setActiveStep(step.id));
  for (const button of elements.maskTools.querySelectorAll('button[data-tool]')) {
    button.addEventListener('click', event => {
      event.stopPropagation();
      setActiveStep('stepMask');
      setTool(button.dataset.tool);
      focusWorkspaceForTool();
    });
  }
  elements.finishPolygon.addEventListener('click', finishPolygon);
  elements.cancelPolygon.addEventListener('click', () => { state.polygon = []; updatePolygonActions(); renderCanvas(); });
  elements.undoMask.addEventListener('click', undoMask);
  elements.redoMask.addEventListener('click', redoMask);
  elements.resetMask.addEventListener('click', () => {
    recordMaskHistory();
    state.baseMask.fill(0);
    state.samples = [];
    renderSamples();
    refreshMaskResult();
  });
  elements.rebuildMask.addEventListener('click', () => rebuildMask());
  elements.growMask.addEventListener('click', () => modifyMask(2));
  elements.shrinkMask.addEventListener('click', () => modifyMask(-2));
  for (const input of [elements.selectionMode, elements.colourTolerance, elements.lightTolerance, elements.edgeSensitivity]) {
    input.addEventListener('input', () => { syncControlLabels(); if (state.samples.length) debouncedRebuildMask(); });
  }
  elements.brushSize.addEventListener('input', syncControlLabels);
  elements.feather.addEventListener('input', () => { syncControlLabels(); debouncedFeather(); });
  for (const input of elements.modeInputs) input.addEventListener('change', syncModeUi);
  elements.intensity.addEventListener('input', () => { syncControlLabels(); debouncedProcess(); updateSummaries(); });
  elements.hexInput.addEventListener('input', debounce(targetFromHex, 120));
  for (const input of [elements.redInput, elements.greenInput, elements.blueInput]) input.addEventListener('input', debounce(targetFromRgb, 120));
  for (const input of [elements.labLInput, elements.labAInput, elements.labBInput]) input.addEventListener('input', debounce(targetFromLab, 120));
  elements.importPalette.addEventListener('click', () => elements.paletteInput.click());
  elements.paletteInput.addEventListener('change', () => elements.paletteInput.files[0] && importPalette(elements.paletteInput.files[0]));
  elements.paletteSelect.addEventListener('change', () => applyPaletteColour(Number(elements.paletteSelect.value)));
  elements.glossLevel.addEventListener('change', () => { updateSummaries(); debouncedProcess(); });
  elements.glossEffect.addEventListener('input', () => { syncControlLabels(); debouncedProcess(); });
  elements.viewButtons.addEventListener('click', event => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    state.viewMode = button.dataset.view;
    for (const candidate of elements.viewButtons.querySelectorAll('button')) candidate.classList.toggle('is-active', candidate === button);
    renderCanvas();
  });
  elements.compareSlider.addEventListener('input', () => { syncControlLabels(); renderCanvas(); });
  elements.saveProject.addEventListener('click', saveProject);
  elements.exportResult.addEventListener('click', exportResult);
  for (const input of [elements.exportPng, elements.exportWebp]) input.addEventListener('change', updateWorkflow);
  elements.editorCanvas.addEventListener('pointerdown', handlePointerDown);
  elements.editorCanvas.addEventListener('pointermove', handlePointerMove);
  elements.editorCanvas.addEventListener('pointerup', handlePointerUp);
  elements.editorCanvas.addEventListener('pointercancel', handlePointerUp);
  elements.editorCanvas.addEventListener('dblclick', () => { if (state.activeTool.startsWith('polygon')) finishPolygon(); });
  elements.editorCanvas.addEventListener('wheel', event => {
    if (!state.workImageData) return;
    event.preventDefault();
    const rect = elements.editorCanvas.getBoundingClientRect();
    setViewZoom(state.view.zoom * (event.deltaY < 0 ? 1.16 : 0.86), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  elements.fitView.addEventListener('click', () => { state.view = { zoom: 1, panX: 0, panY: 0 }; renderCanvas(); });
  elements.actualPixels.addEventListener('click', () => {
    const rect = elements.editorCanvas.getBoundingClientRect();
    const fit = viewGeometry(rect.width, rect.height).fit;
    state.view = { zoom: 1 / fit, panX: 0, panY: 0 };
    renderCanvas();
  });
  elements.zoomIn.addEventListener('click', () => setViewZoom(state.view.zoom * 1.25));
  elements.zoomOut.addEventListener('click', () => setViewZoom(state.view.zoom / 1.25));
  window.addEventListener('keydown', event => {
    if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      if (!state.quickOriginal) { state.quickOriginal = true; renderCanvas(); }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redoMask(); else undoMask();
    }
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') { state.quickOriginal = false; renderCanvas(); } });
  new ResizeObserver(renderCanvas).observe(elements.canvasShell);
}

function initialise() {
  if (!ENGINE) {
    elements.engineStatus.textContent = 'Farb-Engine fehlt';
    elements.engineStatus.className = 'badge error';
    return;
  }
  initialiseWorker();
  bindEvents();
  state.targetLab = ENGINE.rgbToLab(state.targetRgb.r, state.targetRgb.g, state.targetRgb.b);
  syncControlLabels();
  updateTargetUi();
  updateSummaries();
  updateWorkflow();
  setTool('sample');
  renderCanvas();
}

initialise();
