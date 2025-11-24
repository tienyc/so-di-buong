/**
 * Google Apps Script for Surgery Schedule Sheet (Lịch mổ khoa)
 * Deploy this as Web App on the surgery schedule Google Sheet
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your surgery schedule Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this code
 * 4. Deploy → New deployment
 * 5. Type: Web App
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Deploy and copy the Web App URL
 * 9. Paste URL into SmartRound Settings → "Surgery Sheet URL"
 */

const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz'; // Match with main app
const SHEET_NAME = 'Sheet1'; // Change if your sheet has different name

/**
 * Main endpoint - receives surgery data from SmartRound app
 */
function doPost(e) {
  try {
    // Parse request
    const body = JSON.parse(e.postData.contents);
    const { action, secret, data } = body;

    // Verify secret
    if (secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Unauthorized'
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
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Unknown action'
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sync single surgery entry
 */
function syncSurgery(patient) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet not found: ' + SHEET_NAME);
  }

  // Validate required fields
  if (!patient.fullName || !patient.surgeryDate) {
    throw new Error('Missing required fields: fullName, surgeryDate');
  }

  // Find existing row by fullName + surgeryDate
  const existingRow = findExistingRow(sheet, patient.fullName, patient.surgeryDate);

  // Convert time format: "08:30" → "8h30"
  const surgeryTimeFormatted = formatTimeToVietnamese(patient.surgeryTime || '');

  // Determine Sáng/Chiều
  const sangChieu = determineSangChieu(patient.surgeryTime);

  // Prepare row data (columns A-P)
  const rowData = [
    new Date(),                          // A: Dấu thời gian
    patient.surgeryDate,                 // B: Ngày PT
    patient.fullName,                    // C: Tên BN
    patient.diagnosis || '',             // D: Chẩn đoán
    patient.surgeryMethod || '',         // E: PPPT
    patient.surgeryClassification || '', // F: Phân loại
    patient.surgeonName || '',           // G: PTV
    patient.surgeryNotes || '',          // H: Ghi chú
    surgeryTimeFormatted,                // I: Giờ mổ (8h30 format)
    patient.operatingRoom || '',         // J: Phòng mổ
    '',                                  // K: Gửi TK (để trống)
    '',                                  // L: Gửi PTV (để trống)
    patient.anesthesiaMethod || '',      // M: Vô cảm
    patient.surgeryRequirements || '',   // N: Săng + Yêu cầu
    sangChieu,                           // O: Sáng/Chiều
    patient.surgeryTime || ''            // P: Giờ PT (original format)
  ];

  if (existingRow) {
    // Update existing row
    const range = sheet.getRange(existingRow, 1, 1, rowData.length);
    range.setValues([rowData]);
    return {
      success: true,
      action: 'updated',
      row: existingRow,
      patient: patient.fullName
    };
  } else {
    // Append new row
    sheet.appendRow(rowData);
    return {
      success: true,
      action: 'inserted',
      row: sheet.getLastRow(),
      patient: patient.fullName
    };
  }
}

/**
 * Sync multiple surgeries at once
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
    results: results
  };
}

/**
 * Find existing row by patient name + surgery date
 * Returns row number if found, null otherwise
 */
function findExistingRow(sheet, fullName, surgeryDate) {
  const data = sheet.getDataRange().getValues();

  // Skip header row (index 0), start from row 1 (data)
  for (let i = 1; i < data.length; i++) {
    const rowName = data[i][2];     // Column C: Tên BN
    const rowDate = data[i][1];     // Column B: Ngày PT

    // Convert date to string for comparison
    const rowDateStr = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(rowDate);

    if (rowName === fullName && rowDateStr === surgeryDate) {
      return i + 1; // Return 1-based row number
    }
  }

  return null;
}

/**
 * Convert time from "08:30" to "8h30" format
 */
function formatTimeToVietnamese(time) {
  if (!time) return '';

  // If already in Vietnamese format, return as is
  if (time.includes('h')) return time;

  // Convert HH:MM to Hh[M]M
  const parts = time.split(':');
  if (parts.length !== 2) return time;

  const hour = parseInt(parts[0], 10);  // Remove leading zero
  const minute = parts[1];

  return `${hour}h${minute}`;
}

/**
 * Determine if surgery is morning or afternoon
 */
function determineSangChieu(time) {
  if (!time) return '';

  // Extract hour
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
 * Test function - for debugging in Apps Script editor
 */
function testSync() {
  const testPatient = {
    fullName: 'Nguyễn Văn Test',
    surgeryDate: '2025-11-25',
    surgeryTime: '08:30',
    diagnosis: 'Gãy xương đùi',
    surgeryMethod: 'Nẹp vít',
    surgeonName: 'BS. Nguyễn Văn A',
    operatingRoom: 'Phòng 1',
    anesthesiaMethod: 'Mê NKQ',
    surgeryClassification: 'Chấn thương',
    surgeryRequirements: 'Săng trung',
    surgeryNotes: 'Test sync from app'
  };

  const result = syncSurgery(testPatient);
  Logger.log(result);
}
