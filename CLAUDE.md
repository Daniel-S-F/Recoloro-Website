# CLAUDE.md — Recoloro Website Übergabe für Claude Code

Stand: 24.06.2026
Repo: `E:\KI_Projekte\Recoloro\Website\`
Branch: `claude-website-v1`

---

## 1. Aufgabe

Baue die öffentliche Recoloro-Hauptwebsite (`recoloro.ch`) als statisches HTML/CSS/JS.
Keine Frameworks, kein Build-Prozess, kein React, kein Next.js.
Direkt im Browser aufrufbar. Später auf Infomaniak deployed.

---

## 2. Arbeitsregel

- Immer nur ein Abschnitt auf einmal bauen.
- Nach jedem Abschnitt auf Feedback warten.
- Keine Annahmen — bei Unklarheit fragen.
- Alle Entscheidungen sind in diesem Dokument und in `E:\KI_Projekte\Recoloro\KI_Daten\` dokumentiert.

---

## 3. Dateistruktur

```
Website\
  ├── CLAUDE.md
  ├── index.html
  ├── styles.css
  ├── script.js
  └── assets\
        └── images\
              └── (Platzhalterbilder bis echte Fotos vorliegen)
```

---

## 4. Corporate Identity

### Farben
| Name | Hex | Einsatz |
|---|---|---|
| Recoloro Blau | `#0F46D4` | Logo, Akzente, aktive Elemente |
| Kühles Weissgrau | `#F3F4F5` | Website-Hintergrundflächen |
| Warmes Weiss | `#F7F5F0` | Intro-Hintergrund, Print |
| Anthrazit | `#1E2428` | Haupttext, Navigation |
| Liniengrau | `#DDE1E4` | Trennlinien, Tabellen |
| Mittelgrau | `#8B9298` | Sekundärtext |

### Typografie
- Primär: **Source Sans 3** (Google Fonts)
- Fallback: Source Sans Pro, Arial, sans-serif

### Logo
- Blaues R auf hellem Grund = Standard
- Weisses R auf dunklem/Bild-Hintergrund = Sekundär
- Keine Verläufe, keine Schatten, keine Umrisse

---

## 5. Design-Referenz

Vorlage: `https://www.mint-architecture.com`

Übernehmen:
- Vollbild-Hero, Navigation fast unsichtbar beim Laden
- Viel Weissraum, grosse Abstände
- Bilder dominieren, Text tritt zurück
- Navigation erscheint erst beim ersten Scroll (scrolled-Klasse)
- Serifenlose Typografie, leichtes Gewicht

Anpassen:
- Recoloro Blau `#0F46D4` als einziger Farbakzent
- Vorher/Nachher-Slider statt Video im Hero
- Klarer CTA "Offerte anfragen"

---

## 6. Seitenstruktur

Scrollbare Einzelseite. Navigation springt zu Abschnitten.

```
1. Intro (Logo-Moment)
2. Hero (Vorher/Nachher-Slider)
3. Karussell + Thumbnails (Bauteilgruppen)
4. Wo wirkt RECOLORO?
5. Warum RECOLORO?
6. So funktioniert RECOLORO
7. Lokale Recoloro Partner
8. Offertformular
9. FAQ
10. Footer
```

Separate Seite (nur über Menü erreichbar):
- `partner-werden.html`

---

## 7. Navigation

Menüpunkte:
1. So wirkt RECOLORO
2. Wo wirkt RECOLORO?
3. Warum RECOLORO?
4. So funktioniert RECOLORO
5. FAQ
6. Offerte anfragen
7. Partner werden → führt auf `partner-werden.html`

Verhalten:
- Beim Laden: fast unsichtbar, weiss auf Bild
- Nach erstem Scroll: Hintergrund `#F3F4F5`, Text `#1E2428`, dezente Trennlinie

---

## 8. Intro-Sequenz (Phase 1)

1. Vollbild-Hintergrund: Warmes Weiss `#F7F5F0`
2. RECOLORO-Logo zentriert — nur das R-Icon + Wortmarke, kein Text, kein Claim
3. Kurz stehen lassen (ca. 1.5 Sekunden)
4. Erstes Vorher-Bild blendet hinter Logo ein
5. Logo blendet sanft aus
6. Hero-Animation startet

---

## 9. Hero-Animation (Phase 2)

Bildlogik:
- Links = Vorher (ausgebleicht, matt)
- Rechts = Nachher (kräftig, satt, gepflegt)
- Slider-Trennlinie mit weissem Griff

Ablauf beim ersten Laden:
1. Slider startet weit rechts — Vorher-Bild dominiert
2. Slider zieht automatisch nach links — Wirkung wird sichtbar
3. Claim erscheint: **„RECOLORO bringt Farbe zurück."**
4. Slider pendelt ruhig auf 50/50

Bildwechsel-Ablauf:
1. Neues Bildpaar fährt von links ein
2. Slider zieht nach rechts mit → Vorher dominiert kurz
3. Slider gleitet zurück auf 50/50
4. Nutzer kann Slider selbst bewegen

