// ============ UI 工具：toast / modal / 徽章 / SVG 图表 ============

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtTime(t) {
  if (!t || t === '0001-01-01T00:00:00Z') return '-';
  const d = new Date(t);
  if (isNaN(d)) return '-';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDate(t) { return fmtTime(t).split(' ')[0]; }
export function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = Number(bytes);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + ' ' + u[i];
}

// ---------- toast ----------
export function toast(msg, type = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

// ---------- modal ----------
export function modal({ title, body, footer, size = '' , onMount }) {
  const root = document.getElementById('modal-root');
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close">×</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  const close = () => mask.remove();
  mask.querySelector('.modal-close').onclick = close;
  mask.addEventListener('mousedown', e => { if (e.target === mask) close(); });
  root.appendChild(mask);
  if (onMount) onMount(mask, close);
  return { el: mask, close };
}

export function confirmDialog(msg, onOk, title = '确认操作') {
  modal({
    title, size: 'sm',
    body: `<p style="font-size:14px">${esc(msg)}</p>`,
    footer: `<button class="btn" data-act="cancel">取消</button><button class="btn btn-primary" data-act="ok">确定</button>`,
    onMount(m, close) {
      m.querySelector('[data-act=cancel]').onclick = close;
      m.querySelector('[data-act=ok]').onclick = async () => { close(); await onOk(); };
    },
  });
}

// ---------- 徽章 ----------
export const SEV = { 1: ['严重', 'sev-1'], 2: ['高危', 'sev-2'], 3: ['中危', 'sev-3'], 4: ['低危', 'sev-4'] };
export const STATUS = { new: ['新建', 'st-new'], processing: ['处理中', 'st-processing'], fixed: ['已修复', 'st-fixed'], verified: ['已验证', 'st-verified'], closed: ['已关闭', 'st-closed'] };
export const ASSET_TYPE = { server: '服务器', database: '数据库', application: '应用', network: '网络设备' };
export const REPORT_STATUS = { draft: ['草稿', 'st-draft'], pending_review: ['待审核', 'st-pending_review'], approved: ['已通过', 'st-approved'], rejected: ['已驳回', 'st-rejected'], archived: ['已归档', 'st-archived'] };

export const sevBadge = (lv, text) => { const s = SEV[lv] || ['未知', 'st-closed']; return `<span class="badge ${s[1]}"><span class="dot"></span>${esc(text || s[0])}</span>`; };
export const statusBadge = (st, text) => { const s = STATUS[st] || [text || st, 'st-closed']; return `<span class="badge ${s[1]}">${esc(text || s[0])}</span>`; };
export const reportStatusBadge = (st) => { const s = REPORT_STATUS[st] || [st, 'st-draft']; return `<span class="badge ${s[1]}">${esc(s[0])}</span>`; };
export const importanceBadge = (lv) => { const m = { 1: ['高', 'sev-1'], 2: ['中', 'sev-3'], 3: ['低', 'st-new'] }; const s = m[lv] || ['未知', 'st-closed']; return `<span class="badge ${s[1]}">${s[0]}</span>`; };

// ---------- 分页 ----------
export function pager(total, page, pageSize, onGo) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const wrap = document.createElement('div');
  wrap.className = 'pager';
  let btns = '';
  const add = (p, label, cur, dis) => `<button data-p="${p}" ${cur ? 'class="cur"' : ''} ${dis ? 'disabled' : ''}>${label}</button>`;
  btns += add(page - 1, '‹', false, page <= 1);
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i < start + 5 && i <= totalPages; i++) btns += add(i, i, i === page);
  btns += add(page + 1, '›', false, page >= totalPages);
  wrap.innerHTML = `<span>共 ${total} 条</span>${btns}`;
  wrap.querySelectorAll('button[data-p]').forEach(b => b.onclick = () => { const p = +b.dataset.p; if (p >= 1 && p <= totalPages && p !== page) onGo(p); });
  return wrap;
}

export function emptyBox(text = '暂无数据') {
  return `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 13V7a2 2 0 0 0-2-2h-3.5l-1-1.5h-3l-1 1.5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M16 17l2 2 4-4"/></svg><div>${esc(text)}</div></div>`;
}

