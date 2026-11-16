# SPEC: „Blaupause" (Arbeitstitel)

Ein endloses Schleichspiel aus der Draufsicht. Man bricht aus einem Gefängnis aus, das als technischer Grundriss gezeichnet ist. Gesteuert wird ausschließlich mit dem PS5-Controller (DualSense); die Vibration meldet, wie nah man der Entdeckung ist.

## 1. Entscheidungen

| Bereich | Entscheidung |
|---|---|
| Geräte | iPad (Safari / Homescreen) und Windows-PC (Brave) |
| Form | Web-App, eine Codebasis |
| Controller-Funktionen | Kleinster gemeinsamer Nenner: Tasten, Sticks, analoge Trigger, Zwei-Motoren-Vibration. Keine Lightbar, keine adaptiven Trigger, kein Touchpad, kein Gyro |
| Genre | Spiel, Schleichen von oben |
| Thema | Gefängnisausbruch |
| Spielgefühl | Analog und präzise, ruhige Hand |
| Belegung | Ein Stick lenkt, Trigger dosieren |
| L2 | Lauschen |
| Haptik | Nähe zur Gefahr, stufenlos |
| Scheitern | Alarmstufe als Vorrat, erholt sich bei ruhigem Verhalten |
| Struktur | Endlos, prozedural erzeugte Trakte |
| Gefahren | Wachen, Scheinwerfer/Kameras, laute Böden, Schlafende und Hunde |
| Look | Minimal-geometrisch, Blaupausen-Stil |
| Anzeigen | Klar und vollständig |
| Technik | TypeScript, Vite, Canvas 2D, keine Engine, PWA |
| Extra in v1 | Tages-Gefängnis (fester Seed pro Tag) |

Bewusst nicht in v1: Kalibrier-Bildschirm, Ton, Touch-Bedienung ohne Controller, native iPad-App, Online-Bestenliste.

## 2. Spielablauf

- Ein Lauf beginnt in der eigenen Zelle (Trakt 1) und führt von Trakt zu Trakt. Jeder Trakt hat einen Eingang und einen Ausgang.
- Ziel: so viele Trakte wie möglich schaffen. Punktzahl = Anzahl Trakte, bei Gleichstand zählt die geringere Gesamtzeit.
- Der Lauf endet, wenn die Alarmstufe 100 % erreicht (Abriegelung).
- Neustart per Taste in unter einer Sekunde, ohne Menü.
- Zwei Modi: **Freier Lauf** (zufälliger Seed) und **Tages-Gefängnis** (Seed aus dem Datum, pro Tag gleich; eigene Bestleistung des Tages wird gespeichert).

## 3. Steuerung

| Eingabe | Funktion |
|---|---|
| Linker Stick | Richtung. Die Auslenkung bestimmt nur die Richtung, nicht das Tempo |
| R2 (analog) | Tempo, stufenlos von Kriechen bis Rennen. Tempo bestimmt den Lärm |
| L2 (analog) | Lauschen: Figur steht still, Bild dunkelt ab, Geräuschquellen hinter Wänden erscheinen als Wellen. Tiefer gedrückt = größere Hörweite |
| Kreuz | Bestätigen in Menüs |
| Kreis | Zurück in Menüs |
| Options | Pause |
| Dreieck (halten, 0,5 s) | Lauf sofort neu starten |
| Steuerkreuz | Menü-Navigation |

Eingabe-Regeln:

- Radiale Deadzone am Stick: 0,12 innen, 0,95 außen, danach auf 0 bis 1 neu skaliert.
- Trigger-Kurve: `0,5·wert + 0,5·wert²`, damit der untere Bereich fein dosierbar ist, Kriechen aber nicht quälend langsam wird. Trigger-Deadzone 0,03. Volles Tempo: 5 Kacheln/s.
- Tempo-Stufen sind nicht gerastert. Richtwerte: Kriechen bis 25 % Trigger, Gehen bis 60 %, Rennen darüber.
- L2 hat Vorrang: Solange L2 über der Deadzone ist, wird R2 ignoriert.
- Eingaben werden einmal pro Frame per `navigator.getGamepads()` gelesen, nicht über Events.

