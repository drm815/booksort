import type { Book, ShelfResult } from '../types'

// 바코드 숫자값으로 등록번호를 찾는다
// 예: 바코드 "26607" 또는 "0026607" → "JRM0026607" 매핑
function findByScannedId(books: Book[], scannedId: string): number {
  // 1) 완전 일치
  let idx = books.findIndex((b) => b.id === scannedId)
  if (idx !== -1) return idx

  // 2) 숫자만 비교 (앞 0 포함/제거 모두 허용)
  const scannedNum = scannedId.replace(/\D/g, '')
  if (!scannedNum) return -1

  idx = books.findIndex((b) => {
    const bookNum = b.id.replace(/\D/g, '')
    return bookNum === scannedNum || parseInt(bookNum) === parseInt(scannedNum)
  })
  return idx
}

export function findShelfNeighbors(sortedBooks: Book[], bookId: string): ShelfResult | null {
  const idx = findByScannedId(sortedBooks, bookId.trim())
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
