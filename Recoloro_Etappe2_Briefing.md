# RECOLORO — Auftrag Etappe 2: Karussell & Bauteilgruppen
Stand: 24.06.2026

Lies zuerst CLAUDE.md vollständig, falls noch nicht im Kontext.
Etappe 1 (Intro, Hero, Navigation) ist bereits abgenommen und funktioniert.

Baue jetzt ausschliesslich Etappe 2. Kein weiterer Code danach.
Nach Fertigstellung: Stopp und auf Feedback warten.

---

## Kontext: Neue 5-Gruppen-Logik

Die frühere 14-Gruppen-Struktur ist überholt. Ab jetzt gilt die finale
5-Gruppen-Logik aus `E:\KI_Projekte\Recoloro\KI_Daten\11_Data\objekte\
Recoloro_Bilddatenbank_Bildlogik_Website.md`.

Relevant für diese Etappe sind daraus nur Kapitel 3.1, 4 und 16 —
der Rest des Dokuments (Partner-Upload, Adminfelder, Landingpages) betrifft
ein späteres Backend-System und wird jetzt NICHT umgesetzt.

---

## 1. Fünf Hero-Buttons unter dem Hero einbauen

Direkt unter dem Hero-Bereich eine horizontale Buttonzeile einbauen mit
exakt diesen fünf Gruppen, in dieser Reihenfolge:

1. Türen & Tore
2. Fenster & Storen
3. Fassaden & Brüstungen
4. Wintergärten & Glas
5. Spezialobjekte

Diese fünf Buttons sind gleichzeitig:
- sichtbare Navigation zu den Bildgruppen,
- Fallback-Gruppen für die Bildauswahl im Hero-Slider.

Keine weiteren sichtbaren Hauptgruppen. Keine Untergruppen in dieser Etappe.

---

## 2. Verhalten der Buttons

- Klick auf einen Button filtert die im Hero-Slider angezeigten Bildpaare
  auf diese Gruppe.
- Aktiver Button optisch hervorgehoben (Recoloro Blau `#0F46D4` als Unterstrich
  oder Hintergrund, dezent).
- Mobile: Buttonzeile horizontal wischbar/scrollbar, kein Umbruch.
- Design orientiert sich an mint-architecture.com: viel Weissraum,
  zurückhaltende Typografie, kein lautes Button-Design — eher schlichte
  Textlinks mit Hover-/Active-Zustand.

---

## 3. Bilddaten-Struktur aktualisieren

Datei `script.js` — IMAGE_PAIRS Array auf die neue 5-Gruppen-Logik umstellen.
Gruppen-Zuordnung gemäss aktueller Datentabelle:

```javascript
const HERO_GROUPS = [
  { id: 'tueren-tore', label: 'Türen & Tore' },
  { id: 'fenster-storen', label: 'Fenster & Storen' },
  { id: 'fassaden-bruestungen', label: 'Fassaden & Brüstungen' },
  { id: 'wintergaerten-glas', label: 'Wintergärten & Glas' },
  { id: 'spezialobjekte', label: 'Spezialobjekte' },
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
```

Falls bereits ein IMAGE_PAIRS Array mit alter Struktur existiert: ersetzen,
nicht ergänzen.

---

## 4. Filterlogik

```javascript
let activeGroup = null; // null = alle Bildpaare, sonst group-id

function filterByGroup(groupId) {
  activeGroup = groupId;
  const filtered = groupId
    ? IMAGE_PAIRS.filter(p => p.group === groupId)
    : IMAGE_PAIRS;
  // bestehende Hero-Slider-Logik mit "filtered" statt "IMAGE_PAIRS" füttern
  // erstes Bild aus filtered anzeigen, Auto-Wechsel ggf. neu starten
}
```

Button-Klick ruft `filterByGroup(groupId)` auf und markiert den Button
als aktiv (CSS-Klasse `is-active`).

---

## 5. Wichtiger Hinweis zur alten Struktur

Die Datei `bauteile_gruppen_v1.md` (14-Gruppen-Struktur) ist überholt
und wird NICHT mehr verwendet. Falls im bisherigen Code Referenzen auf
die alten 10-14 Gruppen bestehen, diese durch die neue 5-Gruppen-Logik
ersetzen.

---

## Checkliste vor dem Stopp

- [ ] 5 Buttons unter dem Hero, korrekt beschriftet, korrekte Reihenfolge
- [ ] Buttons horizontal, mobile wischbar
- [ ] Klick filtert Hero-Slider auf passende Bildpaare
- [ ] Aktiver Button optisch erkennbar (dezent, Recoloro Blau)
- [ ] IMAGE_PAIRS auf neue 5-Gruppen-Struktur umgestellt
- [ ] Alle 5 vorhandenen Bildpaare korrekt zugeordnet
- [ ] Kein Bezug mehr auf alte 14-Gruppen-Struktur im Code
- [ ] Design zurückhaltend, passend zu bestehendem CI

**Nach Fertigstellung: Stopp. Nicht weiterbauen. Auf Feedback warten.**
