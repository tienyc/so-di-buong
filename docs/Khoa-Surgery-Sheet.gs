/**
 * Google Apps Script for Surgery Schedule Sheet - Khoa Ngoại TK
 * Deploy this as Web App on the "Lịch mổ Ngoại TK" Google Sheet
 *
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở Google Sheet "Lịch mổ Ngoại TK"
 * 2. Extensions → Apps Script
 * 3. Paste toàn bộ code này
 * 4. Deploy → New deployment
 * 5. Type: Web App
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Deploy và copy Web App URL
 * 9. Paste URL vào SmartRound Settings → "Surgery Sheet URL"
 *
 * CẤU TRÚC SHEET (A-N):
 * A: Ngày PT
 * B: TênBN
 * C: Chẩn Đoán
 * D: PPPT
 * E: Phân loại
 * F: PTV
 * G: Ghi chú
 * H: Giờ mổ
 * I: Phòng mổ
 * J: Vô Cảm
 * K: Săng + Yêu cầu
 * L: Sáng/Chiều
 * M: Thời gian chuẩn
 * N: Patient ID (để tránh trùng lặp khi sửa ngày/giờ mổ)
 */

// ⚠️ Mã bảo mật - PHẢI KHỚP với main app
const SURGERY_SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';

// ✅ Tên tab sheet chứa lịch mổ
const SURGERY_SHEET_NAME = 'Lịch mổ'; // Đổi nếu tab của bạn tên khác

// ========== CẤU HÌNH ĐỒNG BỘ LÊN BV ==========
const BV_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LXu29mEAUWm8I8zRSWk0ENA6LFzl5905ZNU4lJFQiyk/edit';
const BV_SHEET_TAB_NAME = 'DUYỆT';
const KHOA_COLUMN_INDEX = 5; // Cột E = NGOẠI TK
const KHOA_NAME = 'NGOẠI TK';
const TONGHOP_TAB_NAME = 'Tổng hợp'; // Tab có 3 cột: Ngày | Buổi | Duyệt mổ

/**
 * TEST endpoint - Kiểm tra Apps Script đã deploy chưa
 * Mở Web App URL trong browser sẽ thấy thông báo này
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: '✅ Apps Script "Lịch mổ Ngoại TK" đã được deploy THÀNH CÔNG!',
    timestamp: new Date().toISOString(),
    sheetName: SURGERY_SHEET_NAME,
    department: 'Ngoại Tiết Niệu - Khoa',
    instructions: 'Để test đồng bộ, dùng POST request với action=SYNC_SURGERY'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main endpoint - Nhận dữ liệu lịch mổ từ SmartRound app
 */
