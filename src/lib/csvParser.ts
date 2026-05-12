import type { Book } from '../types'

// 헤더 행을 찾는다 — "등록번호" 컬럼이 있는 첫 번째 행
function findHeaderRowIndex(lines: string[]): number {
  return lines.findIndex((line) => line.includes('등록번호'))
}

export function parseBooks(csvText: string): Book[] {
  const lines = csvText.trim().split('\n')

  const headerIdx = findHeaderRowIndex(lines)
  if (headerIdx === -1) return []

  const headerCols = lines[headerIdx].split(',').map((h) => h.trim())

  const idx = {
    id: headerCols.indexOf('등록번호'),
    title: headerCols.indexOf('자료명'),
    author: headerCols.indexOf('저자'),
    callNumber: headerCols.indexOf('청구기호'),
    status: headerCols.indexOf('자료상태'),
  }

  if (idx.id === -1 || idx.title === -1 || idx.callNumber === -1) return []

  return lines.slice(headerIdx + 1).flatMap((line) => {
    if (!line.trim()) return []
    const cols = line.split(',')

    const id = cols[idx.id]?.trim()
    const title = cols[idx.title]?.trim()
    const author = idx.author !== -1 ? (cols[idx.author]?.trim() ?? '') : ''
    const callNumber = cols[idx.callNumber]?.trim()
    const rawStatus = idx.status !== -1 ? cols[idx.status]?.trim() : ''

    if (!id || !title || !callNumber) return []

    const status: Book['status'] = rawStatus === '대출중' ? 'checkedOut' : 'available'

    return [{ id, title, author, callNumber, status }]
  })
}
