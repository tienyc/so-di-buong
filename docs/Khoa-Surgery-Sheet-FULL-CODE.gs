/**
 * ========================================
 * GOOGLE APPS SCRIPT - SHEET LỊCH MỔ KHOA
 * CODE HOÀN CHỈNH (Bao gồm đồng bộ lên BV)
 * ========================================
 *
 * HƯỚNG DẪN:
 * 1. Mở Sheet "Lịch mổ Ngoại TK"
 * 2. Extensions → Apps Script
 * 3. Copy TOÀN BỘ code này vào (thay thế code cũ)
 * 4. Lưu (Ctrl+S)
 * 5. Deploy → Manage deployments → Edit → New version → Deploy
 */

// ========== CẤU HÌNH ==========

const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';

// URL Sheet BV (Sheet DUYỆT MỔ BV)
const BV_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LXu29mEAUWm8I8zRSWk0ENA6LFzl5905ZNU4lJFQiyk/edit';
const BV_SHEET_TAB_NAME = 'DUYỆT';
const KHOA_COLUMN_INDEX = 5; // Cột E = NGOẠI TK
const KHOA_NAME = 'NGOẠI TK';

// Tên tab trong Sheet Khoa
const TONGHOP_TAB_NAME = 'Tổng hợp'; // Tab có 3 cột: Ngày | Buổi | Duyệt mổ
const LICH_MO_TAB_NAME = 'Lịch mổ';   // Tab chi tiết ca mổ (13 cột)

// ========== MAIN HANDLER ==========

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, secret, data } = payload;

    // Verify secret
    if (secret !== SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid secret' });
    }

    let result;

    switch (action) {
      case 'SYNC_SURGERY':
        result = handleSyncSurgery(data);
        break;

      case 'SYNC_BATCH':
        result = handleSyncBatch(data);
        break;

      case 'TEST_CONNECTION':
        result = {
          success: true,
          message: 'Kết nối thành công với Sheet Lịch Mổ Khoa'
        };
        break;

      case 'SYNC_TO_HOSPITAL':
        result = syncToHospital();
        break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);

  } catch (error) {
    Logger.log('doPost Error: ' + error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ========== XỬ LÝ ĐỒNG BỘ TỪ APP ==========

/**
 * Xử lý đồng bộ 1 ca mổ từ app
 */
function handleSyncSurgery(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LICH_MO_TAB_NAME) || ss.getSheets()[0];

    const {
      fullName,
      surgeryDate,
      surgeryTime,
      diagnosis,
      surgeryMethod,
      surgeonName,
      operatingRoom,
      anesthesiaMethod,
      surgeryClassification,
      surgeryRequirements,
      surgeryNotes
    } = data;

    // Tìm dòng có cùng tên + ngày mổ
    const lastRow = sheet.getLastRow();
    let rowIndex = -1;
    let action = 'added';

    if (lastRow >= 2) {
      const nameColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const dateColumn = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

      for (let i = 0; i < nameColumn.length; i++) {
        if (nameColumn[i][0] === fullName &&
            formatDateForComparison(dateColumn[i][0]) === surgeryDate) {
          rowIndex = i + 2;
          action = 'updated';
          break;
        }
      }
    }

    // Thêm mới hoặc cập nhật
    if (rowIndex === -1) {
      rowIndex = lastRow + 1;
    }

    // Ghi dữ liệu (13 cột)
    sheet.getRange(rowIndex, 1, 1, 11).setValues([[
      fullName,
      surgeryDate,
      surgeryTime || '',
      diagnosis || '',
      surgeryMethod || '',
      surgeonName || '',
      operatingRoom || '',
      anesthesiaMethod || '',
      surgeryClassification || '',
      surgeryRequirements || '',
      surgeryNotes || ''
    ]]);

    return {
      success: true,
      action: action,
      message: `${action === 'updated' ? 'Cập nhật' : 'Thêm mới'} ca mổ của ${fullName}`
    };

  } catch (error) {
    Logger.log('handleSyncSurgery Error: ' + error);
    return {
      success: false,
      error: 'Lỗi đồng bộ: ' + error.message
    };
  }
}

/**
 * Xử lý đồng bộ nhiều ca mổ từ app
 */
function handleSyncBatch(data) {
  try {
    const { patients } = data;
    let successCount = 0;

    patients.forEach(patient => {
      const result = handleSyncSurgery(patient);
      if (result.success) {
        successCount++;
      }
    });

    return {
      success: true,
      total: patients.length,
      successCount: successCount,
      message: `Đã đồng bộ ${successCount}/${patients.length} ca mổ`
    };

  } catch (error) {
    Logger.log('handleSyncBatch Error: ' + error);
    return {
      success: false,
      error: 'Lỗi đồng bộ batch: ' + error.message
    };
  }
}

// ========== ĐỒNG BỘ LÊN BV ==========

