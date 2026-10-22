// ============ 漏洞资料（严重 / 高危 / 中危 / 低危 + 导入导出）============
import { INTEL_ALL, INTEL_LEVELS } from '../data/vuln-intel.js';
import { Knowledge } from '../api.js';
import { esc, toast, modal, confirmDialog, pager, emptyBox, spinner, sevBadge } from '../ui.js';

const LS_KEY = 'vulnark_intel_custom';

// ---------- 本地自定义条目 ----------
function loadCustom() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
}
function saveCustom(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

let CUSTOM = loadCustom();
let ALL = [...INTEL_ALL];

function refreshAll() { ALL = [...INTEL_ALL, ...CUSTOM]; }
refreshAll();

// ---------- CSV / JSON 解析 ----------
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) { row.push(cur); rows.push(row); row = []; cur = ''; if (c === '\r') i++; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => (x || '').trim() !== ''));
}

// 支持两种顺序：名称,类型,编号,描述,修复建议,标签  或  名称,描述,修复建议
function normalizeRows(rows, level) {
  const out = [];
  rows.forEach((r, idx) => {
    const cells = r.map(x => (x || '').trim());
    if (cells.length < 2) return;
    let name, category, cve, desc, fix, tags;
    if (cells.length >= 6) { [name, category, cve, desc, fix, tags] = cells; }
    else if (cells.length === 5) { [name, category, cve, desc, fix] = cells; }
    else if (cells.length === 3) { [name, desc, fix] = cells; }
    else { [name, desc, fix] = [cells[0], cells[1], cells[2] || '']; }
    if (!name) return;
    out.push({
      id: `c-${Date.now().toString(36)}-${idx}`,
      name, category: category || '自定义', cve: cve || '', level,
      levelText: INTEL_LEVELS.find(l => l.level === level)?.name || '',
      desc: desc || '', fix: fix || '',
      tags: (tags || '').split(/[,，;；]/).map(s => s.trim()).filter(Boolean),
      source: '我的导入',
    });
  });
  return out;
}

function parseImportText(text, level) {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith('[') || t.startsWith('{')) {
    let data = JSON.parse(t);
    if (!Array.isArray(data)) data = [data];
    return data.map((d, i) => ({
      id: `c-${Date.now().toString(36)}-${i}`,
      name: d.name || d.title || '',
      category: d.category || d.type || '自定义',
      cve: d.cve || d.cve_id || '',
      level: +d.level || level,
      levelText: INTEL_LEVELS.find(l => l.level === (+d.level || level))?.name || '',
      desc: d.desc || d.description || '',
      fix: d.fix || d.fix_suggestion || d.solution || '',
      tags: Array.isArray(d.tags) ? d.tags : String(d.tags || '').split(/[,，;；]/).map(s => s.trim()).filter(Boolean),
      source: '我的导入',
    })).filter(x => x.name);
  }
  const rows = parseCSV(t);
  // 去除 CSV 表头
  if (rows.length && /漏洞名称|^name$/i.test((rows[0][0] || '').trim())) rows.shift();
  return normalizeRows(rows, level);
}

// ---------- 主视图 ----------
// 支持 #/intel/<资料ID> 深链：从漏洞详情/列表点进来时自动定位并打开对应条目
export async function render(view, params) {
  return renderIntel(view, params?.[0] || '');
}

