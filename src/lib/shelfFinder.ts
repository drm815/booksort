import type { Book, ShelfResult } from '../types'

export function findShelfNeighbors(sortedBooks: Book[], bookId: string): ShelfResult | null {
  const idx = sortedBooks.findIndex((b) => b.id === bookId)
  if (idx === -1) return null

  const before = sortedBooks
    .slice(Math.max(0, idx - 3), idx)
    .reverse()

  const after = sortedBooks.slice(idx + 1, idx + 4)

  return {
    current: sortedBooks[idx],
    before,
    after,
  }
}
