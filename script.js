/* ═══════════════════════════════════════════════════
   RECOLORO — script.js
   Intro · Hero/Slider · Navigation
   ═══════════════════════════════════════════════════ */

'use strict';

/* ── Daten ──────────────────────────────────────── */

const HERO_GROUPS = [
  { id: 'tueren-tore',          label: 'Türen & Tore' },
  { id: 'fenster-storen',       label: 'Fenster & Storen' },
  { id: 'fassaden-bruestungen', label: 'Fassaden & Brüstungen' },
  { id: 'wintergaerten-glas',   label: 'Wintergärten & Glas' },
  { id: 'spezialobjekte',       label: 'Spezialobjekte' },
];

const IMAGE_PAIRS = [
  {
    id: 'reco-105',
    group: 'tueren-tore',
    tags: ['Industrietor', 'Rolltor', 'Metall', 'Industrie'],
    before: 'assets/images/bildpaare/Reco_105_vor.jpg',
    after:  'assets/images/bildpaare/Reco_105_nach.jpg',
    beforeAlt: 'Industrietor vor der RECOLORO-Behandlung',
    afterAlt:  'Industrietor nach der RECOLORO-Behandlung',
  },
  {
    id: 'reco-106',
    group: 'tueren-tore',
    tags: ['Industrietüre', 'Seitenausgang', 'Metall', 'Gewerbe'],
    before: 'assets/images/bildpaare/Reco_106_vor.jpg',
    after:  'assets/images/bildpaare/Reco_106_nach.jpg',
    beforeAlt: 'Seitentüre vor der RECOLORO-Behandlung',
    afterAlt:  'Seitentüre nach der RECOLORO-Behandlung',
  },
  {
    id: 'reco-107',
    group: 'wintergaerten-glas',
    tags: ['Vordach', 'Glasfassade', 'Alu', 'Treppenhaus', 'Gewerbe'],
    before: 'assets/images/bildpaare/Reco_107_vor.jpg',
    after:  'assets/images/bildpaare/Reco_107_nach.jpg',
    beforeAlt: 'Verglastes Treppenhaus vor der RECOLORO-Behandlung',
    afterAlt:  'Verglastes Treppenhaus nach der RECOLORO-Behandlung',
  },
  {
    id: 'reco-110',
    group: 'tueren-tore',
    tags: ['Eingangstüre', 'Metall', 'Wohnhaus'],
    before: 'assets/images/bildpaare/Reco_110_vor.jpg',
    after:  'assets/images/bildpaare/Reco_110_nach.jpg',
    beforeAlt: 'Eingangstüre vor der RECOLORO-Behandlung',
    afterAlt:  'Eingangstüre nach der RECOLORO-Behandlung',
  },
  {
    id: 'reco-112',
    group: 'fassaden-bruestungen',
    tags: ['Fassade', 'Aussenverkleidung', 'Metall', 'Gewerbe'],
    before: 'assets/images/bildpaare/Reco_112_vor.jpg',
    after:  'assets/images/bildpaare/Reco_112_nach.jpg',
    beforeAlt: 'Fassadenverkleidung vor der RECOLORO-Behandlung',
    afterAlt:  'Fassadenverkleidung nach der RECOLORO-Behandlung',
  },
];

/* ── DOM refs ───────────────────────────────────── */

const intro         = document.getElementById('intro');
const introBefore   = document.getElementById('introBefore');
const introLogo     = document.getElementById('introLogo');
const nav           = document.getElementById('nav');
const navHamburger  = document.getElementById('navHamburger');
const navMenu       = document.getElementById('navMenu');
const hero          = document.getElementById('hero');
const sliderWrap    = document.getElementById('sliderWrap');
const sliderAfter   = document.getElementById('sliderAfter');
const sliderDivider = document.getElementById('sliderDivider');
const sliderHandle  = document.getElementById('sliderHandle');
const imgBefore     = document.getElementById('imgBefore');
const imgAfter      = document.getElementById('imgAfter');
const heroClaim     = document.getElementById('heroClaim');
const heroCta       = document.getElementById('heroCta');
const hotspotLayer  = document.getElementById('hotspotLayer');
const hotspotInfoNumber = document.getElementById('hotspotInfoNumber');
const hotspotInfoTitle = document.getElementById('hotspotInfoTitle');
const hotspotInfoDescription = document.getElementById('hotspotInfoDescription');

/* ── Zustand ────────────────────────────────────── */

