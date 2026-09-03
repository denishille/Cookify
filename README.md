# 🍳 KitchenAid

Rezept-App mit über 200 Rezepten. Gib an, was du zuhause hast, und KitchenAid schlägt dir Gerichte vor. Oder stöbere von Grund auf nach Kategorie, Ernährungsform (vegetarisch, vegan, proteinreich, Low Carb …), Küche und Zeit. Rezepte lassen sich speichern, und jede Woche werden neue Rezepte freigeschaltet.

## Funktionen

- **Was hab ich da?** – Zutaten suchen oder aus den beliebtesten antippen (oder Sets wie „Grundvorrat“ laden), wählen, ob alles da sein muss oder bis zu drei Zutaten fehlen dürfen, und passende Rezepte mit Trefferquote und Fehlliste bekommen. Salz, Pfeffer, Öl und gängige Gewürze zählen als Grundvorrat.
- **Rezepte** – Volltextsuche, Schnellfilter-Chips (Vegetarisch, Vegan, unter 30 Min, Nachspeisen …), ausführliche Filter nach Kategorie, Küche, Dauer und Schwierigkeit hinter einem Filter-Button, Sortierung nach Zeit, Kalorien oder Protein, Zufallsrezept. Oben erscheint jede Woche der Abschnitt „Neu diese Woche“.
- **Rezeptseite** – Portionen hoch- und runterrechnen, Zutaten mit dem Vorrat abgleichen, Schritte abhaken, Nährwerte, Teilen-Link, ähnliche Rezepte.
- **Gespeichert** – Favoriten und Vorrat bleiben im Browser (localStorage) erhalten.
- **Wöchentlich neu** – jedes Rezept hat eine ISO-Kalenderwoche, ab der es sichtbar ist. Die App blendet automatisch jeden Montag die nächste Charge ein, ohne Deployment.
- **Design** – aufgeräumter Look nach dem Vorbild von Kochbox-Apps: Weiß, Grün, große Rezeptkacheln, Outfit und Manrope von Google Fonts.

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
2. **Automatische Generierung** – der Workflow `.github/workflows/weekly-recipes.yml` läuft jeden Montag und erzeugt mit der Claude API fünf neue Rezepte für die Folgewoche (`scripts/generate-weekly.mjs`). Dafür muss das Repository-Secret `ANTHROPIC_API_KEY` gesetzt sein. Die Rezepte werden validiert und als `weekly-<Woche>.json` committet. Ohne Secret wird der Schritt übersprungen. Manuell: `ANTHROPIC_API_KEY=… npm run recipes:weekly -- --week 2026-W45 --count 5`.

## Rezeptbilder

Die App zeigt für jedes Rezept ein Foto, sobald `src/assets/recipes/<id>.jpg` existiert; fehlt es, bleibt die Emoji-Kachel. Die Bilder entstehen per KI:

- `scripts/generate-images.mjs` baut aus Titel, Beschreibung und Hauptzutaten einen Foto-Prompt („professional food photography …“), ruft den Bildgenerator auf und speichert 800×600-JPEGs. Anbieter nach gesetztem Schlüssel: `OPENAI_API_KEY` (gpt-image-1) oder `REPLICATE_API_TOKEN` (Flux Schnell, deutlich günstiger).
- Der Workflow `.github/workflows/generate-images.yml` läuft manuell über *Actions → Rezeptbilder erzeugen → Run workflow* (optional mit Limit oder Rezept-IDs) und automatisch nach jedem wöchentlichen Rezept-Nachschub. Er committet die Bilder direkt in den Branch.
- Lokal: `OPENAI_API_KEY=… npm run recipes:images -- --limit 10`, Prompts ansehen mit `npm run recipes:images -- --dry-run`.

## Deployment

`.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie auf GitHub Pages (in den Repo-Einstellungen unter *Pages* die Quelle „GitHub Actions“ wählen).
