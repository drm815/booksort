import type { Book } from '../types'

export function parseBooks(csvText: string): Book[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  return lines.slice(1).flatMap((line) => {
    if (!line.trim()) return []
    const cols = line.split(',')
    // 컬럼: 번호(0), 등록번호(1), 자료명(2), 저자(3), 출판사(4), 출판년도(5), 청구기호(6), 등록일(7), 자료상태(8), 소장처(9)
    const id = cols[1]?.trim()
    const title = cols[2]?.trim()
    const author = cols[3]?.trim()
    const callNumber = cols[6]?.trim()
    const rawStatus = cols[8]?.trim()

    if (!id || !title || !callNumber) return []

    const status: Book['status'] = rawStatus === '대출중' ? 'checkedOut' : 'available'

    return [{ id, title, author: author ?? '', callNumber, status }]
  })
}
