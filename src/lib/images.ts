/**
 * Rezeptbilder aus src/assets/recipes/<id>.jpg. Vite bündelt nur Bilder, die wirklich existieren;
 * Rezepte ohne Bild bekommen in der Oberfläche die Emoji-Kachel.
 */
const files = import.meta.glob<string>('../assets/recipes/*.jpg', { eager: true, import: 'default', query: '?url' })

const byId = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const id = path.split('/').pop()!.replace(/\.jpg$/, '')
  byId.set(id, url)
}

export function recipeImage(id: string): string | undefined {
  return byId.get(id)
}

export const IMAGE_COUNT = byId.size
