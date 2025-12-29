# 📋 HƯỚNG DẪN ĐỒNG BỘ LỊCH MỔ

## 🔄 Luồng hoạt động đơn giản

```
┌─────────────────┐
│   App NGOẠI TK  │  ← Nhập thông tin ca mổ
└────────┬────────┘
         │ Tự động lưu
         ↓
┌─────────────────────────┐
│ Sheet Lịch Mổ KHOA      │  ← Link 2
│ (surgerySheetUrl)        │
└────────┬────────────────┘
         │ Đồng bộ thủ công (nút) hoặc tự động (20h)
         ↓
┌─────────────────────────┐
│ Sheet Lịch Mổ BV        │  ← Link 3 (BV-Surgery-Sheet.gs)
│ (hospitalSyncUrl)        │
│ Cột E: NGOẠI TK         │
└─────────────────────────┘
         │ Chỉ lưu thông tin, KHÔNG cần duyệt
         ↓
     ✅ Hoàn tất
```

## 📁 Cấu trúc Sheet Lịch Mổ BV

| Cột | Tên trường | Ví dụ |
|-----|------------|-------|
| A | STT | 1, 2, 3... |
| B | Họ tên | Nguyễn Văn A |
| C | Ngày mổ | 2025-12-30 |
| D | Giờ mổ | 08:00 |
| E | **Khoa** | **NGOẠI TK** |
| F | Chẩn đoán | Sỏi thận phải |
| G | Phương pháp mổ | Nội soi |
| H | Bác sĩ mổ | BS. Nguyễn Văn B |
| I | Phòng mổ | Phòng 1 |
| J | Phương pháp vô cảm | Gây mê nội khí quản |
| K | Phân loại PT | Loại II |
| L | Yêu cầu đặc biệt | Cần thiết bị nội soi |
| M | Ghi chú | Bệnh nhân có tiền sử dị ứng |
| N | Thời gian sync cuối | 30/12/2025 14:30 |

## 🚀 Bước 1: Triển khai mã Apps Script cho Sheet BV

### 1.1. Mở Sheet Lịch Mổ BV
- Truy cập Google Sheet Lịch Mổ BV của bệnh viện

### 1.2. Tạo Apps Script
1. Click **Extensions** → **Apps Script**
2. Xóa code mặc định
3. Copy toàn bộ nội dung từ file `BV-Surgery-Sheet.gs`
4. Dán vào Apps Script Editor
5. Đặt tên project: "BV Surgery Sync Handler"
6. Click **Save** (Ctrl+S / Cmd+S)

### 1.3. Deploy Web App
1. Click **Deploy** → **New deployment**
2. Click biểu tượng **⚙️ Settings** → Chọn **Web app**
3. Cấu hình:
   - **Description**: BV Surgery Sync API
   - **Execute as**: Me (email của bạn)
   - **Who has access**: **Anyone**
4. Click **Deploy**
5. **Copy URL deployment** (dạng: `https://script.google.com/macros/s/AKfycby.../exec`)

### 1.4. Cấu hình trong App
1. Mở app Sổ đi buồng
2. Vào **Cài đặt** (⚙️)
3. Scroll xuống phần **Đồng bộ Sheet**
4. Dán URL deployment vào ô **"URL đồng bộ BV (hospitalSyncUrl)"**
5. Click **💾 Lưu cài đặt**

## 🔧 Bước 2: Cập nhật Sheet Lịch Mổ KHOA

### 2.1. Mở Apps Script của Sheet Lịch Mổ KHOA
- Mở Sheet Lịch Mổ KHOA (Link 2)
- Extensions → Apps Script

### 2.2. Thêm các hàm mới

Thêm các đoạn code sau vào Apps Script hiện tại:

#### A. Thêm biến cấu hình (đầu file, sau SECRET)
```javascript
const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';
const BV_SHEET_URL = 'URL_CUA_BAN_O_BUOC_1.3'; // ✅ Thay bằng URL thực tế
```