## 4. Lärm, Sicht und Alarm

**Lärm**
- Die Figur erzeugt einen Lärm-Radius: `radius = tempo × 7 Kacheln × bodenfaktor`. Hinter Wänden zählt er nur zu 60 %.
- Bodenfaktoren: Beton 1,0; Gitterrost 1,8; Kies 2,2; Pfütze 1,5; Glasscherben 3,0.
- Der Lärm-Radius ist als Ring um die Figur sichtbar.

**Sicht**
- Wachen, Scheinwerfer und Kameras haben Lichtkegel, die von Wänden abgeschnitten werden.
- Im Kegel steigt die Alarmstufe, schneller in der Mitte und nahe an der Quelle.

**Alarmstufe (0 bis 100 %)**
- Steigt durch: Aufenthalt im Lichtkegel, Lärm in Hörweite einer Wache, eines Hundes oder Schlafenden.
- Sinkt um ca. 4 % pro Sekunde, wenn 2 Sekunden lang weder gesehen noch gehört.
- Ab 50 %: Wachen im Trakt gehen zur letzten Geräuschquelle.
- Bei 100 %: Lauf vorbei.
- Die Alarmstufe wird in den nächsten Trakt mitgenommen.

## 5. Gefahren

| Gefahr | Reagiert auf | Verhalten |
|---|---|---|
| Wache | Sicht und Lärm | Läuft eine Route ab, hält an, dreht sich. Bei Lärm: geht nachsehen, kehrt dann zurück |
| Scheinwerfer | Sicht | Lichtkreis von oben, fährt einen Raum in festem Rhythmus der Länge nach ab |
| Kamera | Sicht | Schmaler Kegel, schwenkt hin und her, kurzer Stillstand an den Endpunkten |
| Lauter Boden | – | Erhöht den Lärm-Radius (siehe Abschnitt 4) |
| Schlafender | nur Lärm | Sehr empfindlich. Wacht bei Lärm auf und füllt den Alarm stark |
| Hund | Lärm und Witterung | Empfindliches Gehör. Zusätzlich: nach 4 Sekunden in seinem Witterungskreis schlägt er an, auch bei Stille |

## 6. Erzeugung der Trakte

- Seed-basierter Zufallsgenerator (z. B. mulberry32). Gleicher Seed ergibt denselben Lauf, auf beiden Geräten.
- Ein Trakt ist ein Raster aus Räumen und Gängen (24 × 15 Kacheln, darüber die Anzeigenleiste), immer mit garantiertem Weg vom Eingang zum Ausgang.
- Der Generator prüft per Suche über Ort und Zeit, dass es einen Weg gibt, der in Gehtempo (2 Kacheln/s, Warten erlaubt) außerhalb aller Lichtkegel zu schaffen ist. Lärm prüft er nicht; den fängt der Alarm-Vorrat ab. Findet er nach 16 Versuchen keinen lösbaren Trakt, senkt er die Zahl der Gefahren schrittweise.
- Der nächste Trakt wird während des Spielens vorbereitet, ein Versuch pro Frame, damit der Wechsel nicht ruckelt.
- Schwierigkeit steigt mit der Traktnummer:
  - Trakt 1 bis 3: nur Wachen, breite Gänge.
  - Ab 4: Scheinwerfer und Kameras.
  - Ab 7: laute Böden.
  - Ab 10: Schlafende und Hunde.
  - Danach: mehr Gefahren pro Trakt (höchstens 3 Wachen, 3 Kameras, 2 Scheinwerfer, 3 Schlafende, 2 Hunde) und schnellere Wachen und Schwenks.
- Tages-Seed: aus dem Datum in UTC (`JJJJMMTT`).