let sliderPos    = 90;
let animGen      = 0;
let currentPair  = 0;
let userDragging = false;
let autoTimer    = null;
const imageMetaCache = new Map();

// Gruppen-Filter
let activeGroup  = null;
let currentPairs = IMAGE_PAIRS;

// Nav / Claim Sichtbarkeit
let navVisible    = false;
let heroSetupDone = false;

/* ── Slider ─────────────────────────────────────── */

function setSlider(pos) {
  sliderPos = Math.max(2, Math.min(98, pos));
  sliderAfter.style.clipPath = `inset(0 0 0 ${sliderPos}%)`;
  sliderDivider.style.left   = `${sliderPos}%`;
  sliderHandle.setAttribute('aria-valuenow', Math.round(sliderPos));
}

// from → to über durationMs, mit Ease-In-Out. Liefert Gen-Nummer zurück.
function animateSlider(from, to, durationMs, onDone) {
  const gen = ++animGen;
  setSlider(from);
  let t0 = null;

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(now) {
    if (gen !== animGen) return;
    if (!t0) t0 = now;
    const p = Math.min((now - t0) / durationMs, 1);
    setSlider(from + (to - from) * easeInOut(p));
    if (p < 1) {
      requestAnimationFrame(frame);
    } else if (onDone) {
      onDone();
    }
  }

  requestAnimationFrame(frame);
}

/* ── Bildpaar laden ─────────────────────────────── */

function loadPair(index) {
  const pair = currentPairs[index];

  if (pair.before) {
    imgBefore.style.backgroundImage = `url(${pair.before})`;
    imgBefore.setAttribute('aria-label', pair.beforeAlt);
  } else {
    imgBefore.style.backgroundImage = '';
  }

  if (pair.after) {
    imgAfter.style.backgroundImage = `url(${pair.after})`;
    imgAfter.setAttribute('aria-label', pair.afterAlt);
  } else {
    imgAfter.style.backgroundImage = '';
  }

  preloadImageMeta(pair.before);
  preloadImageMeta(pair.after);
  applyCurrentPairFrame();
}

/* ── Bildausschnitt je Paar / Gerät ─────────────── */

function getCurrentFrame(pair) {
  const allFrames = window.RECOLORO_IMAGE_FRAMES || {};
  const device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
  return (allFrames[pair.id] && allFrames[pair.id][device]) || { x: 50, y: 50, zoom: 1 };
}

function preloadImageMeta(src) {
  if (!src || imageMetaCache.has(src)) return;
  const img = new Image();
  img.onload = () => {
    imageMetaCache.set(src, { width: img.naturalWidth, height: img.naturalHeight });
    applyCurrentPairFrame();
  };
  img.src = src;
}

function applyImageFrame(element, src, frame) {
  const meta = imageMetaCache.get(src);
  const rect = sliderWrap.getBoundingClientRect();
  if (!meta || !rect.width || !rect.height) return;

  const zoom = Math.max(0.5, Math.min(2, Number(frame.zoom) || 1));
  const scale = Math.max(rect.width / meta.width, rect.height / meta.height) * zoom;
  const width = meta.width * scale;
  const height = meta.height * scale;
  const x = Math.max(0, Math.min(100, Number(frame.x) || 50));
  const y = Math.max(0, Math.min(100, Number(frame.y) || 50));

  element.style.backgroundSize = `${width}px ${height}px`;
  element.style.backgroundPosition = `${-((width - rect.width) * x / 100)}px ${-((height - rect.height) * y / 100)}px`;
}

function applyCurrentPairFrame() {
  const pair = currentPairs[currentPair];
  if (!pair) return;
  const frame = getCurrentFrame(pair);
  applyImageFrame(imgBefore, pair.before, frame);
  applyImageFrame(imgAfter, pair.after, frame);
}

/* ── Bildpaar-Wechsel ───────────────────────────── */

function nextPair(onDone) {
  currentPair = (currentPair + 1) % currentPairs.length;
  runPairReveal(currentPair, onDone);
}