#### B. Thêm hàm đồng bộ lên BV (sau các hàm hiện tại)
```javascript
/**
 * Đồng bộ toàn bộ lịch mổ từ sheet này lên sheet BV
 */
function syncToHospital() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Lịch mổ') || ss.getSheets()[0];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, message: 'Không có dữ liệu để đồng bộ' };
    }

    // Đọc toàn bộ dữ liệu (bỏ header)
    const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

    // Lọc các dòng có đủ thông tin (có tên + ngày mổ)
    const validRows = data.filter(row => row[0] && row[1]);

    if (validRows.length === 0) {
      return { success: true, message: 'Không có ca mổ hợp lệ để đồng bộ' };
    }

    // Format dữ liệu để gửi lên BV
    const surgeries = validRows.map(row => ({
      fullName: row[0],
      surgeryDate: formatDateForSync(row[1]),
      surgeryTime: row[2] || '',
      diagnosis: row[3] || '',
      surgeryMethod: row[4] || '',
      surgeonName: row[5] || '',
      operatingRoom: row[6] || '',
      anesthesiaMethod: row[7] || '',
      surgeryClassification: row[8] || '',
      surgeryRequirements: row[9] || '',
      surgeryNotes: row[10] || ''
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
          surgeries: surgeries
        }
      }),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.success) {
      // Cập nhật thời gian sync cho các dòng đã đồng bộ
      const now = new Date().toLocaleString('vi-VN');
      validRows.forEach((row, idx) => {
        sheet.getRange(idx + 2, 13).setValue(now); // Cột M = Last Sync Time
      });

      return {
        success: true,
        message: `Đã đồng bộ ${result.successCount || surgeries.length}/${surgeries.length} ca mổ lên BV`
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
 * Helper: Format date cho sync
 */
function formatDateForSync(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  }
  return String(dateValue);
}
```

#### C. Thêm action TRIGGER_SYNC vào doPost

Tìm đoạn `switch (action) {` trong hàm `doPost`, thêm case mới:

```javascript
switch (action) {
  case 'SYNC_SURGERY':
    // ... code hiện tại
    break;

  case 'SYNC_BATCH':
    // ... code hiện tại
    break;

  case 'TRIGGER_SYNC':  // ✅ THÊM CASE NÀY
    const syncResult = syncToHospital();
    return ContentService.createTextOutput(JSON.stringify(syncResult))
      .setMimeType(ContentService.MimeType.JSON);

  case 'TEST_CONNECTION':
    // ... code hiện tại
    break;
}
```

#### D. Thêm trigger tự động 20h (cuối file)

```javascript
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
  }
}
```

### 2.3. Lưu và Deploy lại
1. Click **Save** (Ctrl+S)
2. Click **Deploy** → **Manage deployments**
3. Click **✏️ Edit** (phiên bản hiện tại)
4. **New version** → **Deploy**

### 2.4. Kích hoạt trigger tự động 20h
1. Trong Apps Script Editor, chọn hàm **setupDailyTrigger** từ dropdown
2. Click **Run** (▶️)
3. Cấp quyền khi được hỏi
4. Kiểm tra: Click **⏰ Triggers** (bên trái) → Xem trigger đã được tạo

## ✅ Kiểm tra hoạt động

### Test 1: Đồng bộ thủ công từ App
1. Mở app Sổ đi buồng
2. Vào **Cài đặt**
3. Click **"🔄 Đồng bộ lên BV"**
4. Kiểm tra Sheet Lịch Mổ BV → Dữ liệu đã xuất hiện

### Test 2: Trigger tự động
1. Đợi đến 20h (hoặc chỉnh trigger về giờ khác để test)
2. Kiểm tra Sheet BV có cập nhật dữ liệu mới không
3. Xem log: Apps Script Editor → **Executions** (bên trái)

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "Unauthorized: Invalid secret"
- Kiểm tra `SECRET` trong cả 2 file Apps Script phải giống nhau
- Giá trị hiện tại: `so-di-buong-4.0-2025-quang-tri-xyz`

### Lỗi: "Khoa không khớp"
- Kiểm tra `KHOA_NAME` trong BV-Surgery-Sheet.gs = `NGOẠI TK`
- Kiểm tra trong hàm `syncToHospital()` có `khoaName: 'NGOẠI TK'`

### Lỗi: Cannot read property 'success'
- Kiểm tra URL deployment có chính xác không
- Thử deploy lại Web App với phiên bản mới

### Không có dữ liệu sync
- Kiểm tra Sheet Khoa có dữ liệu ở các dòng từ 2 trở đi
- Kiểm tra cột B (Họ tên) và C (Ngày mổ) có dữ liệu
- Xem log: Apps Script → **Executions** → Xem chi tiết lỗi

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. **Apps Script Logs**: Execution → Xem chi tiết lỗi
2. **Console logs**: F12 trong browser khi dùng app
3. **Sheet BV**: Cột N (Thời gian sync cuối) có cập nhật không

---

**Hoàn tất!** Hệ thống đồng bộ lịch mổ đã sẵn sàng hoạt động. 🎉
