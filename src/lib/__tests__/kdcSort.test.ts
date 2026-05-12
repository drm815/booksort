import { describe, it, expect } from 'vitest'
import { compareCallNumbers, sortBooks } from '../kdcSort'
import type { Book } from '../../types'

describe('compareCallNumbers', () => {
  it('분류번호 숫자가 작은 쪽이 앞에 온다', () => {
    expect(compareCallNumbers('813.6 한17ㅊ', '813.7 김12ㄱ')).toBeLessThan(0)
  })

  it('분류번호가 같으면 저자기호 문자열로 정렬한다', () => {
    expect(compareCallNumbers('813.6 가12ㄱ', '813.6 나12ㄱ')).toBeLessThan(0)
  })

  it('동일한 청구기호는 0을 반환한다', () => {
    expect(compareCallNumbers('813.6 한17ㅊ', '813.6 한17ㅊ')).toBe(0)
  })

  it('소수점 이하 자릿수가 다른 경우 수치 기준으로 정렬한다', () => {
    // 813.6 < 813.61
    expect(compareCallNumbers('813.6 한17ㅊ', '813.61 김12ㄱ')).toBeLessThan(0)
  })

  it('분류번호 앞자리가 같고 뒷자리가 다른 경우', () => {
    expect(compareCallNumbers('100 가12', '200 가12')).toBeLessThan(0)
  })

  it('실제 데이터 형식 — v.1이 v.2보다 앞에 온다', () => {
    expect(compareCallNumbers('909 송64ㅈ v.1', '909 송64ㅈ v.2')).toBeLessThan(0)
  })

  it('실제 데이터 형식 — 분류번호만 있는 경우', () => {
    expect(compareCallNumbers('909 정54ㅈ', '980.9 한44ㅅ')).toBeLessThan(0)
  })
})

describe('sortBooks', () => {
  const books: Book[] = [
    { id: '3', title: 'C', author: '', callNumber: '813.7 김12ㄱ', status: 'available' },
    { id: '1', title: 'A', author: '', callNumber: '813.6 가12ㄱ', status: 'available' },
    { id: '2', title: 'B', author: '', callNumber: '813.6 나12ㄴ', status: 'checkedOut' },
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
