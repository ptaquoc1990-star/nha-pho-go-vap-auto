# NHÀ PHỐ GÒ VẤP AUTO

Ứng dụng web mobile-first: dán nội dung cuối + nhiều ảnh → **ĐĂNG NGAY** lên Fanpage hoặc **hẹn giờ 1H / 2H / 3H / 4H** → chọn đợt nhóm trong 200 nhóm ưu tiên để đăng riêng từng bài vào từng nhóm. Chỉ tin BÁN nhà.

## Tính năng (phiên bản 0.3.0)

- **Bước 1 — Nội dung**: dán nội dung cuối cùng sẽ đăng (nội dung dán vào là nội dung đăng nguyên văn, sửa trực tiếp trong ô). Không còn bước AI biên tập.
- **Bước 2 — Ảnh**: tối đa 15 ảnh (10 MB/ảnh), đổi thứ tự và xóa từng ảnh trước khi đăng.
- **Nhóm ưu tiên**: 200 nhóm xếp theo số thành viên giảm dần (`data/priority-groups.json`). 10 nút đợt 20/40/60/80/100/120/140/160/180/200 (nút 20 = hạng 1–20, nút 40 = hạng 21–40, ...), chọn nhiều đợt được, mỗi đợt hiện tiến độ + "Đã xong" khi đủ 20/20. Có nút Chọn tất cả / Bỏ chọn hết.
- **ĐĂNG NGAY** lên Fanpage sau hộp xác nhận, hoặc **hẹn giờ 1H / 2H / 3H / 4H** (bài hẹn giờ lưu lại, máy chủ tự đăng khi đến giờ, không đăng ngay). Bài tự động duyệt — không có bước xem xét/duyệt, sau khi đăng chỉ báo kết quả kèm link.
- **Danh sách nhóm đã chọn vẫn chọn/đổi được SAU KHI hẹn giờ** (cho tới lúc tới giờ đăng); danh sách nhóm chỉ được đọc lúc bài thực sự đăng. Nội dung, ảnh và nút đăng thì khóa sau khi hẹn.
- **Lưu bản nháp** không cần chọn Fanpage; đăng/hẹn giờ sau từ trang Lịch sử.
- **Lịch sử bài đăng** (lưu file `data/history.json` trên máy chủ): thời gian, tóm tắt, Fanpage, trạng thái (Bản nháp / Đang đăng / Đã hẹn giờ / Đã đăng / Thất bại / Đã hủy), link bài đăng, tiến độ đăng nhóm; nút đăng lại khi thất bại, hủy hẹn, xóa.
- Ảnh của bài thất bại/bản nháp được giữ lại trên máy chủ để đăng lại; chỉ xóa sau khi đăng thành công hoặc khi người dùng xóa/hủy.

## Lưu ý quan trọng: đăng nhóm KHÔNG tự động qua API

Facebook đã khóa đăng bài vào nhóm qua Graph API, nên **máy chủ không tự đăng vào nhóm được**. Máy chủ chỉ lưu danh sách nhóm đã chọn và ghi nhận tiến độ đã đăng. Việc đăng vào nhóm do trợ lý/người vận hành làm tay qua trình duyệt, theo quy tắc trong `HUONG-DAN-SU-DUNG.md` (đăng riêng từng bài vào từng nhóm, thăm dò 1 nhóm trước, đợi 15 phút sau khi bài lên Fanpage, kiểm tra link bài còn sống trước khi đăng nhóm).

## Trạng thái hiện tại

Đây là **bộ mã nguồn đã cập nhật theo bản artifact đang dùng**, chưa phải ứng dụng đã triển khai công khai và chưa đăng thử lên Fanpage thật. Cần cấu hình Meta Developer App, OAuth redirect URL và máy chủ HTTPS trước khi đăng thật. Xem chi tiết trong `HUONG-DAN-SU-DUNG.md` và `BAN-GIAO.md`.

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

## Cấu hình OpenAI (không bắt buộc)

Endpoint `/api/rewrite` vẫn còn trong code để dùng khi cần, nhưng **giao diện không còn dùng bước AI biên tập nữa** nên `OPENAI_API_KEY` **không bắt buộc**. Nếu muốn dùng, tạo API key trong OpenAI Platform và đặt `OPENAI_API_KEY` trong `.env` (model mặc định `gpt-5.5`). API key chỉ nằm ở máy chủ, không đưa vào trình duyệt.

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

## API chính

- `GET /api/status` — trạng thái kết nối Facebook / cấu hình.
- `GET /api/groups` — danh sách 200 nhóm ưu tiên.
- `POST /api/drafts` — lưu bản nháp (multipart: `message`, `photos`, `groupIds` JSON).
- `POST /api/publish` — đăng ngay (multipart, như trên).
- `POST /api/schedule` — hẹn giờ 1–4 tiếng (multipart, `delayHours` 1–4).
- `GET /api/history` — danh sách bài đăng.
- `GET /api/history/:id` — một bài đăng (kèm nhóm đã chọn / đã đăng).
- `POST /api/history/:id/retry` — đăng lại bài thất bại/bản nháp.
- `POST /api/history/:id/schedule` — hẹn giờ cho bản nháp.
- `PATCH /api/history/:id` — sửa nội dung bản nháp/bài thất bại.
- `POST /api/history/:id/share-targets` — lưu danh sách nhóm đã chọn (được đổi cả sau khi hẹn giờ; bài đã đăng/đã hủy thì không).
- `POST /api/history/:id/share-groups` — đánh dấu nhóm đã đăng xong (`{groupIds, shared}`).
- `DELETE /api/history/:id` — xóa bản ghi (bài hẹn giờ → chuyển thành Đã hủy).
- `POST /api/rewrite` — biên tập bằng OpenAI (còn trong code, giao diện không dùng).

## Lưu ý bảo mật / triển khai

- Không dùng session MemoryStore mặc định cho môi trường production; thay bằng Redis hoặc session store bền vững.
- Dùng HTTPS, secret ngẫu nhiên mạnh, giới hạn truy cập, CSRF protection và logging không chứa token.
- Lịch sử bài đăng lưu trong `data/history.json` trên máy chủ; bài hẹn giờ cần Page Access Token nên token được lưu trong file này (không gửi xuống trình duyệt, thư mục `data/` đã chặn commit). Production nên thay bằng secret store bền vững và đặt lịch dọn file ảnh cũ.
- Bản này chưa có phân quyền nhiều người dùng hoặc lịch đăng theo ngày giờ tự chọn (chỉ hẹn 1–4 tiếng).
- Tệp ảnh tạm được xóa sau khi hoàn tất yêu cầu publish.
- Giới hạn 15 ảnh và 10 MB/ảnh ở cấu hình hiện tại; kiểm tra giới hạn mới nhất của Meta trước khi đưa vào vận hành.

## Các biến môi trường

Xem `.env.example`.
