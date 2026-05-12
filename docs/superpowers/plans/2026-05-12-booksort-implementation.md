# 책정리 도우미 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학교 도서관 대출 바코드를 스캔하면 KDC 청구기호 순서 기준으로 앞뒤 3권씩을 선반 시각화로 보여주는 모바일 웹앱을 구축한다.

**Architecture:** Vite + React 정적 SPA. 구글 시트 공개 CSV URL을 환경변수로 고정하고 앱 시작 시 fetch → localStorage 캐시(30분). `@zxing/library`로 카메라 바코드 스캔, KDC 청구기호 파서로 정렬 후 앞뒤 3권 추출. 별도 서버 없이 Vercel에 배포.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v3, @zxing/library, Vitest, Vercel

---

## 파일 구조

```
booksort/
├── .env.example                        # 환경변수 예시
├── .env.local                          # 실제 환경변수 (git 제외)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx                        # React 진입점
│   ├── App.tsx                         # 라우팅 (ScanPage ↔ ResultPage)
│   ├── types.ts                        # Book, ScanResult 타입 정의
│   │
│   ├── lib/
│   │   ├── csvParser.ts               # CSV 텍스트 → Book[] 파싱
│   │   ├── kdcSort.ts                 # KDC 청구기호 비교/정렬 함수
│   │   ├── bookStore.ts               # fetch + 캐시(localStorage) 관리
│   │   └── shelfFinder.ts             # 등록번호로 앞뒤 3권 추출
│   │
│   ├── components/
│   │   ├── ShelfView.tsx              # 선반 시각화 (가로 7권 슬롯)
│   │   ├── BookSlot.tsx               # 개별 책 슬롯 (대출상태 색상)
│   │   ├── ScannerView.tsx            # @zxing 카메라 뷰파인더
│   │   ├── ManualInput.tsx            # 등록번호 직접 입력 폼
│   │   └── LoadingSpinner.tsx         # CSV 로딩 스피너
│   │
│   ├── pages/
│   │   ├── ScanPage.tsx               # 메인: 탭(카메라/입력) + 최근스캔
│   │   └── ResultPage.tsx             # 결과: 선반 + 현재책 + 앞뒤 텍스트
│   │
│   └── hooks/
│       ├── useBookStore.ts            # bookStore 래퍼 훅
│       └── useScanner.ts             # @zxing 스캐너 생명주기 훅
│
└── src/lib/__tests__/
    ├── csvParser.test.ts
    ├── kdcSort.test.ts
    └── shelfFinder.test.ts
```

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`, `.env.example`, `src/main.tsx`, `src/App.tsx` (skeleton)

- [ ] **Step 1: Vite + React + TypeScript 프로젝트 생성**

```bash
cd /Users/binzzang/development/booksort
npm create vite@latest . -- --template react-ts
npm install
```

Expected: `node_modules/` 생성, `src/App.tsx` 등 기본 파일 생성

- [ ] **Step 2: Tailwind CSS 설치**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: tailwind.config.ts 설정**

`tailwind.config.ts` 파일을 아래로 교체:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: src/index.css Tailwind 디렉티브로 교체**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: @zxing/library 설치**

```bash
npm install @zxing/library
```

- [ ] **Step 6: Vitest 설치**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 7: vite.config.ts에 test 설정 추가**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 8: src/test-setup.ts 생성**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 9: package.json scripts에 test 추가**

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 10: .env.example 생성**

```
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/pub?output=csv
```

- [ ] **Step 11: .gitignore에 .env.local 추가 확인**

`.gitignore`에 아래 줄이 없으면 추가:
```
.env.local
```

- [ ] **Step 12: 빌드 확인**

```bash
npm run build
```

Expected: `dist/` 생성, 에러 없음

- [ ] **Step 13: 커밋**

```bash
git init
git add -A
git commit -m "chore: initialize Vite + React + TypeScript + Tailwind project"
```

---

## Task 2: 타입 정의

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: src/types.ts 작성**

```ts
export interface Book {
  id: string          // 등록번호
  title: string       // 자료명
  author: string      // 저자
  callNumber: string  // 청구기호
  status: 'available' | 'checkedOut'  // 대출가능 / 대출중
}

