// ── OCR via Google Cloud Vision API ──────────────────────────────────────
// Google Cloud Console에서 발급한 API 키를 아래에 입력
const VISION_API_KEY = PropertiesService.getScriptProperties().getProperty('VISION_API_KEY')

function ocr(e) {
  try {
    const data = JSON.parse(e.postData.contents)
    const imageBase64 = data.image  // base64 인코딩된 이미지

    if (!imageBase64) return res({ ok: false, message: '이미지 없음' })
    if (!VISION_API_KEY) return res({ ok: false, message: 'API 키 미설정' })

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`
    const payload = {
      requests: [{
        image: { content: imageBase64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          // 영문+숫자만 힌트로 주어 인식 정확도 향상
          languageHints: ['en']
        }
      }]
    }

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    })

    const result = JSON.parse(response.getContentText())
    const text = result.responses?.[0]?.fullTextAnnotation?.text || ''
    return res({ ok: true, text: text.trim() })
  } catch (err) {
    return res({ ok: false, message: String(err) })
  }
}

function doPost(e) {
  // action 파라미터로 라우팅
  try {
    const data = JSON.parse(e.postData.contents)
    if (data.action === 'ocr') return ocr(e)
  } catch { /* 파싱 실패 시 기존 로직 */ }

  // 기존 장서점검 로직
  try {
    const data = JSON.parse(e.postData.contents)
    const id = String(data.id || '').trim()
    if (!id) return res({ ok: false, message: '등록번호 없음' })

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()

    const lastRow = sheet.getLastRow()
    const values = lastRow > 0
      ? sheet.getRange(1, 1, lastRow, 1).getValues().flat()
      : []
    if (values.includes(id)) {
      return res({ ok: false, message: '중복' })
    }

    sheet.appendRow([id])
    return res({ ok: true })
  } catch (err) {
    return res({ ok: false, message: String(err) })
  }
}

function res(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}