## 7. Haptik

Einziger Kanal: Zwei-Motoren-Vibration über `gamepad.vibrationActuator.playEffect("dual-rumble", …)`.

- **Nähe zur Gefahr** ist die einzige Bedeutung der Vibration. Keine Vibration für Menüs, Schritte oder Belohnungen.
- Der Gefahrenwert (0 bis 1) ist das Maximum aus:
  - Abstand zum nächsten Lichtkegel-Rand,
  - Überlappung des eigenen Lärm-Radius mit der Hörweite eines Gegners,
  - Fortschritt der Hunde-Witterung.
- Abbildung: Der feine Motor (`weakMagnitude`) setzt ab Gefahrenwert 0,2 ein und wächst linear. Der starke Motor (`strongMagnitude`) kommt ab 0,7 dazu.
- Im Lichtkegel: pulsierend statt gleichmäßig, Pulsfrequenz steigt mit der Alarmstufe.
- Beim Lauschen (L2): Die Vibration zeigt stattdessen die Schritte der nächsten Wache als kurze Impulse; Stärke nach Entfernung.
- Effekte werden alle 100 ms mit 150 ms Dauer neu gesetzt, damit die Stärke fließend wirkt und beim Pausieren sofort endet.
- Einstellung im Menü: Vibrationsstärke 0 / 50 / 100 %.

## 8. Design

