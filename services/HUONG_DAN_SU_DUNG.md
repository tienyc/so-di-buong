# HƯỚNG DẪN SỬ DỤNG ỨNG DỤNG SỔ ĐI BUỒNG

Tài liệu này mô tả các luồng công việc và chức năng chính của ứng dụng quản lý bệnh nhân nội trú (Sổ đi buồng).

## MỤC LỤC
1. [Tổng quan](#1-tổng-quan)
2. [Luồng công việc chính](#2-luồng-công-việc-chính)
3. [Chi tiết chức năng](#3-chi-tiết-chức-năng)
    - [3.1. Thêm bệnh nhân mới](#31-thêm-bệnh-nhân-mới)
    - [3.2. Ra y lệnh hàng ngày](#32-ra-y-lệnh-hàng-ngày)
    - [3.3. Lập kế hoạch và xếp lịch mổ](#33-lập-kế-hoạch-và-xếp-lịch-mổ)
    - [3.4. Cập nhật hậu phẫu](#34-cập-nhật-hậu-phẫu)
    - [3.5. Cho bệnh nhân ra viện](#35-cho-bệnh-nhân-ra-viện)

---

## 1. Tổng quan

Ứng dụng "Sổ đi buồng" được thiết kế để giúp các bác sĩ và điều dưỡng tại khoa Chấn thương chỉnh hình quản lý thông tin bệnh nhân, theo dõi diễn tiến bệnh, ra y lệnh và lên kế hoạch phẫu thuật một cách hiệu quả và có hệ thống.

## 2. Luồng công việc chính

Luồng công việc cơ bản cho mỗi bệnh nhân trong khoa như sau:

`Tiếp nhận` -> `Thêm vào danh sách` -> `Thăm khám & Ra y lệnh` -> `Chỉ định mổ` -> `Xếp lịch mổ` -> `Phẫu thuật` -> `Chăm sóc hậu phẫu` -> `Ra viện`

## 3. Chi tiết chức năng

### 3.1. Thêm bệnh nhân mới

Khi có bệnh nhân mới nhập viện, bạn cần thêm họ vào hệ thống.

1.  Tại màn hình danh sách bệnh nhân, nhấn nút **"Thêm bệnh nhân"**.
2.  Điền các thông tin cơ bản:
    -   **Họ và tên**
    -   **Năm sinh** (hoặc tuổi)
    -   **Giới tính**
    -   **Chẩn đoán khi vào viện**: Đây là trường rất quan trọng, vì hệ thống sẽ dựa vào đây để gợi ý tên phẫu thuật (PPPT).
    -   Các thông tin hành chính khác nếu có.
3.  Nhấn **"Lưu"** để hoàn tất. Bệnh nhân sẽ xuất hiện trong danh sách "Bệnh nhân đang điều trị".

### 3.2. Ra y lệnh hàng ngày

Trong quá trình đi buồng, bác sĩ sẽ ra y lệnh điều trị cho từng bệnh nhân.

1.  Từ danh sách, chọn bệnh nhân cần ra y lệnh.
2.  Trong màn hình chi tiết bệnh nhân, tìm đến mục **"Y lệnh"**.
3.  Nhập nội dung y lệnh vào ô text, ví dụ:
    -   Thuốc men (tên thuốc, liều lượng, đường dùng).
    -   Chế độ chăm sóc (chăm sóc vết mổ, chế độ ăn).
    -   Các chỉ định cận lâm sàng (X-quang, xét nghiệm máu).
4.  Hệ thống sẽ tự động lưu y lệnh kèm theo ngày giờ.

### 3.3. Lập kế hoạch và xếp lịch mổ

Đây là một trong những chức năng cốt lõi của ứng dụng.

1.  **Đánh dấu chỉ định mổ**: Tại màn hình chi tiết bệnh nhân, bật công tắc **"Có kế hoạch mổ"**.
2.  **Sử dụng Gợi ý Xếp lịch**:
    -   Sau khi bật kế hoạch mổ, một nút **"Gợi ý Xếp lịch"** (màu xanh) sẽ xuất hiện.
    -   Nhấn vào nút này, hệ thống sẽ tự động đề xuất lịch mổ tối ưu dựa trên các quy tắc được thiết lập sẵn.

#### Cách hoạt động của "Gợi ý Xếp lịch":

Hệ thống sẽ phân tích các yếu tố sau để đưa ra gợi ý:

-   **Tự động tạo PPPT**: Dựa vào "Chẩn đoán", hệ thống sẽ sinh ra tên Phương pháp phẫu thuật (PPPT) dự kiến.
    -   *Ví dụ: Chẩn đoán "Gãy 1/3 dưới xương đùi T" -> PPPT gợi ý: "PT KHX đùi T".*
-   **Ước tính thời gian mổ**: Mỗi loại phẫu thuật được gán một thời lượng ước tính (ví dụ: thay khớp 60 phút, tháo phương tiện 30 phút).
-   **Phân loại ưu tiên**: Các ca mổ được xếp hạng ưu tiên:
    1.  **Nhiễm trùng**: Luôn ưu tiên cao nhất, xếp vào phòng mổ cách ly (Phòng 1).
    2.  **Thay khớp, Nội soi tái tạo dây chằng**: Ưu tiên cao, xếp vào phòng mổ lớn (Phòng 7, 8).
    3.  **Kết hợp xương (người già/trẻ em)**: Ưu tiên tiếp theo.
    4.  **Kết hợp xương (thường)**.
    5.  **Bóc u, Tháo phương tiện**.
    6.  Các ca mổ nhỏ khác.
-   **Tìm slot trống**:
    -   Hệ thống luôn **ưu tiên xếp vào buổi sáng**.
    -   Nếu buổi sáng đã kín, hệ thống sẽ tìm slot vào buổi chiều.
    -   Trong cùng một buổi, hệ thống sẽ chọn lịch có **thời điểm kết thúc sớm nhất**.
    -   Nếu có nhiều lựa chọn cùng kết thúc, hệ thống sẽ ưu tiên phòng mổ **đang có ít ca hơn** để cân bằng tải.

3.  **Xác nhận lịch mổ**:
    -   Sau khi nhận gợi ý, bạn có thể chấp nhận hoặc chỉnh sửa lại **Phòng mổ**, **Giờ mổ**, **Tên phẫu thuật viên**.
    -   Nhấn **"Lưu"** để xác nhận lịch mổ. Bệnh nhân sẽ được chuyển sang danh sách "Chờ mổ".

### 3.4. Cập nhật hậu phẫu

Sau khi bệnh nhân đã được mổ xong:

1.  Tìm bệnh nhân trong danh sách "Chờ mổ" hoặc "Đã mổ".
2.  Cập nhật lại các thông tin:
    -   **Tình trạng sau mổ**.
    -   **Phương pháp phẫu thuật chính thức**.
    -   Các ghi chú khác.
3.  Bệnh nhân sẽ được quản lý trong danh sách hậu phẫu để tiếp tục theo dõi.

### 3.5. Cho bệnh nhân ra viện

Khi bệnh nhân đã ổn định và đủ điều kiện xuất viện:

1.  Chọn bệnh nhân trong danh sách.
2.  Nhấn vào nút **"Cho ra viện"**.
3.  Xác nhận hành động. Bệnh nhân sẽ được chuyển vào danh sách lưu trữ "Đã ra viện" và không còn hiển thị trong danh sách điều trị hàng ngày.