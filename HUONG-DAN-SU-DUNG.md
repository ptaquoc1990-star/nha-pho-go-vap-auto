# HƯỚNG DẪN SỬ DỤNG — NHÀ PHỐ GÒ VẤP AUTO (phiên bản 0.3.0)

Tài liệu này dành cho Muse AI / người triển khai ở phía bên kia: đọc xong là biết
app này là gì, cần chuẩn bị những gì, cài đặt và chạy ra sao, dùng từng bước như
thế nào, và những quy tắc vận hành bắt buộc phải tuân theo. Đọc hết trước khi
chạy app lần đầu.

---

## 1. App này là gì, dùng để làm gì

**Nhà Phố Gò Vấp Auto** là ứng dụng web (Node.js + Express) để đăng **tin BÁN nhà**
lên **Fanpage Facebook "Nhà Phố Gò Vấp"**, rồi **chia sẻ bài đó ra các nhóm
Facebook ưu tiên** (200 nhóm bán nhà, xếp theo số thành viên giảm dần).

- Chỉ phục vụ **TIN BÁN NHÀ**. Không có lựa chọn cho thuê, không có loại tin khác.
- Luồng dùng: dán nội dung cuối → tải ảnh → **ĐĂNG NGAY** hoặc **hẹn giờ 1H / 2H /
  3H / 4H** → chọn đợt nhóm 20–200 → xem Lịch sử.
- Nội dung dán vào **CHÍNH LÀ nội dung cuối đăng nguyên văn** — người dùng tự
  biên tập rồi dán vào, app không biên tập lại bằng AI nữa.
- Bài đăng **tự động duyệt** — không có bước xem xét/duyệt trong app; sau khi đăng
  chỉ báo kết quả kèm link bài đăng.
- **Đăng lên Fanpage thì app làm được qua Meta Graph API chính thức.** Đăng vào
  nhóm thì app **không tự làm được** (Facebook đã khóa đăng nhóm qua API) — việc
  đăng nhóm do trợ lý/người vận hành làm tay qua trình duyệt, app chỉ lưu danh
  sách nhóm đã chọn và ghi nhận tiến độ đã đăng xong. Xem mục 6.

---

## 2. Cần chuẩn bị gì

| Thứ cần có | Ghi chú |
|---|---|
| Máy chủ / máy tính chạy app | Node.js **≥ 20**, npm. App chạy mặc định ở cổng 3000. |
| Meta App | Tạo tại https://developers.facebook.com (xem mục 4). Cần **App ID** và **App Secret**. |
| Quyền trên Meta App | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Có thể cần **App Review / Advanced Access** cho quyền `pages_manage_posts` nếu người dùng không phải admin/developer/tester của app. |
| Token truy cập Trang | Page Access Token **dài hạn** của Fanpage "Nhà Phố Gò Vấp". App lấy token này qua OAuth khi người dùng kết nối Facebook trong giao diện; token của bài hẹn giờ được lưu trong `data/history.json` trên máy chủ để đăng khi người dùng không mở trình duyệt. |
| Tài khoản Facebook quản trị Fanpage | Phải là admin/developer/tester của Meta App trong giai đoạn phát triển. |
| HTTPS | **Bắt buộc khi triển khai công khai** để OAuth redirect hoạt động (xem mục 3). Chạy thử trên máy local thì dùng `http://localhost:3000` được. |
| OpenAI API key | **KHÔNG còn bắt buộc.** Bước AI biên tập đã bỏ khỏi giao diện; endpoint `/api/rewrite` vẫn còn trong code để dùng khi cần nhưng app chạy bình thường khi không có key. Nếu muốn dùng: tạo key tại OpenAI Platform, model mặc định `gpt-5.5`. |

**Không bao giờ** đưa App Secret, Page Access Token hay OpenAI key thật vào code,
vào chat hay vào file ZIP. Các giá trị này chỉ nằm trong file `.env` trên máy chủ
(file này không được commit — xem `.gitignore`).

---

## 3. Các bước cài đặt và chạy

### 3.1. Chạy thử trên máy tính (local)