async function renderIntel(view, focusId) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>🗂 漏洞资料</h1><div class="sub">热门漏洞描述与修复建议速查 · 可直接带入漏洞工单</div></div>
      <div class="page-actions">
        <button class="btn" id="vi-sync">🔄 从知识库同步</button>
        <button class="btn" id="vi-export">📤 导出</button>
        <button class="btn" id="vi-import">📥 导入资料</button>
        <button class="btn btn-primary" id="vi-add">+ 新增资料</button>
      </div>
    </div>
    <div class="stat-grid" id="vi-stats"></div>
    <div class="tabs" id="vi-tabs"></div>
    <div class="card">
      <div class="filter-panel mb">
        <div class="form-item" style="grid-column: span 2"><label>搜索</label>
          <input class="input" id="vi-kw" placeholder="搜索漏洞名称 / 描述 / 修复建议 / 标签 / CVE"></div>
        <div class="form-item"><label>分类</label><select class="input" id="vi-cat"><option value="">全部分类</option></select></div>
        <div class="form-item"><label>&nbsp;</label><button class="btn btn-primary" id="vi-search" style="width:100%">🔍 查询</button></div>
      </div>
      <div id="vi-body"></div>
    </div>`;

  let level = 1, page = 1, kw = '', cat = '';

  const statsBox = document.getElementById('vi-stats');
  const renderStats = () => {
    statsBox.innerHTML = INTEL_LEVELS.map(l => {
      const n = ALL.filter(x => x.level === l.level).length;
      const mine = CUSTOM.filter(x => x.level === l.level).length;
      return `<div class="stat-card" style="cursor:pointer;border-left:4px solid ${l.color}" data-lv="${l.level}">
        <div><div class="label">${l.name}漏洞</div><div class="value" style="color:${l.color}">${n}</div>
        <div class="cell-sub">${mine ? `含导入 ${mine} 条` : '内置资料'}</div></div></div>`;
    }).join('');
    statsBox.querySelectorAll('[data-lv]').forEach(el => el.onclick = () => switchLevel(+el.dataset.lv));
  };

  const tabBox = document.getElementById('vi-tabs');
  const renderTabs = () => {
    tabBox.innerHTML = INTEL_LEVELS.map(l => `<div class="tab ${l.level === level ? 'active' : ''}" data-lv="${l.level}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${l.color};margin-right:6px"></span>${l.name}
      <span class="muted">(${ALL.filter(x => x.level === l.level).length})</span></div>`).join('');
    tabBox.querySelectorAll('.tab').forEach(t => t.onclick = () => switchLevel(+t.dataset.lv));
  };

  // 分类下拉
  const catSel = document.getElementById('vi-cat');
  const fillCats = () => {
    const cats = [...new Set(ALL.filter(x => x.level === level).map(x => x.category))].sort();
    catSel.innerHTML = `<option value="">全部分类（${cats.length}）</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (cat) catSel.value = cat;
  };

  function switchLevel(lv) {
    level = lv; page = 1; cat = '';
    renderTabs(); fillCats(); fetchList();
  }

  async function fetchList() {
    const box = document.getElementById('vi-body');
    box.innerHTML = spinner();
    const keyword = kw.trim().toLowerCase();
    let rows = ALL.filter(x => x.level === level);
    if (cat) rows = rows.filter(x => x.category === cat);
    if (keyword) rows = rows.filter(x =>
      (x.name + x.desc + x.fix + (x.tags || []).join(',') + x.cve + x.category).toLowerCase().includes(keyword));
    const pageSize = 15;
    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    box.innerHTML = slice.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th style="width:32%">漏洞名称</th><th>类型</th><th>编号</th><th>标签</th><th>来源</th><th style="width:150px">操作</th></tr></thead>
      <tbody>${slice.map(x => `<tr>
        <td class="cell-main" style="cursor:pointer" data-open="${esc(x.id)}">${esc(x.name)}
          <div class="cell-sub">${esc((x.desc || '').slice(0, 46))}…</div></td>
        <td>${esc(x.category)}</td>
        <td class="muted">${esc(x.cve || '-')}</td>
        <td>${(x.tags || []).slice(0, 2).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</td>
        <td>${x.source === '内置' ? '<span class="badge st-verified">内置</span>' : '<span class="badge st-processing">我的导入</span>'}</td>
        <td>
          <button class="btn-link" data-open="${esc(x.id)}" title="查看详情">查看</button>
          <button class="btn-link" data-use="${esc(x.id)}" title="带入新建漏洞">应用</button>
          ${x.source !== '内置' ? `<button class="btn-link danger" data-del="${esc(x.id)}">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table></div><div id="vi-pager"></div>`
      : emptyBox('该等级下暂无资料，可点击「导入资料」添加');
    box.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openDetail(el.dataset.open));
    box.querySelectorAll('[data-use]').forEach(el => el.onclick = () => applyToVuln(el.dataset.use));
    box.querySelectorAll('[data-del]').forEach(el => el.onclick = () => confirmDialog('确定删除这条导入的资料？', () => {
      CUSTOM = CUSTOM.filter(c => c.id !== el.dataset.del);
      saveCustom(CUSTOM); refreshAll(); renderStats(); renderTabs(); fetchList();
      toast('已删除', 'success');
    }));
    const pg = box.querySelector('#vi-pager');
    if (pg && total > pageSize) pg.appendChild(pager(total, page, pageSize, p => { page = p; fetchList(); }));
  }

  // ---------- 详情 ----------
  function openDetail(id) {
    const x = ALL.find(v => v.id === id);
    if (!x) return;
    modal({
      title: x.name, size: 'lg',
      body: `<div class="flex mb" style="gap:8px;flex-wrap:wrap">
          ${sevBadge(x.level, x.levelText)}
          <span class="badge st-new">${esc(x.category)}</span>
          ${x.cve ? `<span class="badge st-draft">${esc(x.cve)}</span>` : ''}
          ${(x.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}
        </div>
        <div class="section-block"><div class="card-title">📝 漏洞描述</div><pre style="white-space:pre-wrap">${esc(x.desc || '暂无描述')}</pre></div>
        <div class="section-block"><div class="card-title">🛠 修复建议</div><pre style="white-space:pre-wrap">${esc(x.fix || '暂无修复建议')}</pre></div>`,
      footer: `<button class="btn" data-act="cd">复制描述</button>
        <button class="btn" data-act="cf">复制修复建议</button>
        <button class="btn" data-act="kb">存入知识库</button>
        <button class="btn btn-primary" data-act="use">应用到新建漏洞</button>`,
      onMount(m, close) {
        const copy = (txt) => {
          navigator.clipboard?.writeText(txt).then(() => toast('已复制到剪贴板', 'success'))
            .catch(() => toast('复制失败，请手动选择文本', 'warn'));
        };
        m.querySelector('[data-act=cd]').onclick = () => copy(x.desc);
        m.querySelector('[data-act=cf]').onclick = () => copy(x.fix);
        m.querySelector('[data-act=kb]').onclick = async () => {
          try {
            await Knowledge.create({ title: x.name, category: x.category, content: `【漏洞描述】\n${x.desc}\n\n【修复建议】\n${x.fix}`, tags: x.tags });
            toast('已存入知识库', 'success');
          } catch (e) { toast('存入失败：' + e.message, 'error'); }
        };
        m.querySelector('[data-act=use]').onclick = () => { close(); applyToVuln(id); };
      },
    });
  }

  // ---------- 带入新建漏洞 ----------
  function applyToVuln(id) {
    const x = ALL.find(v => v.id === id);
    if (!x) return;
    sessionStorage.setItem('vulnark_intel_prefill', JSON.stringify({
      title: x.name,
      description: x.desc,
      severity_level: x.level,
      fix_suggestion: x.fix,
      cve_id: /^CVE/i.test(x.cve || '') ? x.cve : '',
      cnvd_id: /^CNVD/i.test(x.cve || '') ? x.cve : '',
      impact_scope: x.category,
    }));
    location.hash = '#/vulnerabilities/new';
  }

  // ---------- 新增单条 ----------
  function addForm() {
    modal({
      title: '新增漏洞资料', size: 'lg',
      body: `<div class="form-grid">
        <div class="form-item full"><label>漏洞名称<span class="req">*</span></label><input class="input" id="ia-name" placeholder="如：SQL 注入 - 联合查询注入"></div>
        <div class="form-item"><label>严重等级</label><select class="input" id="ia-lv">
          ${INTEL_LEVELS.map(l => `<option value="${l.level}" ${l.level === level ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>漏洞类型</label><input class="input" id="ia-cat" placeholder="如：注入 / 越权 / 安全配置"></div>
        <div class="form-item full"><label>漏洞描述</label><textarea class="input" id="ia-desc" rows="4" placeholder="漏洞原理、触发条件与实际危害…"></textarea></div>
        <div class="form-item full"><label>修复建议</label><textarea class="input" id="ia-fix" rows="4" placeholder="可落地的修复方案、配置与代码层建议…"></textarea></div>
        <div class="form-item"><label>编号（CVE/CNVD）</label><input class="input" id="ia-cve" placeholder="CVE-2021-44228"></div>
        <div class="form-item"><label>标签</label><input class="input" id="ia-tags" placeholder="逗号分隔，如：SQL注入,OWASP"></div>
      </div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = () => {
          const name = m.querySelector('#ia-name').value.trim();
          if (!name) return toast('请填写漏洞名称', 'warn');
          const lv = +m.querySelector('#ia-lv').value;
          CUSTOM.push({
            id: `c-${Date.now().toString(36)}`,
            name, category: m.querySelector('#ia-cat').value.trim() || '自定义',
            cve: m.querySelector('#ia-cve').value.trim(), level: lv,
            levelText: INTEL_LEVELS.find(l => l.level === lv)?.name || '',
            desc: m.querySelector('#ia-desc').value.trim(),
            fix: m.querySelector('#ia-fix').value.trim(),
            tags: m.querySelector('#ia-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
            source: '我的导入',
          });
          saveCustom(CUSTOM); refreshAll();
          level = lv; renderStats(); renderTabs(); fillCats(); fetchList();
          toast('已保存', 'success'); close();
        };
      },
    });
  }

  // ---------- 导入 ----------
  function importForm() {
    modal({
      title: '导入漏洞资料', size: 'lg',
      body: `<div class="form-item"><label>目标栏目（严重等级）</label><select class="input" id="im-lv">
          ${INTEL_LEVELS.map(l => `<option value="${l.level}" ${l.level === level ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>粘贴数据（JSON 数组 或 CSV）</label>
          <textarea class="input" id="im-text" rows="10" placeholder='JSON 示例：
[{"name":"SQL 注入","category":"注入","cve":"CVE-xxxx","desc":"描述…","fix":"修复建议…","tags":"SQL注入,OWASP"}]

CSV 示例（名称,类型,编号,描述,修复建议,标签）：
SQL 注入,注入,通用型,应用拼接 SQL 导致…,使用参数化查询…,SQL注入,OWASP'></textarea>
          <div class="hint">也可直接选择文件：<input type="file" id="im-file" accept=".json,.csv,.txt" style="margin-top:6px"></div></div>
        <div class="form-item"><label class="flex" style="gap:6px;align-items:center">
          <input type="checkbox" id="im-kb"> 同时保存到后端知识库（/api/v1/knowledge）</label>
          <div class="hint">导入后条目存于浏览器本地，勾选后会额外同步到服务端知识库，供全团队检索。</div></div>
        <div id="im-preview" class="mt"></div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">导入</button>`,
      onMount(m, close) {
        const ta = m.querySelector('#im-text');
        const pv = m.querySelector('#im-preview');
        const levelOf = () => +m.querySelector('#im-lv').value;
        const preview = () => {
          let items = [];
          try { items = parseImportText(ta.value, levelOf()); }
          catch (e) { pv.innerHTML = `<div class="empty" style="color:#dc2626">解析失败：${esc(e.message)}</div>`; return []; }
          pv.innerHTML = items.length
            ? `<div class="badge st-verified">解析到 ${items.length} 条</div>
               <div class="mt" style="max-height:150px;overflow:auto;font-size:12px;color:var(--muted)">
               ${items.slice(0, 10).map(i => `• ${esc(i.name)}（${esc(i.category)}）`).join('<br>')}
               ${items.length > 10 ? `<br>…等 ${items.length - 10} 条` : ''}</div>`
            : '<div class="hint">暂无可导入内容</div>';
          return items;
        };
        ta.addEventListener('input', () => { try { preview(); } catch (e) {} });
        m.querySelector('#im-file').onchange = async (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          ta.value = await f.text();
          preview();
        };
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const items = preview();
          if (!items.length) return toast('没有可导入的数据', 'warn');
          items.forEach(i => { i.level = levelOf(); i.levelText = INTEL_LEVELS.find(l => l.level === i.level)?.name || ''; });
          CUSTOM.push(...items);
          saveCustom(CUSTOM); refreshAll();
          level = levelOf();
          renderStats(); renderTabs(); fillCats(); fetchList();
          toast(`成功导入 ${items.length} 条资料`, 'success');
          if (m.querySelector('#im-kb').checked) {
            let ok = 0;
            for (const i of items) {
              try { await Knowledge.create({ title: i.name, category: i.category, content: `【漏洞描述】\n${i.desc}\n\n【修复建议】\n${i.fix}`, tags: i.tags }); ok++; }
              catch (e) { /* 继续 */ }
            }
            toast(`已同步 ${ok}/${items.length} 条到知识库`, ok ? 'success' : 'warn');
          }
          close();
        };
      },
    });
  }

  // ---------- 导出 ----------
  function exportData() {
    const rows = ALL.filter(x => x.level === level && (!cat || x.category === cat));
    const lvName = INTEL_LEVELS.find(l => l.level === level)?.name || '';
    const csv = ['漏洞名称,类型,编号,描述,修复建议,标签'].concat(
      rows.map(r => [r.name, r.category, r.cve, r.desc, r.fix, (r.tags || []).join(' ')]
        .map(s => `"${String(s || '').replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `漏洞资料-${lvName}-${rows.length}条.csv`;
    a.click();
    toast(`已导出 ${rows.length} 条`, 'success');
  }

  // ---------- 从知识库同步 ----------
  async function syncFromKnowledge() {
    let res;
    try { res = await Knowledge.list({ page: 1, page_size: 100 }); }
    catch (e) { return toast('同步失败：' + e.message, 'error'); }
    const rows = res?.data || [];
    if (!rows.length) return toast('知识库暂无文章', 'warn');
    const items = rows.map((a, i) => ({
      id: `k-${a.id}`, name: a.title || `知识库文章 #${a.id}`,
      category: a.category || '知识库', cve: '', level,
      levelText: INTEL_LEVELS.find(l => l.level === level)?.name || '',
      desc: (a.summary || a.content || '').slice(0, 500), fix: '',
      tags: (a.tags || []).map(t => t.name || t), source: '我的导入',
    }));
    CUSTOM.push(...items);
    saveCustom(CUSTOM); refreshAll();
    renderStats(); renderTabs(); fillCats(); fetchList();
    toast(`已从知识库同步 ${items.length} 条`, 'success');
  }

  // ---------- 绑定 ----------
  document.getElementById('vi-add').onclick = addForm;
  document.getElementById('vi-import').onclick = importForm;
  document.getElementById('vi-export').onclick = exportData;
  document.getElementById('vi-sync').onclick = syncFromKnowledge;
  const doSearch = () => { kw = document.getElementById('vi-kw').value; page = 1; fetchList(); };
  document.getElementById('vi-search').onclick = doSearch;
  document.getElementById('vi-kw').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  catSel.onchange = () => { cat = catSel.value; page = 1; fetchList(); };

  renderStats(); renderTabs(); fillCats();
  await fetchList();

  // 深链定位：切到对应等级并直接弹出该条资料详情
  if (focusId) {
    const item = ALL.find(x => x.id === focusId);
    if (item) {
      level = item.level; page = 1;
      renderTabs(); fillCats();
      await fetchList();
      openDetail(focusId);
    } else {
      const kw2 = decodeURIComponent(focusId);
      document.getElementById('vi-kw').value = kw2;
      kw = kw2; fetchList();
      toast('未找到该资料条目，已按关键词搜索', 'warn');
    }
  }
}
