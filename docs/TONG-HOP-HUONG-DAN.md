# 📚 TỔNG HỢP HƯỚNG DẪN - ĐỒNG BỘ LỊCH MỔ NGOẠI TK

## 🎯 Mục tiêu

Đồng bộ lịch mổ từ **App Ngoại TK** → **Sheet Lịch Mổ Khoa** → **Sheet DUYỆT BV**

```
┌─────────────────┐
│   App NGOẠI TK  │
└────────┬────────┘
         │ Tự động lưu ca mổ
         ↓
┌──────────────────────────┐
│ Sheet Lịch Mổ Khoa       │  ← Apps Script xử lý
│ - Tab "Lịch mổ"          │
│ - Tab "Tổng hợp"         │
└────────┬─────────────────┘
         │ Đồng bộ (nút hoặc 20h tự động)
         ↓
┌──────────────────────────┐
│ Sheet DUYỆT BV           │  ← Chỉ nhận dữ liệu
│ - Tab "DUYỆT"            │
│ - Cột E: NGOẠI TK        │
└──────────────────────────┘
```

---

## 📋 DANH SÁCH FILE QUAN TRỌNG

### 1. File hướng dẫn sửa lỗi (ĐỌC ĐẦU TIÊN)
[HUONG-DAN-SUA-LOI-SYNC-BV.md](./HUONG-DAN-SUA-LOI-SYNC-BV.md)
- Hướng dẫn 3 bước đơn giản sửa lỗi "Unknown action: SYNC_TO_HOSPITAL"
- **ĐỌC FILE NÀY TRƯỚC** nếu bạn đang gặp lỗi

### 2. Code Apps Script hoàn chỉnh
[Khoa-Surgery-Sheet-FULL-CODE.gs](./Khoa-Surgery-Sheet-FULL-CODE.gs)
- Code đầy đủ để copy vào Apps Script của Sheet Lịch Mổ Khoa
- Bao gồm tất cả tính năng:
  - Nhận ca mổ từ app
  - Đồng bộ lên BV
  - Trigger tự động 20h

### 3. Code Apps Script cho BV (Tham khảo)
[BV-Surgery-Sheet-V2.gs](./BV-Surgery-Sheet-V2.gs)
- **LƯU Ý**: Bạn KHÔNG CẦN dùng file này vì không thể can thiệp vào Sheet BV
- File này chỉ để tham khảo cấu trúc

### 4. Hướng dẫn chi tiết đồng bộ
[HUONG-DAN-DONG-BO-LICH-MO.md](./HUONG-DAN-DONG-BO-LICH-MO.md)
- Hướng dẫn đầy đủ toàn bộ quy trình

---

## ⚡ HƯỚNG DẪN NHANH - 5 BƯỚC

### BƯỚC 1: Sửa lỗi Apps Script (QUAN TRỌNG)

**Đọc file**: [HUONG-DAN-SUA-LOI-SYNC-BV.md](./HUONG-DAN-SUA-LOI-SYNC-BV.md)

Tóm tắt:
1. Mở Sheet Lịch Mổ Khoa → Extensions → Apps Script
2. Tìm hàm `doPost`, thêm case mới:
   ```javascript
   case 'SYNC_TO_HOSPITAL':
     result = syncToHospital();
     break;
   ```
3. Lưu (Ctrl+S) và Deploy lại (Deploy → Manage deployments → Edit → New version)

### BƯỚC 2: Kiểm tra cấu hình

Mở file Apps Script, kiểm tra các biến:

```javascript
const BV_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LXu29mEAUWm8I8zRSWk0ENA6LFzl5905ZNU4lJFQiyk/edit';
const BV_SHEET_TAB_NAME = 'DUYỆT';
const KHOA_COLUMN_INDEX = 5; // Cột E
const KHOA_NAME = 'NGOẠI TK';
const TONGHOP_TAB_NAME = 'Tổng hợp';
```

### BƯỚC 3: Kiểm tra cấu trúc Sheet

