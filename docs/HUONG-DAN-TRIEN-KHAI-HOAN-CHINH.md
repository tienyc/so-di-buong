# 🏥 HƯỚNG DẪN TRIỂN KHAI HOÀN CHỈNH - HỆ THỐNG ĐỒNG BỘ LỊCH MỔ

## 📋 Tổng quan hệ thống

### Cấu trúc 3 tầng:

```
┌─────────────────────────────────┐
│  1. App Sổ Đi Buồng NGOẠI TK   │
│     (React + Firebase)          │
└────────────┬────────────────────┘
             │ Lưu thông tin ca mổ (tự động)
             ↓
┌─────────────────────────────────┐
│  2. Sheet Lịch Mổ Khoa         │ ← SurgerySheetScript.gs (đã có)
│     3 cột: Ngày | Buổi | Duyệt  │
└────────────┬────────────────────┘
             │ Đồng bộ (nút hoặc 20h tự động)
             ↓
┌─────────────────────────────────┐
│  3. Sheet DUYỆT MỔ BV          │ ← BV-Surgery-Sheet-V2.gs (mới)
│     Cột E = NGOẠI TK            │
│     Merged cells (ngày 2 dòng)  │
└─────────────────────────────────┘
```

---

## 🎯 PHẦN 1: TRIỂN KHAI SHEET DUYỆT MỔ BV

### Bước 1.1: Mở Apps Script

1. Mở **Google Sheet DUYỆT MỔ BV**
2. Menu: **Extensions** → **Apps Script**
3. Nếu đã có code cũ, xóa hết

### Bước 1.2: Dán code mới

Copy toàn bộ code từ file **[BV-Surgery-Sheet-V2.gs](BV-Surgery-Sheet-V2.gs)** và dán vào

### Bước 1.3: Kiểm tra và điều chỉnh cấu hình

Tìm các dòng này ở đầu file và **kiểm tra kỹ**:

```javascript
const SHEET_NAME = 'DUYỆT'; // ✅ Tên tab sheet (xem tab dưới cùng)
const KHOA_COLUMN_INDEX = 5; // ✅ Cột NGOẠI TK (A=1, B=2, C=3, D=4, E=5)
```

**Cách kiểm tra cột:**
- Mở sheet DUYỆT, đếm từ trái sang phải
- Tìm cột có tên **NGOẠI TK**
- Đếm: A=1, B=2, C=3, D=4, **E=5**...

### Bước 1.4: Lưu và Deploy

1. Click **💾 Save** (hoặc Ctrl+S / Cmd+S)
2. Đặt tên project: "BV Surgery Sync Handler"
3. Click **Deploy** → **New deployment**
4. Click ⚙️ → Chọn **Web app**
5. Cấu hình:
   - Execute as: **Me** (email của bạn)
   - Who has access: **Anyone**
6. Click **Deploy**
7. Cấp quyền khi được hỏi (Review permissions → Choose account → Allow)
8. **📋 COPY URL** deployment (dạng `https://script.google.com/macros/s/AKfycby.../exec`)
9. **LƯU LẠI URL NÀY** - sẽ dùng ở bước sau

### Bước 1.5: Test kết nối

1. Mở URL vừa copy trong trình duyệt
2. Nếu thấy JSON với `"success": true` → **Thành công!**
3. Nếu lỗi → Kiểm tra lại deployment

---

## 🎯 PHẦN 2: CẬP NHẬT SHEET LỊCH MỔ KHOA

### Bước 2.1: Mở Apps Script của Sheet Khoa

1. Mở **Google Sheet Lịch mổ Ngoại TK** (sheet có 3 cột)
2. Menu: **Extensions** → **Apps Script**
3. **KHÔNG XÓA** code hiện có (file SurgerySheetScript.gs)

### Bước 2.2: Thêm cấu hình BV

Tìm dòng:
```javascript
const SURGERY_SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';
const SURGERY_SHEET_NAME = 'Lịch mổ';
```

**Thêm ngay sau đó:**
```javascript
// ✅ THÊM PHẦN NÀY
const BV_SHEET_URL = 'URL_DEPLOYMENT_O_BUOC_1.4'; // Dán URL từ Bước 1.4

// CẤU TRÚC SHEET KHOA:
const KHOA_SHEET_NAME = 'Lịch mổ'; // Tên sheet (kiểm tra tab)
const KHOA_DATE_COL = 1;   // Cột A: Ngày
const KHOA_SESSION_COL = 2; // Cột B: Buổi
const KHOA_CONTENT_COL = 3; // Cột C: Duyệt mổ
```

### Bước 2.3: Thêm các hàm mới

Scroll **xuống cuối file**, sau hàm `testSync()`, **thêm các hàm sau:**

```javascript
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
        secret: SURGERY_SECRET,
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

/**
 * Test function - Chạy thủ công để kiểm tra
 */
function testSyncToHospital() {
  const result = syncToHospital();
  Logger.log('Test sync result:');
  Logger.log(JSON.stringify(result, null, 2));
}
```

### Bước 2.4: Thêm action TRIGGER_SYNC vào doPost

Tìm đoạn này trong hàm `doPost`:

```javascript
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
```

**Sửa thành:**

```javascript
switch (action) {
  case 'SYNC_SURGERY':
    result = syncSurgery(data);
    break;
  case 'SYNC_BATCH':
    result = syncBatch(data.patients);
    break;
  case 'TRIGGER_SYNC':  // ✅ THÊM CASE NÀY
    result = syncToHospital();
    break;
  default:
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
}
```