```bash
# 1. Giải nén file ZIP vào một thư mục, mở terminal trong thư mục đó
# 2. Cài đặt thư viện
npm install

# 3. Tạo file cấu hình từ mẫu
cp .env.example .env

# 4. Mở file .env bằng trình soạn thảo và điền các biến (xem bảng dưới)

# 5. Chạy server
npm start

# 6. Mở trình duyệt: http://localhost:3000
```

### 3.2. Các biến môi trường trong `.env` (điền đủ từng biến)

| Biến | Bắt buộc | Điền gì |
|---|---|---|
| `OPENAI_API_KEY` | Không | Key OpenAI, chỉ khi muốn dùng endpoint `/api/rewrite`. Không có key app vẫn chạy. |
| `OPENAI_MODEL` | Không | Mặc định `gpt-5.5`. |
| `META_APP_ID` | **Có** | App ID của Meta App (xem mục 4). |
| `META_APP_SECRET` | **Có** | App Secret của Meta App. Giữ kín, không chia sẻ. |
| `META_GRAPH_VERSION` | Không | Mặc định `v26.0` (bản Graph API mới nhất đã kiểm chứng). |
| `META_REDIRECT_URI` | **Có** | URL callback OAuth, **phải khớp chính xác** với Valid OAuth Redirect URI đã khai trong Meta App. Local: `http://localhost:3000/auth/facebook/callback`. Triển khai công khai: `https://<domain-của-bạn>/auth/facebook/callback`. |
| `SESSION_SECRET` | **Có** | Chuỗi ngẫu nhiên dài, dùng ký session. Production phải đổi thành chuỗi mạnh riêng. |
| `PORT` | Không | Mặc định `3000`. |
| `APP_BASE_URL` | Không | URL gốc của app, ví dụ `http://localhost:3000` hoặc `https://<domain-của-bạn>`. |

### 3.3. Triển khai lên server HTTPS

1. Cần **HTTPS** để OAuth redirect hoạt động: triển khai app lên máy chủ có
   chứng chỉ SSL (VPS + Nginx/Caddy, hoặc PaaS như Railway/Render/Fly.io...).
2. Đặt `APP_BASE_URL` thành `https://<domain-của-bạn>`.
3. Đặt `META_REDIRECT_URI` thành `https://<domain-của-bạn>/auth/facebook/callback`
   và khai **chính xác URL này** trong Meta App (Valid OAuth Redirect URIs).
   Sai một ký tự (kể cả dấu `/` cuối) OAuth sẽ lỗi.
4. Đặt `SESSION_SECRET` thành chuỗi ngẫu nhiên mạnh, khác hoàn toàn chuỗi mặc
   định trong code.
5. Đặt `NODE_ENV=production` để cookie session bật `secure`.
6. Không dùng session MemoryStore mặc định cho production; thay bằng Redis
   hoặc session store bền vững. Đặt lịch dọn file ảnh cũ trong `uploads/`.
7. Chạy app bằng process manager (systemd / PM2) để app tự chạy lại khi server
   khởi động lại. Bài hẹn giờ được kiểm tra mỗi 30 giây bằng `setInterval`
   trong tiến trình Node, nên **tiến trình phải chạy liên tục** thì bài hẹn giờ
   mới đăng đúng giờ.

---

## 4. Cách tạo Meta App và lấy token

1. Vào https://developers.facebook.com → **My Apps** → **Create App** → chọn
   loại app (ví dụ "Other" / "Business") → đặt tên app → tạo.
2. Trong app vừa tạo: **App settings → Basic** — lấy **App ID** và **App Secret**,
   điền vào `.env` (`META_APP_ID`, `META_APP_SECRET`).
3. Thêm sản phẩm **Facebook Login**: **Add Product** → Facebook Login → chọn
   **Web** → nhập **Site URL** là domain của app (local: `http://localhost:3000`).
4. Trong **Facebook Login → Settings**: mục **Valid OAuth Redirect URIs** — thêm
   chính xác URL callback, khớp với `META_REDIRECT_URI` trong `.env`:
   - Local: `http://localhost:3000/auth/facebook/callback`
   - Triển khai: `https://<domain-của-bạn>/auth/facebook/callback`
