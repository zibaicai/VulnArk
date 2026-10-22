// ============ 资产管理 ============
import { Assets } from '../api.js';
import { esc, fmtTime, importanceBadge, ASSET_TYPE, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

let curPage = 1;
const pageSize = 10;
const TYPE_ICON = { server: '🖥', database: '🗄', application: '📦', network: '🌐' };

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>资产管理</h1><div class="sub">管理系统资产信息和配置</div></div>
      <div class="page-actions">
        <button class="btn" id="a-import">⬆ 导入资产</button>
        <button class="btn btn-primary" id="a-add">+ 新增资产</button>
      </div>
    </div>
    <div id="a-stats"></div>
    <div class="card mb"><div class="card-title">搜索和筛选</div>
      <div class="filter-panel">
        <div class="form-item"><label>搜索资产</label><input class="input" id="af-kw" placeholder="资产名称、IP地址或域名"></div>
        <div class="form-item"><label>资产类型</label><select class="input" id="af-type"><option value="">全部</option>
          ${Object.entries(ASSET_TYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-item"><label>重要程度</label><select class="input" id="af-imp"><option value="">全部</option><option value="1">高</option><option value="2">中</option><option value="3">低</option></select></div>
        <div class="form-item"><label>状态</label><select class="input" id="af-st"><option value="">全部</option><option value="1">在线</option><option value="0">下线</option></select></div>
        <div class="form-item"><button class="btn btn-primary" id="af-search" style="width:100%">🔍 搜索</button></div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table"><thead><tr>
        <th>资产信息</th><th>类型</th><th>网络信息</th><th>指纹 / 环境</th><th>重要程度</th><th>负责人</th><th>更新时间</th><th>操作</th>
      </tr></thead><tbody id="a-tbody"></tbody></table></div>
      <div id="a-pager"></div>
    </div>`;

  loadStats();
  curPage = 1;
  ['af-kw', 'af-type', 'af-imp', 'af-st'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { curPage = 1; fetchRows(); } }));
  document.getElementById('af-search').onclick = () => { curPage = 1; fetchRows(); };
  document.getElementById('a-add').onclick = () => assetForm(null);
  document.getElementById('a-import').onclick = () => importForm();
  await fetchRows();

  async function loadStats() {
    try {
      const st = await Assets.stats();
      const box = document.getElementById('a-stats');
      const byType = st?.by_type || {};
      box.innerHTML = `<div class="stat-grid">
        <div class="stat-card stat-blue"><div><div class="label">总资产数</div><div class="value">${st?.total ?? 0}</div><div class="desc">在线 ${st?.by_status?.['1'] ?? st?.by_status?.[1] ?? '-'}</div></div></div>
        ${Object.entries(ASSET_TYPE).map(([k, name], i) => `<div class="stat-card ${['stat-purple', 'stat-red', 'stat-green', 'stat-blue'][i]}"><div><div class="label">${name}</div><div class="value">${byType[k] ?? 0}</div></div></div>`).join('')}
      </div>`;
    } catch (e) { /* ignore */ }
  }

  async function fetchRows() {
    const tbody = document.getElementById('a-tbody');
    tbody.innerHTML = '<tr><td colspan="8">' + spinner() + '</td></tr>';
    const q = {
      page: curPage, page_size: pageSize,
      keyword: document.getElementById('af-kw').value.trim(),
      type: document.getElementById('af-type').value,
      importance_level: document.getElementById('af-imp').value,
      status: document.getElementById('af-st').value,
    };
    Object.keys(q).forEach(k => { if (!q[k]) delete q[k]; });
    let res;
    try { res = await Assets.list(q); } catch (e) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty">${esc(e.message)}</div></td></tr>`; return; }
    const rows = res?.data || [];
    document.getElementById('a-pager').innerHTML = '';
    document.getElementById('a-pager').appendChild(pager(res?.total || 0, res?.page || curPage, res?.page_size || pageSize, p => { curPage = p; fetchRows(); }));
    tbody.innerHTML = rows.length ? rows.map(a => `
      <tr>
        <td><div class="cell-main">${esc(a.name)}</div><div class="cell-sub">${esc(a.system_name || a.description || a.business_line || '')}</div></td>
        <td><span class="badge st-new">${TYPE_ICON[a.type] || ''} ${ASSET_TYPE[a.type] || esc(a.type)}</span><div class="cell-sub">${esc(a.category || '')}</div></td>
        <td><div class="cell-sub">IP: ${esc(a.ip_address || '-')}</div>
            ${a.domain ? `<div class="cell-sub">域名: ${esc(a.domain)}</div>` : ''}
            ${a.port ? `<div class="cell-sub">端口: ${esc(a.port)}</div>` : ''}</td>
        <td><div class="cell-sub" title="${esc(a.fingerprint || '')}" style="max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.fingerprint || (a.os || '') + ' ' + (a.version || ''))}</div>
            <div class="cell-sub">${a.environment ? `<span class="tag-chip">${esc(a.environment)}</span>` : ''}${a.vuln_count ? `<span class="tag-chip" style="background:#fef2f2;color:#dc2626">${a.vuln_count} 个漏洞</span>` : ''}</div></td>
        <td>${importanceBadge(a.importance_level)}</td>
        <td class="muted">${esc(a.owner_name || a.owner?.real_name || a.department || '-')}<div class="cell-sub">${esc(a.department || '')}</div></td>
        <td class="muted">${fmtTime(a.updated_at)}</td>
        <td><div class="flex" style="gap:2px">
          <button class="btn-link" data-view='${esc(JSON.stringify(a))}'>👁</button>
          <button class="btn-link" data-edit='${esc(JSON.stringify(a))}'>✏️</button>
          <button class="btn-link danger" data-del="${a.id}">🗑</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="7">${emptyBox('没有符合条件的资产')}</td></tr>`;
    tbody.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => assetForm(JSON.parse(b.dataset.edit)));
    tbody.querySelectorAll('button[data-view]').forEach(b => b.onclick = () => {
      const a = JSON.parse(b.dataset.view);
      modal({
        title: `资产详情 - ${a.name}`,
        body: `<dl class="kv">
          <dt>名称</dt><dd>${esc(a.name)}</dd><dt>类型</dt><dd>${ASSET_TYPE[a.type] || esc(a.type)} ${esc(a.category || '')}</dd>
          <dt>IP 地址</dt><dd>${esc(a.ip_address || '-')}</dd><dt>域名</dt><dd>${esc(a.domain || '-')}</dd>
          <dt>端口</dt><dd>${esc(a.port || '-')}</dd><dt>操作系统</dt><dd>${esc(a.os || '-')} ${esc(a.version || '')}</dd>
          ${a.company ? `<dt>所属公司</dt><dd>${esc(a.company)}</dd>` : ''}
          ${a.system_name ? `<dt>业务系统</dt><dd>${esc(a.system_name)}</dd>` : ''}
          ${a.environment ? `<dt>环境</dt><dd>${esc(a.environment)}</dd>` : ''}
          ${a.fingerprint ? `<dt>资产指纹</dt><dd style="font-size:12px;line-height:1.6">${esc(a.fingerprint)}</dd>` : ''}
          ${a.services ? `<dt>开放服务</dt><dd>${esc(a.services)}</dd>` : ''}
          ${a.middleware ? `<dt>中间件</dt><dd>${esc(a.middleware)}</dd>` : ''}
          ${a.framework ? `<dt>开发框架</dt><dd>${esc(a.framework)}</dd>` : ''}
          ${a.owner_name ? `<dt>资产负责人</dt><dd>${esc(a.owner_name)}<div class="cell-sub">${esc(a.department || '')}</div></dd>` : ''}
          ${a.vuln_count ? `<dt>关联漏洞</dt><dd><b style="color:var(--high)">${a.vuln_count}</b> 个</dd>` : ''}
          <dt>部门</dt><dd>${esc(a.department || '-')}</dd><dt>业务线</dt><dd>${esc(a.business_line || '-')}</dd>
          <dt>重要程度</dt><dd>${importanceBadge(a.importance_level)}</dd>
          <dt>状态</dt><dd>${a.status === 1 ? '<span class="badge st-fixed">在线</span>' : '<span class="badge st-closed">下线</span>'}</dd>
          <dt>描述</dt><dd>${esc(a.description || '-')}</dd>
        </dl>`,
        footer: `<button class="btn" data-act="c">关闭</button>`,
        onMount(m, close) { m.querySelector('[data-act=c]').onclick = close; },
      });
    });
    tbody.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该资产吗？', async () => {
      try { await Assets.remove(b.dataset.del); toast('删除成功', 'success'); fetchRows(); loadStats(); } catch (e) { toast(e.message, 'error'); }
    }));
  }

  function assetForm(a) {
    modal({
      title: a ? '编辑资产' : '新增资产', size: 'lg',
      body: `<div class="form-grid">
        <div class="form-item"><label>资产名称<span class="req">*</span></label><input class="input" id="as-name" value="${esc(a?.name || '')}" placeholder="如 Web服务器-01"></div>
        <div class="form-item"><label>资产类型<span class="req">*</span></label><select class="input" id="as-type">
          ${Object.entries(ASSET_TYPE).map(([k, v]) => `<option value="${k}" ${a?.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="form-item"><label>分类</label><input class="input" id="as-cat" placeholder="如 web / mysql / java" value="${esc(a?.category || '')}"></div>
        <div class="form-item"><label>IP 地址</label><input class="input" id="as-ip" placeholder="192.168.1.100" value="${esc(a?.ip_address || '')}"></div>
        <div class="form-item"><label>域名</label><input class="input" id="as-domain" placeholder="web01.vulnark.com" value="${esc(a?.domain || '')}"></div>
        <div class="form-item"><label>端口</label><input class="input" id="as-port" placeholder="80,443" value="${esc(a?.port || '')}"></div>
        <div class="form-item"><label>操作系统</label><input class="input" id="as-os" placeholder="CentOS 7.9" value="${esc(a?.os || '')}"></div>
        <div class="form-item"><label>版本</label><input class="input" id="as-ver" value="${esc(a?.version || '')}"></div>
        <div class="form-item"><label>所属部门</label><input class="input" id="as-dept" placeholder="IT部门" value="${esc(a?.department || '')}"></div>
        <div class="form-item"><label>业务线</label><input class="input" id="as-biz" placeholder="核心业务" value="${esc(a?.business_line || '')}"></div>
        <div class="form-item"><label>重要程度</label><select class="input" id="as-imp">
          <option value="1" ${a?.importance_level === 1 ? 'selected' : ''}>高</option>
          <option value="2" ${a?.importance_level === 2 ? 'selected' : ''}>中</option>
          <option value="3" ${a?.importance_level === 3 || !a ? 'selected' : ''}>低</option></select></div>
        ${a ? `<div class="form-item"><label>状态</label><select class="input" id="as-st"><option value="1" ${a.status === 1 ? 'selected' : ''}>在线</option><option value="0" ${a.status === 0 ? 'selected' : ''}>下线</option></select></div>` : ''}
        <div class="form-item full"><label>描述</label><textarea class="input" id="as-desc" rows="2">${esc(a?.description || '')}</textarea></div>
      </div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">${a ? '保存修改' : '创建资产'}</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const d = {
            name: m.querySelector('#as-name').value.trim(),
            type: m.querySelector('#as-type').value,
            category: m.querySelector('#as-cat').value.trim(),
            ip_address: m.querySelector('#as-ip').value.trim(),
            domain: m.querySelector('#as-domain').value.trim(),
            port: m.querySelector('#as-port').value.trim(),
            os: m.querySelector('#as-os').value.trim(),
            version: m.querySelector('#as-ver').value.trim(),
            department: m.querySelector('#as-dept').value.trim(),
            business_line: m.querySelector('#as-biz').value.trim(),
            importance_level: +m.querySelector('#as-imp').value,
            description: m.querySelector('#as-desc').value.trim(),
          };
          if (a) d.status = +m.querySelector('#as-st').value;
          if (!d.name) return toast('请输入资产名称', 'warn');
          try { a ? await Assets.update(a.id, d) : await Assets.create(d); toast('保存成功', 'success'); close(); fetchRows(); loadStats(); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }

  function importForm() {
    modal({
      title: '批量导入资产', size: 'lg',
      body: `<p class="muted mb">粘贴 JSON 数组，每个对象至少包含 <code class="inline">name</code> 和 <code class="inline">type</code>（server/database/application/network）字段：</p>
      <textarea class="input" id="ai-json" rows="10" placeholder='[
  {"name": "Web服务器-02", "type": "server", "ip_address": "192.168.1.101", "importance_level": 2},
  {"name": "Redis数据库", "type": "database", "ip_address": "192.168.1.102", "category": "redis"}
]'></textarea>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">开始导入</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          let arr;
          try { arr = JSON.parse(m.querySelector('#ai-json').value); }
          catch (e) { return toast('JSON 格式错误：' + e.message, 'error'); }
          if (!Array.isArray(arr) || !arr.length) return toast('请输入非空的 JSON 数组', 'warn');
          try { const r = await Assets.import(arr); toast(`导入完成：成功 ${r?.success ?? r?.imported ?? arr.length} 个`, 'success'); close(); fetchRows(); loadStats(); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }
}
