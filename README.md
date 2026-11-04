# NHÀ PHỐ GÒ VẤP AUTO

Ứng dụng web mobile-first: nhập tin bán nhà + nhiều ảnh → AI biên tập theo mẫu đã thống nhất → người dùng xem trước → bấm xác nhận đăng lên Facebook Page.

## Tính năng (phiên bản 0.2.0)

- Nhập nội dung + tối đa 15 ảnh (10 MB/ảnh), đổi thứ tự và xóa từng ảnh trước khi đăng.
- AI biên tập theo mẫu đã thống nhất; xem trước và **sửa trực tiếp** nội dung đã biên tập trước khi đăng.
- **ĐĂNG NGAY** lên Fanpage sau hộp xác nhận, hoặc **hẹn giờ 1H / 2H / 3H / 4H** (bài hẹn giờ lưu lại, máy chủ tự đăng khi đến giờ, không đăng ngay).
- **Lưu bản nháp** không cần chọn Fanpage; đăng/hẹn giờ sau từ trang Lịch sử.
- **Lịch sử bài đăng** (lưu file `data/history.json` trên máy chủ): thời gian, tóm tắt, Fanpage, trạng thái (Bản nháp / Đang đăng / Đã hẹn giờ / Đã đăng / Thất bại / Đã hủy), link bài đăng; nút đăng lại khi thất bại, hủy hẹn, xóa.
- Ảnh của bài thất bại/bản nháp được giữ lại trên máy chủ để đăng lại; chỉ xóa sau khi đăng thành công hoặc khi người dùng xóa/hủy.

## Trạng thái hiện tại

Đây là **bộ mã nguồn khởi tạo (MVP)**, chưa phải ứng dụng đã triển khai công khai và chưa kết nối Fanpage thật. Cần cấu hình API key, Meta Developer App, OAuth redirect URL và máy chủ HTTPS trước khi đăng thật.

## Chạy thử trên máy tính

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env
```

Điền các giá trị trong `.env`, sau đó:

```bash
npm start
```

Mở `http://localhost:3000`.

## Cấu hình OpenAI

1. Tạo API key trong OpenAI Platform.
2. Đặt `OPENAI_API_KEY` trong `.env`.
3. Đặt `OPENAI_MODEL` thành model văn bản mà dự án API của bạn được cấp quyền.

API key chỉ nằm ở máy chủ, không đưa vào trình duyệt.

## Cấu hình Meta / Facebook Login

1. Truy cập https://developers.facebook.com/ và tạo Meta App.
2. Thêm sản phẩm Facebook Login (web) và cấu hình domain/redirect URI.
3. Khai báo chính xác `META_REDIRECT_URI` trong `.env` và mục Valid OAuth Redirect URIs của Meta.
4. Cấp các quyền cần thiết: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
5. Trong giai đoạn phát triển, tài khoản Facebook quản trị Fanpage phải là admin/developer/tester của Meta App. Muốn người dùng ngoài vai trò thử nghiệm sử dụng, cần hoàn tất yêu cầu App Review/Advanced Access theo chính sách Meta.
6. Triển khai qua HTTPS, cập nhật `APP_BASE_URL`, `META_REDIRECT_URI`, `SESSION_SECRET` và cấu hình cookie secure.

Ứng dụng dùng OAuth để lấy Page access token và lưu trong session phía máy chủ. Không yêu cầu người dùng gửi mật khẩu Facebook cho người phát triển.

## Luồng đăng ảnh

- Ảnh được tải lên Facebook ở trạng thái chưa xuất bản.
- Sau đó ứng dụng tạo một bài feed đính kèm các ảnh đã tải lên.
- Người dùng phải nhấn xác nhận trước khi endpoint publish được gọi.

## Lưu ý bảo mật / triển khai

- Không dùng session MemoryStore mặc định cho môi trường production; thay bằng Redis hoặc session store bền vững.
- Dùng HTTPS, secret ngẫu nhiên mạnh, giới hạn truy cập, CSRF protection và logging không chứa token.
- Xây dựng cơ chế gia hạn/thu hồi token và xử lý lỗi OAuth.
- Lịch sử bài đăng lưu trong `data/history.json` trên máy chủ; bài hẹn giờ cần Page Access Token nên token được lưu trong file này (không gửi xuống trình duyệt, thư mục `data/` đã chặn commit). Production nên thay bằng secret store bền vững và đặt lịch dọn file ảnh cũ.
- Bản MVP chưa có phân quyền nhiều người dùng hoặc lịch đăng theo ngày giờ tự chọn (chỉ hẹn 1–4 tiếng).
- Tệp ảnh tạm được xóa sau khi hoàn tất yêu cầu publish.
- Giới hạn 15 ảnh và 10 MB/ảnh ở cấu hình hiện tại; kiểm tra giới hạn mới nhất của Meta trước khi đưa vào vận hành.

## Các biến môi trường

Xem `.env.example`.
