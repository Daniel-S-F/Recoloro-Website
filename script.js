/* ═══════════════════════════════════════════════════
   RECOLORO — script.js
   Intro · Hero/Slider · Navigation
   ═══════════════════════════════════════════════════ */

'use strict';

/* ── Daten ──────────────────────────────────────── */

const HERO_FALLBACK_PAIR = {
  id: 'reco-105-fallback',
  group: 'tueren-tore',
  displayTitle: 'Pulverbeschichtetes Industrietor',
  alt: {
    before: 'Industrietor vor der RECOLORO-Behandlung',
    after: 'Industrietor nach der RECOLORO-Behandlung',
  },
  generated: {
    desktop: {
      before: 'assets/images/bildpaare/reco-105-hero-desktop-vor.webp',
      after: 'assets/images/bildpaare/reco-105-hero-desktop-nach.webp',
    },
    mobile: {
      before: 'assets/images/bildpaare/reco-105-hero-mobile-vor.webp',
      after: 'assets/images/bildpaare/reco-105-hero-mobile-nach.webp',
    },
  },
};

function validateAndSelectHeroPairs(config) {
  const errors = [];
  const groups = new Set((config?.groups || []).map(group => group.id));
  const pairs = Array.isArray(config?.pairs) ? config.pairs : [];
  const ids = new Set();
  const activeOrders = new Set();

  pairs.forEach(pair => {
    if (!pair?.id || ids.has(pair.id)) errors.push(`Doppelte oder fehlende Bildpaar-ID: ${pair?.id || '(leer)'}`);
    ids.add(pair?.id);
    if (!groups.has(pair?.group)) errors.push(`${pair?.id}: unzulässige Gruppe ${pair?.group || '(leer)'}`);

    if (pair?.heroActive) {
      if (!pair.publicApproved || !pair.heroEligible) errors.push(`${pair.id}: aktiv, aber nicht freigegeben oder nicht Hero-geeignet`);
      if (!Number.isFinite(pair.heroOrder)) errors.push(`${pair.id}: aktive Hero-Reihenfolge fehlt`);
      if (activeOrders.has(pair.heroOrder)) errors.push(`${pair.id}: doppelte Hero-Reihenfolge ${pair.heroOrder}`);
      activeOrders.add(pair.heroOrder);
      ['desktop', 'mobile'].forEach(device => {
        if (!pair.generated?.[device]?.before || !pair.generated?.[device]?.after) {
          errors.push(`${pair.id}: ${device}-Hero-Paar unvollständig`);
        }
      });
    }
  });

  if (errors.length) console.error('RECOLORO Bildkonfiguration:', errors);

  const active = pairs
    .filter(pair => pair?.id !== 'reco-107')
    .filter(pair => pair?.publicApproved && pair?.heroEligible && pair?.heroActive)
    .filter(pair => Number.isFinite(pair?.heroOrder))
    .filter(pair => pair?.generated?.desktop?.before && pair?.generated?.desktop?.after)
    .filter(pair => pair?.generated?.mobile?.before && pair?.generated?.mobile?.after)
    .sort((a, b) => a.heroOrder - b.heroOrder || a.id.localeCompare(b.id));

  if (!active.length) {
    console.error('RECOLORO Bildkonfiguration: Kein gültiges aktives Hero-Bildpaar. Sicheres Fallback wird verwendet.');
    return [HERO_FALLBACK_PAIR];
  }
  return active;
}

const IMAGE_PAIRS = validateAndSelectHeroPairs(window.RECOLORO_IMAGE_CONFIG);

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
const heroContext   = document.getElementById('heroContext');
const hotspotLayer  = document.getElementById('hotspotLayer');
const hotspotInfoNumber = document.getElementById('hotspotInfoNumber');
const hotspotInfoTitle = document.getElementById('hotspotInfoTitle');
const hotspotInfoDescription = document.getElementById('hotspotInfoDescription');
const leadForm      = document.getElementById('leadForm');
const formNote      = document.getElementById('formNote');
const formStarted   = document.getElementById('formStarted');

/* ── Zustand ────────────────────────────────────── */

let sliderPos    = 90;
let animGen      = 0;
let currentPair  = 0;
let userDragging = false;
let autoTimer    = null;
let activeHeroDevice = null;

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

  if (!pair) return;

  const device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
  const sources = pair.generated?.[device] || pair.generated?.desktop;

  if (sources?.before) {
    imgBefore.style.backgroundImage = `url("${sources.before}")`;
    imgBefore.setAttribute('aria-label', pair.alt?.before || 'Vorher-Aufnahme');
  } else {
    imgBefore.style.backgroundImage = '';
  }

  if (sources?.after) {
    imgAfter.style.backgroundImage = `url("${sources.after}")`;
    imgAfter.setAttribute('aria-label', pair.alt?.after || 'Nachher-Aufnahme');
  } else {
    imgAfter.style.backgroundImage = '';
  }

  activeHeroDevice = device;
  if (heroContext) heroContext.textContent = pair.displayTitle || '';
  preloadNextPair(index, device);
}