function doPost(e) {
  try {
    // Parse request body
    const body = JSON.parse(e.postData.contents);
    const { action, secret, data } = body;

    // Verify secret key
    if (secret !== SURGERY_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Unauthorized - Secret key không đúng'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle different actions
    let result;
    switch (action) {
      case 'SYNC_SURGERY':
        result = syncSurgery(data);
        break;
      case 'SYNC_BATCH':
        result = syncBatch(data.patients);
        break;
      case 'SYNC_TO_HOSPITAL':
        result = syncToHospital();
        break;
      case 'TEST_CONNECTION':
        result = {
          success: true,
          message: 'Kết nối thành công! Sheet sẵn sàng nhận dữ liệu.'
        };
        break;
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Unknown action: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Server error: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Đồng bộ 1 ca mổ
 * ✅ CẬP NHẬT: Tìm theo Patient ID để tránh trùng lặp khi sửa ngày/giờ mổ
 */
function syncSurgery(patient) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SURGERY_SHEET_NAME);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet: ' + SURGERY_SHEET_NAME);
  }

  // Validate required fields
  if (!patient.fullName || !patient.surgeryDate) {
    throw new Error('Thiếu thông tin bắt buộc: Tên bệnh nhân hoặc Ngày mổ');
  }

  // ✅ TÌM THEO PATIENT ID (ưu tiên) hoặc tên + ngày (fallback)
  const existingRow = findExistingRow(sheet, patient.id, patient.fullName, patient.surgeryDate);

  // Parse dates and times
  const parsedSurgeryDate = parseDateString(patient.surgeryDate);
  const surgeryTimeFormatted = formatTimeToVietnamese(patient.surgeryTime || '');
  const sangChieu = determineSangChieu(patient.surgeryTime);
  const parsedSurgeryTime = parseTimeString(patient.surgeryTime);

  // Chuẩn bị dữ liệu theo cấu trúc sheet (A-N)
  const rowData = [
    parsedSurgeryDate,                   // A: Ngày PT (dd/MM/yyyy)
    patient.fullName,                    // B: TênBN
    patient.diagnosis || '',             // C: Chẩn đoán
    patient.surgeryMethod || '',         // D: PPPT
    patient.surgeryClassification || '', // E: Phân loại
    patient.surgeonName || '',           // F: PTV
    patient.surgeryNotes || '',          // G: Ghi chú
    surgeryTimeFormatted,                // H: Giờ mổ (8h30 format)
    patient.operatingRoom || '',         // I: Phòng mổ
    patient.anesthesiaMethod || '',      // J: Vô cảm
    patient.surgeryRequirements || '',   // K: Săng + Yêu cầu
    sangChieu,                           // L: Sáng/Chiều
    parsedSurgeryTime,                   // M: Thời gian chuẩn (HH:mm)
    patient.id || ''                     // N: Patient ID ✅ MỚI
  ];

  if (existingRow) {
    // Cập nhật dòng đã tồn tại
    const range = sheet.getRange(existingRow, 1, 1, rowData.length);
    range.setValues([rowData]);
    return {
      success: true,
      action: 'updated',
      row: existingRow,
      patient: patient.fullName,
      message: 'Đã cập nhật ca mổ của ' + patient.fullName
    };
  } else {
    // Thêm dòng mới
    sheet.appendRow(rowData);
    return {
      success: true,
      action: 'inserted',
      row: sheet.getLastRow(),
      patient: patient.fullName,
      message: 'Đã thêm ca mổ mới của ' + patient.fullName
    };
  }
}

/**
 * Đồng bộ nhiều ca mổ cùng lúc
 */
function syncBatch(patients) {
  const results = [];
  patients.forEach(patient => {
    try {
      const result = syncSurgery(patient);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        patient: patient.fullName,
        error: error.message
      });
    }
  });

  const successCount = results.filter(r => r.success).length;
  return {
    success: true,
    total: patients.length,
    successCount: successCount,
    failedCount: patients.length - successCount,
    results: results
  };
}

/**
 * ✅ TÌM DÒNG ĐÃ TỒN TẠI - ƯU TIÊN THEO PATIENT ID
 * Logic:
 * 1. Nếu có Patient ID → tìm theo ID (cột N)
 * 2. Nếu không có ID hoặc không tìm thấy → tìm theo tên + ngày (fallback)
 *
 * Trả về: row number (1-based) nếu tìm thấy, null nếu không
 */
