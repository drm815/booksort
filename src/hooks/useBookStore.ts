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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  return { books, loading, error, refresh: () => load(true) }
}
