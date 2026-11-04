import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import OpenAI from 'openai';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const upload = multer({ dest: path.join(__dirname, 'uploads'), limits: { fileSize: 10 * 1024 * 1024, files: 15 } });

// --- Lịch sử bài đăng (lưu file JSON phía máy chủ) ---
// LƯU Ý BẢO MẬT: bài hẹn giờ cần Page Access Token để đăng khi người dùng
// không còn mở trình duyệt, nên token được lưu trong data/history.json TRÊN
// MÁY CHỦ (không bao giờ gửi xuống trình duyệt, thư mục data/ đã chặn commit
// trong .gitignore). Môi trường production nên thay bằng secret store bền vững.
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true }).catch(() => {});

// --- Nhóm ưu tiên (200 nhóm, xếp theo số thành viên giảm dần) ---
// Nguồn: data/priority-groups.json (copy từ danh sách 200 nhóm ưu tiên).
// Máy chủ chỉ PHỤC VỤ danh sách và GHI NHẬN nhóm đã chọn/đã đăng xong;
// Facebook đã khóa đăng nhóm qua Graph API nên việc đăng vào nhóm do trợ lý
// làm tay qua trình duyệt (đăng riêng từng bài vào từng nhóm, không dùng Share).
const GROUPS_FILE = path.join(DATA_DIR, 'priority-groups.json');
let priorityGroups = [];
try {
  const parsed = JSON.parse(await fs.readFile(GROUPS_FILE, 'utf8'));
  if (Array.isArray(parsed)) priorityGroups = parsed;
} catch { priorityGroups = []; }
const groupIdSet = new Set(priorityGroups.map(g => g.id));
function parseGroupIds(raw) {
  try {
    const arr = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(String))].filter(id => groupIdSet.has(id)).slice(0, 200);
  } catch { return []; }
}