**Sheet Lịch Mổ Khoa** cần có 2 tab:
- **Tab "Lịch mổ"**: 13 cột (STT, Họ tên, Ngày mổ, Giờ mổ,...)
- **Tab "Tổng hợp"**: 3 cột (**Ngày | Buổi | Duyệt mổ**)

**Sheet DUYỆT BV** cần có:
- **Tab "DUYỆT"**
- **Cột E**: NGOẠI TK
- **Cột A**: Ngày (merged cells cho 2 dòng)
- **Cột B**: Buổi (sáng/chiều)

### BƯỚC 4: Test kết nối

1. Mở app → Cài đặt
2. Click **"🔄 Đồng bộ lên BV"**
3. Kiểm tra:
   - Có thông báo "Đã đồng bộ X/Y buổi mổ" → **THÀNH CÔNG**
   - Xem Sheet BV cột E đã có dữ liệu chưa

### BƯỚC 5: Kích hoạt trigger tự động 20h (Tùy chọn)

1. Trong Apps Script, chọn hàm **setupDailyTrigger** từ dropdown
2. Click **Run** (▶️)
3. Cấp quyền khi được hỏi
4. Kiểm tra: Click **⏰ Triggers** → Xem trigger đã được tạo

---

## 🔧 CÁC VẤN ĐỀ THƯỜNG GẶP

### ❌ Lỗi: "Unknown action: SYNC_TO_HOSPITAL"

**Nguyên nhân**: Chưa thêm case `SYNC_TO_HOSPITAL` vào hàm `doPost`

**Giải pháp**: Đọc [HUONG-DAN-SUA-LOI-SYNC-BV.md](./HUONG-DAN-SUA-LOI-SYNC-BV.md)

### ❌ Lỗi: "Unauthorized: Invalid secret"

**Nguyên nhân**: SECRET trong Apps Script khác với trong app

**Giải pháp**:
- Kiểm tra `const SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';`
- Phải giống nhau trong cả 2 nơi

### ❌ Không tìm thấy tab "Tổng hợp"

**Nguyên nhân**: Sheet Khoa chưa có tab "Tổng hợp"

**Giải pháp**:
- Tạo tab mới tên "Tổng hợp"
- Cấu trúc 3 cột: Ngày | Buổi | Duyệt mổ
- Nhập dữ liệu mẫu

### ❌ Không đồng bộ được lên BV

**Kiểm tra**:
1. URL Sheet BV có đúng không?
2. Tab "DUYỆT" có tồn tại không?
3. Có quyền chỉnh sửa Sheet BV không?
4. Cột E có phải là "NGOẠI TK" không?

---

## 📞 KIỂM TRA LOG

### Xem log Apps Script

1. Mở Apps Script
2. Click **Executions** (bên trái)
3. Xem chi tiết lỗi

### Xem log browser

1. Mở app
2. Nhấn **F12** (Developer Tools)
3. Vào tab **Console**
4. Xem lỗi (màu đỏ)

---

## 🎉 CHECKLIST HOÀN THÀNH

- [ ] Đã thêm case `SYNC_TO_HOSPITAL` vào Apps Script
- [ ] Đã Save và Deploy phiên bản mới
- [ ] Test đồng bộ từ app thành công
- [ ] Dữ liệu xuất hiện trong Sheet BV cột E
- [ ] (Tùy chọn) Đã setup trigger tự động 20h

---

## 📝 GHI CHÚ

- **Sheet BV**: Chỉ nhận dữ liệu, KHÔNG CẦN Apps Script
- **Sheet Khoa**: Xử lý tất cả logic đồng bộ
- **App**: Gửi request đến Sheet Khoa, Sheet Khoa tự động ghi vào BV
- **Secret**: `so-di-buong-4.0-2025-quang-tri-xyz` (phải giống nhau)

---

**Hoàn tất!** Nếu làm theo đúng 5 bước trên, hệ thống sẽ hoạt động. 🚀