### Bước 2.5: Lưu và Deploy lại

1. Click **💾 Save**
2. Click **Deploy** → **Manage deployments**
3. Click ✏️ **Edit** (deployment hiện tại)
4. **New version** → **Deploy**
5. Đóng popup

### Bước 2.6: Thiết lập trigger tự động 20h

1. Trong Apps Script Editor, chọn hàm **`setupDailyTrigger`** từ dropdown (góc trên)
2. Click **▶️ Run**
3. Cấp quyền khi được hỏi (Review permissions → Allow)
4. Kiểm tra: Click **⏰ Triggers** (menu bên trái)
5. Xem có trigger `dailySyncToHospital` chạy lúc 20h không → **Thành công!**

---

## 🎯 PHẦN 3: CẤU HÌNH APP

### Bước 3.1: Mở Settings trong app

1. Chạy app Sổ Đi Buồng
2. Click **⚙️ Cài đặt**

### Bước 3.2: Điền URL

Scroll xuống phần **Đồng bộ Sheet**, điền:

- **URL Sheet chính (sheetUrl)**: URL của Sheet Lịch Mổ Khoa (đã có sẵn)
- **URL Sheet Lịch Mổ Khoa (surgerySheetUrl)**: URL deployment của Sheet Lịch Mổ Khoa (đã có sẵn)
- **URL đồng bộ BV (hospitalSyncUrl)**: **URL từ Bước 1.4** (Sheet DUYỆT BV)

### Bước 3.3: Lưu cài đặt

Click **💾 Lưu cài đặt** → Xem thông báo thành công

---

## ✅ PHẦN 4: TEST HỆ THỐNG

### Test 1: Đồng bộ thủ công

1. Trong app, vào **Cài đặt**
2. Click nút **"🔄 Đồng bộ lên BV"**
3. Đợi 5-10 giây
4. Xem thông báo → Nếu thành công: "Đã đồng bộ X/Y buổi mổ lên BV"
5. **Kiểm tra Sheet DUYỆT BV** → Cột E (NGOẠI TK) có dữ liệu mới

### Test 2: Kiểm tra merged cells

1. Mở Sheet DUYỆT BV
2. Xem cột Ngày (A) → Có merged không?
3. Kiểm tra dữ liệu có đúng dòng (sáng/chiều) không

### Test 3: Apps Script Logs

1. Mở Apps Script của Sheet Khoa
2. Chọn hàm `testSyncToHospital`
3. Click **▶️ Run**
4. Click **Execution log** (dưới cùng) → Xem kết quả
5. Nếu `"success": true` → **Hoàn hảo!**

### Test 4: Trigger tự động

1. Đợi đến 20h (hoặc sửa trigger thành giờ khác để test)
2. Sau 20h, kiểm tra Sheet BV
3. Hoặc xem **Executions** trong Apps Script → Xem log

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi: "Khoa không khớp"
**Nguyên nhân:** Tên khoa trong request không khớp với KHOA_NAME
**Giải pháp:**
- Kiểm tra `const KHOA_NAME = 'NGOẠI TK'` trong BV-Surgery-Sheet-V2.gs
- Kiểm tra `khoaName: 'NGOẠI TK'` trong Khoa-Surgery-Sheet-UPDATE.gs

### Lỗi: "Không tìm thấy sheet"
**Nguyên nhân:** Tên sheet sai
**Giải pháp:**
- Kiểm tra `const SHEET_NAME = 'DUYỆT'` khớp với tên tab

### Lỗi: "Unauthorized"
**Nguyên nhân:** SECRET không khớp
**Giải pháp:**
- Đảm bảo cả 2 file đều dùng: `'so-di-buong-4.0-2025-quang-tri-xyz'`

### Dữ liệu ghi sai cột
**Nguyên nhân:** KHOA_COLUMN_INDEX sai
**Giải pháp:**
- Đếm lại cột: A=1, B=2, C=3, D=4, E=5...
- Sửa `const KHOA_COLUMN_INDEX = 5`

### Không đồng bộ được
**Nguyên nhân:** Dữ liệu Sheet Khoa không hợp lệ
**Giải pháp:**
- Kiểm tra Sheet Khoa có dữ liệu ở cột A, B, C
- Cột C (Duyệt mổ) không được trống

---

## 📞 DEBUG NÂNG CAO

### Xem Execution Logs

1. Mở Apps Script của bất kỳ sheet nào
2. Click **Executions** (menu bên trái, biểu tượng ⚡)
3. Xem chi tiết các lần chạy gần nhất
4. Click vào từng execution → Xem log chi tiết

### Test riêng từng function

**Sheet BV:**
```javascript
// Không có test function riêng, dùng doGet để test kết nối
```

**Sheet Khoa:**
```javascript
// Chạy function testSyncToHospital() để test
```

---

## 🎉 HOÀN TẤT!

Hệ thống đã sẵn sàng hoạt động với đầy đủ 3 tầng:
- ✅ App lưu thông tin ca mổ
- ✅ Sheet Khoa tổng hợp lịch mổ
- ✅ Sheet BV nhận dữ liệu từ các khoa (cột E = NGOẠI TK)
- ✅ Tự động đồng bộ lúc 20h mỗi ngày
- ✅ Hỗ trợ merged cells (ngày gộp 2 dòng sáng/chiều)

**Chúc mừng! 🎊**