5. Cấp quyền: trong **App Review → Permissions and Features**, xin 3 quyền:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Trong giai
   đoạn phát triển, tài khoản quản trị Fanpage phải là admin/developer/tester của
   Meta App. Muốn người ngoài vai trò thử nghiệm dùng được, cần hoàn tất **App
   Review / Advanced Access** cho `pages_manage_posts` theo chính sách Meta.
6. **Lấy token Trang dài hạn**: mở app → bấm **Kết nối Facebook** → đăng nhập
   tài khoản quản trị Fanpage → chọn Fanpage "Nhà Phố Gò Vấp" → **Xác nhận
   Fanpage**. App dùng OAuth để lấy Page Access Token và lưu trong session phía
   máy chủ (không yêu cầu mật khẩu Facebook). Token của bài hẹn giờ được lưu
   trong `data/history.json` trên máy chủ (không gửi xuống trình duyệt) để đăng
   khi người dùng không mở trình duyệt. Production nên thay bằng secret store
   bền vững và xây cơ chế gia hạn/thu hồi token.

---

## 5. Cách sử dụng app từng bước

Mở `http://localhost:3000` (hoặc domain đã triển khai).

### Bước 1 — Kết nối Facebook (làm 1 lần)
- Bấm **Kết nối Facebook** → đăng nhập → chọn Fanpage **Nhà Phố Gò Vấp** →
  bấm **Xác nhận Fanpage**. Trạng thái hiển thị "Đã chọn Fanpage: Nhà Phố Gò Vấp".

### Bước 2 — Dán nội dung (Bước 1 trong app)
- Dán **nội dung cuối cùng sẽ đăng** vào ô nội dung. Nội dung này đăng nguyên
  văn — app không biên tập lại. Sửa trực tiếp trong ô nếu cần.
- Bấm **Sao chép nội dung** để copy, **Lưu bản nháp** để lưu lại đăng sau
  (không cần chọn Fanpage).

### Bước 3 — Tải ảnh (Bước 2 trong app)
- Chọn tối đa **15 ảnh**, mỗi ảnh tối đa **10 MB** (JPEG/PNG/WebP).
- Bấm **↑ ↓** để đổi thứ tự ảnh, **✕** để xóa ảnh. Ảnh đầu tiên là ảnh đại diện.

### Bước 4 — Chọn đợt nhóm (mục Nhóm ưu tiên)
- 10 nút đợt: **20 / 40 / 60 / 80 / 100 / 120 / 140 / 160 / 180 / 200**.
  Nút 20 = nhóm hạng 1–20, nút 40 = hạng 21–40, cứ thế đến nút 200 = hạng 181–200.
- Bấm một nút để chọn/bỏ chọn cả đợt 20 nhóm. Chọn nhiều đợt được.
- Mỗi nút hiện tiến độ (ví dụ `12/20`) và hiện **"Đã xong"** khi đủ 20/20.
- Nút **Chọn tất cả** / **Bỏ chọn hết** để chọn hoặc bỏ hết 200 nhóm.
- **Danh sách nhóm đã chọn vẫn chọn/đổi được SAU KHI hẹn giờ** (cho tới lúc tới
  giờ đăng). Danh sách nhóm chỉ được đọc lúc bài thực sự đăng nên lựa chọn mới
  nhất luôn có hiệu lực. Nội dung, ảnh và nút đăng thì khóa sau khi hẹn.

### Bước 5 — Đăng bài
- **ĐĂNG NGAY**: đăng ngay lên Fanpage đã chọn (có hộp xác nhận). Đăng xong báo
  kết quả kèm link bài đăng.
- **Hẹn giờ 1H / 2H / 3H / 4H**: hẹn đăng sau 1, 2, 3 hoặc 4 tiếng. Bài hẹn giờ
  **không đăng ngay**; tới giờ máy chủ tự đăng. Bài tự động duyệt, không có
  thông báo xem xét.
