# Blaupause

Ein endloses Schleichspiel für den PS5-Controller (DualSense). Läuft im Browser auf iPad und PC.
Die vollständige Beschreibung steht in `SPEC.md`.

## Starten (für Entwickler)

    npm install
    npm run dev

## Veröffentlichen

Jeder Push auf `main` baut das Spiel und stellt es über GitHub Pages online
(`.github/workflows/deploy.yml`).

## Global Logistics Tycoon

Ein zweites, eigenständiges Spiel liegt unter `public/logistik/index.html`: ein Logistik-Tycoon
für iPhone, iPad und Android (Browser, Touch). Eine einzelne HTML-Datei ohne Abhängigkeiten.

- Lokal spielen: die Datei im Browser öffnen oder `npm run dev` und `/logistik/` aufrufen.
- Nach dem Veröffentlichen über GitHub Pages: `<Pages-Adresse>/logistik/`.
- Der Spielstand wird im Browser gespeichert (localStorage) und lässt sich unter
  Mehr → Firma als Code exportieren und auf einem anderen Gerät laden.