function runPairReveal(pairIndex, onDone) {
  hideHeroMessage();
  heroCta.style.opacity = '0';

  // Das letzte Bild bleibt bis hier sichtbar bei 50/50. Erst die kurze
  // Überblendung verdeckt das Zurücksetzen des Reglers auf «Vorher».
  sliderWrap.classList.add('is-pair-transition');
  setTimeout(() => {
    sliderWrap.classList.add('is-before-only');
    setSlider(98);
    loadPair(pairIndex);

    requestAnimationFrame(() => {
      sliderWrap.classList.remove('is-pair-transition');
    });

    setTimeout(() => {
      sliderWrap.classList.remove('is-before-only');
      animateSlider(98, 38, 1800, () => {
        // Die Aussage erscheint erst, wenn die Farbrückkehr klar sichtbar ist:
        // beim Rückweg von 62 % Nachher auf die 50/50-Vergleichsposition.
        revealHeroMessage();
        animateSlider(38, 50, 900, () => {
          heroCta.style.opacity = '1';
          if (onDone) onDone();
        });
      });
    }, 650);
  }, 280);
}

/* ── Gruppen-Filter ─────────────────────────────── */

function filterByGroup(groupId) {
  const candidates = groupId
    ? IMAGE_PAIRS.filter(p => p.group === groupId)
    : IMAGE_PAIRS;

  if (candidates.length === 0) return; // keine Bilder für diese Gruppe

  activeGroup  = groupId;
  currentPairs = candidates;
  currentPair  = 0;

  // Buttons aktualisieren
  document.querySelectorAll('.group-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.group === groupId);
  });

  // Hero auf erstes Paar der Gruppe wechseln
  stopAuto();
  runPairReveal(0, () => scheduleAuto());
}

/* ── Auto-Rotation (nur Bildpaare) ─────────────── */

function stopAuto() {
  clearTimeout(autoTimer);
}

function scheduleAuto() {
  stopAuto();
  autoTimer = setTimeout(autoTick, 5000);
}

function autoTick() {
  if (userDragging) { scheduleAuto(); return; }
  nextPair(() => scheduleAuto());
}

/* ── Claim — Absender zuerst, Botschaft mit der Farbe ─ */

function showHeroBrand() {
  heroClaim.classList.add('is-brand-visible');
}

function revealHeroMessage() {
  heroClaim.classList.add('is-message-visible');
}

function hideHeroMessage() {
  heroClaim.classList.remove('is-message-visible');
}

/* ── Navigation Sichtbarkeit ────────────────────── */

function showNav() {
  if (navVisible) return;
  navVisible = true;
  nav.classList.add('is-visible');
}

function onUserInteraction() {
  showNav();
}

function startNavLogic() {
  // Das Menü erscheint bewusst nicht im Opening; nach der Hero-Sequenz
  // oder sofort, wenn der Benutzer aktiv wird.
  setTimeout(showNav, 5500);
  window.addEventListener('scroll',     onUserInteraction, { once: true, passive: true });
  sliderWrap.addEventListener('mousedown',  onUserInteraction, { once: true });
  sliderWrap.addEventListener('touchstart', onUserInteraction, { once: true, passive: true });
}

/* ── Hero-Animation ─────────────────────────────── */

function startHeroAnimation() {
  hero.classList.add('is-ready');
  sliderWrap.classList.add('is-before-only');
  setSlider(98);

  setTimeout(() => {
    // Das neue Bild ist da: RECOLORO zieht mit ihm ein.
    showHeroBrand();
    setTimeout(() => {
      // Erst dann beginnt die Farbrückkehr. Der zweite Claimteil wartet,
      // bis die Farbe sichtbar zurück ist.
      sliderWrap.classList.remove('is-before-only');
      animateSlider(98, 38, 1800, () => {
        revealHeroMessage();
        animateSlider(38, 50, 900, () => {
          heroCta.style.opacity = '1';
          scheduleAuto();
        });
      });
    }, 900);

    if (!heroSetupDone) {
      heroSetupDone = true;
      startNavLogic();
    }
  }, 320);
}

/* ── Drag / Touch ───────────────────────────────── */

function startDrag(clientX) {
  animGen++;          // laufende Slider-Animation abbrechen
  userDragging = true;
  stopAuto();
  sliderWrap.classList.remove('is-pair-transition', 'is-before-only');

  // Falls Benutzer vor Abschluss der Hero-Sequenz zieht
  if (!heroSetupDone) {
    heroSetupDone = true;
    showHeroBrand();
    revealHeroMessage();
    heroCta.style.opacity = '1';
    startNavLogic();
  }

  const rect = sliderWrap.getBoundingClientRect();
  setSlider(((clientX - rect.left) / rect.width) * 100);

  function onMove(e) {
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const r  = sliderWrap.getBoundingClientRect();
    setSlider(((cx - r.left) / r.width) * 100);
  }

  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);
    // Nach 3 s Leerlauf Auto-Rotation fortsetzen
    autoTimer = setTimeout(() => {
      userDragging = false;
      scheduleAuto();
    }, 3000);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onEnd);
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend',  onEnd);
}

sliderHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  startDrag(e.clientX);
});

sliderHandle.addEventListener('touchstart', (e) => {
  startDrag(e.touches[0].clientX);
}, { passive: true });

// Klick irgendwo auf den Slider setzt Position
sliderWrap.addEventListener('click', (e) => {
  if (!hero.classList.contains('is-ready')) return;
  if (e.target === sliderHandle || sliderHandle.contains(e.target)) return;
  startDrag(e.clientX);
});

// Tastatur
sliderHandle.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 10 : 5;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); setSlider(sliderPos - step); }
  if (e.key === 'ArrowRight') { e.preventDefault(); setSlider(sliderPos + step); }
});

/* ── Intro-Sequenz ──────────────────────────────── */

function runIntro() {
  // Phase 1 (0 – 1.5 s):   Logo auf warmem Weiss
  // Phase 2 (1.5 – 2.6 s): Vorher-Platzhalter blendet hinter Logo ein
  // Phase 3 (2.6 – 3.4 s): Logo blendet aus
  // Phase 4 (3.4 – 4.2 s): Overlay blendet aus → Hero startet

  setTimeout(() => {
    introBefore.style.opacity = '1';

    setTimeout(() => {
      introLogo.style.opacity = '0';

      setTimeout(() => {
        intro.style.opacity = '0';
        intro.addEventListener('transitionend', () => {
          intro.style.display = 'none';
          startHeroAnimation();
        }, { once: true });
      }, 800);
    }, 1100);
  }, 1500);
}

/* ── Navigation — Scroll-Verhalten ─────────────── */

window.addEventListener('scroll', () => {
  if (window.scrollY > 8) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

let resizeFrameTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeFrameTimer);
  resizeFrameTimer = setTimeout(applyCurrentPairFrame, 120);
}, { passive: true });

/* ── Hamburger-Menü ─────────────────────────────── */

navHamburger.addEventListener('click', () => {
  const isOpen = navMenu.classList.toggle('is-open');
  navHamburger.classList.toggle('is-open', isOpen);
  navHamburger.setAttribute('aria-expanded', String(isOpen));
  navHamburger.setAttribute('aria-label', isOpen ? 'Menü schliessen' : 'Menü öffnen');
});

document.addEventListener('click', (e) => {
  if (!nav.contains(e.target) && navMenu.classList.contains('is-open')) {
    navMenu.classList.remove('is-open');
    navHamburger.classList.remove('is-open');
    navHamburger.setAttribute('aria-expanded', 'false');
    navHamburger.setAttribute('aria-label', 'Menü öffnen');
  }
});

/* ── Anwendungsgrafik / Hotspots ───────────────── */

function showHotspotInfo(hotspot) {
  hotspotInfoNumber.textContent = `Anwendung ${hotspot.id}`;
  hotspotInfoTitle.textContent = hotspot.title;
  hotspotInfoDescription.textContent = hotspot.description
    || `Informationen zu ${hotspot.title} werden ergänzt.`;

  document.querySelectorAll('.hotspot-button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.hotspotId === hotspot.id);
    button.setAttribute('aria-pressed', String(button.dataset.hotspotId === hotspot.id));
  });
}

function buildHotspots() {
  if (!hotspotLayer || !Array.isArray(window.RECOLORO_HOTSPOTS)) return;

  window.RECOLORO_HOTSPOTS.forEach(hotspot => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot-button';
    button.dataset.hotspotId = hotspot.id;
    button.style.left = `${hotspot.x}%`;
    button.style.top = `${hotspot.y}%`;
    button.setAttribute('aria-label', `Anwendung ${hotspot.id}: ${hotspot.title}`);
    button.setAttribute('aria-pressed', 'false');
    button.textContent = hotspot.id;

    button.addEventListener('mouseenter', () => showHotspotInfo(hotspot));
    button.addEventListener('focus', () => showHotspotInfo(hotspot));
    button.addEventListener('click', () => showHotspotInfo(hotspot));
    hotspotLayer.appendChild(button);
  });
}

/* ── Init ───────────────────────────────────────── */

// Gruppen-Buttons: Klick filtert Hero, Toggle hebt Filter auf
document.querySelectorAll('.group-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const gid = btn.dataset.group;
    const newGroup = (activeGroup === gid) ? null : gid;
    filterByGroup(newGroup);
  });
});

loadPair(0);
setSlider(98);
buildHotspots();
runIntro();
