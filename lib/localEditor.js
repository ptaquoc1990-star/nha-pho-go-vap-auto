// Biên tập nội bộ (rule-based) — chạy ngay, không cần API key.
// Chỉ dùng dữ liệu có trong nguồn. Thiếu trường nào thì bỏ dòng đó.
// Không bịa số phòng, diện tích, pháp lý, hướng, tiện ích; không thêm SĐT.

const PHONE_RE = /(0\d{2,3}(?:[.\s]\d{3,4}){2}|0\d{9,10})/;
const COMMISSION_LINE = /hoa\s*hồng|hoa hong|commission/i;

function fmtNum(n) {
  if (!Number.isFinite(n)) return '';
  const s = Number(n.toFixed(2)).toString();
  return s;
}

function cleanFragment(s) {
  return String(s || '')
    .replace(/[^,;\n]*\b(?:hoa\s*hồng|hoa hong|commission)\b[^,;\n]*/gi, '')
    .replace(/\bHH\b\s*\d+(?:[.,]\d+)?\s*%[^,;\n]*/gi, '')
    .replace(/\bgiá\b[^,\n]*/gi, '')
    .replace(/\bLH\b.*$/i, '')
    .replace(PHONE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s:;.-]+/, '')
    .replace(/[,\s;:.]+$/, '')
    .trim();
}

function removeCommission(text) {
  // Chỉ cắt đúng cụm hoa hồng, KHÔNG xóa cả dòng/đoạn chứa nó,
  // vì một dòng nguồn thường chứa nhiều trường khác (giá, địa chỉ...).
  return String(text || '')
    .replace(/[,;]?\s*[^,;.\n]*\b(?:hoa\s*hồng|hoa hong|commission)\b[^,;.\n]*/gi, '')
    .replace(/\bHH\b\s*\d+(?:[.,]\d+)?\s*%[^,;\n]*/gi, '');
}

function parseDecimal(s) {
  return parseFloat(String(s).replace(',', '.'));
}

function formatTy(total) {
  // 5.250 -> 5.25 ; 5.050 -> 5.05 ; 5.000 -> 5 (không làm tròn giá trị)
  return total.toFixed(3).replace(/\.?0+$/, '') + ' tỷ';
}

export function normalizePrice(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*t[ỷỉ](?:\s+(\d{1,3}))?(?:\s*triệu)?/i);
  if (m) {
    const base = parseDecimal(m[1]);
    if (!Number.isFinite(base)) return null;
    if (m[2] && !/[.,]/.test(m[1])) {
      return formatTy(base + parseInt(m[2], 10) / 1000);
    }
    return formatTy(base);
  }
  const m2 = text.match(/(\d[\d.,]*)\s*triệu/i);
  if (m2) {
    const millions = parseInt(m2[1].replace(/[.,\s]/g, ''), 10);
    if (Number.isFinite(millions) && millions >= 1000) {
      return formatTy(millions / 1000);
    }
    return `${fmtNum(millions)} triệu`;
  }
  return null;
}

function extractPhone(text) {
  const m = text.match(PHONE_RE);
  return m ? m[1].trim() : null;
}

function extractTitle(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    const idx = line.search(/đường\s+/i);
    if (idx >= 0) {
      let seg = line.slice(idx).replace(/^đường\s+/i, '');
      seg = seg.split(/[.;]/)[0];
      seg = seg.replace(/\bgiá\b.*$/i, '').replace(/\bLH\b.*$/i, '').replace(/\bliên hệ\b.*$/i, '');
      seg = cleanFragment(seg);
      // Tuyệt đối không dùng từ "hẻm" trong tiêu đề.
      seg = seg.replace(/(?:,\s*)?\bhẻm\b[^,]*/gi, '').replace(/\bhẻm\b/gi, '');
      seg = seg.replace(/\s{2,}/g, ' ').replace(/^[,\s]+/, '').replace(/[,\s]+$/, '').trim();
      if (seg.length >= 2) return `✅ Bán nhà đường ${seg}`;
    }
  }
  // Dự phòng: "Bán nhà <tên đường>" nhưng nguồn không ghi chữ "đường",
  // hoặc "Bán nhà hẻm <số> <tên đường>" -> bỏ cụm hẻm, giữ tên đường.
  for (const line of lines) {
    const m = line.match(/bán nhà\s+([^,\n]{3,50})/i);
    if (m) {
      let seg = m[1].replace(/^hẻm\s*\d+[^\s]*\s*/i, '');
      seg = cleanFragment(seg);
      seg = seg.replace(/(?:,\s*)?\bhẻm\b[^,]*/gi, '').replace(/\bhẻm\b/gi, '').trim();
      // Giữ thêm phường/quận ngay sau dấu phẩy nếu có (vd: ", Gò Vấp").
      const rest = line.slice(line.indexOf(m[1]) + m[1].length).split(',')[1];
      if (rest) {
        const ward = cleanFragment(rest.split(/[.;]/)[0]);
        if (ward && /phường|gò vấp|quận|tp\.?\s*hcm/i.test(ward)) seg += `, ${ward}`;
      }
      if (seg && !/giá|tỷ|triệu|phòng|trệt|lầu/i.test(seg)) {
        return `✅ Bán nhà đường ${seg}`;
      }
    }
  }
  return null;
}

