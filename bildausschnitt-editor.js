/* RECOLORO – lokaler Hero-Bildworkflow. Keine Server-Schreibschnittstelle. */
'use strict';

const clone = value => JSON.parse(JSON.stringify(value));
const sourceConfig = window.RECOLORO_IMAGE_CONFIG;

if (!sourceConfig || !Array.isArray(sourceConfig.pairs)) {
  throw new Error('Die zentrale Bildkonfiguration image-config.js fehlt oder ist ungültig.');
}

let config = clone(sourceConfig);
let savedConfig = clone(sourceConfig);
let activePair = config.pairs[0];
let activeSide = 'before';
let websiteRoot = null;
let working = false;
const imageCache = new Map();
const sliderPositions = { desktop: 50, mobile: 50 };

const elements = {
  pairSelect: document.querySelector('#pairSelect'),
  pairId: document.querySelector('#pairId'),
  component: document.querySelector('#component'),
  group: document.querySelector('#group'),
  displayTitle: document.querySelector('#displayTitle'),
  beforeAlt: document.querySelector('#beforeAlt'),
  afterAlt: document.querySelector('#afterAlt'),
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
  mobileControls: document.querySelector('#mobileControls'),
};

function currentFrame(device) {
  activePair.crop ||= {};
  activePair.crop[device] ||= { x: 50, y: 50, zoom: 1 };
  return activePair.crop[device];
}

function setStatus(message, type = '') {
  elements.workflowOutput.textContent = message;
  elements.workflowOutput.className = `output${type ? ` is-${type}` : ''}`;
}

function setRootStatus(message, type = '') {
  elements.rootStatus.textContent = message;
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
    <div class="preview-side before"><div class="preview-image" data-preview-image="before"></div></div>
    <div class="preview-side after"><div class="preview-image" data-preview-image="after"></div></div>
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

function paintPreview(container, device) {
  const frame = currentFrame(device);
  const afterLayer = container.querySelector('.preview-side.after');
  const divider = container.querySelector('.divider');
  const slider = sliderPositions[device];
  afterLayer.style.clipPath = `inset(0 0 0 ${slider}%)`;
  divider.style.left = `${slider}%`;
  container.querySelector('[data-preview-title]').textContent = activePair.displayTitle || '';

  ['before', 'after'].forEach(side => {
    const target = container.querySelector(`[data-preview-image="${side}"]`);
    getImage(activePair.source?.[side])
      .then(image => applyBackground(target, image, frame))
      .catch(error => {
        target.style.backgroundImage = '';
        showPairWarnings([error.message]);
      });
  });
}

function controlMarkup(device, key, label, min, max, step) {
  const value = currentFrame(device)[key];
  const shown = key === 'zoom' ? Number(value).toFixed(2) : Math.round(value);
  return `<div class="control"><span><b>${label}</b><output>${shown}${key === 'zoom' ? '×' : '%'}</output></span><div class="control-row"><button type="button" data-adjust="-1" data-device="${device}" data-key="${key}" aria-label="${label} verkleinern">−</button><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-device="${device}" data-key="${key}"><button type="button" data-adjust="1" data-device="${device}" data-key="${key}" aria-label="${label} vergrössern">+</button></div></div>`;
}

function renderControls(device) {
  elements[`${device}Controls`].innerHTML = [
    controlMarkup(device, 'x', 'Horizontal', 0, 100, 1),
    controlMarkup(device, 'y', 'Vertikal', 0, 100, 1),
    controlMarkup(device, 'zoom', 'Bildgrösse', 0.7, 1.6, 0.05),
  ].join('');
}

function renderPreviews() {
  paintPreview(elements.desktopPreview, 'desktop');
  paintPreview(elements.mobilePreview, 'mobile');
  renderControls('desktop');
  renderControls('mobile');
  document.querySelectorAll('[data-side]').forEach(button => button.classList.toggle('is-active', button.dataset.side === activeSide));
}

function renderFields() {
  elements.pairId.value = activePair.id;
  elements.component.value = activePair.component || '';
  elements.group.value = activePair.group || '';
  elements.displayTitle.value = activePair.displayTitle || '';
  elements.beforeAlt.value = activePair.alt?.before || '';
  elements.afterAlt.value = activePair.alt?.after || '';
  elements.heroEligible.checked = Boolean(activePair.heroEligible);
  elements.heroActive.checked = Boolean(activePair.heroActive);
  elements.heroActive.disabled = activePair.id === 'reco-107' || !activePair.heroEligible || !activePair.publicApproved;
  elements.heroOrder.value = Number.isFinite(activePair.heroOrder) ? activePair.heroOrder : '';
  elements.heroOrder.disabled = !activePair.heroActive;
  inspectPair();
  renderPreviews();
}

function showPairWarnings(messages) {
  const unique = [...new Set(messages.filter(Boolean))];
  elements.pairWarning.textContent = unique.join(' ');
  elements.pairWarning.classList.toggle('is-error', unique.some(message => /fehlt|nicht gefunden|darf nicht|unvollständig/i.test(message)));
}

async function inspectPair() {
  const inspectedPair = activePair;
  const warnings = [];
  if (inspectedPair.id === 'reco-107') warnings.push('Reco 107 bleibt wegen nicht deckungsgleicher Aufnahmen und missverständlicher Glaswirkung bewusst öffentlich gesperrt und Hero-inaktiv.');
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
  activePair.heroEligible = elements.heroEligible.checked;
  activePair.heroActive = activePair.id === 'reco-107' ? false : elements.heroActive.checked;
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
    if (pair.id === 'reco-107' && pair.heroActive) errors.push('Reco 107 darf nicht Hero-aktiv sein.');
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

function canvasBlob(image, frame, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#f3f4f5';
  context.fillRect(0, 0, width, height);
  const zoom = Math.max(0.7, Math.min(1.6, Number(frame.zoom) || 1));
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = Math.max(0, Math.min(100, Number(frame.x) || 50));
  const y = Math.max(0, Math.min(100, Number(frame.y) || 50));
  const drawX = -((drawWidth - width) * x / 100);
  const drawY = -((drawHeight - height) * y / 100);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('WebP-Ausgabe wird von diesem Browser nicht unterstützt.')), 'image/webp', quality));
}

