/**
 * ========================================
 * GOOGLE APPS SCRIPT - SHEET LỊCH MỔ BV
 * (Phiên bản phù hợp với cấu trúc thực tế)
 * ========================================
 *
 * CẤU TRÚC SHEET BV:
 * - Cột A: Ngày (29/12)
 * - Cột B: Buổi (sáng/chiều)
 * - Cột C: NGOẠI CT
 * - Cột D: (Khoa khác)
 * - Cột E: NGOẠI TK ← Khoa của bạn
 * - Cột F-I: Các khoa khác (TMH, RHM, MẮT...)
 *
 * HƯỚNG DẪN TRIỂN KHAI:
 * 1. Mở Google Sheet DUYỆT MỔ BV
 * 2. Extensions → Apps Script
 * 3. Copy toàn bộ code này vào
 * 4. **SỬA SHEET_NAME và KHOA_COLUMN_INDEX** cho đúng
 * 5. Lưu và Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy URL deployment → Dán vào hospitalSyncUrl trong app
 */

const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';
const SHEET_NAME = 'DUYỆT'; // ✅ Tên sheet trong hình 2
const KHOA_COLUMN_INDEX = 5; // ✅ Cột E = index 5 (A=1, B=2, C=3, D=4, E=5)
const KHOA_NAME = 'NGOẠI TK';

/**
 * Main handler
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, secret, data } = payload;

    // Verify secret
    if (secret !== SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid secret' });
    }

    switch (action) {
      case 'SYNC_FROM_KHOA':
        // Đồng bộ dữ liệu từ Sheet Khoa lên Sheet BV
        return handleSyncFromKhoa(data);

      case 'TEST_CONNECTION':
        return jsonResponse({
          success: true,
          message: `Kết nối thành công với Sheet Lịch Mổ BV (Cột ${KHOA_NAME})`,
          khoaName: KHOA_NAME,
          columnIndex: KHOA_COLUMN_INDEX
        });

      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (error) {
    Logger.log('doPost Error: ' + error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Nhận dữ liệu đồng bộ từ Sheet Khoa
 * Data format:
 * {
 *   khoaName: "NGOẠI TK",
 *   schedules: [
 *     { date: "29/12", session: "sáng", content: "1. Hoàng Văn Tình\nCD:...\nDT:..." },
 *     { date: "30/12", session: "chiều", content: "..." }
 *   ]
 * }
 */
function handleSyncFromKhoa(data) {
  try {
    const { khoaName, schedules } = data;

    // Kiểm tra khoa có đúng không
    if (khoaName !== KHOA_NAME) {
      return jsonResponse({
        success: false,
        error: `Khoa không khớp. Mong đợi: "${KHOA_NAME}", nhận được: "${khoaName}"`
      });
    }

    if (!schedules || schedules.length === 0) {
      return jsonResponse({
        success: true,
        message: 'Không có lịch mổ để đồng bộ',
        total: 0,
        successCount: 0
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({
        success: false,
        error: `Không tìm thấy sheet "${SHEET_NAME}"`
      });
    }

    let successCount = 0;

    schedules.forEach(schedule => {
      try {
        const { date, session, content } = schedule;

        // Tìm dòng tương ứng với ngày + buổi
        const rowNumber = findRowByDateAndSession(sheet, date, session);

        if (rowNumber > 0) {
          // Ghi nội dung vào cột NGOẠI TK
          sheet.getRange(rowNumber, KHOA_COLUMN_INDEX).setValue(content);
          successCount++;
        } else {
          Logger.log(`Không tìm thấy dòng cho ${date} ${session}`);
        }
      } catch (err) {
        Logger.log(`Error processing schedule ${schedule.date} ${schedule.session}: ${err}`);
      }
    });

    return jsonResponse({
      success: true,
      total: schedules.length,
      successCount: successCount,
      message: `Đã đồng bộ ${successCount}/${schedules.length} buổi mổ từ ${khoaName}`
    });

  } catch (error) {
    Logger.log('handleSyncFromKhoa Error: ' + error);
    return jsonResponse({
      success: false,
      error: 'Lỗi đồng bộ: ' + error.message
    });
  }
}

/**
 * Tìm dòng theo ngày + buổi
 * ✅ XỬ LÝ MERGED CELLS: Cột Ngày được gộp cho 2 dòng (sáng + chiều)
 * @param {Sheet} sheet
 * @param {string} targetDate - Định dạng: "29/12" hoặc "29/12/2025"
 * @param {string} targetSession - "sáng" hoặc "chiều"
 * @return {number} Row number (1-indexed) hoặc -1 nếu không tìm thấy
 */
function findRowByDateAndSession(sheet, targetDate, targetSession) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  // Đọc cột A (Ngày) và cột B (Buổi)
  const dateColumn = sheet.getRange(1, 1, lastRow, 1).getValues();
  const sessionColumn = sheet.getRange(1, 2, lastRow, 1).getValues();

  const normalizedTargetDate = normalizeDateForSearch(targetDate);
  const normalizedTargetSession = normalizeSession(targetSession);

  // ✅ Biến lưu ngày hiện tại (để xử lý merged cells)
  let currentDate = '';

  for (let i = 0; i < dateColumn.length; i++) {
    const cellDate = dateColumn[i][0];
    const cellSession = sessionColumn[i][0];

    // ✅ Nếu ô có giá trị ngày, cập nhật currentDate
    // (merged cells: chỉ dòng đầu tiên có giá trị, các dòng sau trống)
    if (cellDate && String(cellDate).trim() !== '') {
      currentDate = normalizeDateForSearch(cellDate);
    }

    // So sánh với target
    const rowSession = normalizeSession(cellSession);

    if (currentDate === normalizedTargetDate && rowSession === normalizedTargetSession) {
      return i + 1; // Trả về row number (1-indexed)
    }
  }

  return -1;
}

/**
 * Chuẩn hóa ngày để so sánh
 * Ví dụ: "29/12/2025" → "29/12"
 *        "29/12" → "29/12"
 */
function normalizeDateForSearch(dateValue) {
  if (!dateValue) return '';

  let dateStr = '';

  if (dateValue instanceof Date) {
    const day = dateValue.getDate();
    const month = dateValue.getMonth() + 1;
    dateStr = `${day}/${month}`;
  } else {
    dateStr = String(dateValue).trim();
  }

  // Nếu có năm (29/12/2025), bỏ phần năm
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return dateStr;
}

/**
 * Chuẩn hóa buổi để so sánh
 */
function normalizeSession(sessionValue) {
  if (!sessionValue) return '';

  const normalized = String(sessionValue).trim().toLowerCase();

  // Chuẩn hóa các biến thể
  if (normalized.includes('sáng') || normalized.includes('sang')) {
    return 'sáng';
  }
  if (normalized.includes('chiều') || normalized.includes('chieu')) {
    return 'chiều';
  }

  return normalized;
}

/**
 * Helper: Trả về JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
