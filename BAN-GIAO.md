# BÀN GIAO — NHÀ PHỐ GÒ VẤP AUTO (phiên bản 0.3.0)

Ứng dụng web nhập tin bán nhà + ảnh, đăng lên Fanpage Facebook sau khi người
dùng xác nhận (đăng ngay hoặc hẹn giờ 1H / 2H / 3H / 4H), chọn đợt nhóm trong
200 nhóm ưu tiên để đăng riêng từng bài vào từng nhóm. Chỉ tin BÁN, không có
lựa chọn cho thuê.

## Có gì trong dự án

- `server.js` — máy chủ Node.js + Express: OAuth Facebook, đăng nhiều ảnh lên
  Fanpage qua Graph API, lịch sử + hẹn giờ (file JSON), API nhóm ưu tiên
  (`/api/groups`, `/api/history/:id/share-targets`,
  `/api/history/:id/share-groups`). Endpoint `/api/rewrite` (OpenAI) vẫn còn
  trong code nhưng giao diện không dùng nữa.
- `public/index.html` — giao diện tiếng Việt, ưu tiên điện thoại: Bước 1 dán
  nội dung cuối (đăng nguyên văn), Bước 2 chọn tối đa 15 ảnh (đổi thứ tự, xóa
  từng ảnh), 10 nút đợt nhóm 20–200, ĐĂNG NGAY, 4 nút hẹn giờ 1H/2H/3H/4H,
  mục Lịch sử (Bản nháp / Đang đăng / Đã hẹn giờ / Đã đăng / Thất bại / Đã hủy,
  link bài, tiến độ đăng nhóm, nút đăng lại, hủy hẹn). Giao diện gọn, không còn
  chữ giải thích.
- `public/icon.webp` — icon hình ngôi nhà sang trọng, dùng làm favicon của app.
- `data/priority-groups.json` — danh sách 200 nhóm ưu tiên (hạng, tên, ID, số
  thành viên, link), xếp theo số thành viên giảm dần.
- `README.md` — hướng dẫn chạy và cấu hình.
- `HUONG-DAN-SU-DUNG.md` — hướng dẫn sử dụng đầy đủ cho người triển khai phía
  bên kia (app là gì, chuẩn bị gì, cài đặt từng bước, tạo Meta App và lấy
  token, cách dùng từng bước, quy tắc vận hành bắt buộc, file 200 nhóm, xử lý
  lỗi thường gặp).
- `.env.example` — danh sách biến cần điền, không chứa secret thật.
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

1. **Meta App** (developers.facebook.com): tạo app, thêm Facebook Login (web),
   khai báo đúng `META_REDIRECT_URI`, xin quyền `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`. Điền `META_APP_ID`,
   `META_APP_SECRET` vào `.env`. Triển khai qua HTTPS và cập nhật
   `APP_BASE_URL`, `META_REDIRECT_URI`, `SESSION_SECRET`.
2. Tài khoản Facebook quản trị Fanpage phải là admin/developer/tester của Meta
   App trong giai đoạn phát triển. Muốn người ngoài vai trò thử nghiệm dùng
   được, cần hoàn tất App Review / Advanced Access cho quyền
   `pages_manage_posts` theo chính sách Meta.
3. **OpenAI**: KHÔNG còn bắt buộc (bước AI biên tập đã bỏ khỏi giao diện).
   Muốn dùng endpoint `/api/rewrite` thì tạo API key, điền `OPENAI_API_KEY`.
   Model mặc định `gpt-5.5` (đã kiểm chứng là model thật).

## Đã đổi so với ZIP cũ (phiên bản 0.2.0, ngày 05/11/2026)

- **Bỏ hẳn bước AI biên tập**: giao diện không còn bước 3, không còn lựa chọn
  "AI biên tập"/"Tôi tự biên tập", không còn nút biên tập. Nội dung dán vào
  CHÍNH LÀ nội dung cuối đăng nguyên văn. Endpoint `/api/rewrite` vẫn còn
  trong code nhưng giao diện không dùng nữa; `OPENAI_API_KEY` không còn bắt buộc.
- **Bỏ bảng/nút "Cho Phép Đăng Bài"**: bản Node trước đây không có bảng này;
  bản này xác nhận rõ trong code và tài liệu: bài tự động duyệt vĩnh viễn,
  không gửi thông báo xem xét/duyệt, sau khi đăng chỉ báo kết quả kèm link.
- **Thêm nhóm ưu tiên 200 nhóm**: file `data/priority-groups.json` mới, API
  `/api/groups`, giao diện 10 nút đợt 20/40/60/80/100/120/140/160/180/200
  (mỗi nút 20 nhóm, chọn nhiều đợt được), mỗi đợt hiện tiến độ + "Đã xong" khi
  đủ 20/20, nút Chọn tất cả / Bỏ chọn hết. Lịch sử bài đăng lưu
  `shareTargetGroupIds` + `sharedGroupIds` và hiện tiến độ đăng nhóm.
- **Nhóm chọn được sau khi hẹn giờ**: API `POST /api/history/:id/share-targets`
  cho phép đổi danh sách nhóm khi bài còn Bản nháp / Thất bại / Đã hẹn giờ
  (kể cả sau khi đã hẹn); bài Đã đăng / Đã hủy thì không đổi được. Nội dung,
  ảnh và nút đăng vẫn khóa sau khi hẹn (PATCH chỉ cho bản nháp/bài thất bại).