function extractArea(text) {
  const dims = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m(?![a-zà-ỹ])/i);
  const m2 = text.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
  if (dims) {
    const a = parseDecimal(dims[1]);
    const b = parseDecimal(dims[2]);
    const area = m2 ? parseDecimal(m2[1]) : a * b;
    return `📏 Diện tích: ${fmtNum(a)} x ${fmtNum(b)}m (${fmtNum(area)}m²)`;
  }
  if (m2) return `📏 Diện tích: ${fmtNum(parseDecimal(m2[1]))}m²`;
  return null;
}

function extractStructure(text) {
  const labeled = text.match(/kết cấu\s*[:\-]\s*([^\n]+)/i);
  if (labeled) {
    const content = cleanFragment(labeled[1].split(/[.;]/)[0]);
    if (content) return `🏠 Kết cấu: ${content}`;
  }
  const tokens = [];
  const re = /(\d+)\s*(trệt|lầu|tầng|gác|phòng ngủ|phòng thờ|phòng giặt|sân thượng|WC|PN)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const unit = m[2].toLowerCase() === 'pn' ? 'phòng ngủ' : m[2];
    const token = `${m[1]} ${unit}`;
    if (!tokens.includes(token)) tokens.push(token);
  }
  if (tokens.length) return `🏠 Kết cấu: ${tokens.join(', ')}`;
  return null;
}

function extractLabeled(text, label) {
  const m = text.match(new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]+)`, 'i'));
  if (!m) return null;
  const content = cleanFragment(m[1].split(/[.;]/)[0]);
  return content || null;
}

function extractPosition(text) {
  const labeled = extractLabeled(text, 'vị trí');
  if (labeled) return `📍 Vị trí: ${labeled}`;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || /đường\s+/i.test(line) || /^bán nhà/i.test(line)) continue;
    if (/\bhẻm\b|\bmặt tiền\b|\bkhu vực\b/i.test(line)) {
      const content = cleanFragment(line);
      if (content) return `📍 Vị trí: ${content}`;
    }
  }
  return null;
}

function extractAmenities(text, positionLine) {
  const labeled = extractLabeled(text, 'tiện ích');
  if (labeled) return `🛍️ Tiện ích: ${labeled}`;
  // Nguồn viết thành một đoạn dài: lấy đúng cụm "Gần ..." tới hết câu.
  const near = text.match(/gần\s+[^.\n]+/i);
  if (near) {
    const content = cleanFragment(near[0]);
    if (content) return `🛍️ Tiện ích: ${content}`;
  }
  const parts = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (positionLine && positionLine.includes(line)) continue;
    if (/\bgần\b|chợ|trường học|siêu thị|bệnh viện|công viên/i.test(line) && !/đường\s+/i.test(line)) {
      const content = cleanFragment(line);
      if (content && !parts.includes(content)) parts.push(content);
    }
  }
  if (parts.length) return `🛍️ Tiện ích: ${parts.join(', ')}`;
  return null;
}

function extractExtras(text, alreadyJoined) {
  const extras = [];
  const legalLabeled = extractLabeled(text, 'pháp lý');
  if (legalLabeled) {
    extras.push(`📜 Pháp lý: ${legalLabeled}`);
  } else {
    const lm = text.match(/sổ hồng(?:\s*riêng)?|sổ đỏ|\bSHR\b/i);
    if (lm) extras.push(`📜 Pháp lý: ${lm[0]}`);
  }
  const hm = text.match(/hướng\s*[:\-]?\s*(Đông Nam|Tây Bắc|Đông Bắc|Tây Nam|Đông|Tây|Nam|Bắc)/i);
  if (hm) extras.push(`🧭 Hướng: ${hm[1]}`);
  return extras.filter((e) => !alreadyJoined.includes(e));
}

export function editListing(source) {
  const cleaned = removeCommission(source);
  const lines = [];
  const phone = extractPhone(cleaned);
  if (phone) lines.push(phone);
  const price = normalizePrice(cleaned);
  if (price) lines.push(`💰 Giá bán: ${price}`);
  const title = extractTitle(cleaned);
  if (title) lines.push(title);
  const area = extractArea(cleaned);
  if (area) lines.push(area);
  const structure = extractStructure(cleaned);
  if (structure) lines.push(structure);
  const position = extractPosition(cleaned);
  if (position) lines.push(position);
  const amenities = extractAmenities(cleaned, position || '');
  if (amenities) lines.push(amenities);
  const extras = extractExtras(cleaned, lines.join('\n'));
  lines.push(...extras);
  if (price) lines.push(`💰 Giá bán: ${price}`);
  // Không dòng trống giữa các dòng.
  return lines.filter((l) => l && l.trim()).join('\n');
}
