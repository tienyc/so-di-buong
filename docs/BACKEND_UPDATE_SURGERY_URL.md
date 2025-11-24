# Hướng dẫn Update Backend để hỗ trợ Surgery Sheet URL

## Vấn đề
Hiện tại `surgerySheetUrl` (URL sheet lịch mổ khoa) đang lưu trong localStorage của browser, dễ bị mất khi refresh hoặc clear data.

## Giải pháp
Lưu `surgerySheetUrl` vào Google Sheet như một config tĩnh, tương tự như các config khác (doctors, operatingRooms, wards, v.v.)

## Cập nhật Frontend (✅ Đã hoàn thành)
- Thêm `surgerySheetUrl` vào `SettingsPayload` interface
- Update `fetchSettings()` và `saveSettings()` để xử lý surgerySheetUrl
- Update App.tsx để load/save surgerySheetUrl từ settings API

## Cập nhật Backend (⚠️ Cần thực hiện)

### Bước 1: Thêm sheet hoặc cell để lưu surgerySheetUrl

Trong Google Sheet chính (sheet quản lý bệnh nhân), tạo một trong hai cách:

**Cách 1: Thêm cột vào sheet Settings (Khuyên dùng)**
- Vào sheet "Settings" hoặc sheet cấu hình
- Thêm một row mới với format:
  ```
  | type           | value                                    | order |
  |----------------|------------------------------------------|-------|
  | SURGERY_SHEET  | https://script.google.com/macros/s/...   |   0   |
  ```

**Cách 2: Tạo Named Range**
- Tạo một cell đặc biệt (VD: Z1) để lưu URL
- Đặt tên cho cell này là "SurgerySheetUrl"
- Apps Script có thể đọc qua `SpreadsheetApp.getActiveSpreadsheet().getRangeByName('SurgerySheetUrl').getValue()`

### Bước 2: Update Apps Script code

Trong file Apps Script của Google Sheet chính, update hàm `listSettings`:

```javascript
function listSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ... existing code to read wards and dropdowns ...

  // READ surgerySheetUrl
  let surgerySheetUrl = '';
  try {
    // Cách 1: Đọc từ sheet Settings
    const settingsSheet = ss.getSheetByName('Settings') || ss.getSheetByName('Cấu hình');
    if (settingsSheet) {
      const data = settingsSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === 'SURGERY_SHEET') {
          surgerySheetUrl = data[i][1] || '';
          break;
        }
      }
    }

    // Cách 2: Đọc từ Named Range (fallback)
    if (!surgerySheetUrl) {
      const range = ss.getRangeByName('SurgerySheetUrl');
      if (range) {
        surgerySheetUrl = range.getValue() || '';
      }
    }
  } catch (e) {
    Logger.log('Error reading surgerySheetUrl: ' + e.message);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      wards: wards,
      dropdowns: dropdowns,
      surgerySheetUrl: surgerySheetUrl  // ✅ Add this line
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Update hàm `saveSettings`:

```javascript
function saveSettings(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ... existing code to save wards and dropdowns ...

  // SAVE surgerySheetUrl
  if (payload.surgerySheetUrl !== undefined) {
    try {
      // Cách 1: Lưu vào sheet Settings
      const settingsSheet = ss.getSheetByName('Settings') || ss.getSheetByName('Cấu hình');
      if (settingsSheet) {
        const data = settingsSheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === 'SURGERY_SHEET') {
            settingsSheet.getRange(i + 1, 2).setValue(payload.surgerySheetUrl);
            found = true;
            break;
          }
        }

        // Nếu chưa có, thêm row mới
        if (!found) {
          settingsSheet.appendRow(['SURGERY_SHEET', payload.surgerySheetUrl, 0]);
        }
      }

      // Cách 2: Lưu vào Named Range (fallback)
      const range = ss.getRangeByName('SurgerySheetUrl');
      if (range) {
        range.setValue(payload.surgerySheetUrl);
      }
    } catch (e) {
      Logger.log('Error saving surgerySheetUrl: ' + e.message);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Bước 3: Deploy lại Apps Script
1. Lưu code Apps Script
2. Deploy → Manage deployments → Edit (icon bút chì)
3. Version → New version
4. Deploy
5. Copy URL mới (hoặc URL không đổi nếu dùng deployment cũ)

### Bước 4: Test
1. Vào Settings trong app
2. Nhập Surgery Sheet URL
3. Kiểm tra xem URL có được lưu vào Google Sheet không
4. Refresh app, kiểm tra URL có được load lại không

## Lợi ích
- ✅ Surgery Sheet URL được lưu tĩnh trong Google Sheet
- ✅ Không bị mất khi clear browser cache
- ✅ Có thể chia sẻ giữa nhiều thiết bị/browser
- ✅ Tập trung quản lý config ở một nơi

## Migration Notes
Khi deploy frontend mới:
1. Backend chưa update → surgerySheetUrl sẽ trả về empty string → app vẫn dùng localStorage như cũ (backward compatible)
2. Sau khi update backend → surgerySheetUrl được sync từ sheet → replace localStorage value
3. User cần nhập lại URL một lần duy nhất trong Settings nếu backend được update sau khi đã có data trong localStorage