**Blaupausen-Stil**
- Hintergrund: Blaupausen-Blau (`#0B3A6B`), feines helleres Raster.
- Wände: dünne, helle Linien (`#DCEBFF`), 2 px. Räume tragen Nummern und Maßlinien wie auf einem Plan.
- Figur: ausgefüllter weißer Kreis mit Richtungsstrich.
- Wachen, Kameras, Hunde, Schlafende: Plan-Symbole (Kreis mit Kreuz, Dreieck, Raute, Kreis mit „Z").
- Lichtkegel: halbtransparentes Hellgelb (`#FFE9A8`, 25 % Deckkraft).
- Lärm-Ring: gestrichelte weiße Linie um die Figur.
- Laute Böden: Schraffuren, je Bodenart ein eigenes Muster.
- Sichtfeld: Gegner und Licht sind nur dort zu sehen, wo die Figur hinsehen kann; der Rest des Plans ist abgedunkelt. Was hinter Wänden ist, verrät nur das Lauschen.
- Alarm: Rot (`#FF4D3D`) wird nur für Alarm benutzt. Ab 50 % färbt sich das Raster leicht rötlich.
- Schrift: eine Monospace-Schrift, Großbuchstaben, wie Planbeschriftung.
- Keine Texturen, keine Bilder; alles wird zur Laufzeit gezeichnet.

**Anzeigen (klar und vollständig)**
Eine Leiste am oberen Rand, von links nach rechts:
- Alarm-Leiste mit Prozentwert und Marke bei 50 %.
- Lärm-Anzeige (aktueller Radius als Balken, Bodenart als Wort).
- Trakt-Nummer, Bestwert, Laufzeit.
- Modus und Seed (z. B. „TAG 20261116").
- Mindestschriftgröße 16 px auf dem iPad; alle Anzeigen innerhalb der Safe-Area.

**Einführung**
- Im ersten Trakt erscheinen fünf Hinweise nacheinander in einem Band am unteren Rand (Stick und R2, Lärm-Ring, Lauschen, Licht/Vibration/Alarm, Ausgang). Jeder verschwindet, sobald man die Sache selbst gemacht hat.
- Während der Einführung steigt der Alarm nur halb so schnell.
- Nach dem ersten geschafften Trakt ist sie erledigt; in den Einstellungen lässt sie sich wieder einschalten.

**Bildschirme**
1. Start: „Controller verbinden und eine Taste drücken" (die Gamepad-API zeigt den Controller erst nach einem Tastendruck).
2. Hauptmenü: Freier Lauf, Tages-Gefängnis, Einstellungen.
3. Spiel.
4. Pause.
5. Ende: Trakte, Zeit, Bestwert, „Dreieck = nochmal".

Alle Menüs sind vollständig per Controller bedienbar.

## 9. Technik

- **Stack:** TypeScript, Vite, Canvas 2D. Keine Spiel-Engine, keine UI-Bibliothek.
- **Schleife:** `requestAnimationFrame`, feste Simulationsschritte von 1/120 s mit Akkumulator. Dadurch gleiches Verhalten bei 60 Hz und 120 Hz (iPad ProMotion).
- **Eingabe:** Gamepad-API, Standard-Mapping. R2 = `buttons[7].value`, L2 = `buttons[6].value`, linker Stick = `axes[0]`, `axes[1]`.
- **Sichtkegel:** Raycasting gegen Wandsegmente, pro Lichtquelle ein Polygon.
- **Speichern:** `localStorage` (Bestwert, Tages-Bestwerte, Einstellungen). Kein Konto, kein Server.
- **PWA:** Manifest + Service Worker, offline spielbar, im Querformat fixiert, auf dem iPad über „Zum Home-Bildschirm" installierbar.
- **Auflösung:** Canvas skaliert mit `devicePixelRatio`, logische Spielfläche fest im Seitenverhältnis 3:2, Rest mit Rand gefüllt.
- **Hosting:** statische Dateien über HTTPS (Gamepad-API und Service Worker brauchen einen sicheren Kontext).

**Vorgeschlagene Struktur**

```
src/
  main.ts            Start, Schleife, Bildschirmwechsel
  input/gamepad.ts   Abfrage, Deadzones, Kurven
  input/haptics.ts   Vibration
  game/geom.ts       Raster, Raycasting, Wegsuche
  game/game.ts       Lauf, Figur, Lärm, Alarm, Gegner, Gefahrenwert
  gen/rng.ts         Seed-Zufall
  gen/block.ts       Trakt-Erzeugung, Lösbarkeitsprüfung
  render/view.ts     Canvas-Anpassung, Farben
  render/draw.ts     Blaupausen-Zeichner, Anzeigen
  ui/screens.ts      Menüs
  storage.ts
```

## 10. Reihenfolge beim Bauen

1. Controller lesen, Figur bewegen, Vibration testen (auf beiden Geräten).
2. Ein fester Test-Trakt mit Wänden, einer Wache, Lichtkegel, Alarm.
3. Lärm, Böden, Lauschen.
4. Restliche Gefahren.
5. Trakt-Generator mit Seed, Schwierigkeitskurve.
6. Anzeigen, Menüs, Speichern, Tages-Gefängnis.
7. PWA, Feinschliff der Haptik-Kurven.

## 11. Offene Punkte (vor dem Bauen zu prüfen)

- **Vibration in Safari auf dem iPad:** Ob `vibrationActuator` mit dem DualSense in der installierten iPadOS-Version funktioniert, ist nicht geprüft (nur am echten Gerät möglich). Die App erkennt es selbst: Meldet der Browser keine Vibration oder steht sie auf 0 %, pulsiert stattdessen der Bildschirmrand rot.
- **Echter Controller:** Bisher nur mit einem simulierten Controller im Browser getestet.
- **Balance:** Alle Zahlenwerte (Tempo, Lärm, Alarm-Raten, Sichtweiten) sind ungespielt.
- **Brave:** Die Gamepad-API sollte ohne Zusatzeinstellung laufen; mit aktivierten Shields prüfen.
- **Trigger analog:** Prüfen, dass beide Browser für L2/R2 Zwischenwerte liefern und nicht nur 0/1.
- **Stick-Drift:** Ohne Kalibrier-Bildschirm kann ein abgenutzter Controller die feste Deadzone überschreiten. Falls das stört, wird der Kalibrier-Bildschirm nachgezogen.
- **Name:** „Blaupause" ist nur ein Arbeitstitel.
