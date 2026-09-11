/*
  여명각인 단축어용 SVG 워커 — /c (단톡) · /v (리코LIVE)
  배포: Cloudflare Workers > 코드 편집 > 전체 붙여넣기 > 배포
  ⚠ 배포 후 Settings > Observability > Logs 를 끌 것 (URL에 실린 대사가 로그로 남음)
  ⚠ 이 코드는 어떤 요청도 저장·전송하지 않음. 이미지만 그림.

  /c?r=방이름&n=인원&t=HH:MM&a=공지&pg=1&l=이름｜내용|이름｜내용&s=입력중이름
     줄 문법: 이름｜내용  /  내용 특수값: [사진] [부재중] ↪인용문  🧸(스티커)  끝에 ✓N(읽음)
             이름을 - 로 쓰면 가운데 시스템 안내줄
  /v?t=제목&v=동접&h=좋아요&pg=1&l=🎤｜멘트|닉｜채팅|💰1000｜닉｜멘트|🔔닉|⚡급등&e=본심
     줄 문법: 🎤｜멘트(리코)  닉｜채팅  💰금액｜닉｜멘트(후원)  🔔닉(구독)  ⚡문구(지표 급변)
     e= 는 pg=3 에서만 표시 (⏹ 종료 직후 마이크에 섞인 본심)
  장당 발화 인물 최대 5명 권장 — 6명째부터는 프로필 대신 이모지로 그림 (이미지 용량 보호)
  /a?n=이름  프로필 크롭 위치 미리보기 (빨간 원 = 현재 크롭 범위). FACE 표 숫자 조정 후 재배포
  공통: 공백은 _ 로 받음. 줄 구분 | . 한 줄 18자 기준 자동 줄바꿈.
  프로필: https://5aaa.uk/이름01.webp 를 워커가 받아 얼굴만 원형 크롭해 base64 로 내장 (AV_MODE 참조)
*/

const FONT = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','Segoe UI Emoji','Apple Color Emoji',sans-serif";
const W = 640;

const CAST = {
  "레이":   ["☀️", "#F2A33A"],
  "리코":   ["🎀", "#F26D8D"],
  "신스케": ["💤", "#8D8F99"],
  "카나메": ["📋", "#F08A3C"],
  "토우카": ["❄️", "#5FA8D3"],
  "잇세이": ["🥋", "#D9534F"],
  "아즈사": ["💥", "#9B7BD1"],
  "히비키": ["🍭", "#E88BC4"],
  "카구야": ["🌕", "#B8B0D8"],
  "엔마":   ["🍶", "#7A6E5E"],
  "나츠메": ["⚡", "#6C5FC7"],
  "켄":     ["🥊", "#8C6A3C"],
  "시즈하": ["🎴", "#8FB8A0"],
  "쿠온":   ["🌑", "#3B3F4A"],
};

/* ---------- 프로필 이미지(기본 01 얼굴 크롭) ---------- */
const IMG_BASE = "https://5aaa.uk/";     // 이름01.webp
const AV_MODE = "embed";                 // "embed"=base64 내장(모바일 안정) / "link"=외부 참조(가볍지만 앱 미표시 가능)
// 얼굴 위치: [얼굴 중심 x 비율, 얼굴 중심 y 비율, 얼굴 폭 비율(이미지 폭 대비, 원 지름이 이 폭을 덮음)]
// /a?n=이름 으로 크롭 미리보기 후 숫자 조정
const FACE_DEFAULT = [0.5, 0.2, 0.42];
const FACE = {
  // "레이": [0.5, 0.18, 0.4],
};
const _avCache = new Map();

