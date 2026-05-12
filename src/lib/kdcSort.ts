import type { Book } from '../types'

// 청구기호를 분류번호와 저자기호로 분리
// 예: "911.05 곽73ㄱ" → { classNum: 911.05, authorMark: "곽73ㄱ" }
// 예: "909 송64ㅈ v.2" → { classNum: 909, authorMark: "송64ㅈ v.2" }
function parseCallNumber(callNumber: string): { classNum: number; authorMark: string } {
  const spaceIdx = callNumber.indexOf(' ')
  if (spaceIdx === -1) {
    return { classNum: parseFloat(callNumber) || 0, authorMark: '' }
  }
  const classNum = parseFloat(callNumber.slice(0, spaceIdx)) || 0
  const authorMark = callNumber.slice(spaceIdx + 1)
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