/**
 * Đồng bộ từ tab "Tổng hợp" lên Sheet BV
 * Đọc 3 cột: Ngày | Buổi | Duyệt mổ
 * Ghi vào cột E (NGOẠI TK) của Sheet BV
 */
function syncToHospital() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TONGHOP_TAB_NAME);

    if (!sheet) {
      return {
        success: false,
        error: `Không tìm thấy tab "${TONGHOP_TAB_NAME}"`
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        message: 'Không có dữ liệu để đồng bộ',
        total: 0,
        successCount: 0
      };
    }

    // Đọc toàn bộ dữ liệu (3 cột: Ngày | Buổi | Duyệt mổ)
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
        message: 'Không có lịch mổ hợp lệ để đồng bộ',
        total: 0,
        successCount: 0
      };
    }

    // Mở Sheet BV
    const bvSheet = SpreadsheetApp.openByUrl(BV_SHEET_URL);
    const bvTab = bvSheet.getSheetByName(BV_SHEET_TAB_NAME);

    if (!bvTab) {
      return {
        success: false,
        error: `Không tìm thấy tab "${BV_SHEET_TAB_NAME}" trong Sheet BV`
      };
    }

    let successCount = 0;

    // Ghi từng dòng vào Sheet BV
    validRows.forEach(row => {
      try {
        const date = formatDateForBV(row[0]);
        const session = normalizeSession(row[1]);
        const content = String(row[2]);

        // Tìm dòng tương ứng trong Sheet BV
        const rowNumber = findRowInBV(bvTab, date, session);

        if (rowNumber > 0) {
          // Ghi nội dung vào cột E (NGOẠI TK)
          bvTab.getRange(rowNumber, KHOA_COLUMN_INDEX).setValue(content);
          successCount++;
        } else {
          Logger.log(`Không tìm thấy dòng cho ${date} ${session}`);
        }
      } catch (err) {
        Logger.log(`Error processing row ${row[0]} ${row[1]}: ${err}`);
      }
    });

    return {
      success: true,
      total: validRows.length,
      successCount: successCount,
      message: `Đã đồng bộ ${successCount}/${validRows.length} buổi mổ lên BV`
    };

  } catch (error) {
    Logger.log('syncToHospital Error: ' + error);
    return {
      success: false,
      error: 'Lỗi đồng bộ BV: ' + error.message
    };
  }
}

/**
 * Tìm dòng trong Sheet BV theo ngày + buổi
 * Xử lý merged cells: Cột Ngày được gộp cho 2 dòng (sáng + chiều)
 */
function findRowInBV(sheet, targetDate, targetSession) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  // Đọc cột A (Ngày) và cột B (Buổi)
  const dateColumn = sheet.getRange(1, 1, lastRow, 1).getValues();
  const sessionColumn = sheet.getRange(1, 2, lastRow, 1).getValues();

  const normalizedTargetDate = normalizeDateForComparison(targetDate);
  const normalizedTargetSession = normalizeSession(targetSession);

  // Biến lưu ngày hiện tại (để xử lý merged cells)
  let currentDate = '';

  for (let i = 0; i < dateColumn.length; i++) {
    const cellDate = dateColumn[i][0];
    const cellSession = sessionColumn[i][0];

    // Nếu ô có giá trị ngày, cập nhật currentDate
    if (cellDate && String(cellDate).trim() !== '') {
      currentDate = normalizeDateForComparison(cellDate);
    }

    // So sánh với target
    const rowSession = normalizeSession(cellSession);

    if (currentDate === normalizedTargetDate && rowSession === normalizedTargetSession) {
      return i + 1; // Trả về row number (1-indexed)
    }
  }

  return -1;
}

// ========== HELPER FUNCTIONS ==========

/**
 * Format ngày cho BV: "29/12/2025" → "29/12"
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
    return `${parts[0]}/${parts[1]}`;
  }

  return dateStr;
}

/**
 * Chuẩn hóa ngày để so sánh: "29/12/2025" → "29/12"
 */
function normalizeDateForComparison(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date) {
    const day = dateValue.getDate();
    const month = dateValue.getMonth() + 1;
    return `${day}/${month}`;
  }

  const dateStr = String(dateValue).trim();
  const parts = dateStr.split('/');

  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return dateStr;
}

/**
 * Chuẩn hóa buổi: "sáng" hoặc "chiều"
 */
function normalizeSession(sessionValue) {
  if (!sessionValue) return '';

  const normalized = String(sessionValue).trim().toLowerCase();

  if (normalized.includes('sáng') || normalized.includes('sang')) {
    return 'sáng';
  }
  if (normalized.includes('chiều') || normalized.includes('chieu')) {
    return 'chiều';
  }

  return normalized;
}

/**
 * Format date cho so sánh: Date object → "yyyy-MM-dd"
 */
function formatDateForComparison(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  }

  return String(dateValue);
}

/**
 * Trả về JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== TRIGGER TỰ ĐỘNG ==========

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
