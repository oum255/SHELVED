// Logique pure de la pyramide de niche, séparée de BookshelfPage.jsx pour rester
// testable sans dégrader le hot-reload de Vite (un fichier de composant ne devrait
// exporter que des composants).

// Taille approximative d'une case, reprend les dimensions du CSS (couverture 130px,
// hauteur ~196px + padding de .shelf-slot/.niche-books).
const SLOT_GAP = 4
const ROW_GAP = 32 // espace + ligne d'étagère entre deux rangées
const SLOT_HEIGHT = 220
const SLOT_WIDTH = 146
// Taille par défaut de la rangée la plus large avant la première mesure de la page.
const DEFAULT_MAX_PER_ROW = 5

// Construit les rangées en pyramide en calculant, à chaque hauteur, combien de
// livres tiennent sous la courbe de l'arc (cercle de rayon R) — pas une suite
// devinée à l'avance. `availableWidth` (mesurée via ResizeObserver) fixe la
// largeur de la rangée du bas, donc la taille de toute la niche. Renvoie aussi
// la marge à réserver en haut pour que la première rangée ne soit jamais rognée.
export function buildPyramidRows(books, availableWidth) {
  const step = SLOT_WIDTH + SLOT_GAP
  const maxFromWidth = availableWidth > 0 ? Math.floor(availableWidth / step) : 0
  const maxPerRow = Math.min(
    books.length,
    Math.max(2, maxFromWidth || DEFAULT_MAX_PER_ROW)
  )
  const R = (maxPerRow * step) / 2

  // Largeur disponible sous l'arc à la hauteur y depuis le sommet (équation du
  // cercle : elle grandit jusqu'à 2R quand y atteint R, puis reste à 2R).
  function widthAt(y) {
    if (y >= R) return 2 * R
    return 2 * Math.sqrt(Math.max(0, 2 * R * y - y * y))
  }

  // Hauteur minimale pour que `count` livres tiennent (inverse de l'équation du
  // cercle). x² / (R + racine) plutôt que R - racine : mathématiquement égales,
  // mais la deuxième perd sa précision quand R est grand (soustraction de deux
  // nombres presque égaux), ce qui pouvait faire "disparaître" un livre de la
  // première rangée.
  function minYFor(count) {
    const halfWidth = (count * step) / 2
    if (halfWidth >= R) return R
    const s = Math.sqrt(Math.max(0, R * R - halfWidth * halfWidth))
    return (halfWidth * halfWidth) / (R + s)
  }

  const rows = []
  let remaining = books
  const firstCount = Math.min(2, remaining.length)
  let y = minYFor(firstCount)
  const paddingTop = Math.round(y)

  while (remaining.length > 0) {
    // +0.01 : marge contre l'arrondi flottant (une largeur tout juste suffisante pourrait arrondir en dessous).
    let count = Math.max(1, Math.floor(widthAt(y) / step + 0.01))
    count = Math.min(count, remaining.length)
    // Pas de toute dernière rangée isolée à 1 livre : on l'absorbe dans celle d'avant.
    if (remaining.length - count === 1) count += 1
    rows.push(remaining.slice(0, count))
    remaining = remaining.slice(count)
    y += SLOT_HEIGHT + ROW_GAP
  }

  return { rows, paddingTop }
}
