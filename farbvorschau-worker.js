/* RECOLORO Farbvisualisierung – lokaler Web Worker. */
'use strict';

importScripts('farbvorschau-engine.js');

let sourceCache = null;
let maskCache = null;

self.addEventListener('message', event => {
  const { id, type, payload } = event.data;
  try {
    let result;
    if (type === 'setSource') {
      const imageData = new ImageData(new Uint8ClampedArray(payload.buffer), payload.width, payload.height);
      sourceCache = {
        id: payload.sourceId,
        imageData,
        labs: RecoloroColorEngine.imageLabs(imageData),
      };
      maskCache = null;
      self.postMessage({ id, ok: true, buffer: new ArrayBuffer(0) });
      return;
    }
    if (type === 'setMask') {
      if (!sourceCache || sourceCache.id !== payload.sourceId) throw new Error('Arbeitsfoto ist im Worker nicht vorbereitet.');
      const mask = new Uint8ClampedArray(payload.mask);
      const selected = [];
      for (let index = 0; index < mask.length; index += 1) if (mask[index]) selected.push(index);
      maskCache = { sourceId: payload.sourceId, mask, indices: Uint32Array.from(selected) };
      self.postMessage({ id, ok: true, buffer: new ArrayBuffer(0) });
      return;
    }
    if (type === 'deriveMask') {
      if (!sourceCache || sourceCache.id !== payload.sourceId) throw new Error('Arbeitsfoto ist im Worker nicht vorbereitet.');
      result = RecoloroColorEngine.deriveMask(sourceCache.imageData, payload.samples, payload.options, sourceCache.labs);
      self.postMessage({ id, ok: true, buffer: result.buffer }, [result.buffer]);
      return;
    }
    if (type === 'morphology') {
      result = RecoloroColorEngine.morphology(
        new Uint8ClampedArray(payload.mask), payload.width, payload.height, payload.amount,
      );
      self.postMessage({ id, ok: true, buffer: result.buffer }, [result.buffer]);
      return;
    }
    if (type === 'feather') {
      result = RecoloroColorEngine.innerFeather(
        new Uint8ClampedArray(payload.mask), payload.width, payload.height, payload.radius,
      );
      self.postMessage({ id, ok: true, buffer: result.buffer }, [result.buffer]);
      return;
    }
    if (type === 'process') {
      if (payload.sourceId) {
        if (!sourceCache || sourceCache.id !== payload.sourceId) throw new Error('Arbeitsfoto ist im Worker nicht vorbereitet.');
        if (!maskCache || maskCache.sourceId !== payload.sourceId) throw new Error('Arbeitsmaske ist im Worker nicht vorbereitet.');
        result = RecoloroColorEngine.processImage(sourceCache.imageData, maskCache.mask, payload.options, sourceCache.labs, maskCache.indices);
      } else {
        const imageData = new ImageData(new Uint8ClampedArray(payload.buffer), payload.width, payload.height);
        const mask = new Uint8ClampedArray(payload.mask);
        result = RecoloroColorEngine.processImage(imageData, mask, payload.options);
      }
      self.postMessage({ id, ok: true, buffer: result.data.buffer }, [result.data.buffer]);
      return;
    }
    throw new Error(`Unbekannter Verarbeitungsauftrag: ${type}`);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
