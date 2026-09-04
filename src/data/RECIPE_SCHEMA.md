# Rezept-Schema

Jede Rezeptdatei unter `src/data/recipes/*.json` ist ein JSON-Array von Rezept-Objekten.

```jsonc
{
  "id": "spaghetti-carbonara",          // eindeutig, kebab-case, nur a-z 0-9 und -
  "title": "Spaghetti Carbonara",
  "description": "Ein bis zwei Sätze, appetitlich, auf Deutsch.",
  "emoji": "🍝",                         // genau ein Emoji als Bild-Ersatz
  "category": "hauptgericht",           // hauptgericht | vorspeise | suppe | salat | beilage | fruehstueck | snack | nachspeise | backen | getraenk
  "cuisine": "italienisch",             // deutsch | italienisch | asiatisch | indisch | mexikanisch | mediterran | amerikanisch | orientalisch | franzoesisch | international
  "diet": ["vegetarisch"],              // Teilmenge von: vegetarisch, vegan, glutenfrei, laktosefrei, proteinreich, lowcarb, kalorienarm
  "timeMinutes": 25,                    // Gesamtzeit in Minuten
  "difficulty": "einfach",              // einfach | mittel | anspruchsvoll
  "servings": 2,
  "nutrition": { "kcal": 650, "protein": 30, "carbs": 70, "fat": 25 },   // pro Portion, realistische Schätzung
  "ingredients": [
    { "key": "spaghetti", "name": "Spaghetti", "amount": 200, "unit": "g" },
    { "key": "eier", "name": "Eier", "amount": 2, "unit": "Stück" },
    { "key": "parmesan", "name": "Parmesan, frisch gerieben", "amount": 50, "unit": "g" },
    { "key": "petersilie", "name": "Petersilie", "amount": 1, "unit": "Handvoll", "optional": true },
    { "key": "salz", "name": "Salz", "amount": null, "unit": "" }
  ],
  "steps": [
    "Schritt 1 als vollständiger Satz.",
    "Schritt 2 ..."
  ],
  "tags": ["schnell", "klassiker"]      // freie, kleingeschriebene Tags, 2-5 Stück
}
```

## Regeln

- `key` MUSS ein Schlüssel aus `src/data/ingredients.json` sein. Keine neuen Keys erfinden. Wenn eine Zutat nicht existiert, nimm den nächstpassenden Key (z. B. "Schalotte" → `zwiebel`, "Crème double" → `sahne`) und schreib den genauen Namen ins Feld `name`.
- `name` ist der lesbare Zutatenname wie im Rezept (darf präziser sein als der Key).
- `amount` ist eine Zahl oder `null` (bei "nach Geschmack"). `unit` ist ein String: g, ml, Stück, EL, TL, Prise, Bund, Handvoll, Dose, Zehe, Scheibe, Packung, "" (leer bei null).
- `optional: true` nur bei wirklich verzichtbaren Zutaten.
- `diet`: Gib nur `vegetarisch` und `vegan` an. Alles andere (`glutenfrei`, `laktosefrei`, `proteinreich`, `lowcarb`, `kalorienarm`, `lowfodmap`, `fruktosefrei`, `leichtverdaulich`) berechnet die App selbst aus Nährwerten und Zutaten und überschreibt vorhandene Angaben.
  - Aus den Nährwerten (`src/lib/nutrition.ts`): proteinreich ab 20 % Energie aus Protein oder ab 25 g bei mindestens 15 %, lowcarb bis 20 g Kohlenhydrate oder 20 % Energieanteil, kalorienarm unter 400 kcal.
  - Aus den Zutaten (`src/lib/dietRules.ts`): dort steht je Ernährungsform, welche Zutat kritisch ist – entweder immer oder erst ab einer Menge je Portion. Deshalb sind korrekte `amount`, `unit` und `servings` wichtig: Sie entscheiden mit darüber, ob ein Rezept z. B. als Low FODMAP gilt.
  - Dasselbe Regelwerk liefert die Ersatzvorschläge (Zucker → Traubenzucker, Sahne → Hafercreme, Hühnerbrühe → Gemüsebrühe). Wer eine Zutat ergänzt, pflegt sie dort mit ein; `node scripts/check-diet-rules.mjs` prüft, dass nichts fehlt.
- Zwischen 6 und 14 Zutaten, zwischen 4 und 9 Schritte. Schritte konkret mit Zeiten/Temperaturen.
- Alles auf Deutsch, Du-Form in den Schritten ("Brate die Zwiebeln ...").
- Keine Duplikate innerhalb der Datei, `id` eindeutig.