- Sau khi đăng, bài vào **Lịch sử**.

### Bước 6 — Xem Lịch sử
- Mỗi bài hiện: tóm tắt, trạng thái (Bản nháp / Đang đăng / Đã hẹn giờ / Đã đăng /
  Thất bại / Đã hủy), Fanpage, giờ hẹn (nếu có), link **Xem bài**, tiến độ đăng
  nhóm (đã đăng X/Y nhóm).
- **Hủy hẹn giờ**: bài đang "Đã hẹn giờ" → bấm **Hủy hẹn**. Bài chuyển thành
  "Đã hủy" (giữ lại bản ghi để đối chiếu).
- **Đăng lại bài lỗi**: bài "Thất bại" → bấm **Đăng lại**. Bài "Bản nháp" → bấm
  **Đăng ngay** hoặc hẹn giờ 1H–4H.
- **Sửa bài**: bài "Bản nháp" hoặc "Thất bại" → bấm **Sửa** để sửa nội dung
  (và đổi nhóm đã chọn), rồi đăng lại. Bài đã hẹn giờ hoặc đã đăng thì **không
  sửa được nội dung**.
- **Xóa**: bấm **Xóa** để xóa bản ghi (bài hẹn giờ → chuyển thành Đã hủy thay vì
  xóa hẳn).

---

## 6. Quy tắc vận hành Muse bên kia PHẢI tuân theo

Đây là quy tắc bắt buộc khi vận hành app này, đã chốt với người dùng. Muse AI
bên kia phải làm đúng như sau:

### 6.1. Đăng nhóm = đăng RIÊNG từng bài vào từng nhóm
- Mỗi nhóm đăng **một bài riêng**: đăng lại **toàn bộ nội dung + ảnh như bài mới**
  trong nhóm đó. **KHÔNG dùng nút Share / Chia sẻ** bài Fanpage vào nhóm.
- **Thăm dò 1 nhóm trước**: đăng thử 1 nhóm đầu tiên, xem có cảnh báo/chặn
  không. Nếu sạch thì mới đăng tiếp các nhóm còn lại, từng nhóm một.
- **Gặp cảnh báo/chặn thì DỪNG NGAY**, không cố đăng tiếp, và báo lại cho người
  dùng. An toàn tài khoản là ưu tiên tối đa.

### 6.2. Đợi 15 phút sau khi bài lên Fanpage mới đăng nhóm
- Sau khi bài đăng **thành công lên Fanpage**, **ĐỢI 15 PHÚT** rồi mới bắt đầu
  đăng nhóm. Không đăng nhóm ngay sau khi đăng Fanpage.

### 6.3. Kiểm tra bài Fanpage còn sống trước khi đăng nhóm
- Trước khi bắt đầu đăng nhóm, **kiểm tra lại link bài Fanpage còn sống không**.
- Nếu bài trên Fanpage **đã bị xóa** (người dùng xóa hoặc không còn truy cập
  được) thì **HỦY đăng nhóm** — không đăng nhóm nữa, và báo cho người dùng.
- Nếu người dùng xóa bài Fanpage thì nhắn trợ lý để hủy đăng nhóm ngay (không
  báo thì bài nhóm vẫn đăng theo lịch, vì bài nhóm là bài riêng, không tự mất
  theo bài Fanpage).

### 6.4. Bài tự động duyệt, không gửi thông báo xem xét
- Bài đăng ngay và bài hẹn giờ đều **tự động duyệt**, app **không gửi thông báo
  xem xét/duyệt** nào. Sau khi đăng chỉ báo kết quả kèm link bài đăng.

### 6.5. Hẹn giờ tối đa 4 tiếng
- App chỉ hẹn đăng sau **1, 2, 3 hoặc 4 tiếng** kể từ lúc hẹn. Không hẹn được
  giờ cụ thể trực tiếp. Muốn đăng vào một giờ cụ thể (ví dụ 9 giờ sáng) thì
  hẹn lại vào thời điểm sao cho cộng đủ số tiếng ra giờ đó (ví dụ hẹn lúc
  5 giờ sáng với 4H thì đăng lúc 9 giờ).

