import { describe, expect, it } from 'vitest'
import { buildPyramidRows } from './bookshelfLayout'

// buildPyramidRows ne regarde jamais le contenu des livres, juste leur nombre.
function fakeBooks(count) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }))
}

describe('buildPyramidRows', () => {
  it('renvoie une pyramide vide sans erreur quand il n\'y a aucun livre', () => {
    const { rows } = buildPyramidRows([], 800)
    expect(rows).toEqual([])
  })

  it('place tous les livres, aucun perdu ni dupliqué', () => {
    const books = fakeBooks(17)
    const { rows } = buildPyramidRows(books, 900)
    const placed = rows.flat()
    expect(placed).toHaveLength(books.length)
    // Même livres, dans le même ordre (la pyramide ne mélange jamais).
    expect(placed.map((b) => b.id)).toEqual(books.map((b) => b.id))
  })

  it('ne laisse jamais une dernière rangée isolée à 1 seul livre', () => {
    // Pour toute taille de bibliothèque : soit une seule rangée, soit la dernière en contient au moins 2.
    for (let count = 1; count <= 30; count++) {
      const { rows } = buildPyramidRows(fakeBooks(count), 700)
      const lastRow = rows[rows.length - 1]
      if (rows.length > 1) {
        expect(lastRow.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('commence avec au plus 2 livres sur la toute première rangée', () => {
    const { rows } = buildPyramidRows(fakeBooks(20), 1000)
    expect(rows[0].length).toBeLessThanOrEqual(2)
  })

  it('donne une rangée plus large quand plus de place est disponible', () => {
    const narrow = buildPyramidRows(fakeBooks(30), 400)
    const wide = buildPyramidRows(fakeBooks(30), 1400)
    // Avec plus de largeur, la pyramide s'étale sur moins de rangées.
    expect(wide.rows.length).toBeLessThanOrEqual(narrow.rows.length)
  })

  it('ne casse pas avec une largeur disponible de 0 (pas encore mesurée)', () => {
    const { rows } = buildPyramidRows(fakeBooks(5), 0)
    const placed = rows.flat()
    expect(placed).toHaveLength(5)
  })
})
