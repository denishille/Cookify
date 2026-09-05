/**
 * Teilt eine Adresse über das Teilen-Menü des Geräts, sonst in die Zwischenablage.
 * Gibt zurück, was der Nutzer erfahren soll – oder null, wenn das Menü aufging.
 */
export async function shareLink(title: string, url: string): Promise<string | null> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return null
    }
    await navigator.clipboard.writeText(url)
    return 'Link kopiert'
  } catch (e) {
    // Abbrechen im Teilen-Menü ist kein Fehler, den man melden müsste.
    if (e instanceof DOMException && e.name === 'AbortError') return null
    return 'Teilen nicht möglich'
  }
}
