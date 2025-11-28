<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Z6F_UA23nnxV6N-_65lsh-0t3lV4472D

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## BV Approval Sync

1. Deploy the "Lịch mổ" Apps Script Web App (receives `SYNC_SURGERY`/`SYNC_BATCH`) and paste its URL into **Link Google Sheet Lịch Mổ Khoa** trong phần Cài đặt của ứng dụng.
2. Deploy the Apps Script dùng để chuyển dữ liệu lên sheet DUYỆT BV. Endpoint này cần chấp nhận payload `{ action: "TRIGGER_SYNC", triggerSync: true, secret }`.
3. Paste URL của Web App đồng bộ BV vào **Link Web App Đồng bộ lên BV**. Nút "Đồng bộ lên BV" ở tab Lịch mổ sẽ gọi URL này ngay lập tức.
4. Trong Apps Script thứ hai, tạo thêm Time-driven trigger (Daily → 20:00) cho hàm sync để đảm bảo lịch tự chạy hàng ngày. App chỉ chạy bổ sung khi bạn bấm tay.
