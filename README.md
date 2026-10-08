# KI-Check — Trifft es Ihren Job?

Interaktiver Rechner zur Paper-Reihe „Liability Signaling under Improving AI".
Fassung für krone.at, Stand 8. Oktober 2026.

## Inhalt

- `index.html` — die Seite. Lädt React, Recharts und Tailwind über CDN.
- `app.js` — aus `krone_job_check_v2.jsx` kompiliert, kein Build nötig.

## Veröffentlichen

Beide Dateien in ein Repository legen und GitHub Pages auf den Branch stellen
(Settings → Pages → Branch `main`, Ordner `/`). Die Seite läuft ohne weiteren
Schritt; es gibt keinen Build und keine Abhängigkeiten im Repository.

Dasselbe Paar funktioniert unverändert auf jedem statischen Host.

## Quellen des Modells

| Paper | Fundstelle | Stand |
|---|---|---|
| The Last Costly Signal | Games 17(5), 49 · doi:10.3390/g17050049 | begutachtet erschienen |
| The Fallback as Signal | arXiv:2608.04276 | Vorabdruck |
| The Institutional Window | arXiv:2608.05969 | Vorabdruck |
| Three Ceilings | arXiv:2609.26141 | Vorabdruck |
| Insuring the Fallback | arXiv:2609.26172 | Vorabdruck |

## Neu bauen

Nach einer Änderung an `krone_job_check_v2.jsx` wird `app.js` neu erzeugt. Die
Datei ist reines JavaScript; Imports sind durch die globalen Objekte `React`
und `Recharts` ersetzt.
