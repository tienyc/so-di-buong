# 🔧 HƯỚNG DẪN SỬA LỖI "Unknown action: SYNC_TO_HOSPITAL"

## ⚠️ Nguyên nhân lỗi

App đang gửi action `SYNC_TO_HOSPITAL` nhưng Apps Script trong Sheet Lịch Mổ Khoa chưa có code xử lý action này.

## ✅ GIẢI PHÁP - 3 BƯỚC ĐƠN GIẢN

### BƯỚC 1: Mở Apps Script của Sheet Lịch Mổ Khoa

1. Mở Google Sheet **Lịch mổ Ngoại TK** (Sheet có 3 cột: Ngày | Buổi | Duyệt mổ)
2. Click menu **Extensions** → **Apps Script**
3. Bạn sẽ thấy file Code.gs với hàm `doPost`

### BƯỚC 2: Tìm hàm doPost và thêm case mới

Trong file Apps Script, tìm đoạn code có dạng:

```javascript
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, secret, data } = payload;

    // Verify secret
    if (secret !== SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
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
        result = { success: true, message: 'Kết nối thành công' };
        break;

      // ✅ THÊM CASE MỚI NÀY TRƯỚC default:
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
```

**QUAN TRỌNG**: Thêm đoạn này **TRƯỚC** `default:`:

```javascript
case 'SYNC_TO_HOSPITAL':
  result = syncToHospital();
  break;
```

### BƯỚC 3: Lưu và Deploy lại

#### 3.1. Lưu file
- Nhấn **Ctrl+S** (Windows) hoặc **Cmd+S** (Mac)
- Hoặc click biểu tượng 💾 (Save)

#### 3.2. Deploy phiên bản mới
1. Click **Deploy** (góc trên bên phải)
2. Chọn **Manage deployments**
3. Click biểu tượng **✏️** (Edit) bên cạnh deployment hiện tại
4. Ở mục **Version**, chọn **New version**
5. Click **Deploy**
6. Đóng cửa sổ

## 🧪 KIỂM TRA

1. Mở app Sổ đi buồng
2. Vào **Cài đặt** (⚙️)
3. Click nút **"🔄 Đồng bộ lên BV"**
4. Nếu thấy thông báo "Đã đồng bộ X/Y buổi mổ lên BV" → **THÀNH CÔNG!**

## 📝 LƯU Ý

- URL trong `hospitalSyncUrl` phải là URL **deployment của Sheet Lịch Mổ Khoa**, KHÔNG PHẢI Sheet BV
- Sheet BV chỉ được ghi dữ liệu, không cần Apps Script
- Hàm `syncToHospital()` đã được thêm vào Apps Script trước đó

## 🐛 Nếu vẫn lỗi

Kiểm tra lại:
1. ✅ Đã thêm case `SYNC_TO_HOSPITAL` vào switch
2. ✅ Đã Save file (Ctrl+S)
3. ✅ Đã Deploy phiên bản mới (New version)
4. ✅ URL trong app là URL deployment (có dạng `https://script.google.com/macros/s/.../exec`)

---

## 📋 CODE ĐẦY ĐỦ CHO doPost

Nếu bạn muốn, đây là code hoàn chỉnh của hàm `doPost`:

```javascript
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

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

**Hoàn tất!** Sau khi làm theo 3 bước trên, tính năng đồng bộ lên BV sẽ hoạt động. 🎉
