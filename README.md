# Cookify

<img src="public/logo.svg" alt="Cookify" width="320">

Rezept-App mit über 200 Rezepten. Gib an, was du zuhause hast, und Cookify schlägt dir Gerichte vor. Oder stöbere von Grund auf nach Kategorie, Ernährungsform (vegetarisch, vegan, proteinreich, Low Carb …), Küche und Zeit. Rezepte lassen sich speichern, und jede Woche werden neue Rezepte freigeschaltet.

## Funktionen

- **Was hab ich da?** – Zutaten suchen oder aus den beliebtesten antippen (oder Sets wie „Grundvorrat“ laden), wählen, ob alles da sein muss oder bis zu drei Zutaten fehlen dürfen, und passende Rezepte mit Trefferquote und Fehlliste bekommen. Salz, Pfeffer, Öl und gängige Gewürze zählen als Grundvorrat.
- **Rezepte** – Volltextsuche, Schnellfilter-Chips (Vegetarisch, Vegan, unter 30 Min, Nachspeisen …), ausführliche Filter nach Kategorie, Küche, Dauer und Schwierigkeit hinter einem Filter-Button, Sortierung nach Zeit, Kalorien oder Protein, Zufallsrezept. Oben erscheint jede Woche der Abschnitt „Neu diese Woche“.
- **Rezeptseite** – Portionen hoch- und runterrechnen, Zutaten mit dem Vorrat abgleichen, Schritte abhaken, Nährwerte, Teilen-Link, ähnliche Rezepte.
- **Gespeichert** – Favoriten und Vorrat bleiben im Browser (localStorage) erhalten.
- **Wöchentlich neu** – jedes Rezept hat eine ISO-Kalenderwoche, ab der es sichtbar ist. Die App blendet automatisch jeden Montag die nächste Charge ein, ohne Deployment.
- **Design** – aufgeräumter Look nach dem Vorbild von Kochbox-Apps: Weiß, Grün, große Rezeptkacheln, Outfit und Manrope von Google Fonts.
- **Logo** – Wort- und Bildmarke liegen als fontunabhängige SVG-Pfade in `public/logo.svg` und `public/favicon.svg`; `npm run logo` erzeugt sie neu aus Fredoka SemiBold (`scripts/make-logo.mjs`).

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Produktions-Build nach dist/
npm run lint
```

## Rezeptdaten

- Rezepte liegen als JSON in `src/data/recipes/*.json`, das Schema steht in `src/data/RECIPE_SCHEMA.md`.
- Zutaten verwenden ein kontrolliertes Vokabular aus `src/data/ingredients.json`, damit das Matching mit dem Vorrat funktioniert.
- `npm run recipes:validate` prüft alle Rezeptdateien gegen Schema und Vokabular (läuft auch in CI).
- `src/data/schedule.json` ordnet jeder Rezept-ID die Woche zu, ab der sie sichtbar ist. `npm run recipes:schedule` verteilt neue, noch nicht eingeplante Rezepte automatisch: Start-Bestand sofort, Pipeline (`part5.json`) ab nächster Woche in Vierergruppen.

## Wöchentlich neue Rezepte

Zwei Mechanismen, die sich ergänzen:

1. **Vorbereitete Pipeline** – 50 Rezepte in `part5.json` sind auf die kommenden Wochen verteilt und erscheinen automatisch. Läuft ohne externe Dienste.
2. **Generierung per Skript** – `scripts/generate-weekly.mjs` erzeugt mit der Claude API neue Rezepte für eine Woche und legt sie als `weekly-<Woche>.json` ab: `ANTHROPIC_API_KEY=… npm run recipes:weekly -- --week 2026-W45 --count 5`.

## Quellen und Bewertungen

Jedes Rezept ist ein eigener Text, verlinkt aber ein passendes, möglichst gut und oft bewertetes Originalrezept auf einer bekannten Seite (EatSmarter, lecker.de, kochbar, HelloFresh, KptnCook …). Die App zeigt Sternewert und Stimmenzahl auf der Karte, auf der Rezeptseite gibt es den Link zum Original. Filter „Top bewertet“ (ab 4,5 Sternen und 50 Stimmen) und Sortierung „Beste Bewertung“ nutzen diese Daten.

- `src/data/sources/*.json` ordnet Rezept-IDs eine Quelle zu (`site`, `url`, `title`, optional `rating`, `ratingCount`). Die ersten Zuordnungen stammen aus einer Websuche-Recherche, `auto.json` schreibt die Pipeline.
- `scripts/research-sources.mjs` liest die öffentlichen schema.org-Rezeptmetadaten (JSON-LD) der Quellseiten: `--refresh` aktualisiert Bewertungen, `--fill` sucht Quellen für Rezepte ohne Quelle, `--discover N` sammelt neue, sehr gut bewertete Gerichte in `src/data/candidates.json`. Für Suche braucht es `BRAVE_API_KEY` (Brave Search API, kostenloser Tarif).
- Der Rezept-Generator wählt seine Gerichte bevorzugt aus den Kandidaten und schreibt dazu eine eigene Rezeptur; die Quelle mit Bewertung hängt am Rezept.
- Aufruf lokal, z. B. `npm run recipes:sources -- --refresh` oder `BRAVE_API_KEY=… npm run recipes:sources -- --fill --discover 20`.
- Bewusst ausgelassen: chefkoch.de blockiert automatisierte Zugriffe und Crawler. Rezepttexte und Fotos werden von keiner Seite übernommen.

## Rezeptbilder

Die App zeigt für jedes Rezept ein Foto, sobald `src/assets/recipes/<id>.jpg` existiert; fehlt es, bleibt die Emoji-Kachel. Die Bilder entstehen per KI:

- `scripts/generate-images.mjs` baut aus Titel, Beschreibung und Hauptzutaten einen Foto-Prompt („professional food photography …“), ruft den Bildgenerator auf und speichert 800×600-JPEGs. Anbieter nach gesetztem Schlüssel: `OPENAI_API_KEY` (gpt-image-1) oder `REPLICATE_API_TOKEN` (Flux Schnell, deutlich günstiger).
- Aufruf lokal: `OPENAI_API_KEY=… npm run recipes:images -- --limit 10`, Prompts ansehen mit `npm run recipes:images -- --dry-run`.

## Deployment

Die App liegt auf **Cloudflare Pages**, angebunden über die Git-Integration: Cloudflare baut bei jedem Push auf den Produktionsbranch selbst, es braucht dafür keinen Workflow und kein API-Token im Repository.

Projekteinstellungen in Cloudflare:

- Build command: `npm run recipes:validate && npm run build`
- Build output directory: `dist`
- Root directory: `/`

Die Routen laufen über den URL-Hash (`#/rezept/<id>`), deshalb ist keine SPA-Rewrite-Regel nötig – der Server liefert immer `index.html`.

Jeder Push auf den Produktionsbranch, auch mit neuen Rezepten oder Bildern aus den Skripten, löst ein Deployment aus.