function webpSize(b) {                   // WebP 헤더에서 가로·세로 추출
  if (b.length < 30 || String.fromCharCode(b[8], b[9], b[10], b[11]) !== "WEBP") return null;
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (tag === "VP8 ") return [(b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff];
  if (tag === "VP8L") { const x = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24; return [(x & 0x3fff) + 1, ((x >>> 14) & 0x3fff) + 1]; }
  if (tag === "VP8X") return [1 + (b[24] | b[25] << 8 | b[26] << 16), 1 + (b[27] | b[28] << 8 | b[29] << 16)];
  return null;
}
function b64(bytes) {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
async function avatar(name) {            // {href, w, h} 또는 null
  if (!CAST[name]) return null;
  if (_avCache.has(name)) return _avCache.get(name);
  const url = IMG_BASE + encodeURIComponent(name + "01") + ".webp";
  let out = null;
  try {
    const cache = caches.default;
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url, { cf: { cacheTtl: 86400 } });
      if (res.ok) { res = new Response(res.body, res); res.headers.set("cache-control", "public, max-age=86400"); await cache.put(url, res.clone()); }
    }
    if (res && res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const sz = webpSize(bytes);
      if (sz) out = { href: AV_MODE === "link" ? url : "data:image/webp;base64," + b64(bytes), w: sz[0], h: sz[1] };
    }
  } catch (e) { out = null; }
  _avCache.set(name, out);
  return out;
}
// 원형 아바타: 이미지 있으면 얼굴 크롭, 없으면 이모지
function avatarSvg(name, av, cx, cy, r, id) {
  const [emo, col] = CAST[name] || ["👤", hashColor(name)];
  let s = `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="${col}" opacity="0.18"/>`;
  if (av) {
    const [fx, fy, fw] = FACE[name] || FACE_DEFAULT;
    const scale = (2 * r) / (fw * av.w);
    const dw = av.w * scale, dh = av.h * scale;
    const x = cx - fx * av.w * scale, y = cy - fy * av.h * scale;
    s += `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
    s += `<image href="${av.href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" clip-path="url(#${id})" preserveAspectRatio="none"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="2"/>`;
  } else {
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFF" stroke="${col}" stroke-width="2"/>`;
    s += `<text x="${cx}" y="${cy + r * 0.4}" font-size="${r}" text-anchor="middle">${emo}</text>`;
  }
  return s;
}
// /a?n=이름 : 크롭 위치 조정용 미리보기
async function renderAdjust(p) {
  const name = clean(p.get("n") || "레이", 10);
  const av = await avatar(name);
  if (!av) return svg(`<rect width="${W}" height="120" fill="#FFF"/><text x="20" y="60" font-size="16">이미지 없음: ${esc(name)}01.webp</text>`, 120);
  const dw = 400, dh = av.h * (dw / av.w);
  const [fx, fy, fw] = FACE[name] || FACE_DEFAULT;
  const cx = 20 + fx * dw, cy = 20 + fy * dh, r = fw * dw / 2;
  const body = `<rect width="${W}" height="${dh + 40}" fill="#FFF"/>
<image href="${av.href}" x="20" y="20" width="${dw}" height="${dh}"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F00" stroke-width="3"/>
<text x="440" y="50" font-size="15">${esc(name)} ${av.w}x${av.h}</text>
<text x="440" y="75" font-size="13">FACE: [${fx}, ${fy}, ${fw}]</text>
<text x="440" y="100" font-size="12" fill="#666">x비율, y비율, 얼굴폭비율</text>
${avatarSvg(name, av, 520, 200, 60, "prev")}`;
  return svg(body, dh + 40);
}

