# 🆔 HƯỚNG DẪN TRIỂN KHAI PATIENT ID

## ⚠️ Vấn đề đã giải quyết

**Trước đây**: Khi sửa ngày mổ (30/12 → 31/12), hệ thống tạo 2 dòng cho cùng 1 bệnh nhân.

**Bây giờ**: Dùng Patient ID để xác định duy nhất → Chỉ cập nhật dòng cũ, không tạo mới.

---

## 📋 CÁC BƯỚC TRIỂN KHAI

### BƯỚC 1: Cập nhật Apps Script

1. Mở Google Sheet **"Lịch mổ Ngoại TK"**
2. **Extensions** → **Apps Script**
3. **XÓA TOÀN BỘ** code cũ
4. Mở file [`docs/Khoa-Surgery-Sheet.gs`](./Khoa-Surgery-Sheet.gs)
5. **Copy toàn bộ** code mới
6. **Paste** vào Apps Script Editor
7. Click **💾 Save** (Ctrl+S)

### BƯỚC 2: Deploy phiên bản mới

1. Click **Deploy** → **Manage deployments**
2. Click **✏️ Edit** (deployment hiện tại)
3. Chọn **New version**
4. Click **Deploy**
5. Đóng cửa sổ

### BƯỚC 3: Thêm header cột N (nếu chưa có)

1. Mở tab **"Lịch mổ"** trong Google Sheet
2. Kiểm tra cột N (hàng 1)
3. Nếu chưa có header, ghi: **"Patient ID"**

---

## ✅ Kiểm tra hoạt động

### Test 1: Thêm mới bệnh nhân
1. Mở app → Thêm bệnh nhân mới
2. Lên lịch mổ: **9h ngày 30/12**
3. Kiểm tra Sheet → Xuất hiện 1 dòng mới

### Test 2: Sửa giờ mổ (cùng ngày)
1. Sửa giờ mổ: **9h → 11h** (cùng ngày 30/12)
2. Kiểm tra Sheet → Dòng cũ được **cập nhật**, không tạo dòng mới

### Test 3: Sửa ngày mổ (khác ngày)
1. Sửa ngày mổ: **30/12 11h → 31/12 8h**
2. Kiểm tra Sheet → Dòng cũ được **cập nhật**, không tạo dòng mới
3. Kiểm tra cột N → Patient ID giữ nguyên

**✅ THÀNH CÔNG** nếu cả 3 test chỉ tạo **1 dòng** duy nhất.

---

## 🔧 Cấu trúc Sheet mới (A-N)

| Cột | Tên trường | Ví dụ |
|-----|------------|-------|
| A | Ngày PT | 30/12/2025 |
| B | TênBN | Lê Thị Cúc |
| C | Chẩn đoán | Sỏi thận phải |
| D | PPPT | Nội soi laser |
| E | Phân loại | Phẫu thuật lớn |
| F | PTV | BS. Nguyễn Văn A |
| G | Ghi chú | Săng trung |
| H | Giờ mổ | 8h30 |
| I | Phòng mổ | Phòng 1 |
| J | Vô cảm | Mê NKQ |
| K | Săng + Yêu cầu | Săng trung |
| L | Sáng/Chiều | Sáng |
| M | Thời gian chuẩn | 08:30 |
| **N** | **Patient ID** | **abc123xyz** ← MỚI |

---

## 📝 Lưu ý

- **Không cần xóa dữ liệu cũ**: Các dòng cũ không có Patient ID vẫn hoạt động bình thường
- **Chỉ record mới** (từ bây giờ) sẽ có Patient ID
- **Record cũ** sẽ tiếp tục dùng logic tìm theo tên + ngày

---

## 🐛 Xử lý lỗi

### Vẫn tạo 2 dòng khi sửa ngày mổ

**Nguyên nhân**: Chưa deploy phiên bản mới

**Giải pháp**:
1. Kiểm tra lại BƯỚC 2 (Deploy → New version)
2. Refresh app và thử lại

### Cột N không có dữ liệu

**Nguyên nhân**: App chưa gửi patient.id

**Giải pháp**:
- Patient trong app đã có field `id` (tự động tạo khi thêm mới)
- Nếu vẫn thiếu, kiểm tra code client (services/surgerySync.ts)

---

**Hoàn tất!** Hệ thống giờ đã tránh được trùng lặp khi sửa lịch mổ. 🎉