/* ── Gerätespezifische Web-Bilder / gezieltes Vorladen ─ */

function preloadNextPair(index, device) {
  if (currentPairs.length < 2) return;
  const next = currentPairs[(index + 1) % currentPairs.length];
  const sources = next.generated?.[device] || next.generated?.desktop;
  [sources?.before, sources?.after].forEach(src => {
    if (!src) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
  });
}

/* ── Bildpaar-Wechsel ───────────────────────────── */

function nextPair(onDone) {
  if (!currentPairs.length) return;
  currentPair = (currentPair + 1) % currentPairs.length;
  runPairReveal(currentPair, onDone);
}

function runPairReveal(pairIndex, onDone) {
  hideHeroMessage();

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
  setTimeout(showNav, 1200);
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
    heroCta.style.opacity = '1';
    setTimeout(() => {
      // Erst dann beginnt die Farbrückkehr. Der zweite Claimteil wartet,
      // bis die Farbe sichtbar zurück ist.
      sliderWrap.classList.remove('is-before-only');
      animateSlider(98, 38, 1800, () => {
        revealHeroMessage();
        animateSlider(38, 50, 900, () => {
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
  animGen++;
  stopAuto();
  sliderWrap.classList.remove('is-pair-transition', 'is-before-only');
  const rect = sliderWrap.getBoundingClientRect();
  setSlider(((e.clientX - rect.left) / rect.width) * 100);
  autoTimer = setTimeout(scheduleAuto, 3000);
});

// Tastatur
sliderHandle.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 10 : 5;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); setSlider(sliderPos - step); }
  if (e.key === 'ArrowRight') { e.preventDefault(); setSlider(sliderPos + step); }
});

/* ── Intro-Sequenz ──────────────────────────────── */

function runIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    intro.remove();
    showNav();
    showHeroBrand();
    revealHeroMessage();
    heroCta.style.opacity = '1';
    hero.classList.add('is-ready');
    setSlider(50);
    return;
  }

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
      }, 420);
    }, 520);
  }, 700);
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
  resizeFrameTimer = setTimeout(() => {
    const device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
    if (device !== activeHeroDevice) loadPair(currentPair);
  }, 120);
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
    || `${hotspot.title} können je nach Material, Beschichtung und Zustand für eine Farbauffrischung geeignet sein. Die Eignung wird vor der Ausführung geprüft.`;

  document.querySelectorAll('.hotspot-button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.hotspotId === hotspot.id);
    button.setAttribute('aria-pressed', String(button.dataset.hotspotId === hotspot.id));
  });
}

/* ── Offertanfrage ─────────────────────────────── */

function setFormMessage(message, isError = false) {
  if (!formNote) return;
  formNote.textContent = message;
  formNote.classList.toggle('is-error', isError);
}

function validateComponents() {
  if (!leadForm) return true;
  const checked = leadForm.querySelectorAll('input[name="components[]"]:checked');
  const first = leadForm.querySelector('input[name="components[]"]');
  if (checked.length) {
    first.setCustomValidity('');
    return true;
  }
  first.setCustomValidity('Bitte wählen Sie mindestens ein Bauteil aus.');
  first.reportValidity();
  return false;
}

if (leadForm) {
  if (formStarted) formStarted.value = String(Math.floor(Date.now() / 1000));

  leadForm.querySelectorAll('input[name="components[]"]').forEach(input => {
    input.addEventListener('change', validateComponents);
  });

  leadForm.addEventListener('submit', async event => {
    event.preventDefault();
    setFormMessage('');
    if (!leadForm.reportValidity() || !validateComponents()) return;

    const photos = leadForm.querySelector('input[type="file"]')?.files || [];
    const totalSize = [...photos].reduce((sum, file) => sum + file.size, 0);
    if (photos.length > 3 || totalSize > 10 * 1024 * 1024) {
      setFormMessage('Bitte wählen Sie höchstens 3 Bilder mit insgesamt maximal 10 MB aus.', true);
      return;
    }

    const submitButton = leadForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    leadForm.setAttribute('aria-busy', 'true');
    setFormMessage('Ihre Anfrage wird gesendet …');

    try {
      const response = await fetch(leadForm.action, {
        method: 'POST',
        body: new FormData(leadForm),
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Die Anfrage konnte nicht gesendet werden.');
      leadForm.reset();
      if (formStarted) formStarted.value = String(Math.floor(Date.now() / 1000));
      setFormMessage('Vielen Dank. Ihre Anfrage wurde erfolgreich übermittelt. Wir melden uns nach der Prüfung.');
    } catch (error) {
      setFormMessage(error.message || 'Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.', true);
    } finally {
      submitButton.disabled = false;
      leadForm.removeAttribute('aria-busy');
    }
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
