import type { Book } from '../types'

// 청구기호를 분류번호와 저자기호로 분리
// 예: "813.6-한17ㅊ" → { classNum: 813.6, authorMark: "한17ㅊ" }
function parseCallNumber(callNumber: string): { classNum: number; authorMark: string } {
  const dashIdx = callNumber.indexOf('-')
  if (dashIdx === -1) {
    return { classNum: parseFloat(callNumber) || 0, authorMark: '' }
  }
  const classNum = parseFloat(callNumber.slice(0, dashIdx)) || 0
  const authorMark = callNumber.slice(dashIdx + 1)
  return { classNum, authorMark }
}

export function compareCallNumbers(a: string, b: string): number {
  const pa = parseCallNumber(a)
  const pb = parseCallNumber(b)

  if (pa.classNum !== pb.classNum) {
    return pa.classNum - pb.classNum
  }
  return pa.authorMark.localeCompare(pb.authorMark, 'ko')
}

export function sortBooks(books: Book[]): Book[] {
  return [...books].sort((a, b) => compareCallNumbers(a.callNumber, b.callNumber))
}
