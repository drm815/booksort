import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  detectColumns,
  groupDuplicates,
  type BookRow,
  type BookGroup,
  type ColumnMap,
} from '../lib/duplicateBooks'
import { exportToExcel } from '../lib/excelExport'

const GROUP_COLORS = [
  'bg-blue-50', 'bg-green-50', 'bg-orange-50', 'bg-red-50',
  'bg-purple-50', 'bg-yellow-50', 'bg-cyan-50', 'bg-emerald-50',
]

interface Props {
  onExit: () => void
}

type Step = 'upload' | 'mapping' | 'result'

export function DuplicatePage({ onExit }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<BookRow[]>([])
  const [colMap, setColMap] = useState<Partial<ColumnMap>>({})
  const [minCount, setMinCount] = useState(10)
  const [groups, setGroups] = useState<BookGroup[]>([])
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<BookRow>(ws, { defval: '' })

      if (json.length === 0) return

      const hdrs = Object.keys(json[0])
      setHeaders(hdrs)
      setRows(json)

      const detected = detectColumns(hdrs)
      setColMap(detected)

      if (detected.title && detected.callnum) {
        setStep('result')
        const result = groupDuplicates(json, detected as ColumnMap, minCount)
        setGroups(result)
      } else {
        setStep('mapping')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [minCount])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleApplyMapping = () => {
    if (!colMap.title || !colMap.callnum) return
    const result = groupDuplicates(rows, colMap as ColumnMap, minCount)
    setGroups(result)
    setStep('result')
  }

  const handleRecount = () => {
    if (!colMap.title || !colMap.callnum) return
    const result = groupDuplicates(rows, colMap as ColumnMap, minCount)
    setGroups(result)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportToExcel(groups, headers, `복본목록_${minCount}권이상.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const totalBooks = groups.reduce((s, g) => s + g.books.length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onExit}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          ←
        </button>
        <h1 className="font-bold text-gray-800 text-base">복본 조회</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* STEP 1: 업로드 */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-5xl mb-4">📂</div>
              <p className="text-gray-700 font-semibold text-lg mb-1">
                엑셀 파일을 여기에 끌어다 놓거나 클릭하세요
              </p>
              <p className="text-gray-400 text-sm">.xlsx, .xls 파일 지원</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-600 mb-3">최소 권수 기준</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minCount}
                  onChange={(e) => setMinCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 border border-gray-300 rounded-xl px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-gray-600">권 이상인 도서만 표시</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 컬럼 매핑 */}
        {step === 'mapping' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 mb-1">컬럼 설정</h2>
              <p className="text-sm text-gray-500">
                자동 감지에 실패했습니다. 직접 선택해 주세요.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자료명 (도서 제목) 컬럼</label>
                <select
                  value={colMap.title ?? ''}
                  onChange={(e) => setColMap(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">선택하세요</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구기호 컬럼</label>
                <select
                  value={colMap.callnum ?? ''}
                  onChange={(e) => setColMap(p => ({ ...p, callnum: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">선택하세요</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={handleApplyMapping}
              disabled={!colMap.title || !colMap.callnum}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
            >
              분석 시작
            </button>
          </div>
        )}

        {/* STEP 3: 결과 */}
        {step === 'result' && (
          <div className="space-y-4">
            {/* 요약 + 컨트롤 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">{fileName}</p>
                <p className="font-bold text-gray-800">
                  총 <span className="text-blue-600">{groups.length}그룹</span>
                  {' / '}
                  <span className="text-blue-600">{totalBooks.toLocaleString()}권</span>
                </p>
              </div>

              {/* 권수 기준 변경 */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minCount}
                  onChange={(e) => setMinCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-600">권 이상</span>
                <button
                  onClick={handleRecount}
                  className="bg-blue-500 text-white text-sm px-3 py-1 rounded-lg font-medium"
                >
                  적용
                </button>
              </div>

              {/* 다운로드 */}
              <button
                onClick={handleExport}
                disabled={exporting || groups.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40"
              >
                {exporting ? '생성 중...' : '⬇ 엑셀 다운로드'}
              </button>

              {/* 다시 업로드 */}
              <button
                onClick={() => { setStep('upload'); setGroups([]); setFileName('') }}
                className="text-gray-500 text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                다시 업로드
              </button>
            </div>

            {/* 그룹 목록 */}
            {groups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                {minCount}권 이상인 중복 도서가 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, gi) => (
                  <div
                    key={group.key}
                    className={`rounded-2xl border border-gray-200 overflow-hidden ${GROUP_COLORS[gi % GROUP_COLORS.length]}`}
                  >
                    {/* 그룹 헤더 */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 bg-white/60">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{group.normalizedTitle}</p>
                        <p className="text-xs text-gray-500">{group.representativeCallNum}</p>
                      </div>
                      <span className="ml-3 shrink-0 bg-white border border-gray-300 text-gray-700 text-sm font-bold px-3 py-1 rounded-full">
                        {group.books.length}권
                      </span>
                    </div>

                    {/* 도서 행 — 접기/펼치기 */}
                    <GroupRows group={group} headers={headers} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GroupRows({ group, headers }: { group: BookGroup; headers: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW = 3
  const shown = expanded ? group.books : group.books.slice(0, PREVIEW)

  // 표시할 컬럼: 너무 많으면 주요 컬럼만
  const displayHeaders = headers.slice(0, 8)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/40">
              {displayHeaders.map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((book, bi) => (
              <tr key={bi} className="border-t border-gray-100">
                {displayHeaders.map(h => (
                  <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                    {String(book[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {group.books.length > PREVIEW && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border-t border-gray-200 bg-white/30"
        >
          {expanded
            ? '접기 ▲'
            : `나머지 ${group.books.length - PREVIEW}권 더 보기 ▼`}
        </button>
      )}
    </div>
  )
}