async function generateSelectedPair() {
  if (!activePair.heroEligible) return [];
  const defaults = config.heroDefaults;
  const names = outputNames(activePair);
  const [before, after] = await Promise.all([getImage(activePair.source.before), getImage(activePair.source.after)]);
  const results = [];

  for (const device of ['desktop', 'mobile']) {
    const size = defaults[device];
    for (const side of ['before', 'after']) {
      const image = side === 'before' ? before : after;
      const blob = await canvasBlob(image, currentFrame(device), size.width, size.height, defaults.quality);
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

async function prepareFiles() {
  syncFieldsToPair();
  const errors = validateConfig();
  if (errors.length) throw new Error(errors.join(' '));
  const images = await generateSelectedPair();
  const fileErrors = await validateReferencedFiles(images.length > 0);
  if (fileErrors.length) throw new Error(fileErrors.join(' '));
  return { images, configuration: configText() };
}

async function saveAndApply() {
  if (working) return;
  setWorking(true);
  setStatus('WebP-Dateien werden erzeugt und geprüft …');
  try {
    const prepared = await prepareFiles();
    if (!websiteRoot) {
      if (!window.showDirectoryPicker) {
        prepared.images.forEach(file => download(file.path.split('/').pop(), file.blob));
        download('image-config.js', prepared.configuration);
        setStatus('Direkter Ordnerzugriff wird nicht unterstützt. Dateien wurden als Downloads bereitgestellt.', 'ok');
        return;
      }
      throw new Error('Bitte zuerst den lokalen Website-Ordner auswählen.');
    }
    if (await websiteRoot.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Schreibzugriff auf den Website-Ordner wurde nicht erteilt.');
    await verifyWebsiteRoot(websiteRoot);
    for (const file of prepared.images) await writePath(websiteRoot, file.path, file.blob);
    await writePath(websiteRoot, 'image-config.js', prepared.configuration);
    savedConfig = clone(config);
    const imageSummary = prepared.images.length ? `${prepared.images.length} WebP-Dateien und ` : '';
    setStatus(`${imageSummary}image-config.js wurden übernommen. Website jetzt im zweiten Tab neu laden und prüfen.`, 'ok');
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
    setStatus(`${prepared.images.length} WebP-Dateien und die zentrale Konfiguration wurden heruntergeladen.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Download fehlgeschlagen.', 'error');
  } finally {
    setWorking(false);
  }
}

function initialise() {
  config.groups.forEach(group => elements.group.add(new Option(group.label, group.id)));
  config.pairs.forEach(pair => elements.pairSelect.add(new Option(`${pair.id.toUpperCase()} · ${pair.internalLabel}`, pair.id)));
  buildHeroPreview(elements.desktopPreview, 'desktop');
  buildHeroPreview(elements.mobilePreview, 'mobile');

  elements.pairSelect.addEventListener('change', () => {
    activePair = config.pairs.find(pair => pair.id === elements.pairSelect.value);
    activeSide = 'before';
    sliderPositions.desktop = 50;
    sliderPositions.mobile = 50;
    renderFields();
  });

  document.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => {
    activeSide = button.dataset.side;
    const position = activeSide === 'before' ? 98 : 2;
    sliderPositions.desktop = position;
    sliderPositions.mobile = position;
    renderPreviews();
  }));

  [elements.component, elements.group, elements.displayTitle, elements.beforeAlt, elements.afterAlt, elements.heroEligible, elements.heroActive, elements.heroOrder]
    .forEach(input => input.addEventListener('change', syncFieldsToPair));

  document.addEventListener('input', event => {
    const input = event.target.closest('input[data-device]');
    if (!input) return;
    currentFrame(input.dataset.device)[input.dataset.key] = Number(input.value);
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
    renderFields();
    setStatus('Änderungen am ausgewählten Paar wurden verworfen.');
  });

  window.addEventListener('resize', renderPreviews, { passive: true });
  renderFields();
  restoreRootHandle();
  if (!window.showDirectoryPicker) setRootStatus('Ordnerzugriff nicht unterstützt – Download-Fallback verfügbar');
}

initialise();