// ---------- SVG 图表 ----------
const PALETTE = ['#2563eb', '#f97316', '#22c55e', '#eab308', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b'];

export function donutChart(items, { size = 210, thickness = 30, centerLabel = '', centerValue = '' } = {}) {
  const total = items.reduce((s, x) => s + x.value, 0);
  if (!total) return `<div class="empty">暂无数据</div>`;
  const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
  let offset = 0, segs = '';
  items.forEach((it, i) => {
    if (!it.value) return;
    const frac = it.value / total, len = frac * circ;
    segs += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color || PALETTE[i % PALETTE.length]}"
      stroke-width="${thickness}" stroke-dasharray="${len - 2} ${circ - len + 2}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${c} ${c})" stroke-linecap="round"><title>${esc(it.label)}: ${it.value}</title></circle>`;
    offset += len;
  });
  const legend = items.map((it, i) => `<span class="li"><span class="sw" style="background:${it.color || PALETTE[i % PALETTE.length]}"></span>${esc(it.label)} ${it.value}${it.percent !== undefined ? ` (${it.percent})` : ` (${(it.value / total * 100).toFixed(1)}%)`}</span>`).join('');
  return `<div class="chart-box" style="text-align:center">
    <svg viewBox="0 0 ${size} ${size}" style="width:${size}px;max-width:100%">
      ${segs}
      <text x="${c}" y="${c - 4}" text-anchor="middle" font-size="24" font-weight="700" fill="#1e293b">${esc(centerValue || total)}</text>
      <text x="${c}" y="${c + 18}" text-anchor="middle" font-size="12" fill="#64748b">${esc(centerLabel)}</text>
    </svg>
    <div class="legend">${legend}</div></div>`;
}

export function lineChart(points, { height = 220, color = '#2563eb', yLabel = '' } = {}) {
  if (!points || !points.length) return `<div class="empty">暂无数据</div>`;
  const w = 620, h = height, padL = 38, padB = 26, padT = 14, padR = 12;
  const maxV = Math.max(...points.map(p => p.value), 1);
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = i => padL + (points.length === 1 ? iw / 2 : i * iw / (points.length - 1));
  const y = v => padT + ih - (v / maxV) * ih;
  let grid = '', labels = '';
  for (let g = 0; g <= 4; g++) {
    const gv = maxV * g / 4, gy = y(gv);
    grid += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="#eef2f7"/><text x="${padL - 6}" y="${gy + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${Math.round(gv * 10) / 10}</text>`;
  }
  const step = Math.ceil(points.length / 8);
  points.forEach((p, i) => { if (i % step === 0 || i === points.length - 1) labels += `<text x="${x(i)}" y="${h - 8}" font-size="10" fill="#94a3b8" text-anchor="middle">${esc(p.label)}</text>`; });
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z`;
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"><title>${esc(p.label)}: ${p.value}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%">${grid}${labels}
    <path d="${area}" fill="${color}" opacity="0.08"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}</svg>`;
}

export function barChart(items, { height = 220, color = '#2563eb', horizontal = false } = {}) {
  if (!items || !items.length) return `<div class="empty">暂无数据</div>`;
  if (horizontal) {
    const maxV = Math.max(...items.map(i => i.value), 1);
    return `<div style="padding:4px 0">${items.map(it => `
      <div class="sev-bar-row"><span class="name" style="width:auto;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(it.label)}">${esc(it.label)}</span>
      <div class="sev-bar-track"><div class="sev-bar-fill" style="width:${it.value / maxV * 100}%;background:${it.color || color}"></div></div>
      <span class="num">${it.value}</span></div>`).join('')}</div>`;
  }
  const w = 620, h = height, padL = 36, padB = 40, padT = 14;
  const maxV = Math.max(...items.map(i => i.value), 1);
  const iw = w - padL - 12, ih = h - padT - padB;
  const bw = Math.min(38, iw / items.length * 0.6);
  let bars = '', labels = '';
  items.forEach((it, i) => {
    const cx = padL + (i + 0.5) * iw / items.length;
    const bh = it.value / maxV * ih;
    bars += `<rect x="${cx - bw / 2}" y="${padT + ih - bh}" width="${bw}" height="${bh}" rx="4" fill="${it.color || color}"><title>${esc(it.label)}: ${it.value}</title></rect>`;
    labels += `<text x="${cx}" y="${h - 20}" font-size="10.5" fill="#64748b" text-anchor="middle">${esc(it.label.length > 6 ? it.label.slice(0, 6) + '…' : it.label)}</text>`;
  });
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const gy = padT + ih - ih * g / 4;
    grid += `<line x1="${padL}" y1="${gy}" x2="${w - 12}" y2="${gy}" stroke="#eef2f7"/><text x="${padL - 6}" y="${gy + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${Math.round(maxV * g / 4 * 10) / 10}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%">${grid}${bars}${labels}</svg>`;
}

export function sevBars(counts) {
  // counts: {1:n,2:n,...}
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const conf = [[1, 'var(--critical)', '#dc2626'], [2, 'var(--high)', '#ea580c'], [3, 'var(--medium)', '#d97706'], [4, 'var(--low)', '#16a34a']];
  return conf.map(([lv, , hex]) => {
    const v = counts[lv] || 0;
    return `<div class="sev-bar-row"><span class="name">${SEV[lv][0]}</span>
      <div class="sev-bar-track"><div class="sev-bar-fill" style="width:${v / total * 100}%;background:${hex}"></div></div>
      <span class="num">${v} (${(v / total * 100).toFixed(0)}%)</span></div>`;
  }).join('');
}

export function spinner() { return '<div class="spinner"></div>'; }
