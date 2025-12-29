/**
 * ========================================
 * GOOGLE APPS SCRIPT - SHEET LỊCH MỔ BV
 * ========================================
 *
 * Mục đích: Nhận và quản lý lịch mổ từ các khoa gửi lên
 * Khoa: NGOẠI TK (cột E)
 *
 * HƯỚNG DẪN TRIỂN KHAI:
 * 1. Mở Google Sheet Lịch Mổ BV
 * 2. Extensions → Apps Script
 * 3. Copy toàn bộ code này vào
 * 4. Lưu và Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy URL deployment → Dán vào hospitalSyncUrl trong app
 */

const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';
const KHOA_NAME = 'NGOẠI TK'; // Tên khoa trong cột E

/**
 * Cấu trúc sheet Lịch Mổ BV (Đơn giản - chỉ lưu thông tin):
 * A: STT
 * B: Họ tên
 * C: Ngày mổ
 * D: Giờ mổ
 * E: Khoa (NGOẠI TK)
 * F: Chẩn đoán
 * G: Phương pháp mổ
 * H: Bác sĩ mổ
 * I: Phòng mổ
 * J: Phương pháp vô cảm
 * K: Phân loại phẫu thuật
 * L: Yêu cầu đặc biệt
 * M: Ghi chú
 * N: Thời gian sync cuối
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
          message: 'Kết nối thành công với Sheet Lịch Mổ BV',
          khoaName: KHOA_NAME
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
 */
function handleSyncFromKhoa(data) {
  try {
    const { khoaName, surgeries } = data;

    // Kiểm tra khoa có đúng không
    if (khoaName !== KHOA_NAME) {
      return jsonResponse({
        success: false,
        error: `Khoa không khớp. Mong đợi: "${KHOA_NAME}", nhận được: "${khoaName}"`
      });
    }

    if (!surgeries || surgeries.length === 0) {
      return jsonResponse({
        success: true,
        message: 'Không có ca mổ để đồng bộ',
        total: 0,
        successCount: 0
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Lịch mổ BV') || ss.getSheets()[0];

    let successCount = 0;
    const now = new Date().toLocaleString('vi-VN');

    surgeries.forEach(surgery => {
      try {
        const existingRow = findSurgeryRow(sheet, surgery.fullName, surgery.surgeryDate);

        if (existingRow > 0) {
          // Cập nhật ca mổ đã có
          updateSurgeryRow(sheet, existingRow, surgery, khoaName, now);
        } else {
          // Thêm ca mổ mới
          addNewSurgeryRow(sheet, surgery, khoaName, now);
        }
        successCount++;
      } catch (err) {
        Logger.log(`Error processing surgery ${surgery.fullName}: ${err}`);
      }
    });

    return jsonResponse({
      success: true,
      total: surgeries.length,
      successCount: successCount,
      message: `Đã đồng bộ ${successCount}/${surgeries.length} ca mổ từ ${khoaName}`
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
 * Tìm dòng ca mổ theo tên + ngày
 */
function findSurgeryRow(sheet, fullName, surgeryDate) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const data = sheet.getRange(2, 2, lastRow - 1, 3).getValues(); // Cột B, C, D
  const normalizedDate = normalizeDateString(surgeryDate);

  for (let i = 0; i < data.length; i++) {
    const rowName = String(data[i][0]).trim();
    const rowDate = normalizeDateString(data[i][1]);

    if (rowName === fullName && rowDate === normalizedDate) {
      return i + 2; // Trả về row number (1-indexed)
    }
  }

  return -1;
}

/**
 * Thêm ca mổ mới
 */
function addNewSurgeryRow(sheet, surgery, khoaName, syncTime) {
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  // Tính STT
  const stt = lastRow > 1 ? lastRow - 1 + 1 : 1;

  sheet.getRange(newRow, 1, 1, 14).setValues([[
    stt,                                    // A: STT
    surgery.fullName || '',                 // B: Họ tên
    surgery.surgeryDate || '',              // C: Ngày mổ
    surgery.surgeryTime || '',              // D: Giờ mổ
    khoaName,                               // E: Khoa
    surgery.diagnosis || '',                // F: Chẩn đoán
    surgery.surgeryMethod || '',            // G: Phương pháp mổ
    surgery.surgeonName || '',              // H: Bác sĩ mổ
    surgery.operatingRoom || '',            // I: Phòng mổ
    surgery.anesthesiaMethod || '',         // J: Phương pháp vô cảm
    surgery.surgeryClassification || '',    // K: Phân loại PT
    surgery.surgeryRequirements || '',      // L: Yêu cầu đặc biệt
    surgery.surgeryNotes || '',             // M: Ghi chú
    syncTime                                // N: Thời gian sync
  ]]);
}

/**
 * Cập nhật ca mổ đã có
 */
function updateSurgeryRow(sheet, rowNumber, surgery, khoaName, syncTime) {
  sheet.getRange(rowNumber, 1, 1, 14).setValues([[
    sheet.getRange(rowNumber, 1).getValue(), // A: Giữ nguyên STT
    surgery.fullName || '',                  // B: Họ tên
    surgery.surgeryDate || '',               // C: Ngày mổ
    surgery.surgeryTime || '',               // D: Giờ mổ
    khoaName,                                // E: Khoa
    surgery.diagnosis || '',                 // F: Chẩn đoán
    surgery.surgeryMethod || '',             // G: Phương pháp mổ
    surgery.surgeonName || '',               // H: Bác sĩ mổ
    surgery.operatingRoom || '',             // I: Phòng mổ
    surgery.anesthesiaMethod || '',          // J: Phương pháp vô cảm
    surgery.surgeryClassification || '',     // K: Phân loại PT
    surgery.surgeryRequirements || '',       // L: Yêu cầu đặc biệt
    surgery.surgeryNotes || '',              // M: Ghi chú
    syncTime                                 // N: Cập nhật thời gian sync
  ]]);
}

/**
 * Helper: Chuẩn hóa chuỗi ngày
 */
function normalizeDateString(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  }

  const str = String(dateValue).trim();

  // Nếu đã ở dạng YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Nếu dạng DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return str;
}

/**
 * Helper: Trả về JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
