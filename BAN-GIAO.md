# BÀN GIAO — NHÀ PHỐ GÒ VẤP AUTO (phiên bản 0.2.0)

Ứng dụng web nhập tin bán nhà + ảnh, AI biên tập theo mẫu cố định, xem trước,
đăng lên Fanpage Facebook sau khi người dùng xác nhận (đăng ngay hoặc hẹn giờ
1H / 2H / 3H / 4H). Chỉ tin BÁN, không có lựa chọn cho thuê.

## Có gì trong dự án

- `server.js` — máy chủ Node.js + Express: OAuth Facebook, biên tập bằng OpenAI,
  đăng nhiều ảnh lên Fanpage qua Graph API, lịch sử + hẹn giờ (file JSON).
- `public/index.html` — giao diện tiếng Việt, ưu tiên điện thoại: dán nội dung,
  chọn tối đa 15 ảnh (đổi thứ tự, xóa từng ảnh), AI BIÊN TẬP, sửa trực tiếp nội
  dung đã biên tập, ĐĂNG NGAY, 4 nút hẹn giờ 1H/2H/3H/4H, mục Lịch sử
  (Bản nháp / Đang đăng / Đã hẹn giờ / Đã đăng / Thất bại / Đã hủy, link bài,
  nút đăng lại, hủy hẹn).
- `README.md` — hướng dẫn chạy và cấu hình. `.env.example` — danh sách biến
  cần điền, không chứa secret thật.
- `TAI-LIEU-YEU-CAU-GOC.txt` — file yêu cầu gốc của người dùng.

## Chạy thử

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env
# Điền các giá trị trong .env rồi chạy:
npm start
# Mở http://localhost:3000
```

## Cần cấu hình trước khi đăng thật

1. **OpenAI**: tạo API key, điền `OPENAI_API_KEY`. Model mặc định `gpt-5.5`
   (đã kiểm chứng là model thật).
2. **Meta App** (developers.facebook.com): tạo app, thêm Facebook Login (web),
   khai báo đúng `META_REDIRECT_URI`, xin quyền `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`. Điền `META_APP_ID`,
   `META_APP_SECRET` vào `.env`. Triển khai qua HTTPS và cập nhật
   `APP_BASE_URL`, `META_REDIRECT_URI`, `SESSION_SECRET`.
3. Tài khoản Facebook quản trị Fanpage phải là admin/developer/tester của Meta
   App trong giai đoạn phát triển. Muốn người ngoài vai trò thử nghiệm dùng
   được, cần hoàn tất App Review / Advanced Access cho quyền
   `pages_manage_posts` theo chính sách Meta.

## Đã kiểm chứng (ngày 05/11/2026, trên máy local)

- Graph API `v26.0` là bản mới nhất hiện tại; model `gpt-5.5` có thật.
- Server chạy được; trang chủ, `/api/status`, `/api/history` trả đúng.
- `/api/rewrite` thiếu key báo 503 đúng; `/api/publish` chưa chọn Fanpage báo
  401 đúng; lưu bản nháp / sửa / xóa bản nháp đều chạy.
- Bộ hẹn giờ: bài đến giờ được tự đăng; khi token sai thì ghi trạng thái
  "Thất bại" kèm lỗi thật, không treo (đã thêm timeout 60s cho gọi Graph API).

## Chưa kiểm chứng

- Đăng thật lên Fanpage (cần Meta App + Fanpage thật + key OpenAI thật).
- Biên tập bằng OpenAI (cần key thật).
- Đăng nhập OAuth end-to-end (cần Meta App + HTTPS).

## Lưu ý

- Bài hẹn giờ cần Page Access Token để đăng khi người dùng không mở trình
  duyệt, nên token được lưu trong `data/history.json` TRÊN MÁY CHỦ (không gửi
  xuống trình duyệt, thư mục `data/` đã chặn commit trong `.gitignore`).
  Production nên thay bằng secret store bền vững.
- Ảnh của bài thất bại/bản nháp được giữ lại trên máy chủ để đăng lại; chỉ
  xóa sau khi đăng thành công hoặc khi người dùng xóa/hủy.
- Ghi chú: đã thử làm bản APK (WebView + Facebook SDK) trong môi trường này
  nhưng không hoàn thành được — nếu làm tiếp hướng APK thì cần tự đánh giá
  lại cách làm, đừng coi như đã có sẵn.