### 6.6. Bảng "Cần xem xét" — phân biệt hai loại
- **Trong Muse (trợ lý đăng qua trình duyệt)**: mỗi lần đăng Facebook qua trình
  duyệt đều hiện bảng **"Cần xem xét"** của hệ thống (tải file + đăng bài) và
  **người dùng phải bấm "Cho phép" mỗi lần** — không tự động cho phép được.
  Nếu người dùng bận/không bấm thì bài không đăng được, cứ chờ; để lâu quá bảng
  hết hạn thì bài báo lỗi, mở app đăng lại. Vì vậy khi hẹn giờ đăng thì hẹn
  vào lúc người dùng thức để bấm cho phép kịp.
- **Đăng qua Graph API trực tiếp từ server** (app này, khi đã cấu hình Meta App
  xong): **không cần** bấm "Cho phép" — máy chủ tự đăng khi tới giờ.
- Đây là khác biệt quan trọng: đăng qua app (Graph API) thì tự động hoàn toàn;
  đăng qua trợ lý/trình duyệt thì cần người dùng bấm cho phép mỗi lần.

### 6.7. Đăng nhóm bằng tài khoản nào (quyết định tạm thời)
- **TẠM THỜI đăng nhóm bằng tài khoản cá nhân Đồng Nữ** (user quyết 02:29
  05/11/2026). Việc đăng bằng Trang tính sau.
- Đăng bằng Trang "Nhà Phố Gò Vấp" được đánh giá là ít bị hạn chế hơn, nhưng
  **Trang CHƯA tham gia các nhóm**. Muốn đăng bằng Trang thì Trang phải
  **tham gia từng nhóm trước** (nhiều nhóm cần admin duyệt mới vào được).

### 6.8. Đồng Nữ bị hạn chế thì chuyển sang Thanh Tâm
- Trong quá trình Đồng Nữ đăng nhóm theo lựa chọn trong app, nếu Đồng Nữ bị
  hạn chế thì cho Đồng Nữ tạm nghỉ, chuyển sang Thanh Tâm đăng tiếp các nhóm
  CÒN LẠI trong lựa chọn đó, không đăng lại nhóm Đồng Nữ đã đăng xong.
- Thanh Tâm làm trong đúng cửa sổ trình duyệt đã đăng nhập của Thanh Tâm,
  không mở cửa sổ mới. Nếu Thanh Tâm cũng bị hạn chế thì dừng hẳn và báo
  người dùng.

### 6.9. Hẹn giờ đăng = tự tạo nhắc trong lịch
- Bất cứ khi nào app chọn hẹn giờ để đăng bài thì đồng nghĩa phải tạo ngay
  sự kiện nhắc trong lịch vào đúng thời điểm đăng đó, reminder 0 phút (nhắc
  ngay tại thời điểm xảy ra sự kiện), không cần hỏi lại. Khi dời giờ đăng thì
  dời luôn sự kiện lịch sang giờ mới.

---

## 7. File danh sách 200 nhóm ưu tiên đi kèm

- File: **`data/priority-groups.json`** (đã kèm trong gói này).
- Nội dung: đúng **200 nhóm**, mỗi nhóm có `rank` (hạng 1–200), `name` (tên nhóm),
  `id` (ID nhóm Facebook), `member_count` (số thành viên), `url` (link nhóm).
- Xếp theo **số thành viên giảm dần**: hạng 1 đông nhất (438.000 thành viên),
  hạng 200 ít nhất (18.000 thành viên).
- App dùng file này để hiện 10 nút đợt nhóm (mỗi nút 20 nhóm) và để kiểm tra
  ID nhóm khi lưu danh sách nhóm đã chọn (ID không nằm trong file sẽ bị loại).
- Muốn đổi danh sách nhóm: sửa file `data/priority-groups.json` rồi khởi động
  lại server (server đọc file này lúc khởi động).
