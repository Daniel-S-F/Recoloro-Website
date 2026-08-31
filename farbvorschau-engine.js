/* RECOLORO Farbvisualisierung – deterministische, lokal ausführbare Pixel- und Maskenlogik. */
'use strict';

(function exposeEngine(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.RecoloroColorEngine = engine;
}(typeof self !== 'undefined' ? self : globalThis, () => {
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const smoothstep = (edge0, edge1, value) => {
    const position = clamp((value - edge0) / Math.max(0.00001, edge1 - edge0), 0, 1);
    return position * position * (3 - (2 * position));
  };

  function srgbToLinear(value) {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function linearToSrgbExact(value) {
    const channel = clamp(value, 0, 1);
    return 255 * (channel <= 0.0031308 ? channel * 12.92 : (1.055 * (channel ** (1 / 2.4))) - 0.055);
  }

  const LINEAR_LUT_SIZE = 8192;
  const linearSrgbLut = (() => {
    const lookup = new Uint8ClampedArray(LINEAR_LUT_SIZE + 1);
    for (let index = 0; index <= LINEAR_LUT_SIZE; index += 1) lookup[index] = Math.round(linearToSrgbExact(index / LINEAR_LUT_SIZE));
    return lookup;
  })();

  function linearToSrgb(value) {
    return linearSrgbLut[Math.round(clamp(value, 0, 1) * LINEAR_LUT_SIZE)];
  }

  function rgbToLab(red, green, blue) {
    const r = srgbToLinear(red);
    const g = srgbToLinear(green);
    const b = srgbToLinear(blue);
    const x = ((r * 0.4124564) + (g * 0.3575761) + (b * 0.1804375)) / 0.95047;
    const y = (r * 0.2126729) + (g * 0.7151522) + (b * 0.0721750);
    const z = ((r * 0.0193339) + (g * 0.1191920) + (b * 0.9503041)) / 1.08883;
    const pivot = value => value > 0.008856451679 ? Math.cbrt(value) : (7.787037037 * value) + (16 / 116);
    const fx = pivot(x);
    const fy = pivot(y);
    const fz = pivot(z);
    return { l: (116 * fy) - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function labToRgb(l, a, b) {
    const fy = (l + 16) / 116;
    const fx = fy + (a / 500);
    const fz = fy - (b / 200);
    const inversePivot = value => {
      const cube = value ** 3;
      return cube > 0.008856451679 ? cube : (value - (16 / 116)) / 7.787037037;
    };
    const x = 0.95047 * inversePivot(fx);
    const y = inversePivot(fy);
    const z = 1.08883 * inversePivot(fz);
    const r = (x * 3.2404542) + (y * -1.5371385) + (z * -0.4985314);
    const g = (x * -0.9692660) + (y * 1.8760108) + (z * 0.0415560);
    const blue = (x * 0.0556434) + (y * -0.2040259) + (z * 1.0572252);
    return {
      r: linearToSrgb(r),
      g: linearToSrgb(g),
      b: linearToSrgb(blue),
    };
  }

  function labToRgbInto(l, a, b, output, offset, source, alpha) {
    const fy = (l + 16) / 116;
    const fx = fy + (a / 500);
    const fz = fy - (b / 200);
    const inversePivot = value => {
      const cube = value * value * value;
      return cube > 0.008856451679 ? cube : (value - (16 / 116)) / 7.787037037;
    };
    const x = 0.95047 * inversePivot(fx);
    const y = inversePivot(fy);
    const z = 1.08883 * inversePivot(fz);
    const red = linearToSrgb((x * 3.2404542) + (y * -1.5371385) + (z * -0.4985314));
    const green = linearToSrgb((x * -0.9692660) + (y * 1.8760108) + (z * 0.0415560));
    const blue = linearToSrgb((x * 0.0556434) + (y * -0.2040259) + (z * 1.0572252));
    output[offset] = Math.round(source[offset] + ((red - source[offset]) * alpha));
    output[offset + 1] = Math.round(source[offset + 1] + ((green - source[offset + 1]) * alpha));
    output[offset + 2] = Math.round(source[offset + 2] + ((blue - source[offset + 2]) * alpha));
  }

  function deltaE(first, second) {
    return Math.hypot(first.l - second.l, first.a - second.a, first.b - second.b);
  }

  function imageLabs(imageData) {
    const pixels = imageData.width * imageData.height;
    const l = new Float32Array(pixels);
    const a = new Float32Array(pixels);
    const b = new Float32Array(pixels);
    for (let index = 0; index < pixels; index += 1) {
      const offset = index * 4;
      const lab = rgbToLab(imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]);
      l[index] = lab.l;
      a[index] = lab.a;
      b[index] = lab.b;
    }
    return { l, a, b };
  }

  function deriveMask(imageData, samples, options = {}, preparedLabs = null) {
    const { width, height } = imageData;
    const pixels = width * height;
    const mask = new Uint8ClampedArray(pixels);
    if (!samples.length) return mask;
    const labs = preparedLabs || imageLabs(imageData);
    const colourTolerance = clamp(Number(options.colourTolerance) || 20, 2, 80);
    const lightTolerance = clamp(Number(options.lightTolerance) || 24, 2, 70);
    const edgeSensitivity = clamp(Number(options.edgeSensitivity) || 50, 0, 100);
    const lightMinimum = Math.min(...samples.map(sample => sample.lab.l)) - lightTolerance;
    const lightMaximum = Math.max(...samples.map(sample => sample.lab.l)) + lightTolerance;
    const candidate = new Uint8Array(pixels);
    for (let index = 0; index < pixels; index += 1) {
      const pixelLab = { l: labs.l[index], a: labs.a[index], b: labs.b[index] };
      if (pixelLab.l < lightMinimum || pixelLab.l > lightMaximum) continue;
      let nearest = Infinity;
      for (const sample of samples) nearest = Math.min(nearest, deltaE(pixelLab, sample.lab));
      if (nearest <= colourTolerance) candidate[index] = 1;
    }
    if (options.selectionMode !== 'connected') {
      for (let index = 0; index < pixels; index += 1) mask[index] = candidate[index] ? 255 : 0;
      return mask;
    }

    const queue = new Int32Array(pixels);
    let head = 0;
    let tail = 0;
    const edgeLimit = 5 + ((100 - edgeSensitivity) * 0.22);
    for (const sample of samples) {
      const x = clamp(Math.round(sample.x), 0, width - 1);
      const y = clamp(Math.round(sample.y), 0, height - 1);
      const seed = (y * width) + x;
      if (candidate[seed] && !mask[seed]) {
        mask[seed] = 255;
        queue[tail] = seed;
        tail += 1;
      }
    }
    while (head < tail) {
      const current = queue[head];
      head += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbours = [];
      if (x > 0) neighbours.push(current - 1);
      if (x + 1 < width) neighbours.push(current + 1);
      if (y > 0) neighbours.push(current - width);
      if (y + 1 < height) neighbours.push(current + width);
      for (const neighbour of neighbours) {
        if (!candidate[neighbour] || mask[neighbour]) continue;
        const step = Math.hypot(
          labs.l[current] - labs.l[neighbour],
          labs.a[current] - labs.a[neighbour],
          labs.b[current] - labs.b[neighbour],
        );
        if (step > edgeLimit) continue;
        mask[neighbour] = 255;
        queue[tail] = neighbour;
        tail += 1;
      }
    }
    return mask;
  }

  function oneMorphologyPass(mask, width, height, grow) {
    const output = new Uint8ClampedArray(mask.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width) + x;
        let value = grow ? 0 : 255;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) {
            if (!grow) value = 0;
            continue;
          }
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) {
              if (!grow) value = 0;
              continue;
            }
            const selected = mask[(sampleY * width) + sampleX] > 0;
            if (grow && selected) value = 255;
            if (!grow && !selected) value = 0;
          }
        }
        output[index] = value;
      }
    }
    return output;
  }

  function morphology(mask, width, height, amount) {
    let result = new Uint8ClampedArray(mask);
    const passes = clamp(Math.abs(Math.round(amount)), 0, 20);
    for (let pass = 0; pass < passes; pass += 1) {
      result = oneMorphologyPass(result, width, height, amount > 0);
    }
    return result;
  }

  function innerFeather(mask, width, height, radius) {
    const passes = clamp(Math.round(radius), 0, 30);
    if (!passes) return new Uint8ClampedArray(mask);
    const alpha = new Uint8ClampedArray(mask.length);
    let remaining = new Uint8ClampedArray(mask);
    for (let layer = 1; layer <= passes; layer += 1) {
      const eroded = oneMorphologyPass(remaining, width, height, false);
      const layerAlpha = Math.round(255 * (layer / (passes + 1)));
      for (let index = 0; index < mask.length; index += 1) {
        if (remaining[index] && !eroded[index]) alpha[index] = layerAlpha;
      }
      remaining = eroded;
    }
    for (let index = 0; index < mask.length; index += 1) {
      if (remaining[index]) alpha[index] = 255;
    }
    return alpha;
  }

  function maskMeanLab(labs, mask) {
    let count = 0;
    let l = 0;
    let a = 0;
    let b = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      const weight = mask[index] / 255;
      l += labs.l[index] * weight;
      a += labs.a[index] * weight;
      b += labs.b[index] * weight;
      count += weight;
    }
    if (!count) return { l: 50, a: 0, b: 0 };
    return { l: l / count, a: a / count, b: b / count };
  }

  function neighbourMean(array, index, width, height) {
    const x = index % width;
    const y = Math.floor(index / width);
    let total = array[index] * 4;
    let count = 4;
    if (x > 0) { total += array[index - 1]; count += 1; }
    if (x + 1 < width) { total += array[index + 1]; count += 1; }
    if (y > 0) { total += array[index - width]; count += 1; }
    if (y + 1 < height) { total += array[index + width]; count += 1; }
    return total / count;
  }

  function processImage(imageData, mask, options = {}, preparedLabs = null, selectedIndices = null) {
    const { width, height } = imageData;
    if (mask.length !== width * height) throw new Error('Maske und Bild besitzen unterschiedliche Dimensionen.');
    const source = imageData.data;
    const output = new Uint8ClampedArray(source);
    const labs = preparedLabs || imageLabs(imageData);
    const sourceMean = options.sourceMeanLab || maskMeanLab(labs, mask);
    const target = options.targetLab || sourceMean;
    const mode = options.mode === 'free' ? 'free' : 'refresh';
    const intensity = clamp(Number(options.intensity) || 0, 0, 1);
    const glossLevel = clamp(Number(options.glossLevel) || 0, 0, 4);
    const glossEffect = clamp(Number(options.glossEffect) || 0, 0, 1);
    const gloss = (glossLevel / 4) * glossEffect;
    const matte = ((4 - glossLevel) / 4) * glossEffect;
    const pixels = width * height;
    const iterationLength = selectedIndices ? selectedIndices.length : pixels;
    for (let cursor = 0; cursor < iterationLength; cursor += 1) {
      const index = selectedIndices ? selectedIndices[cursor] : cursor;
      const alpha = mask[index] / 255;
      if (!alpha) continue;
      const offset = index * 4;
      const originalL = labs.l[index];
      const originalA = labs.a[index];
      const originalB = labs.b[index];
      const localMean = neighbourMean(labs.l, index, width, height);
      const detail = originalL - localMean;
      const shadowProtection = 1 - (0.42 * smoothstep(0, 18, 18 - originalL));
      const highlightProtection = 1 - (0.55 * smoothstep(72, 100, originalL));
      const colourProtection = Math.min(shadowProtection, highlightProtection);
      let transformedL;
      let transformedA;
      let transformedB;
      if (mode === 'free') {
        const targetL = clamp(target.l, 2, 98);
        const baseL = targetL + ((localMean - sourceMean.l) * 0.9);
        const detailGain = 1.02 + (gloss * 0.16) - (matte * 0.05);
        transformedL = baseL + (detail * detailGain);
        transformedA = originalA + ((target.a - originalA) * colourProtection);
        transformedB = originalB + ((target.b - originalB) * colourProtection);
      } else {
        const chroma = Math.hypot(originalA, originalB);
        const referenceChroma = Math.max(4, Math.hypot(sourceMean.a, sourceMean.b));
        const hueA = chroma > 1 ? originalA / chroma : sourceMean.a / referenceChroma;
        const hueB = chroma > 1 ? originalB / chroma : sourceMean.b / referenceChroma;
        const boostedChroma = chroma + ((Math.max(chroma, referenceChroma) * 0.62) * intensity);
        const baseL = localMean - (1.1 * intensity);
        transformedL = baseL + (detail * (1.03 + (gloss * 0.12)));
        transformedA = originalA + (((hueA * boostedChroma) - originalA) * intensity * colourProtection);
        transformedB = originalB + (((hueB * boostedChroma) - originalB) * intensity * colourProtection);
      }
      const centreL = mode === 'free' ? target.l : sourceMean.l;
      const contrast = (gloss * 0.11) - (matte * 0.06);
      transformedL = centreL + ((transformedL - centreL) * (1 + contrast));
      transformedL += smoothstep(64, 96, originalL) * gloss * 7.5;
      transformedL = clamp(transformedL, 1.5, 98.5);
      labToRgbInto(transformedL, transformedA, transformedB, output, offset, source, alpha);
    }
    return new ImageData(output, width, height);
  }

  function rleEncode(mask) {
    if (!mask.length) return [];
    const encoded = [];
    let value = mask[0];
    let count = 1;
    for (let index = 1; index < mask.length; index += 1) {
      if (mask[index] === value && count < 65535) count += 1;
      else {
        encoded.push(count, value);
        value = mask[index];
        count = 1;
      }
    }
    encoded.push(count, value);
    return encoded;
  }

  function rleDecode(encoded, expectedLength) {
    const mask = new Uint8ClampedArray(expectedLength);
    let cursor = 0;
    for (let index = 0; index < encoded.length; index += 2) {
      const count = Number(encoded[index]);
      const value = Number(encoded[index + 1]);
      if (!Number.isInteger(count) || count < 1 || value < 0 || value > 255 || cursor + count > expectedLength) {
        throw new Error('Die gespeicherte Maskencodierung ist ungültig.');
      }
      mask.fill(value, cursor, cursor + count);
      cursor += count;
    }
    if (cursor !== expectedLength) throw new Error('Die gespeicherte Maske ist unvollständig.');
    return mask;
  }

  function hexToRgb(value) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(value).trim());
    if (!match) return null;
    const integer = Number.parseInt(match[1], 16);
    return { r: (integer >> 16) & 255, g: (integer >> 8) & 255, b: integer & 255 };
  }

  function rgbToHex(red, green, blue) {
    const channel = value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
  }

  return {
    clamp,
    rgbToLab,
    labToRgb,
    deltaE,
    imageLabs,
    deriveMask,
    morphology,
    innerFeather,
    processImage,
    maskMeanLab,
    rleEncode,
    rleDecode,
    hexToRgb,
    rgbToHex,
  };
}));