/* ---------- 공통 유틸 ---------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clean(s, max = 200) {
  return String(s || "").replace(/_/g, " ").replace(/[\u0000-\u001f]/g, "").slice(0, max);
}
function cw(ch) {                       // 글자 폭: 한글·전각·이모지 = 1, ASCII = 0.55
  const c = ch.codePointAt(0);
  if (c < 0x2000) return 0.55;
  return 1;
}
function wrap(text, maxUnits = 18) {   // 18자 기준 자동 줄바꿈
  const out = []; let line = "", units = 0;
  for (const ch of Array.from(text)) {
    const w = cw(ch);
    if (units + w > maxUnits && line) { out.push(line); line = ""; units = 0; }
    line += ch; units += w;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}
function textW(s, size) {
  let u = 0; for (const ch of Array.from(s)) u += cw(ch);
  return u * size;
}
function hashColor(s) {
  let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pal = ["#3C7DD9", "#D9663C", "#3CA66A", "#B04AC9", "#C98B1E", "#1FA0A8", "#D9457A"];
  return pal[h % pal.length];
}
function after(raw, prefix) {              // 이모지 접두어 제거 (서로게이트 안전)
  return raw.slice(prefix.length).replace(/^｜/, "").trim();
}
function splitLines(l) {
  return clean(l, 4000).split("|").map(s => s.trim()).filter(Boolean).slice(0, 40);
}
function svg(body, h) {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">${body}</svg>`,
    { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } }
  );
}

/* ---------- /c 단톡 ---------- */
async function renderChat(p) {
  const room = clean(p.get("r") || "서광반", 30);
  const n = clean(p.get("n") || "", 4);
  const t = clean(p.get("t") || "", 8);
  const notice = clean(p.get("a") || "", 60);
  const pg = Math.min(3, Math.max(1, parseInt(p.get("pg") || "1", 10) || 1));
  const typing = clean(p.get("s") || "", 12);
  const lines = splitLines(p.get("l"));

  const BG = "#F1ECE2", BUBBLE = "#FFFFFF", INK = "#2A2C33", SUB = "#7C7F8A";
  let y = 0, parts = [];

  // 상단 바 (진남색 — 라인 계열 색 회피)
  parts.push(`<rect width="${W}" height="64" fill="#23283A"/>`);
  parts.push(`<text x="20" y="40" font-size="22" font-weight="700" fill="#FFF">💬 ${esc(room)}${n ? ` <tspan fill="#AEB4C6" font-weight="400">(${esc(n)})</tspan>` : ""}</text>`);
  parts.push(`<text x="${W - 20}" y="40" font-size="16" fill="#AEB4C6" text-anchor="end">📅 오늘 ${esc(t)}  ·  ${pg}/3</text>`);
  y = 64;
  // 공지 띠
  if (notice) {
    parts.push(`<rect x="0" y="${y}" width="${W}" height="38" fill="#FBF3DF"/>`);
    parts.push(`<text x="20" y="${y + 25}" font-size="15" fill="#6E5A1E">📌 ${esc(notice)}</text>`);
    y += 38;
  }
  y += 14;

  const bodyStart = y;
  const items = [];
  for (const raw of lines) {
    const idx = raw.indexOf("｜");
    let name = idx >= 0 ? raw.slice(0, idx).trim() : "";
    let body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
    let read = "";
    const m = body.match(/✓\s*(\d+)\s*$/);
    if (m) { read = m[1]; body = body.replace(/✓\s*\d+\s*$/, "").trim(); }
    items.push({ name, body, read });
  }

  const names = [...new Set(items.map(i => i.name).filter(n => CAST[n]))].slice(0, 5);   // 장당 프로필 최대 5명 (초과 인물은 이모지)
  const avs = Object.fromEntries(await Promise.all(names.map(async n => [n, await avatar(n)])));

  let k = 0;
  for (const it of items) {
    // 시스템 줄
    if (!it.name || it.name === "-") {
      const txt = it.body;
      const tw = textW(txt, 13) + 28;
      parts.push(`<rect x="${(W - tw) / 2}" y="${y}" width="${tw}" height="26" rx="13" fill="#D9D3C6"/>`);
      parts.push(`<text x="${W / 2}" y="${y + 18}" font-size="13" fill="#4E5160" text-anchor="middle">${esc(txt)}</text>`);
      y += 38; continue;
    }
    const col = (CAST[it.name] || [null, hashColor(it.name)])[1];
    // 아바타 (기본 01 얼굴 크롭)
    parts.push(avatarSvg(it.name, avs[it.name], 42, y + 22, 20, "av" + (k++)));
    // 이름
    parts.push(`<text x="76" y="${y + 14}" font-size="14" font-weight="700" fill="${INK}">${esc(it.name)}</text>`);
    let by = y + 22;
    const b = it.body;

    if (b === "[사진]") {
      parts.push(`<rect x="76" y="${by}" width="180" height="120" rx="12" fill="#D8D2C6"/>`);
      parts.push(`<text x="166" y="${by + 70}" font-size="30" text-anchor="middle">📷</text>`);
      by += 120;
    } else if (b === "[부재중]") {
      parts.push(`<rect x="76" y="${by}" width="220" height="44" rx="12" fill="#FDE8E6"/>`);
      parts.push(`<text x="92" y="${by + 28}" font-size="15" fill="#B3382F">📵 부재중 전화</text>`);
      by += 44;
    } else if (/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+$/u.test(b)) {   // 스티커(이모지만)
      parts.push(`<text x="80" y="${by + 52}" font-size="56">${esc(b)}</text>`);
      by += 66;
    } else {
      let quote = null, text = b;
      if (text.startsWith("↪")) {
        const cut = text.indexOf("｜", 1);
        if (cut > 0) { quote = text.slice(1, cut).trim(); text = text.slice(cut + 1).trim(); }
        else { quote = text.slice(1).trim(); text = ""; }
      }
      const ls = wrap(text);
      const qls = quote ? wrap(quote, 16) : [];
      const widest = Math.max(...ls.map(s => textW(s, 16)), ...qls.map(s => textW(s, 13) + 14), 40);
      const bw = Math.min(W - 120, widest + 32);
      const bh = 16 + ls.length * 24 + (qls.length ? qls.length * 18 + 14 : 0);
      parts.push(`<path d="M76 ${by + 10} l-8 -8 l8 -4 z" fill="${BUBBLE}"/>`);
      parts.push(`<rect x="76" y="${by}" width="${bw}" height="${bh}" rx="14" fill="${BUBBLE}" stroke="#E4DED2"/>`);
      let ty = by + 8;
      if (qls.length) {
        parts.push(`<rect x="90" y="${ty + 4}" width="3" height="${qls.length * 18}" fill="${col}"/>`);
        qls.forEach((q, i) => parts.push(`<text x="100" y="${ty + 17 + i * 18}" font-size="13" fill="${SUB}">${esc(q)}</text>`));
        ty += qls.length * 18 + 10;
      }
      ls.forEach((s, i) => parts.push(`<text x="92" y="${ty + 19 + i * 24}" font-size="16" fill="${INK}">${esc(s)}</text>`));
      if (it.read) parts.push(`<text x="${76 + bw + 8}" y="${by + bh - 4}" font-size="11" fill="#9A9DA8">읽음 ${esc(it.read)}</text>`);
      by += bh;
    }
    y = by + 14;
  }
  if (!items.length) { parts.push(`<text x="${W / 2}" y="${y + 30}" font-size="15" fill="${SUB}" text-anchor="middle">(대화 없음)</text>`); y += 60; }

  // 하단
  y += 6;
  if (pg === 3 || typing) {
    if (typing) parts.push(`<text x="24" y="${y + 16}" font-size="13" fill="${SUB}">「${esc(typing)} 입력 중…」</text>`);
    y += 26;
    parts.push(`<rect x="0" y="${y}" width="${W}" height="56" fill="#FFFFFF" stroke="#E4DED2"/>`);
    parts.push(`<text x="18" y="${y + 36}" font-size="20" fill="#8A8D98">＋</text>`);
    parts.push(`<rect x="48" y="${y + 12}" width="${W - 150}" height="32" rx="16" fill="#F1ECE2"/>`);
    parts.push(`<text x="64" y="${y + 33}" font-size="14" fill="#A5A8B3">메시지 입력</text>`);
    parts.push(`<text x="${W - 88}" y="${y + 36}" font-size="20">☺</text>`);
    parts.push(`<text x="${W - 50}" y="${y + 36}" font-size="20">⚡</text>`);
    y += 56;
  } else {
    parts.push(`<text x="${W / 2}" y="${y + 16}" font-size="13" fill="#A5A8B3" text-anchor="middle">▼ 계속</text>`);
    y += 30;
  }
  const H = y + 10;
  const bg = `<rect width="${W}" height="${H}" fill="${BG}"/>`;
  return svg(bg + parts.join(""), H);
}