export interface ShelfResult {
  current: Book
  before: Book[]  // 앞 3권, index 0 = 바로 앞
  after: Book[]   // 뒤 3권, index 0 = 바로 뒤
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/types.ts
git commit -m "feat: add Book and ShelfResult types"
```

---

## Task 3: CSV 파서

**Files:**
- Create: `src/lib/csvParser.ts`
- Create: `src/lib/__tests__/csvParser.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/csvParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseBooks } from '../csvParser'

const SAMPLE_CSV = `번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처
1,1000001,채식주의자,한강,창비,2007,813.6-한17ㅊ,2020-01-01,대출가능,본관
2,1000002,작별하지 않는다,한강,문학동네,2021,813.6-한17ㅈ,2022-03-01,대출중,본관
3,1000003,82년생 김지영,조남주,민음사,2016,813.6-조211ㅍ,2019-05-01,대출가능,본관`

describe('parseBooks', () => {
  it('CSV 텍스트를 Book 배열로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books).toHaveLength(3)
  })

  it('등록번호를 id로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].id).toBe('1000001')
  })

  it('자료명을 title로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].title).toBe('채식주의자')
  })

  it('청구기호를 callNumber로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].callNumber).toBe('813.6-한17ㅊ')
  })

  it('대출가능을 available로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].status).toBe('available')
  })

  it('대출중을 checkedOut으로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[1].status).toBe('checkedOut')
  })

  it('빈 CSV는 빈 배열을 반환한다', () => {
    const books = parseBooks('번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처\n')
    expect(books).toHaveLength(0)
  })

  it('헤더만 있는 CSV는 빈 배열을 반환한다', () => {
    const books = parseBooks('번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처')
    expect(books).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- csvParser
```

Expected: FAIL — `parseBooks` not found

- [ ] **Step 3: csvParser.ts 구현**

`src/lib/csvParser.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npm test -- csvParser
```

Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/csvParser.ts src/lib/__tests__/csvParser.test.ts
git commit -m "feat: add CSV parser for Google Sheets book data"
```

---

## Task 4: KDC 청구기호 정렬

**Files:**
- Create: `src/lib/kdcSort.ts`
- Create: `src/lib/__tests__/kdcSort.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/kdcSort.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compareCallNumbers, sortBooks } from '../kdcSort'
import type { Book } from '../../types'

describe('compareCallNumbers', () => {
  it('분류번호 숫자가 작은 쪽이 앞에 온다', () => {
    expect(compareCallNumbers('813.6-한17ㅊ', '813.7-김12ㄱ')).toBeLessThan(0)
  })

  it('분류번호가 같으면 저자기호 문자열로 정렬한다', () => {
    expect(compareCallNumbers('813.6-가12ㄱ', '813.6-나12ㄱ')).toBeLessThan(0)
  })

  it('동일한 청구기호는 0을 반환한다', () => {
    expect(compareCallNumbers('813.6-한17ㅊ', '813.6-한17ㅊ')).toBe(0)
  })

  it('소수점 이하 자릿수가 다른 경우 수치 기준으로 정렬한다', () => {
    // 813.6 < 813.61
    expect(compareCallNumbers('813.6-한17ㅊ', '813.61-김12ㄱ')).toBeLessThan(0)
  })

  it('분류번호 앞자리가 같고 뒷자리가 다른 경우', () => {
    expect(compareCallNumbers('100-가12', '200-가12')).toBeLessThan(0)
  })
})

describe('sortBooks', () => {
  const books: Book[] = [
    { id: '3', title: 'C', author: '', callNumber: '813.7-김12ㄱ', status: 'available' },
    { id: '1', title: 'A', author: '', callNumber: '813.6-가12ㄱ', status: 'available' },
    { id: '2', title: 'B', author: '', callNumber: '813.6-나12ㄴ', status: 'checkedOut' },
  ]

  it('청구기호 KDC 순으로 정렬된 새 배열을 반환한다', () => {
    const sorted = sortBooks(books)
    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('3')
  })

  it('원본 배열을 변경하지 않는다', () => {
    const original = [...books]
    sortBooks(books)
    expect(books[0].id).toBe(original[0].id)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- kdcSort
```

Expected: FAIL — `compareCallNumbers` not found

- [ ] **Step 3: kdcSort.ts 구현**

`src/lib/kdcSort.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npm test -- kdcSort
```

Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/kdcSort.ts src/lib/__tests__/kdcSort.test.ts
git commit -m "feat: add KDC call number comparator and sort function"
```

---

## Task 5: 앞뒤 책 추출 (shelfFinder)

**Files:**
- Create: `src/lib/shelfFinder.ts`
- Create: `src/lib/__tests__/shelfFinder.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/shelfFinder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findShelfNeighbors } from '../shelfFinder'
import type { Book } from '../../types'

const makeBook = (id: string, callNumber: string): Book => ({
  id, title: `책${id}`, author: '', callNumber, status: 'available'
})

// 7권: id 1~7, 청구기호 순 정렬 상태
const BOOKS: Book[] = [
  makeBook('1', '100-가'),
  makeBook('2', '200-가'),
  makeBook('3', '300-가'),
  makeBook('4', '400-가'),
  makeBook('5', '500-가'),
  makeBook('6', '600-가'),
  makeBook('7', '700-가'),
]

describe('findShelfNeighbors', () => {
  it('중간 책의 앞 3권 뒤 3권을 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result).not.toBeNull()
    expect(result!.current.id).toBe('4')
    expect(result!.before.map(b => b.id)).toEqual(['3', '2', '1'])
    expect(result!.after.map(b => b.id)).toEqual(['5', '6', '7'])
  })

  it('before[0]이 바로 앞 책이다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result!.before[0].id).toBe('3')
  })

  it('after[0]이 바로 뒤 책이다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result!.after[0].id).toBe('5')
  })

  it('앞 책이 2권뿐이면 2권만 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '2')
    expect(result!.before).toHaveLength(1)
    expect(result!.before[0].id).toBe('1')
  })

  it('뒤 책이 2권뿐이면 2권만 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '6')
    expect(result!.after).toHaveLength(1)
    expect(result!.after[0].id).toBe('7')
  })

  it('첫 번째 책이면 before는 빈 배열이다', () => {
    const result = findShelfNeighbors(BOOKS, '1')
    expect(result!.before).toHaveLength(0)
  })

  it('마지막 책이면 after는 빈 배열이다', () => {
    const result = findShelfNeighbors(BOOKS, '7')
    expect(result!.after).toHaveLength(0)
  })

  it('존재하지 않는 등록번호는 null을 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '999')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- shelfFinder
```

Expected: FAIL — `findShelfNeighbors` not found

- [ ] **Step 3: shelfFinder.ts 구현**

`src/lib/shelfFinder.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npm test -- shelfFinder
```

Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/shelfFinder.ts src/lib/__tests__/shelfFinder.test.ts
git commit -m "feat: add shelfFinder to extract before/after 3 books by KDC order"
```

---

## Task 6: bookStore (fetch + 캐시)

**Files:**
- Create: `src/lib/bookStore.ts`

- [ ] **Step 1: bookStore.ts 작성**

`src/lib/bookStore.ts`:

```ts
import { parseBooks } from './csvParser'
import { sortBooks } from './kdcSort'
import type { Book } from '../types'

const CACHE_KEY = 'booksort_cache'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30분

interface Cache {
  timestamp: number
  books: Book[]
}

function loadCache(): Book[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: Cache = JSON.parse(raw)
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null
    return cache.books
  } catch {
    return null
  }
}

function saveCache(books: Book[]): void {
  try {
    const cache: Cache = { timestamp: Date.now(), books }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage 쓰기 실패는 무시 (용량 초과 등)
  }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY)
}

export async function fetchBooks(): Promise<Book[]> {
  const cached = loadCache()
  if (cached) return cached

  const url = import.meta.env.VITE_SHEET_CSV_URL
  if (!url) throw new Error('VITE_SHEET_CSV_URL 환경변수가 설정되지 않았습니다.')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`도서목록을 불러오지 못했습니다. (${res.status})`)

  const text = await res.text()
  const books = sortBooks(parseBooks(text))
  saveCache(books)
  return books
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/bookStore.ts
git commit -m "feat: add bookStore with Google Sheets CSV fetch and localStorage cache"
```

---

## Task 7: useBookStore 훅

**Files:**
- Create: `src/hooks/useBookStore.ts`

- [ ] **Step 1: useBookStore.ts 작성**

`src/hooks/useBookStore.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { fetchBooks, clearCache } from '../lib/bookStore'
import type { Book } from '../types'

export function useBookStore() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      if (forceRefresh) clearCache()
      const data = await fetchBooks()
      setBooks(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { books, loading, error, refresh: () => load(true) }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/hooks/useBookStore.ts
git commit -m "feat: add useBookStore hook with loading/error state"
```

---

## Task 8: LoadingSpinner + BookSlot 컴포넌트

**Files:**
- Create: `src/components/LoadingSpinner.tsx`
- Create: `src/components/BookSlot.tsx`

- [ ] **Step 1: LoadingSpinner.tsx 작성**

`src/components/LoadingSpinner.tsx`:

```tsx
export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">도서목록 불러오는 중...</p>
    </div>
  )
}
```

- [ ] **Step 2: BookSlot.tsx 작성**

`src/components/BookSlot.tsx`:

```tsx
import type { Book } from '../types'

interface Props {
  book: Book
  isCurrent?: boolean
  label?: string  // "바로 앞", "3번째" 등
}

export function BookSlot({ book, isCurrent = false, label }: Props) {
  const bgColor = isCurrent
    ? 'bg-blue-600 text-white border-blue-600'
    : book.status === 'checkedOut'
    ? 'bg-gray-100 text-gray-400 border-gray-200'
    : 'bg-white text-gray-800 border-gray-300'

  return (
    <div
      className={`flex flex-col items-center justify-center border-2 rounded-lg p-2 min-h-[80px] flex-1 text-center ${bgColor}`}
    >
      {label && (
        <span className={`text-[9px] font-semibold mb-1 ${isCurrent ? 'text-blue-200' : 'text-gray-400'}`}>
          {label}
        </span>
      )}
      <span className="text-[11px] font-medium leading-tight line-clamp-2">{book.title}</span>
      <span className={`text-[9px] mt-1 ${isCurrent ? 'text-blue-200' : book.status === 'checkedOut' ? 'text-red-400' : 'text-green-600'}`}>
        {isCurrent ? book.callNumber : book.status === 'checkedOut' ? '대출중' : '대출가능'}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/LoadingSpinner.tsx src/components/BookSlot.tsx
git commit -m "feat: add LoadingSpinner and BookSlot components"
```

---

## Task 9: ShelfView 컴포넌트

**Files:**
- Create: `src/components/ShelfView.tsx`

- [ ] **Step 1: ShelfView.tsx 작성**

`src/components/ShelfView.tsx`:

```tsx
import type { ShelfResult } from '../types'
import { BookSlot } from './BookSlot'

interface Props {
  result: ShelfResult
}

// before[0]이 바로 앞, after[0]이 바로 뒤이므로
// 화면 왼쪽→오른쪽: before 역순(before[2], before[1], before[0]) + current + after[0], after[1], after[2]
export function ShelfView({ result }: Props) {
  const { current, before, after } = result

  // 왼쪽 슬롯: 앞 3권을 멀리→가까이 순으로 (before[2] → before[1] → before[0])
  const leftSlots = [...before].reverse()
  // 빈 슬롯 채우기 (앞 책이 3권 미만일 때)
  const leftPadded = Array(3 - leftSlots.length).fill(null).concat(leftSlots)

  // 오른쪽 슬롯: 뒤 3권 (after[0] → after[1] → after[2])
  const rightPadded = [...after, ...Array(3 - after.length).fill(null)]

  const beforeLabels = ['3번째 앞', '2번째 앞', '바로 앞']
  const afterLabels = ['바로 뒤', '2번째 뒤', '3번째 뒤']

  return (
    <div className="w-full">
      {/* 선반 시각화 */}
      <div className="bg-amber-900 rounded-lg p-2">
        <div className="bg-amber-100 rounded-md p-2 flex gap-1 items-stretch">
          {leftPadded.map((book, i) =>
            book ? (
              <BookSlot key={book.id} book={book} label={beforeLabels[i]} />
            ) : (
              <div key={`empty-left-${i}`} className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-amber-200" />
            )
          )}

          {/* 현재 책 슬롯 */}
          <BookSlot book={current} isCurrent />

          {rightPadded.map((book, i) =>
            book ? (
              <BookSlot key={book.id} book={book} label={afterLabels[i]} />
            ) : (
              <div key={`empty-right-${i}`} className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-amber-200" />
            )
          )}
        </div>
        {/* 선반 하단 */}
        <div className="bg-amber-950 h-2 rounded-b-md mt-1" />
      </div>

      {/* 현재 책 정보 */}
      <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-xs text-blue-500 font-semibold mb-1">📖 지금 정리할 책</p>
        <p className="font-bold text-gray-900">{current.title}</p>
        <p className="text-sm text-gray-500">{current.callNumber}</p>
      </div>

      {/* 바로 앞/뒤 텍스트 요약 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-xs text-amber-600 font-semibold mb-1">← 바로 앞</p>
          {before[0] ? (
            <>
              <p className="text-sm font-medium text-gray-800">{before[0].title}</p>
              <p className={`text-xs mt-0.5 ${before[0].status === 'checkedOut' ? 'text-red-500' : 'text-green-600'}`}>
                {before[0].status === 'checkedOut' ? '대출중' : '대출가능'}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">첫 번째 책</p>
          )}
        </div>
        <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-200">
          <p className="text-xs text-cyan-600 font-semibold mb-1">바로 뒤 →</p>
          {after[0] ? (
            <>
              <p className="text-sm font-medium text-gray-800">{after[0].title}</p>
              <p className={`text-xs mt-0.5 ${after[0].status === 'checkedOut' ? 'text-red-500' : 'text-green-600'}`}>
                {after[0].status === 'checkedOut' ? '대출중' : '대출가능'}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">마지막 책</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/ShelfView.tsx
git commit -m "feat: add ShelfView shelf visualization component"
```

---

## Task 10: useScanner 훅 + ScannerView 컴포넌트

**Files:**
- Create: `src/hooks/useScanner.ts`
- Create: `src/components/ScannerView.tsx`

- [ ] **Step 1: useScanner.ts 작성**

`src/hooks/useScanner.ts`:

```ts
import { useEffect, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface Options {
  onScan: (result: string) => void
  onError?: (error: Error) => void
}

export function useScanner({ onScan, onError }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  const start = useCallback(async () => {
    if (!videoRef.current) return
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    try {
      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText())
        } else if (err && !(err instanceof NotFoundException)) {
          onError?.(err as Error)
        }
      })
    } catch (e) {
      onError?.(e as Error)
    }
  }, [onScan, onError])

  const stop = useCallback(() => {
    readerRef.current?.reset()
    readerRef.current = null
  }, [])

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return { videoRef }
}
```

- [ ] **Step 2: ScannerView.tsx 작성**

`src/components/ScannerView.tsx`:

```tsx
import { useScanner } from '../hooks/useScanner'

interface Props {
  onScan: (bookId: string) => void
}

export function ScannerView({ onScan }: Props) {
  const { videoRef } = useScanner({ onScan })

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" />
      {/* 스캔 가이드 박스 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2/3 h-1/3 relative">
          {/* 모서리 표시 */}
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-400 rounded-tl" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-green-400 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br" />
          {/* 스캔 라인 */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-green-400 opacity-70" />
        </div>
      </div>
      <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs opacity-70">
        바코드를 스캔 영역에 맞춰주세요
      </p>
    </div>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/useScanner.ts src/components/ScannerView.tsx
git commit -m "feat: add useScanner hook and ScannerView camera component"
```

---

## Task 11: ManualInput 컴포넌트

**Files:**
- Create: `src/components/ManualInput.tsx`

- [ ] **Step 1: ManualInput.tsx 작성**

`src/components/ManualInput.tsx`:

```tsx
import { useState } from 'react'

interface Props {
  onSubmit: (bookId: string) => void
}

export function ManualInput({ onSubmit }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="등록번호 입력..."
        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-5 py-3 rounded-lg text-sm font-semibold active:bg-blue-700"
      >
        검색
      </button>
    </form>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/ManualInput.tsx
git commit -m "feat: add ManualInput component for direct barcode number entry"
```

---

## Task 12: ScanPage

**Files:**
- Create: `src/pages/ScanPage.tsx`

- [ ] **Step 1: ScanPage.tsx 작성**

`src/pages/ScanPage.tsx`:

```tsx
import { useState } from 'react'
import { ScannerView } from '../components/ScannerView'
import { ManualInput } from '../components/ManualInput'

type Tab = 'camera' | 'manual'

interface RecentItem {
  id: string
  title: string
}

interface Props {
  onScan: (bookId: string) => void
  recentScans: RecentItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function ScanPage({ onScan, recentScans, loading, error, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('camera')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">📚 책정리 도우미</h1>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-white text-sm bg-blue-500 rounded-full px-3 py-1 active:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로딩중...' : '🔄 새로고침'}
        </button>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('camera')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'camera' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            📷 카메라 스캔
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            ⌨️ 번호 입력
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'camera' ? (
          <ScannerView onScan={onScan} />
        ) : (
          <ManualInput onSubmit={onScan} />
        )}

        {/* 최근 스캔 */}
        {recentScans.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <p className="text-xs text-gray-400 font-semibold px-4 py-2 border-b border-gray-100">
              최근 스캔
            </p>
            {recentScans.map((item) => (
              <button
                key={item.id}
                onClick={() => onScan(item.id)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 border-b border-gray-50 last:border-0 active:bg-gray-50"
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/ScanPage.tsx
git commit -m "feat: add ScanPage with camera/manual tab and recent scans"
```

---

## Task 13: ResultPage

**Files:**
- Create: `src/pages/ResultPage.tsx`

- [ ] **Step 1: ResultPage.tsx 작성**

`src/pages/ResultPage.tsx`:

```tsx
import type { ShelfResult } from '../types'
import { ShelfView } from '../components/ShelfView'

interface Props {
  result: ShelfResult
  onBack: () => void
}

export function ResultPage({ result, onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-lg leading-none">←</button>
        <h1 className="font-bold">스캔 결과</h1>
      </header>
      <main className="flex-1 px-4 py-4">
        <ShelfView result={result} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/ResultPage.tsx
git commit -m "feat: add ResultPage with ShelfView"
```

---

## Task 14: App.tsx — 전체 조립

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: App.tsx 작성**

`src/App.tsx`:

```tsx
import { useState } from 'react'
import { useBookStore } from './hooks/useBookStore'
import { findShelfNeighbors } from './lib/shelfFinder'
import { ScanPage } from './pages/ScanPage'
import { ResultPage } from './pages/ResultPage'
import { LoadingSpinner } from './components/LoadingSpinner'
import type { ShelfResult } from './types'

interface RecentItem {
  id: string
  title: string
}

export default function App() {
  const { books, loading, error, refresh } = useBookStore()
  const [result, setResult] = useState<ShelfResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [recentScans, setRecentScans] = useState<RecentItem[]>([])

  const handleScan = (bookId: string) => {
    setScanError(null)
    const found = findShelfNeighbors(books, bookId)
    if (!found) {
      setScanError(`등록번호 "${bookId}"를 찾을 수 없습니다.`)
      return
    }
    setRecentScans((prev) => {
      const filtered = prev.filter((r) => r.id !== bookId)
      return [{ id: bookId, title: found.current.title }, ...filtered].slice(0, 5)
    })
    setResult(found)
  }

  if (loading && books.length === 0) return <LoadingSpinner />

  if (result) {
    return <ResultPage result={result} onBack={() => setResult(null)} />
  }

  return (
    <ScanPage
      onScan={handleScan}
      recentScans={recentScans}
      loading={loading}
      error={scanError ?? error}
      onRefresh={refresh}
    />
  )
}
```

- [ ] **Step 2: src/main.tsx 정리**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
npm test
```

Expected: PASS (모든 테스트)

- [ ] **Step 4: 빌드 확인**

```bash
npm run build
```

Expected: `dist/` 생성, 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: wire up App with scan flow, shelf result, and recent scans"
```

---

## Task 15: 로컬 개발 환경 테스트

**Files:**
- Create: `.env.local` (git 제외)

- [ ] **Step 1: .env.local 생성**

구글 시트를 공개 CSV로 게시 후:
```
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/실제ID/pub?output=csv
```

- [ ] **Step 2: 개발 서버 실행**

```bash
npm run dev
```

Expected: `http://localhost:5173` 접속 가능

- [ ] **Step 3: 실제 동작 확인 체크리스트**
  - [ ] 앱 시작 시 도서목록 로드 (스피너 → 스캔 화면)
  - [ ] 카메라 탭: 카메라 권한 요청 → 뷰파인더 표시
  - [ ] 입력 탭: 등록번호 입력 → 검색 → 결과 화면
  - [ ] 결과 화면: 선반 시각화 7칸, 현재 책 파란색, 앞뒤 텍스트 표시
  - [ ] 대출중 책: 회색 + "대출중" 텍스트
  - [ ] 뒤로가기: 스캔 화면으로 복귀
  - [ ] 새로고침 버튼: 캐시 초기화 후 재fetch
  - [ ] 존재하지 않는 등록번호: 에러 메시지 표시

---

## Task 16: Vercel 배포

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: GitHub 저장소 생성 및 push**

```bash
git remote add origin https://github.com/YOUR_USERNAME/booksort.git
git push -u origin main
```

- [ ] **Step 2: vercel.json 생성**

`vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 3: Vercel 환경변수 설정**

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables:
```
VITE_SHEET_CSV_URL = https://docs.google.com/spreadsheets/d/실제ID/pub?output=csv
```

- [ ] **Step 4: Vercel에 배포**

```bash
npx vercel --prod
```

또는 Vercel 대시보드에서 GitHub 저장소 연결 후 자동 배포

- [ ] **Step 5: 배포된 URL에서 모바일 동작 확인**
  - 스마트폰 브라우저에서 접속
  - 카메라 스캔 동작 확인
  - 결과 화면 모바일 레이아웃 확인

- [ ] **Step 6: 커밋**

```bash
git add vercel.json
git commit -m "chore: add vercel.json for deployment"
git push
```

---

## 자체 검토 결과

**스펙 커버리지:**
- ✅ 3.1 바코드 스캔 (카메라 + 수동 입력) → Task 10, 11, 12
- ✅ 3.2 앞뒤 3권 + 자료상태 + 선반 시각화 + 텍스트 요약 → Task 5, 9
- ✅ 3.3 CSV fetch + localStorage 캐시 30분 + 수동 새로고침 → Task 6, 7
- ✅ KDC 정렬 → Task 4
- ✅ 최근 스캔 기록 (세션 메모리) → Task 14
- ✅ 모바일 최적화 (Tailwind, 44px 터치) → 각 컴포넌트 Task
- ✅ 에러 처리 (네트워크 오류, 등록번호 미발견) → Task 6, 14
- ✅ Vercel 배포 → Task 16

**타입 일관성:** `Book`, `ShelfResult` 타입이 Task 2에서 정의되고 이후 모든 Task에서 일관되게 사용됨. `before[0]` = 바로 앞, `after[0]` = 바로 뒤로 일관되게 사용됨.