- **Thêm API đánh dấu nhóm đã đăng xong**: `POST /api/history/:id/share-groups`
  (`{groupIds, shared}`) để ghi nhận tiến độ đăng nhóm từng đợt.
- **Giao diện gọn**: gỡ toàn bộ phụ đề/chú thích/chữ giải thích; chỉ còn thành
  phần chức năng (ô nhập nội dung, chọn ảnh, ĐĂNG NGAY, 1H–4H, nút đợt nhóm,
  Lịch sử) + nhãn trạng thái ngắn.
- **Icon**: thêm `public/icon.webp` (hình ngôi nhà sang trọng) làm favicon và
  apple-touch-icon của app.
- **Tài liệu mới**: thêm `HUONG-DAN-SU-DUNG.md` (hướng dẫn sử dụng đầy đủ cho
  phía triển khai) và cập nhật `README.md` theo bản 0.3.0.

## Quy tắc đăng nhóm (ghi trong HUONG-DAN-SU-DUNG.md để Muse khác làm theo)

- Đăng nhóm = đăng RIÊNG từng bài vào từng nhóm (đăng lại toàn bộ nội dung +
  ảnh như bài mới), KHÔNG dùng Share. Thăm dò 1 nhóm trước, gặp cảnh báo/chặn
  dừng ngay.
- Sau khi bài đăng thành công lên Fanpage thì **ĐỢI 15 PHÚT** rồi mới bắt đầu
  đăng nhóm.
- Trước khi đăng nhóm phải kiểm tra lại link bài Fanpage còn sống không — không
  còn thì **HỦY đăng nhóm**.
- TẠM THỜI đăng nhóm bằng tài khoản cá nhân Đồng Nữ (user quyết 02:29
  05/11/2026); việc đăng bằng Trang tính sau. Đăng bằng Trang "Nhà Phố Gò Vấp"
  được đánh giá là ít bị hạn chế hơn, nhưng Trang CHƯA tham gia các nhóm —
  muốn đăng bằng Trang thì Trang phải tham gia từng nhóm trước (nhiều nhóm cần
  admin duyệt).
- Đồng Nữ bị hạn chế giữa lúc đăng nhóm thì cho Đồng Nữ tạm nghỉ, chuyển sang
  Thanh Tâm đăng tiếp các nhóm còn lại (không đăng lại nhóm đã đăng xong);
  Thanh Tâm làm trong đúng cửa sổ đã đăng nhập của Thanh Tâm; cả hai cùng bị
  hạn chế thì dừng hẳn và báo user (user dặn 02:33 05/11/2026).
- Hẹn giờ đăng trong app đồng nghĩa phải tạo ngay sự kiện nhắc trong lịch vào
  đúng thời điểm đăng đó, reminder 0 phút; dời giờ đăng thì dời luôn sự kiện
  lịch (user dặn 02:34 05/11/2026).
- Máy chủ không tự đăng vào nhóm được (Facebook khóa đăng nhóm qua Graph API)
  — app chỉ lưu danh sách nhóm đã chọn và ghi nhận tiến độ.

## Đã kiểm chứng (ngày 05/11/2026, trên máy local, Node v24)

- Graph API `v26.0` là bản mới nhất hiện tại; model `gpt-5.5` có thật.
- Server chạy được; `GET /` trả 200 (có link favicon `/icon.webp`),
  `GET /icon.webp` trả 200 (68.664 bytes), `/api/status`, `/api/history`,
  `/api/groups` trả đúng (groups: 200 nhóm, ID không trùng).
- `/api/rewrite` thiếu key báo 503 đúng; `/api/publish` chưa chọn Fanpage báo
  401 đúng.
- Luồng bản nháp: lưu nháp kèm nhóm đã chọn (ID lạ bị lọc bỏ), đổi danh sách
  nhóm sau khi lưu, sửa nội dung (PATCH), hẹn giờ khi chưa chọn Page báo 401
  đúng, xóa nháp, lịch sử rỗng sau khi xóa, đổi nhóm trên bài đã xóa báo 404.
- Bộ hẹn giờ: bài đến giờ được tự đăng; khi token sai thì ghi trạng thái
  "Thất bại" kèm lỗi thật, không treo (timeout 60s cho gọi Graph API).
- Dữ liệu test đã dọn sạch trước khi đóng gói (không còn `data/history.json`).

## Chưa kiểm chứng

- Đăng thật lên Fanpage (cần Meta App + Fanpage thật + đăng nhập OAuth).
- Biên tập bằng OpenAI (cần key thật; giao diện không dùng nữa).
- Đăng nhập OAuth end-to-end (cần Meta App + HTTPS).
- Đăng nhóm thật (do trợ lý làm tay qua trình duyệt, không phải qua API).

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
- File `TAI-LIEU-YEU-CAU-GOC.txt` trong gói ZIP này đã được xóa key API thật
  (dòng `AI_API_KEY`) và thay bằng placeholder — file gốc trong thư mục dự án
  vẫn còn key thật, không chia sẻ file gốc.
