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
