/**
 * 복본 결과 엑셀 다운로드
 * 그룹별 색상 배경 + 빈 줄 구분
 */
import ExcelJS from 'exceljs'
import type { BookGroup } from './duplicateBooks'

const GROUP_COLORS = [
  'D6EAF8', 'D5F5E3', 'FDEBD0', 'F9EBEA',
  'F5EEF8', 'FEF9E7', 'EAF2FF', 'E8F8F5',
]

export async function exportToExcel(
  groups: BookGroup[],
  headers: string[],
  filename = '복본목록.xlsx'
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('복본목록')

  // 헤더 행
  ws.addRow(headers)
  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    }
  })
  headerRow.height = 22

  groups.forEach((group, gi) => {
    const color = GROUP_COLORS[gi % GROUP_COLORS.length]
    const argbColor = `FF${color}`

    group.books.forEach(book => {
      const rowData = headers.map(h => book[h] ?? '')
      const row = ws.addRow(rowData)
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        }
        cell.alignment = { vertical: 'middle' }
      })
    })

    // 그룹 구분 빈 줄
    ws.addRow([])
  })

  // 열 너비 자동 조정
  ws.columns.forEach((col, i) => {
    const header = headers[i] ?? ''
    const isTitleCol = ['자료명', '서명', '도서명', '제목', 'title'].some(k =>
      header.toLowerCase().includes(k.toLowerCase())
    )
    col.width = isTitleCol ? 50 : header.includes('청구') ? 22 : header.includes('저자') ? 20 : 14
  })

  // 다운로드
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