function findExistingRow(sheet, patientId, fullName, surgeryDate) {
  const data = sheet.getDataRange().getValues();

  // Chuẩn hóa ngày mổ từ request (yyyy-MM-dd hoặc ISO format)
  const normalizedSurgeryDate = surgeryDate.split('T')[0]; // Extract yyyy-MM-dd

  // Bỏ qua header row (index 0), bắt đầu từ row 1 (data)
  for (let i = 1; i < data.length; i++) {
    const rowPatientId = data[i][13];  // Column N: Patient ID
    const rowName = data[i][1];        // Column B: Tên BN
    const rowDate = data[i][0];        // Column A: Ngày PT

    // ✅ ƯU TIÊN: Tìm theo Patient ID (nếu có)
    if (patientId && rowPatientId === patientId) {
      return i + 1; // Tìm thấy theo ID → Cập nhật dòng này
    }

    // ✅ FALLBACK: Tìm theo tên + ngày (cho các record cũ chưa có ID)
    // Chuẩn hóa date từ sheet về yyyy-MM-dd
    let rowDateStr;
    if (rowDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (typeof rowDate === 'string') {
      rowDateStr = rowDate.split('T')[0];
    } else {
      rowDateStr = String(rowDate);
    }

    // So sánh tên VÀ ngày (đã chuẩn hóa) - chỉ khi chưa tìm thấy theo ID
    if (!patientId && rowName === fullName && rowDateStr === normalizedSurgeryDate) {
      return i + 1; // Trả về 1-based row number
    }
  }

  return null; // Không tìm thấy → Thêm mới
}

/**
 * Chuyển đổi thời gian từ "08:30" sang "8h30"
 */
function formatTimeToVietnamese(time) {
  if (!time) return '';

  // Nếu đã là định dạng Vietnamese, giữ nguyên
  if (time.includes('h')) return time;

  // Chuyển HH:MM sang Hh[M]M
  const parts = time.split(':');
  if (parts.length !== 2) return time;

  const hour = parseInt(parts[0], 10);  // Bỏ số 0 đầu
  const minute = parts[1];

  return `${hour}h${minute}`;
}

/**
 * Xác định Sáng/Chiều dựa trên giờ mổ
 */
function determineSangChieu(time) {
  if (!time) return '';

  // Lấy giờ
  let hour;
  if (time.includes('h')) {
    // Format: "8h30"
    hour = parseInt(time.split('h')[0], 10);
  } else if (time.includes(':')) {
    // Format: "08:30"
    hour = parseInt(time.split(':')[0], 10);
  } else {
    return '';
  }

  return hour < 12 ? 'Sáng' : 'Chiều';
}

/**
 * Parse date string thành Date object
 * Hỗ trợ: "2025-11-24", "2025-11-24T17:00:00.000Z", "24/11/2025"
 */
function parseDateString(dateStr) {
  if (!dateStr) return '';

  try {
    // Nếu đã là Date object
    if (dateStr instanceof Date) return dateStr;

    // Bỏ phần time nếu là ISO format
    const dateOnly = dateStr.split('T')[0];

    // Parse yyyy-MM-dd format
    if (dateOnly.includes('-')) {
      const parts = dateOnly.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }

    // Parse dd/MM/yyyy format
    if (dateOnly.includes('/')) {
      const parts = dateOnly.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }

    // Fallback: try to parse as is
    return new Date(dateStr);
  } catch (error) {
    Logger.log('Error parsing date: ' + dateStr + ' - ' + error.message);
    return '';
  }
}

/**
 * Parse time string thành HH:mm format
 * Hỗ trợ: "08:30", "8h30", "2025-11-24T08:30:00.000Z"
 */
function parseTimeString(timeStr) {
  if (!timeStr) return '';

  try {
    // Nếu là ISO datetime string, lấy phần time
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      if (timePart) {
        const timeOnly = timePart.split('.')[0]; // Bỏ milliseconds
        const [hour, minute] = timeOnly.split(':');
        return hour + ':' + minute;
      }
    }

    // Nếu là Vietnamese format "8h30"
    if (timeStr.includes('h')) {
      const parts = timeStr.split('h');
      const hour = parts[0].padStart(2, '0');
      const minute = parts[1] || '00';
      return hour + ':' + minute;
    }

    // Nếu đã là HH:mm format
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hour = parts[0].padStart(2, '0');
      const minute = parts[1] || '00';
      return hour + ':' + minute;
    }

    return timeStr;
  } catch (error) {
    Logger.log('Error parsing time: ' + timeStr + ' - ' + error.message);
    return '';
  }
}

// ========== ĐỒNG BỘ LÊN BV ==========

/**
 * Đồng bộ từ tab "Tổng hợp" lên Sheet DUYỆT BV
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
 * ✅ Xử lý merged cells: Cột Ngày được gộp cho 2 dòng (sáng + chiều)
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

// ========== HÀMTEST ==========

/**
 * Hàm test - Dùng để debug trong Apps Script editor
 * Chạy: Run → testSync
 */
function testSync() {
  const testPatient = {
    id: 'test-patient-123', // ✅ MỚI: Patient ID
    fullName: 'Nguyễn Văn Test',
    surgeryDate: '2025-12-30',
    surgeryTime: '08:30',
    diagnosis: 'Sỏi thận trái',
    surgeryMethod: 'Nội soi laser tán sỏi',
    surgeonName: 'BS. Nguyễn Văn A',
    operatingRoom: 'Phòng 1',
    anesthesiaMethod: 'Mê NKQ',
    surgeryClassification: 'Phẫu thuật lớn',
    surgeryRequirements: 'Săng trung',
    surgeryNotes: 'Test sync from SmartRound App'
  };

  const result = syncSurgery(testPatient);
  Logger.log(result);

  // Xem kết quả: View → Logs
}

/**
 * Test đồng bộ lên BV
 * Chạy: Run → testSyncToHospital
 */
function testSyncToHospital() {
  const result = syncToHospital();
  Logger.log('Test sync to hospital result:');
  Logger.log(JSON.stringify(result, null, 2));
}