/* ---------- /v 리코LIVE ---------- */
async function renderLive(p) {
  const title = clean(p.get("t") || "리코LIVE", 40);
  const v = clean(p.get("v") || "", 10);
  const h = clean(p.get("h") || "", 10);
  const pg = Math.min(3, Math.max(1, parseInt(p.get("pg") || "1", 10) || 1));
  const ending = clean(p.get("e") || "", 80);
  const lines = splitLines(p.get("l"));

  const BG = "#15161C", PANEL = "#1F2129", INK = "#F2F2F5", SUB = "#9A9DAB", PINK = "#F26D8D";
  let parts = [], y = 0;

  // 헤더
  parts.push(`<rect width="${W}" height="60" fill="#0E0F14"/>`);
  parts.push(`<rect x="16" y="18" width="62" height="24" rx="6" fill="#E5322D"/>`);
  parts.push(`<text x="47" y="35" font-size="13" font-weight="800" fill="#FFF" text-anchor="middle">● LIVE</text>`);
  parts.push(`<text x="90" y="37" font-size="17" font-weight="700" fill="${INK}">${esc(title)}</text>`);
  parts.push(`<text x="${W - 16}" y="37" font-size="14" fill="${SUB}" text-anchor="end">👥 ${esc(v)}   ❤️ ${esc(h)}   ${pg}/3</text>`);
  y = 60;

  // 방송 화면 (리코 최근 멘트 자막)
  const mic = lines.filter(s => s.startsWith("🎤"));
  const last = mic.length ? after(mic[mic.length - 1], "🎤") : "";
  const silent = /^[…\.]+$/.test(last);
  parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A2C55"/><stop offset="1" stop-color="#1B3550"/></linearGradient></defs>`);
  parts.push(`<rect x="0" y="${y}" width="${W}" height="190" fill="url(#g)"/>`);
  const riko = await avatar("리코");
  parts.push(avatarSvg("리코", riko, 120, y + 95, 52, "avr"));
  if (silent) parts.push(`<circle cx="120" cy="${y + 95}" r="52" fill="#000" opacity="0.45"/>`);
  parts.push(`<text x="200" y="${y + 60}" font-size="13" fill="${SUB}">ON AIR · 리코</text>`);
  const cap = wrap(silent ? "……" : last, 22).slice(0, 3);
  cap.forEach((s, i) => parts.push(`<text x="200" y="${y + 92 + i * 26}" font-size="19" font-weight="${silent ? 400 : 700}" fill="${silent ? SUB : INK}">${esc(s)}</text>`));
  y += 190;

  // 채팅
  y += 12;
  for (const raw of lines) {
    if (raw.startsWith("🎤")) {
      const txt = after(raw, "🎤");
      const ls = wrap(txt, 24);
      const bh = 12 + ls.length * 22;
      parts.push(`<rect x="16" y="${y}" width="${W - 32}" height="${bh}" rx="10" fill="#2B1F2E"/>`);
      parts.push(`<rect x="16" y="${y}" width="4" height="${bh}" rx="2" fill="${PINK}"/>`);
      ls.forEach((s, i) => parts.push(`<text x="32" y="${y + 24 + i * 22}" font-size="15" fill="${INK}"><tspan fill="${PINK}" font-weight="700">🎀 리코</tspan>  ${esc(s)}</text>`));
      y += bh + 8; continue;
    }
    if (raw.startsWith("💰")) {
      const seg = after(raw, "💰").split("｜").map(s => s.trim());
      const amt = seg[0] || "", nick = seg[1] || "", msg = seg.slice(2).join(" ");
      const ls = wrap(msg, 22);
      const bh = 34 + ls.length * 20;
      parts.push(`<rect x="16" y="${y}" width="${W - 32}" height="${bh}" rx="10" fill="#3A2F12" stroke="#C9A23A"/>`);
      parts.push(`<text x="32" y="${y + 22}" font-size="14" font-weight="700" fill="#F1C651">💰 ${esc(amt)}  <tspan fill="#E8DDB5" font-weight="400">${esc(nick)}</tspan></text>`);
      ls.forEach((s, i) => parts.push(`<text x="32" y="${y + 46 + i * 20}" font-size="14" fill="#F5EFD8">${esc(s)}</text>`));
      y += bh + 8; continue;
    }
    if (raw.startsWith("🔔")) {
      const nick = after(raw, "🔔");
      parts.push(`<rect x="16" y="${y}" width="${W - 32}" height="28" rx="8" fill="#12303A"/>`);
      parts.push(`<text x="32" y="${y + 19}" font-size="13" fill="#7FD3E6">🔔 ${esc(nick)} 님이 구독했습니다</text>`);
      y += 36; continue;
    }
    if (raw.startsWith("⚡")) {
      const txt = after(raw, "⚡");
      parts.push(`<rect x="16" y="${y}" width="${W - 32}" height="28" rx="8" fill="#3D3A12"/>`);
      parts.push(`<text x="32" y="${y + 19}" font-size="13" font-weight="700" fill="#F5E14B">⚡ ${esc(txt)}</text>`);
      y += 36; continue;
    }
    const idx = raw.indexOf("｜");
    const nick = idx >= 0 ? raw.slice(0, idx).trim() : "익명";
    const msg = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
    const ls = wrap(msg, 26);
    const nc = hashColor(nick);
    ls.forEach((s, i) => parts.push(`<text x="24" y="${y + 18 + i * 21}" font-size="14" fill="#D6D7DE">${i === 0 ? `<tspan fill="${nc}" font-weight="700">${esc(nick)}</tspan>  ` : ""}${esc(s)}</text>`));
    y += ls.length * 21 + 6;
  }
  if (!lines.length) { parts.push(`<text x="${W / 2}" y="${y + 24}" font-size="14" fill="${SUB}" text-anchor="middle">(채팅 없음)</text>`); y += 40; }

  // 종료·본심 (pg 3)
  y += 8;
  if (pg === 3) {
    parts.push(`<rect x="0" y="${y}" width="${W}" height="2" fill="#33353F"/>`);
    parts.push(`<text x="24" y="${y + 30}" font-size="14" font-weight="700" fill="${SUB}">⏹ 방송 종료</text>`);
    y += 40;
    if (ending) {
      const ls = wrap(ending, 26);
      ls.forEach((s, i) => parts.push(`<text x="24" y="${y + 18 + i * 22}" font-size="15" font-style="italic" fill="#C9C4D8">${i === 0 ? "🎙 " : "   "}${esc(s)}</text>`));
      y += ls.length * 22 + 10;
    }
  } else {
    parts.push(`<rect x="16" y="${y}" width="${W - 32}" height="40" rx="20" fill="${PANEL}"/>`);
    parts.push(`<text x="36" y="${y + 25}" font-size="14" fill="#6E717E">채팅 입력…</text>`);
    parts.push(`<text x="${W - 40}" y="${y + 26}" font-size="16">💬</text>`);
    y += 50;
  }
  const H = y + 8;
  return svg(`<rect width="${W}" height="${H}" fill="${BG}"/>` + parts.join(""), H);
}

/* ---------- 라우팅 ---------- */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.searchParams;
    if (url.pathname === "/c") return renderChat(p);
    if (url.pathname === "/v") return renderLive(p);
    if (url.pathname === "/a") return renderAdjust(p);
    return new Response("ok: use /c, /v, /a?n=이름", { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
};