async function loadHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
async function saveHistory(list) {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(list, null, 2));
}
function summaryOf(message) {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? oneLine.slice(0, 80) + '…' : oneLine;
}
async function addHistory(entry) {
  const list = await loadHistory();
  list.unshift(entry);
  await saveHistory(list.slice(0, 100));
  return entry;
}
async function updateHistory(id, patch) {
  const list = await loadHistory();
  const item = list.find(e => e.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  await saveHistory(list);
  return item;
}
function publicEntry(e) {
  const { photoFiles, pageAccessToken, ...rest } = e;
  return rest;
}
async function deleteStoredFiles(files) {
  await Promise.all((files || []).map(f => fs.unlink(f.path).catch(() => {})));
}

// fetch có giới hạn thời gian: tránh treo mãi khi Meta không phản hồi
// (mặc định fetch của Node không có timeout).
function fetchWithTimeout(url, opts, ms = 60000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

// Đăng một bài lên Fanpage qua Graph API: tải ảnh ở trạng thái chưa xuất bản
// rồi tạo bài feed kèm attached_media. Dùng chung cho đăng ngay, đăng lại và hẹn giờ.
async function publishToFacebook(page, message, files) {
  if (!files || files.length === 0) {
    const body = new URLSearchParams({ message, access_token: page.accessToken });
    const r = await fetchWithTimeout(`${GRAPH}/${page.id}/feed`, { method: 'POST', body });
    const post = await r.json();
    if (!r.ok || post.error) throw new Error(post.error?.message || 'Facebook từ chối đăng bài.');
    return post;
  }
  const media = [];
  for (const file of files) {
    const bytes = await fs.readFile(file.path);
    const form = new FormData();
    form.set('published', 'false');
    form.set('access_token', page.accessToken);
    form.set('source', new Blob([bytes], { type: file.mimetype }), file.originalname);
    const r = await fetchWithTimeout(`${GRAPH}/${page.id}/photos`, { method: 'POST', body: form }, 120000);
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error?.message || `Không tải được ảnh ${file.originalname}.`);
    media.push({ media_fbid: data.id });
  }
  const body = new URLSearchParams({ message, access_token: page.accessToken });
  media.forEach((item, i) => body.set(`attached_media[${i}]`, JSON.stringify(item)));
  const r = await fetchWithTimeout(`${GRAPH}/${page.id}/feed`, { method: 'POST', body });
  const post = await r.json();
  if (!r.ok || post.error) throw new Error(post.error?.message || 'Facebook không tạo được bài đăng nhiều ảnh.');
  return post;
}
function postUrlOf(post) {
  const id = post.id || post.post_id || '';
  return id ? `https://www.facebook.com/${id}` : null;
}

app.use(express.json({ limit: '2mb' }));
app.use(session({
  name: 'npgva.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const rewriteInstructions = `Bạn là trợ lý biên tập tin bất động sản chuyên nghiệp cho thương hiệu Nhà Phố Gò Vấp. Chỉ xử lý TIN BÁN NHÀ. Hãy viết lại nội dung nguồn theo các quy tắc cố định sau:
- Dòng đầu tiên: số điện thoại liên hệ nếu nguồn có cung cấp.
- Dòng tiếp theo: giá bán, chuẩn hóa cách ghi (ví dụ 5 tỷ 250 triệu thành 5.25 tỷ); lặp lại giá ở dòng cuối.
- Tiêu đề theo dạng “✅ Bán nhà đường [địa chỉ]...” và KHÔNG dùng từ “hẻm” trong tiêu đề.
- Các dòng thông tin riêng biệt, gọn, không có dòng trống: 📏 Diện tích; 🏠 Kết cấu; 📍 Vị trí; 🛍️ Tiện ích nếu dữ liệu có.
- Thông tin bổ sung đặt ở dòng riêng, không dùng nhãn “🎁 Thêm:”.
- Bỏ hoàn toàn mọi thông tin hoa hồng/commission, kể cả phần trăm hoặc số tiền hoa hồng.
- Không bịa, không suy diễn, không tự thêm tiện ích, pháp lý, số phòng, hướng nhà hoặc khoảng cách.
- Bỏ trường không có dữ liệu; không ghi “chưa cập nhật”.
- Văn bản thuần, dễ sao chép lên Zalo/Facebook; mỗi trường một dòng, không chèn dòng trống.
Chỉ trả về nội dung bài đăng đã biên tập, không giải thích.`;

function requireConfig(keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) return `Thiếu cấu hình máy chủ: ${missing.join(', ')}. Hãy điền file .env theo README.`;
  return null;
}

app.get('/api/status', (req, res) => {
  res.json({
    appName: 'Nhà Phố Gò Vấp Auto',
    facebookConnected: Boolean(req.session.pages?.length),
    selectedPage: req.session.selectedPage?.name || null,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasMeta: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI)
  });
});

app.get('/auth/facebook', (req, res) => {
  const issue = requireConfig(['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI']);
  if (issue) return res.status(503).send(issue);
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    state,
    response_type: 'code',
    scope: 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts'
  });
  res.redirect(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`);
});

app.get('/auth/facebook/callback', async (req, res) => {
  try {
    if (!req.query.code) throw new Error(req.query.error_description || 'Facebook không trả về mã xác thực.');
    if (!req.query.state || req.query.state !== req.session.oauthState) throw new Error('OAuth state không hợp lệ. Hãy thử kết nối lại.');
    delete req.session.oauthState;
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code: String(req.query.code)
    });
    const tokenRes = await fetchWithTimeout(`${GRAPH}/oauth/access_token?${tokenParams}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error?.message || 'Không đổi được access token.');

    const pagesUrl = new URL(`${GRAPH}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,tasks');
    pagesUrl.searchParams.set('access_token', tokenData.access_token);
    const pagesRes = await fetchWithTimeout(pagesUrl);
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok || pagesData.error) throw new Error(pagesData.error?.message || 'Không lấy được danh sách Fanpage.');
    req.session.pages = (pagesData.data || []).map(p => ({ id: p.id, name: p.name, accessToken: p.access_token, tasks: p.tasks || [] }));
    req.session.save(() => res.redirect('/?connected=1'));
  } catch (err) {
    res.redirect(`/?facebook_error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/pages', (req, res) => {
  res.json({ pages: (req.session.pages || []).map(({ id, name }) => ({ id, name })), selectedPageId: req.session.selectedPage?.id || null });
});

app.post('/api/select-page', (req, res) => {
  const page = (req.session.pages || []).find(p => p.id === req.body.pageId);
  if (!page) return res.status(400).json({ error: 'Fanpage không nằm trong danh sách được cấp quyền.' });
  req.session.selectedPage = page;
  res.json({ ok: true, selectedPage: { id: page.id, name: page.name } });
});

app.post('/api/rewrite', async (req, res) => {
  const issue = requireConfig(['OPENAI_API_KEY']);
  if (issue) return res.status(503).json({ error: issue });
  const source = String(req.body.source || '').trim();
  if (source.length < 10) return res.status(400).json({ error: 'Vui lòng nhập nội dung căn nhà.' });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.5',
      instructions: rewriteInstructions,
      input: `Hãy biên tập tin bán nhà sau đây:\n\n${source}`
    });
    res.json({ text: response.output_text || '' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Không biên tập được nội dung.' });
  }
});

app.post('/api/publish', upload.array('photos', 15), async (req, res) => {
  const page = req.session.selectedPage;
  if (!page?.accessToken) return res.status(401).json({ error: 'Chưa kết nối và chọn Fanpage.' });
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Bài đăng đang trống.' });
  const files = (req.files || []).map(f => ({ path: f.path, mimetype: f.mimetype, originalname: f.originalname }));
  const entry = await addHistory({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), scheduledFor: null,
    message, summary: summaryOf(message), pageId: page.id, pageName: page.name,
    photoCount: files.length, photoFiles: files, status: 'posting', postId: null, postUrl: null, error: null,
    shareTargetGroupIds: parseGroupIds(req.body.groupIds), sharedGroupIds: []
  });
  try {
    const post = await publishToFacebook(page, message, files);
    await deleteStoredFiles(files);
    const updated = await updateHistory(entry.id, { status: 'published', postId: post.id || post.post_id || null, postUrl: postUrlOf(post), photoFiles: [] });
    res.json({ ok: true, postId: updated.postId, postUrl: updated.postUrl, pageName: page.name, photoCount: files.length });
  } catch (err) {
    // Đăng thất bại: GIỮ ẢNH để đăng lại được, không xóa.
    await updateHistory(entry.id, { status: 'failed', error: err.message || 'Đăng bài thất bại.' });
    res.status(500).json({ error: err.message || 'Đăng bài thất bại.', historyId: entry.id });
  }
});

// Hẹn giờ đăng: chỉ nhận 1, 2, 3 hoặc 4 tiếng. Bài được lưu trạng thái
// "scheduled" kèm giờ đăng; bộ kiểm tra bên dưới sẽ đăng khi đến giờ.
app.post('/api/schedule', upload.array('photos', 15), async (req, res) => {
  const page = req.session.selectedPage;
  if (!page?.accessToken) return res.status(401).json({ error: 'Chưa kết nối và chọn Fanpage.' });
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Bài đăng đang trống.' });
  const delayHours = Number(req.body.delayHours);
  if (![1, 2, 3, 4].includes(delayHours)) return res.status(400).json({ error: 'Chỉ hẹn đăng sau 1, 2, 3 hoặc 4 tiếng.' });
  const files = (req.files || []).map(f => ({ path: f.path, mimetype: f.mimetype, originalname: f.originalname }));
  const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
  const entry = await addHistory({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), scheduledFor,
    message, summary: summaryOf(message), pageId: page.id, pageName: page.name,
    photoCount: files.length, photoFiles: files, pageAccessToken: page.accessToken,
    status: 'scheduled', postId: null, postUrl: null, error: null,
    shareTargetGroupIds: parseGroupIds(req.body.groupIds), sharedGroupIds: []
  });
  res.json({ ok: true, historyId: entry.id, scheduledFor, pageName: page.name, photoCount: files.length });
});

// Lưu bản nháp: không cần chọn Fanpage. Ảnh được giữ lại trên máy chủ
// để đăng/hẹn giờ sau từ trang Lịch sử.
app.post('/api/drafts', upload.array('photos', 15), async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Bài đăng đang trống.' });
  const files = (req.files || []).map(f => ({ path: f.path, mimetype: f.mimetype, originalname: f.originalname }));
  const entry = await addHistory({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), scheduledFor: null,
    message, summary: summaryOf(message), pageId: null, pageName: null,
    photoCount: files.length, photoFiles: files, status: 'draft', postId: null, postUrl: null, error: null,
    shareTargetGroupIds: parseGroupIds(req.body.groupIds), sharedGroupIds: []
  });
  res.json({ ok: true, historyId: entry.id });
});

app.get('/api/history', async (req, res) => {
  const list = await loadHistory();
  res.json({ posts: list.map(publicEntry) });
});

// Danh sách 200 nhóm ưu tiên (xếp theo số thành viên giảm dần).
app.get('/api/groups', (req, res) => {
  res.json({ groups: priorityGroups, count: priorityGroups.length });
});

app.get('/api/history/:id', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  res.json({ post: publicEntry(entry) });
});

// Lưu danh sách nhóm đã chọn cho một bài. Được đổi khi bài còn là Bản nháp,
// Thất bại hoặc Đã hẹn giờ — KỂ CẢ SAU KHI đã hẹn (danh sách nhóm chỉ được
// đọc lúc bài thực sự đăng nên lựa chọn mới nhất luôn có hiệu lực). Bài Đã
// đăng / Đã hủy / Đang đăng thì không đổi được nữa.
app.post('/api/history/:id/share-targets', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  if (!['draft', 'failed', 'scheduled'].includes(entry.status)) return res.status(400).json({ error: 'Bài này không còn đổi được danh sách nhóm chia sẻ.' });
  const clean = parseGroupIds(JSON.stringify(req.body.groupIds || []));
  await updateHistory(entry.id, { shareTargetGroupIds: clean });
  res.json({ ok: true, groupIds: clean });
});

// Đánh dấu nhóm đã đăng xong (đăng riêng từng bài vào từng nhóm, làm tay
// hoặc qua trợ lý; máy chủ chỉ ghi nhận tiến độ, không tự đăng vào nhóm).
// Body: { groupIds: [...], shared: true|false } (mặc định true).
app.post('/api/history/:id/share-groups', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  if (!['published', 'scheduled', 'posting'].includes(entry.status)) return res.status(400).json({ error: 'Chỉ đánh dấu được nhóm cho bài đã đăng hoặc đã hẹn giờ.' });
  const ids = parseGroupIds(JSON.stringify(req.body.groupIds || []));
  const targets = new Set(entry.shareTargetGroupIds || []);
  const done = new Set(entry.sharedGroupIds || []);
  const mark = req.body.shared !== false;
  ids.forEach(id => { if (targets.has(id)) { if (mark) done.add(id); else done.delete(id); } });
  await updateHistory(entry.id, { sharedGroupIds: [...done] });
  res.json({ ok: true, sharedGroupIds: [...done] });
});

app.post('/api/history/:id/retry', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  if (!['failed', 'draft'].includes(entry.status)) return res.status(400).json({ error: 'Chỉ đăng được bài đang ở trạng thái Bản nháp hoặc Thất bại.' });
  const page = (req.session.pages || []).find(p => p.id === entry.pageId) || req.session.selectedPage;
  if (!page?.accessToken) return res.status(401).json({ error: 'Chưa kết nối Fanpage. Hãy kết nối lại rồi đăng lại.' });
  await updateHistory(entry.id, { status: 'posting', error: null, pageId: page.id, pageName: page.name });
  try {
    const post = await publishToFacebook(page, entry.message, entry.photoFiles || []);
    await deleteStoredFiles(entry.photoFiles || []);
    const updated = await updateHistory(entry.id, { status: 'published', postId: post.id || post.post_id || null, postUrl: postUrlOf(post), photoFiles: [] });
    res.json({ ok: true, postId: updated.postId, postUrl: updated.postUrl });
  } catch (err) {
    await updateHistory(entry.id, { status: 'failed', error: err.message || 'Đăng lại thất bại.' });
    res.status(500).json({ error: err.message || 'Đăng lại thất bại.' });
  }
});

// Hẹn giờ cho một bản nháp đã lưu (từ trang Lịch sử).
app.post('/api/history/:id/schedule', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  if (entry.status !== 'draft') return res.status(400).json({ error: 'Chỉ hẹn giờ được bài đang ở trạng thái Bản nháp.' });
  const page = req.session.selectedPage;
  if (!page?.accessToken) return res.status(401).json({ error: 'Chưa kết nối Fanpage. Hãy kết nối lại rồi hẹn giờ.' });
  const delayHours = Number(req.body.delayHours);
  if (![1, 2, 3, 4].includes(delayHours)) return res.status(400).json({ error: 'Chỉ hẹn đăng sau 1, 2, 3 hoặc 4 tiếng.' });
  const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
  await updateHistory(entry.id, { status: 'scheduled', scheduledFor, pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken, error: null });
  res.json({ ok: true, scheduledFor });
});

// Sửa nội dung một bản nháp / bài thất bại (chỉ sửa chữ; ảnh đã lưu giữ nguyên).
app.patch('/api/history/:id', async (req, res) => {
  const list = await loadHistory();
  const entry = list.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  if (!['draft', 'failed'].includes(entry.status)) return res.status(400).json({ error: 'Chỉ sửa được bài đang ở trạng thái Bản nháp hoặc Thất bại.' });
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Bài đăng đang trống.' });
  await updateHistory(entry.id, { message, summary: summaryOf(message) });
  res.json({ ok: true });
});

app.delete('/api/history/:id', async (req, res) => {
  const list = await loadHistory();
  const idx = list.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
  const entry = list[idx];
  await deleteStoredFiles(entry.photoFiles || []);
  if (entry.status === 'scheduled') {
    // Hủy hẹn: giữ lại bản ghi với trạng thái "cancelled" để đối chiếu.
    await updateHistory(entry.id, { status: 'cancelled', photoFiles: [], pageAccessToken: null });
    return res.json({ ok: true, cancelled: true });
  }
  list.splice(idx, 1);
  await saveHistory(list);
  res.json({ ok: true });
});

// Bộ kiểm tra bài hẹn giờ: mỗi 30 giây quét một lần. Bài đến giờ được đánh
// dấu "posting" TRƯỚC khi đăng để lần quét sau không đăng trùng.
async function runDueScheduledPosts() {
  const list = await loadHistory();
  const now = new Date();
  for (const entry of list) {
    if (entry.status !== 'scheduled' || !entry.scheduledFor) continue;
    if (new Date(entry.scheduledFor) > now) continue;
    if (!entry.pageAccessToken) {
      await updateHistory(entry.id, { status: 'failed', error: 'Hết phiên kết nối Fanpage. Hãy kết nối lại rồi đăng lại.' });
      continue;
    }
    await updateHistory(entry.id, { status: 'posting', error: null });
    try {
      const post = await publishToFacebook({ id: entry.pageId, accessToken: entry.pageAccessToken }, entry.message, entry.photoFiles || []);
      await deleteStoredFiles(entry.photoFiles || []);
      await updateHistory(entry.id, { status: 'published', postId: post.id || post.post_id || null, postUrl: postUrlOf(post), photoFiles: [], pageAccessToken: null });
    } catch (err) {
      await updateHistory(entry.id, { status: 'failed', error: err.message || 'Đăng bài hẹn giờ thất bại.', pageAccessToken: null });
    }
  }
}
setInterval(() => { runDueScheduledPosts().catch(() => {}); }, 30 * 1000);

app.post('/api/disconnect', (req, res) => {
  delete req.session.pages;
  delete req.session.selectedPage;
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Nha Pho Go Vap Auto running at http://localhost:${PORT}`));