- File gốc đầy đủ: `nhom-uu-tien-200.md` / `nhom-uu-tien-200.json` (bản đầy đủ
  có cả tên không dấu). Trong gói này chỉ kèm bản JSON.

---

## 8. Xử lý lỗi thường gặp

| Lỗi / hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| **Token hết hạn / "Hết phiên kết nối Fanpage"** | Page Access Token hết hạn hoặc bị thu hồi. | Mở app → **Kết nối Facebook** lại → chọn lại Fanpage. Bài hẹn giờ bị lỗi do hết token sẽ chuyển thành "Thất bại" — kết nối lại rồi bấm **Đăng lại**. Token dài hạn ít hết hạn hơn token ngắn hạn; production nên có cơ chế gia hạn token. |
| **Hẹn giờ báo lỗi / bài hẹn giờ không đăng** | Tạo lịch hẹn thất bại (lỗi cron) hoặc server không chạy liên tục. | Kiểm tra server còn chạy không (bộ hẹn giờ chạy bằng `setInterval` trong tiến trình Node — **tắt server là bài hẹn giờ không đăng**). Xem log server để biết lỗi thật. Bài lỗi thì bấm **Đăng lại** hoặc hẹn lại. Nếu lỗi lặp lại, kiểm tra cấu hình session/`SESSION_SECRET`. |
| **Lỗi 403 / không thấy Fanpage** | Meta App chưa được cấp quyền, hoặc tài khoản không phải admin/developer/tester của Meta App, hoặc chưa qua App Review. | Kiểm tra lại mục 4: đúng App ID/Secret, đúng Redirect URI, đủ 3 quyền `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, tài khoản là admin/developer/tester của app. Nếu cần dùng cho người ngoài vai trò thử nghiệm thì hoàn tất App Review. |
| **Bài hẹn giờ không đăng (tới giờ vẫn "Đã hẹn giờ")** | Server đã tắt/khởi động lại, hoặc token hết hạn, hoặc lỗi khi đăng. | Kiểm tra server đang chạy, kiểm tra token (kết nối lại Facebook), xem lỗi trong Lịch sử. Bài lỗi → **Đăng lại**. |
| **Đăng bài báo lỗi (500)** | Lỗi thật từ Facebook (token sai, ảnh lỗi, quyền thiếu...). | Đọc thông báo lỗi trong Lịch sử — app ghi lỗi thật từ Facebook. Sửa nguyên nhân (kết nối lại, đổi ảnh, kiểm tra quyền) rồi **Đăng lại**. Ảnh của bài thất bại được giữ lại trên máy chủ để đăng lại. |
| **Chọn nhóm sau khi hẹn không lưu được** | Bài đã đăng/đã hủy thì không đổi được danh sách nhóm (đúng quy tắc). | Chỉ đổi được nhóm khi bài còn Bản nháp / Thất bại / Đã hẹn giờ. Bài đã đăng thì chỉ đánh dấu tiến độ đã đăng xong, không đổi danh sách. |
| **`/api/rewrite` báo 503** | Chưa cấu hình `OPENAI_API_KEY`. | Bình thường — key OpenAI không bắt buộc vì giao diện không dùng bước AI biên tập. Muốn dùng thì điền key vào `.env`. |
| **`/api/publish` báo 401** | Chưa kết nối và chọn Fanpage. | Kết nối Facebook và chọn Fanpage trước khi đăng. |

---

## Ghi chú cuối

- **Không có APK** trong gói này. Đã thử làm bản APK riêng (WebView + Facebook
  SDK) nhưng không hoàn thành được trong môi trường này — nếu làm tiếp hướng
  APK thì cần tự đánh giá lại cách làm, đừng coi như đã có sẵn.
- **Chưa triển khai công khai, chưa đăng thử lên Fanpage thật.** Mọi bước trong
  mục 4 và 8 cần làm thật với Meta App + Fanpage thật trước khi đăng bài thật.
- File yêu cầu gốc của người dùng: `TAI-LIEU-YEU-CAU-GOC.txt`.
- Chi tiết kỹ thuật và trạng thái kiểm chứng: xem `README.md` và `BAN-GIAO.md`.
