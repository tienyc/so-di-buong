# 🔄 HƯỚNG DẪN ĐỒNG BỘ LÊN SHEET BV

## 📋 Quy trình đồng bộ

```
┌──────────────────────────┐
│ Tab "Tổng hợp" (Khoa)    │  ← Nhập thủ công
│ 3 cột: Ngày|Buổi|Duyệt mổ│
└────────┬─────────────────┘
         │ Nút "Đồng bộ BV" trong app
         ↓
┌──────────────────────────┐
│ Sheet DUYỆT (BV)         │
│ Cột E: NGOẠI TK          │
└──────────────────────────┘
```

---

## 🚀 CÁC BƯỚC TRIỂN KHAI

### BƯỚC 1: Deploy Apps Script

1. Mở Google Sheet **"Lịch mổ Ngoại TK"**
2. **Extensions** → **Apps Script**
3. **XÓA TOÀN BỘ** code cũ
4. Mở file [`docs/Khoa-Surgery-Sheet.gs`](./Khoa-Surgery-Sheet.gs)
5. **Copy toàn bộ** code
6. **Paste** vào Apps Script Editor
7. **💾 Save** (Ctrl+S)

### BƯỚC 2: Deploy phiên bản mới

1. **Deploy** → **Manage deployments**
2. Click **✏️ Edit** (deployment hiện tại)
3. Chọn **New version**
4. **Deploy**
5. Copy URL deployment (nếu chưa có trong app settings)

### BƯỚC 3: Kiểm tra cấu hình

Trong Apps Script, kiểm tra các biến:

```javascript
const BV_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LXu29mEAUWm8I8zRSWk0ENA6LFzl5905ZNU4lJFQiyk/edit';
const BV_SHEET_TAB_NAME = 'DUYỆT';
const KHOA_COLUMN_INDEX = 5; // Cột E
const KHOA_NAME = 'NGOẠI TK';
const TONGHOP_TAB_NAME = 'Tổng hợp';
```

**✅ Nếu đúng** → Tiếp tục
**❌ Nếu sai** → Sửa lại cho đúng

---

## ✅ TEST HOẠT ĐỘNG

### Test 1: Test trong Apps Script (Không cần app)

1. Trong Apps Script Editor
2. Chọn hàm **testSyncToHospital** từ dropdown
3. Click **▶️ Run**
4. Xem **Execution log** (View → Logs)
5. Kết quả mong đợi:
   ```json
   {
     "success": true,
     "total": X,
     "successCount": X,
     "message": "Đã đồng bộ X/X buổi mổ lên BV"
   }
   ```

### Test 2: Test từ App

1. Mở app → **Cài đặt**
2. Scroll xuống phần **Đồng bộ Sheet**
3. Click **"🔄 Đồng bộ lên BV"**
4. Kiểm tra thông báo
5. Mở **Sheet DUYỆT BV** → Cột E có dữ liệu chưa?

---

## 📊 CẤU TRÚC DỮ LIỆU

### Tab "Tổng hợp" (Sheet Khoa)

| Cột A | Cột B | Cột C |
|-------|-------|-------|
| Ngày | Buổi | Duyệt mổ |
| 29/12 | sáng | 1. Nguyễn Văn A<br>CD: Sỏi thận<br>DT: Nội soi |
| 29/12 | chiều | 1. Trần Thị B<br>CD: U bàng quang |
| 30/12 | sáng | (trống) |

### Sheet DUYỆT BV

| Cột A | Cột B | Cột C | Cột D | **Cột E** |
|-------|-------|-------|-------|-----------|
| Ngày | Buổi | NGOẠI CT | Khoa khác | **NGOẠI TK** ← Ghi vào đây |
| 29/12 | sáng | ... | ... | 1. Nguyễn Văn A<br>CD: Sỏi thận<br>DT: Nội soi |
| | chiều | ... | ... | 1. Trần Thị B<br>CD: U bàng quang |
| 30/12 | sáng | ... | ... | (trống) |

**Lưu ý**: Cột A (Ngày) được **merge** cho 2 dòng (sáng + chiều)

---

## 🐛 XỬ LÝ LỖI

### ❌ Lỗi: "Không tìm thấy tab 'Tổng hợp'"

**Nguyên nhân**: Chưa tạo tab "Tổng hợp" trong Sheet Khoa

**Giải pháp**:
1. Mở Sheet "Lịch mổ Ngoại TK"
2. Tạo tab mới tên **"Tổng hợp"**
3. Thêm header: **Ngày | Buổi | Duyệt mổ**
4. Nhập dữ liệu mẫu

### ❌ Lỗi: "Exception: You do not have permission to call SpreadsheetApp.openByUrl"

**Nguyên nhân**: Apps Script chưa có quyền truy cập Sheet BV

**Giải pháp**:
1. Chạy hàm **testSyncToHospital** lần đầu
2. Click **Review permissions**
3. Chọn tài khoản Google
4. Click **Advanced** → **Go to ... (unsafe)**
5. Click **Allow**

### ❌ Lỗi: "Không tìm thấy dòng cho 29/12 sáng"

**Nguyên nhân**: Sheet BV chưa có dòng tương ứng

**Giải pháp**:
1. Mở Sheet DUYỆT BV
2. Kiểm tra cột A có ngày **29/12** không
3. Kiểm tra cột B có buổi **sáng** không
4. Nếu thiếu, thêm dòng mới

### ❌ Không đồng bộ được (successCount = 0)

**Kiểm tra**:
- Tab "Tổng hợp" có dữ liệu không?
- Cột A (Ngày), B (Buổi), C (Duyệt mổ) có đầy đủ không?
- Sheet BV có đúng cấu trúc không?

---

## 📞 DEBUG

### Xem log Apps Script

1. Apps Script Editor
2. **View** → **Execution log**
3. Hoặc **Executions** (sidebar) → Click vào execution gần nhất

### Xem log browser (khi test từ app)

1. Nhấn **F12** trong browser
2. Tab **Console**
3. Tìm lỗi màu đỏ

---

## 🎯 CHECKLIST HOÀN THÀNH

- [ ] Đã deploy Apps Script với code mới
- [ ] Đã test hàm testSyncToHospital() thành công
- [ ] Đã cấp quyền truy cập Sheet BV
- [ ] Đã test từ app thành công
- [ ] Dữ liệu xuất hiện trong Sheet BV cột E

---

**Hoàn tất!** Hệ thống đồng bộ BV đã sẵn sàng. 🎉
