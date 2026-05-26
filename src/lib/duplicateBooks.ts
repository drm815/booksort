/**
 * 복본(중복도서) 분석 라이브러리
 * 정규화 제목 + 저자기호 기준으로 그룹핑
 */

export interface BookRow {
  [key: string]: string | number | null | undefined
}

export interface BookGroup {
  key: string
  normalizedTitle: string
  authorSymbol: string
  representativeTitle: string
  representativeCallNum: string
  books: BookRow[]
}

export interface ColumnMap {
  title: string   // 자료명 컬럼명
  callnum: string // 청구기호 컬럼명
}

/** 제목 정규화: 앞/중간 괄호 제거, 공백 정리 */
export function normalizeTitle(title: string): string {
  if (!title) return ''
  let t = title.trim()
  // 앞쪽 괄호 2번 제거 (중첩 대비)
  t = t.replace(/^[\(\（\[【「『].*?[\)\）\]】」』]\s*/g, '')
  t = t.replace(/^[\(\（\[【「『].*?[\)\）\]】」』]\s*/g, '')
  // 중간/뒤 괄호 제거
  t = t.replace(/[\(\（\[【「『].*?[\)\）\]】」』]/g, '')
  // 끝 특수문자 제거
  t = t.replace(/[\s\.\-·:：]+$/, '')
  return t.replace(/\s+/g, ' ').trim()
}

/** 청구기호에서 저자기호 추출: '430 이56ㅎ c.3' → '이56ㅎ' */
export function extractAuthorSymbol(callnum: string): string {
  if (!callnum) return ''
  let cn = callnum.trim()
  // c.N, v.N 등 제거
  cn = cn.replace(/\s+c\.\d+.*$/i, '')
  cn = cn.replace(/\s+v\.\d+.*$/i, '')
  cn = cn.trim()
  // 숫자 분류번호 제거 후 저자기호만 추출
  const m = cn.match(/^\d[\d\.]*\s+(.+)$/)
  if (m) return m[1].trim()
  return cn
}

/** 청구기호 정규화 (c.N, v.N 제거) */
export function normalizeCallNum(callnum: string): string {
  if (!callnum) return ''
  let cn = callnum.trim()
  cn = cn.replace(/\s+c\.\d+.*$/i, '')
  cn = cn.replace(/\s+v\.\d+.*$/i, '')
  return cn.trim()
}

/**
 * 컬럼명 자동 감지
 * 자료명, 청구기호에 해당하는 컬럼을 키워드 매칭으로 찾음
 */
export function detectColumns(headers: string[]): Partial<ColumnMap> {
  const titleKeywords = ['자료명', '서명', '도서명', '제목', 'title', '책이름']
  const callnumKeywords = ['청구기호', '청구번호', 'callnum', 'call', '분류기호']

  const find = (keywords: string[]) =>
    headers.find(h =>
      keywords.some(kw => h?.toLowerCase().includes(kw.toLowerCase()))
    )

  return {
    title: find(titleKeywords),
    callnum: find(callnumKeywords),
  }
}

/**
 * 복본 그룹핑 메인 함수
 * @param rows 전체 도서 행 배열
 * @param colMap 자료명/청구기호 컬럼명
 * @param minCount 최소 권수 기준 (기본 10)
 */
export function groupDuplicates(
  rows: BookRow[],
  colMap: ColumnMap,
  minCount = 10
): BookGroup[] {
  const groups = new Map<string, BookRow[]>()

  for (const row of rows) {
    const title = String(row[colMap.title] ?? '')
    const callnum = String(row[colMap.callnum] ?? '')

    const nt = normalizeTitle(title)
    const auth = extractAuthorSymbol(callnum)
    if (!nt) continue

    const key = `${nt}|${auth}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const result: BookGroup[] = []

  for (const [key, books] of groups.entries()) {
    if (books.length < minCount) continue

    const [nt, auth] = key.split('|')

    // 대표 자료명: 가장 짧은(괄호 없는) 제목
    const titleCounts = new Map<string, number>()
    books.forEach(b => {
      const t = String(b[colMap.title] ?? '')
      titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1)
    })
    const repTitle = [...titleCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    // 대표 청구기호: c.N, v.N 제거한 것 중 가장 많은 것
    const cnCounts = new Map<string, number>()
    books.forEach(b => {
      const cn = normalizeCallNum(String(b[colMap.callnum] ?? ''))
      cnCounts.set(cn, (cnCounts.get(cn) ?? 0) + 1)
    })
    const repCn = [...cnCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    result.push({
      key,
      normalizedTitle: nt,
      authorSymbol: auth,
      representativeTitle: repTitle,
      representativeCallNum: repCn,
      books,
    })
  }

  // 권수 내림차순 정렬
  return result.sort((a, b) => b.books.length - a.books.length)
}
