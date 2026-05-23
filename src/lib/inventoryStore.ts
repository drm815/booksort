const SCRIPT_URL = import.meta.env.VITE_INVENTORY_SCRIPT_URL

export async function submitInventoryScan(bookId: string): Promise<void> {
  if (!SCRIPT_URL) throw new Error('VITE_INVENTORY_SCRIPT_URL 환경변수가 설정되지 않았습니다.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bookId }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`전송 실패 (${res.status})`)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('전송 시간이 초과됐습니다.', { cause: e })
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