Wichtig:
- Bewegung hochwertig, ruhig, kontrolliert
- Keine Bounce-Animationen
- Bei Nutzerinteraktion pausiert Automatik

Rotierende Claim-Sätze (ruhig, nicht aufdringlich):
- RECOLORO bringt Farbe zurück.
- Recoloro macht den Unterschied sichtbar.
- Gepflegte Immobilien fallen auf.
- Originalfarbe. Gepflegter Eindruck. Ohne Ersatz.

---

## 10. Karussell und Bildgruppen

Unter dem Hero: horizontales Karussell mit Bauteilgruppen.

Startgruppen Version 1:
1. Haustür / Eingangsfront
2. Tore
3. Sonnenschutz / Wetterschutz
4. Fenster / Rahmen
5. Fassadenelemente
6. Briefkästen / Kleinbauteile
7. Geländer / Brüstungen
8. Ladenfronten / Schaufenster
9. Wintergärten / Glas-Metall
10. Weitere Aussenelemente

Regeln:
- Nur Gruppen mit Bildern werden angezeigt
- Thumbnails erscheinen bei Gruppenauswahl
- Klick auf Thumbnail → Bildpaar wechselt im Hero
- Mobile: horizontal wischbar

---

## 11. Bilddaten-Struktur

Jedes Bildpaar hat:
- 1 Hauptgruppe
- Optional 1-2 Zusatzgruppen
- Tags (z.B. "Rollladen", "Aluminium", "Einfamilienhaus")

Für Version 1: Platzhalterbilder mit korrekter Datenstruktur.
Echte Fotos werden später eingespielt ohne Code-Änderung.

---

## 12. Abschnitt: Wo wirkt RECOLORO?

- Objektgrafiken als Platzhalter (werden separat erstellt)
- Objektarten: Einfamilienhaus, Mehrfamilienhaus, Geschäftshaus, Gewerbe/Industrie
- Alphabetische Bauteilliste rechts neben Grafik
- Klick auf Bauteil → springt zu passenden Bildpaaren im Hero

---

## 13. Offertformular

Pflichtfelder:
- Name
- E-Mail-Adresse
- PLZ des Objekts
- Bauteil / Bauteile (Dropdown/Mehrfachauswahl)

Optionale Felder:
- Telefonnummer (mit Hinweis: nur wenn telefonischer Kontakt gewünscht)
- Notizen
- Foto-Upload

Version 1: Formular-Submit zeigt Bestätigungsmeldung.
E-Mail-Versand wird später technisch definiert.

---

## 14. Partner werden (separate Seite)

Datei: `partner-werden.html`

Felder:
- Firma, Adresse, PLZ, Ort
- Ansprechpartner Vorname + Nachname
- E-Mail-Adresse
- Telefonnummer
- Kurze Nachricht (optional)

---

## 15. FAQ Version 1

1. Was ist RECOLORO?
2. Ist RECOLORO ein Anstrich oder eine Neubeschichtung?
3. Für welche Oberflächen eignet sich RECOLORO?
4. Wann ist RECOLORO nicht geeignet?
5. Wie lange hält die Wirkung?
6. Muss das Bauteil demontiert werden?
7. Wie lange dauert die Ausführung?
8. Wer führt die Arbeiten aus?
9. Was kostet RECOLORO?
10. Wie läuft eine Offertanfrage ab?

---

## 16. Codex-Vorarbeit

Codex hat bereits einen Static Preview gebaut:
`E:\KI_Projekte\Recoloro\KI_Daten\12_Development\recoloro-static-preview\`

Dieser enthält:
- Korrekte CI-Farben
- Vorher/Nachher-Slider (funktionsfähig)
- Grundstruktur der Sektionen
- Navigation mit Scroll-Verhalten

Als Referenz und Inspiration verwenden — nicht direkt kopieren.
Claude baut neu, sauberer, näher an mint-architecture.com.

---

## 17. Pflichtseiten vor Go-Live

- Impressum (minimal)
- Datenschutz (minimal)
- Offertformular fertig
- Partner-werden-Seite

---

## 18. Mobile First

- Slider mobil bedienbar (Touch)
- Karussells horizontal wischbar
- Bilder lazy-loaded, mehrere Grössen
- Grosse Touchflächen
- Navigation mobile: Hamburger-Menü

---

## 19. SEO

- Semantische HTML-Struktur
- Alt-Texte für alle Bilder
- FAQ sauber ausformuliert
- Klare Abschnittsüberschriften

---

## 20. Start jetzt

**Erster Schritt:** Nur den Intro + Hero bauen.
Nichts anderes. Auf Feedback warten bevor weiter.

Referenzdateien:
- CI: `E:\KI_Projekte\Recoloro\KI_Daten\02_Strategy\Recoloro_Corporate_Identity_Master_v1.0.md`
- Website-Brief: `E:\KI_Projekte\Recoloro\KI_Daten\06_Website\Recoloro_Website_Brief_Master_v1.0.md`
- Codex-Preview: `E:\KI_Projekte\Recoloro\KI_Daten\12_Development\recoloro-static-preview\`
