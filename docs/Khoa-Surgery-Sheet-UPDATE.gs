/**
 * ========================================
 * CẬP NHẬT CODE CHO SHEET LỊCH MỔ KHOA
 * ========================================
 *
 * HƯỚNG DẪN:
 * 1. Mở Apps Script của Sheet "Lịch mổ Ngoại TK" (Sheet có 3 cột)
 * 2. THÊM các đoạn code dưới đây vào file hiện tại
 * 3. SỬA biến BV_SHEET_URL
 * 4. Lưu và Deploy lại
 */

// ===== THÊM BIẾN CẤU HÌNH (đầu file, sau SECRET) =====

const BV_SHEET_URL = 'URL_DEPLOYMENT_CUA_BV_SHEET_O_FILE_V2'; // ✅ Thay bằng URL thực tế

// CẤU TRÚC SHEET KHOA:
const KHOA_SHEET_NAME = 'Lịch mổ'; // Tên sheet trong hình 1
const KHOA_DATE_COL = 1;   // Cột A: Ngày
const KHOA_SESSION_COL = 2; // Cột B: Buổi
const KHOA_CONTENT_COL = 3; // Cột C: Duyệt mổ

// ===== THÊM HÀM MỚI (sau các hàm hiện tại) =====

/**
 * Đồng bộ lịch mổ từ sheet Khoa lên sheet BV
 * Đọc từ 3 cột: Ngày | Buổi | Duyệt mổ
 */
function syncToHospital() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(KHOA_SHEET_NAME) || ss.getSheets()[0];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, message: 'Không có dữ liệu để đồng bộ' };
    }

    // Đọc toàn bộ dữ liệu (3 cột: Ngày, Buổi, Duyệt mổ)
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    // Lọc các dòng có đủ thông tin
    const validRows = data.filter(row => {
      const date = row[0];
      const session = row[1];
      const content = row[2];
      return date && session && content && String(content).trim() !== '';
    });

    if (validRows.length === 0) {
      return {
        success: true,
        message: 'Không có lịch mổ hợp lệ để đồng bộ'
      };
    }

    // Format dữ liệu để gửi lên BV
    const schedules = validRows.map(row => ({
      date: formatDateForBV(row[0]),
      session: normalizeSessionForBV(row[1]),
      content: String(row[2])
    }));

    // Gửi request lên BV sheet
    const response = UrlFetchApp.fetch(BV_SHEET_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        action: 'SYNC_FROM_KHOA',
        secret: SECRET,
        data: {
          khoaName: 'NGOẠI TK',
          schedules: schedules
        }
      }),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.success) {
      return {
        success: true,
        message: `Đã đồng bộ ${result.successCount}/${result.total} buổi mổ lên BV`,
        details: result
      };
    } else {
      return {
        success: false,
        error: result.error || 'Lỗi từ BV sheet'
      };
    }

  } catch (error) {
    Logger.log('Error syncing to hospital: ' + error);
    return {
      success: false,
      error: 'Lỗi kết nối BV: ' + error.message
    };
  }
}

/**
 * Format ngày cho BV (29/12 hoặc 29/12/2025 → "29/12")
 */
function formatDateForBV(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date) {
    const day = dateValue.getDate();
    const month = dateValue.getMonth() + 1;
    return `${day}/${month}`;
  }

  const dateStr = String(dateValue).trim();

  // Nếu đã có định dạng 29/12 hoặc 29/12/2025
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`; // Chỉ lấy ngày/tháng
  }

  return dateStr;
}

/**
 * Chuẩn hóa buổi cho BV
 */
function normalizeSessionForBV(sessionValue) {
  if (!sessionValue) return '';

  const normalized = String(sessionValue).trim().toLowerCase();

  if (normalized.includes('sáng') || normalized.includes('sang')) {
    return 'sáng';
  }
  if (normalized.includes('chiều') || normalized.includes('chieu')) {
    return 'chiều';
  }

  return sessionValue;
}

// ===== THÊM VÀO SWITCH CASE TRONG doPost =====

/**
 * QUAN TRỌNG: Tìm đoạn này trong hàm doPost hiện tại:
 *
 * switch (action) {
 *   case 'SYNC_SURGERY':
 *     // ... code hiện tại
 *     break;
 *
 *   case 'SYNC_BATCH':
 *     // ... code hiện tại
 *     break;
 *
 *   // ✅ THÊM CASE MỚI NÀY:
 *   case 'TRIGGER_SYNC':
 *     const syncResult = syncToHospital();
 *     return ContentService.createTextOutput(JSON.stringify(syncResult))
 *       .setMimeType(ContentService.MimeType.JSON);
 *
 *   case 'TEST_CONNECTION':
 *     // ... code hiện tại
 *     break;
 * }
 */

// ===== THÊM TRIGGER TỰ ĐỘNG (cuối file) =====

/**
 * Thiết lập trigger tự động đồng bộ mỗi ngày lúc 20h
 * Chạy hàm này 1 lần để cài đặt trigger
 */
function setupDailyTrigger() {
  // Xóa trigger cũ (nếu có)
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailySyncToHospital') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Tạo trigger mới: mỗi ngày lúc 20h
  ScriptApp.newTrigger('dailySyncToHospital')
    .timeBased()
    .atHour(20)
    .everyDays(1)
    .create();

  Logger.log('✅ Đã thiết lập trigger tự động đồng bộ lúc 20h hàng ngày');
}

/**
 * Hàm được gọi tự động mỗi ngày lúc 20h
 */
function dailySyncToHospital() {
  const result = syncToHospital();
  Logger.log('Auto sync result: ' + JSON.stringify(result));

  if (!result.success) {
    Logger.log('⚠️ Đồng bộ tự động thất bại: ' + result.error);
    // Có thể gửi email thông báo ở đây nếu muốn
  }
}

/**
 * Test function - Chạy thủ công để kiểm tra
 */
function testSyncToHospital() {
  const result = syncToHospital();
  Logger.log('Test sync result:');
  Logger.log(JSON.stringify(result, null, 2));
}
