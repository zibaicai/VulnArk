// ============ 漏洞管理：列表 / 详情 / 新建编辑 / 分配规则 ============
import { Vulns, Assets, Users, Rules, Assignments } from '../api.js';
import { esc, fmtTime, sevBadge, statusBadge, sevBars, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';
import { INTEL_ALL } from '../data/vuln-intel.js';

let curPage = 1;
const pageSize = 10;

// 漏洞 → 漏洞资料条目定位：优先用后端返回的 intel_id，否则用名称反查资料库
function intelIdOf(v) {
  if (v?.intel_id) return v.intel_id;
  const t = v?.vuln_type || v?.title || '';
  let best = '', bestLen = 0;
  for (const x of INTEL_ALL) {
    if (t.includes(x.name) && x.name.length > bestLen) { best = x.id; bestLen = x.name.length; }
  }
  return best;
}

// ================= 路由入口 =================
export async function render(view, params) {
  if (params[0] === 'new') return renderForm(view, null);
  if (params[0] && /^\d+$/.test(params[0])) {
    if (params[1] === 'edit') return renderForm(view, params[0]);
    return renderDetail(view, params[0]);
  }
  return renderList(view);
}

// ================= 列表 =================
async function renderList(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>漏洞管理</h1><div class="sub">管理系统安全漏洞和修复进度</div></div>
      <div class="page-actions">
        <button class="btn" id="v-auto-assign">⚡ 自动分配</button>
        <a class="btn btn-primary" href="#/vulnerabilities/new">+ 新增漏洞</a>
      </div>
    </div>
    <div class="tabs" id="v-tabs">
      <div class="tab active" data-t="list">漏洞列表</div>
      <div class="tab" data-t="rules">分配规则</div>
      <div class="tab" data-t="stats">分配统计</div>
    </div>
    <div id="v-body"></div>`;
  curPage = 1;
  const body = document.getElementById('v-body');
  document.querySelectorAll('#v-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#v-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    if (t.dataset.t === 'list') loadList();
    else if (t.dataset.t === 'rules') renderRules(body);
    else renderAssignStats(body);
  });
  document.getElementById('v-auto-assign').onclick = () => confirmDialog('将按分配规则把所有未分配漏洞自动指派给合适的负责人，确定执行？', async () => {
    try { const r = await Vulns.autoAssign({}); toast(`自动分配完成：处理 ${r?.assigned ?? r?.count ?? 0} 个漏洞`, 'success'); loadList(); }
    catch (e) { toast(e.message, 'error'); }
  }, '自动分配');
  await loadList();

  async function loadList() {
    body.innerHTML = spinner();
    const [assets, users] = await Promise.all([Assets.list({ page: 1, page_size: 50 }).catch(() => ({ data: [] })), Users.list({ page: 1, page_size: 50 }).catch(() => ({ data: [] }))]);
    const assetList = assets?.data || [];
    const userList = users?.data || [];
    body.innerHTML = `
      <div class="card mb"><div class="card-title">搜索和筛选</div>
        <div class="filter-panel">
          <div class="form-item"><label>搜索漏洞</label><input class="input" id="f-kw" placeholder="漏洞标题、CVE编号"></div>
          <div class="form-item"><label>严重程度</label><select class="input" id="f-sev"><option value="">全部</option><option value="1">严重</option><option value="2">高危</option><option value="3">中危</option><option value="4">低危</option></select></div>
          <div class="form-item"><label>状态</label><select class="input" id="f-st"><option value="">全部</option><option value="new">新建</option><option value="processing">处理中</option><option value="fixed">已修复</option><option value="verified">已验证</option><option value="closed">已关闭</option></select></div>
          <div class="form-item"><label>影响资产</label><select class="input" id="f-asset"><option value="">全部</option>${assetList.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
          <div class="form-item"><label>负责人</label><select class="input" id="f-assignee"><option value="">全部</option>${userList.map(u => `<option value="${u.id}">${esc(u.real_name || u.username)}</option>`).join('')}</select></div>
          <div class="form-item"><button class="btn btn-primary" id="f-search" style="width:100%">🔍 搜索</button></div>
        </div>
      </div>
      <div class="card">
        <div class="flex-between mb"><div class="card-title" style="margin:0">漏洞列表</div>
          <div class="flex"><button class="btn btn-sm" id="v-batch" disabled>批量指派选中项</button></div>
        </div>
        <div class="table-wrap"><table class="table"><thead><tr>
          <th style="width:34px"><input type="checkbox" id="v-selall"></th>
          <th>漏洞信息</th><th>严重程度</th><th>影响资产</th><th>负责人</th><th>状态</th><th>创建时间</th><th>操作</th>
        </tr></thead><tbody id="v-tbody"></tbody></table></div>
        <div id="v-pager"></div>
      </div>`;
    const bind = ['f-kw', 'f-sev', 'f-st', 'f-asset', 'f-assignee'];
    bind.forEach(id => document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { curPage = 1; fetchRows(); } }));
    document.getElementById('f-search').onclick = () => { curPage = 1; fetchRows(); };
    document.getElementById('v-selall').onchange = e => { document.querySelectorAll('.v-sel').forEach(c => c.checked = e.target.checked); updateBatchBtn(); };
    document.getElementById('v-batch').onclick = () => {
      const ids = [...document.querySelectorAll('.v-sel:checked')].map(c => +c.dataset.id);
      if (!ids.length) return;
      modal({
        title: `批量指派（${ids.length} 个漏洞）`, size: 'sm',
        body: `<div class="form-item"><label>指派给</label><select class="input" id="ba-user">${userList.map(u => `<option value="${u.id}">${esc(u.real_name || u.username)}（${esc(u.username)}）</option>`).join('')}</select></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">确定指派</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            try { await Vulns.batchAssign({ vulnerability_ids: ids, assignee_id: +m.querySelector('#ba-user').value }); toast('批量指派成功', 'success'); close(); fetchRows(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    };
    await fetchRows();
  }

  async function fetchRows() {
    const tbody = document.getElementById('v-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8">' + spinner() + '</td></tr>';
    const q = {
      page: curPage, page_size: pageSize,
      keyword: document.getElementById('f-kw').value.trim(),
      severity_level: document.getElementById('f-sev').value,
      status: document.getElementById('f-st').value,
      asset_id: document.getElementById('f-asset').value,
      assignee_id: document.getElementById('f-assignee').value,
    };
    Object.keys(q).forEach(k => { if (!q[k]) delete q[k]; });
    let res;
    try { res = await Vulns.list(q); } catch (e) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty">${esc(e.message)}</div></td></tr>`; return; }
    const rows = res?.data || [];
    document.getElementById('v-pager').innerHTML = '';
    document.getElementById('v-pager').appendChild(pager(res?.total || 0, res?.page || curPage, res?.page_size || pageSize, p => { curPage = p; fetchRows(); }));
    tbody.innerHTML = rows.length ? rows.map(v => `
      <tr>
        <td><input type="checkbox" class="v-sel" data-id="${v.id}" onchange="this.closest('table')&&0;window.__vb&&window.__vb()"></td>
        <td>${(() => { const iid = intelIdOf(v); return iid
          ? `<a class="cell-main vuln-link" href="#/intel/${esc(iid)}" title="点击查看该漏洞的资料：描述 + 修复建议">${esc(v.title)}</a>`
          : `<div class="cell-main">${esc(v.title)}</div>`; })()}
          <div class="cell-sub">${esc((((v.description || '').split('【漏洞描述】')[1]) || (v.description || '')).replace(/\n/g, ' ').trim().slice(0, 52))}</div>
          ${v.cve_id ? `<span class="cve-chip">${esc(v.cve_id)}</span>` : ''}${v.cnvd_id ? `<span class="cve-chip" style="background:#fef3c7;color:#d97706">${esc(v.cnvd_id)}</span>` : ''}
          ${v.vuln_type ? `<span class="tag-chip">${esc(v.vuln_type)}</span>` : ''}
        </td>
        <td>${sevBadge(v.severity_level, v.severity_level_text)}</td>
        <td><div class="cell-main" style="font-weight:500">${esc(v.asset?.name || '-')}</div>
          <div class="cell-sub">${esc(v.asset?.ip_address || '')} ${esc(v.asset?.system_name || v.asset?.category || v.asset?.type || '')}</div></td>
        <td>${v.assignee ? `<div class="flex" style="gap:6px">👤 ${esc(v.assignee.real_name || v.assignee.username)}</div>` : '<span class="muted">未分配</span>'}</td>
        <td>${statusBadge(v.status, v.status_text)}</td>
        <td class="muted">${fmtTime(v.created_at)}</td>
        <td><div class="flex" style="gap:2px">
          <a class="btn-link" href="#/vulnerabilities/${v.id}" title="查看">👁</a>
          <a class="btn-link" href="#/vulnerabilities/${v.id}/edit" title="编辑">✏️</a>
          <button class="btn-link danger" data-del="${v.id}" title="删除">🗑</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="8">${emptyBox('没有符合条件的漏洞')}</td></tr>`;
    tbody.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog(`确定删除漏洞 #${b.dataset.del} 吗？此操作不可恢复。`, async () => {
      try { await Vulns.remove(b.dataset.del); toast('删除成功', 'success'); fetchRows(); } catch (e) { toast(e.message, 'error'); }
    }, '删除漏洞'));
    tbody.querySelectorAll('.v-sel').forEach(c => c.onchange = updateBatchBtn);
    window.__vb = updateBatchBtn;
    updateBatchBtn();
  }

  function updateBatchBtn() {
    const n = document.querySelectorAll('.v-sel:checked').length;
    const btn = document.getElementById('v-batch');
    if (btn) { btn.disabled = !n; btn.textContent = n ? `批量指派选中项 (${n})` : '批量指派选中项'; }
  }
}

// ================= 分配规则 =================
async function renderRules(body) {
  body.innerHTML = spinner();
  const [rules, types] = await Promise.all([Rules.list({ page: 1, page_size: 50 }).catch(() => ({ data: [] })), Rules.types().catch(() => [])]);
  const ruleTypes = Array.isArray(types) ? types : (types?.data || []);
  const typeName = t => { const f = ruleTypes.find(x => (x.value || x.id) === t); return f?.label || f?.name || t; };
  body.innerHTML = `
    <div class="card">
      <div class="flex-between mb"><div class="card-title" style="margin:0">自动分配规则</div><button class="btn btn-primary btn-sm" id="rule-add">+ 新建规则</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>规则名称</th><th>类型</th><th>条件</th><th>目标负责人</th><th>优先级</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${(rules?.data || []).length ? rules.data.map(r => `<tr>
        <td class="cell-main">${esc(r.name)}</td><td>${esc(typeName(r.type || r.rule_type))}</td>
        <td class="muted">${esc(r.condition || r.condition_value || '-')}</td>
        <td>${esc(r.assignee?.real_name || r.target_user || '-')}</td>
        <td>${esc(r.priority ?? '-')}</td>
        <td><span class="badge ${r.enabled ? 'st-fixed' : 'st-closed'}">${r.enabled ? '启用' : '停用'}</span></td>
        <td><button class="btn-link" data-edit='${esc(JSON.stringify(r))}'>✏️</button><button class="btn-link danger" data-del="${r.id}">🗑</button></td>
      </tr>`).join('') : `<tr><td colspan="7">${emptyBox('暂无分配规则，新建规则后可使用自动分配')}</td></tr>`}
      </tbody></table></div>
    </div>`;
  const ruleForm = (r) => modal({
    title: r ? '编辑分配规则' : '新建分配规则',
    body: `<div class="form-grid">
      <div class="form-item full"><label>规则名称<span class="req">*</span></label><input class="input" id="r-name" value="${esc(r?.name || '')}"></div>
      <div class="form-item"><label>规则类型</label><select class="input" id="r-type">${ruleTypes.map(t => `<option value="${esc(t.value ?? t.id)}" ${((r?.type || r?.rule_type) === (t.value ?? t.id)) ? 'selected' : ''}>${esc(t.label || t.name)}</option>`).join('') || '<option value="severity">按严重程度</option>'}</select></div>
      <div class="form-item"><label>条件值</label><input class="input" id="r-cond" value="${esc(r?.condition || r?.condition_value || '')}" placeholder="如严重程度 1/2 或资产类型"></div>
      <div class="form-item"><label>优先级</label><input class="input" id="r-pri" type="number" value="${esc(r?.priority ?? 1)}"></div>
      <div class="form-item"><label>启用</label><select class="input" id="r-en"><option value="1" ${r?.enabled !== false ? 'selected' : ''}>启用</option><option value="0" ${r?.enabled === false ? 'selected' : ''}>停用</option></select></div>
    </div>`,
    footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
    onMount(m, close) {
      m.querySelector('[data-act=c]').onclick = close;
      m.querySelector('[data-act=ok]').onclick = async () => {
        const d = {
          name: m.querySelector('#r-name').value.trim(),
          type: m.querySelector('#r-type').value,
          condition: m.querySelector('#r-cond').value.trim(),
          priority: +m.querySelector('#r-pri').value || 1,
          enabled: m.querySelector('#r-en').value === '1',
        };
        if (!d.name) return toast('请输入规则名称', 'warn');
        try { r ? await Rules.update(r.id, d) : await Rules.create(d); toast('保存成功', 'success'); close(); renderRules(body); }
        catch (e) { toast(e.message, 'error'); }
      };
    },
  });
  body.querySelector('#rule-add').onclick = () => ruleForm(null);
  body.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => ruleForm(JSON.parse(b.dataset.edit)));
  body.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该分配规则？', async () => {
    try { await Rules.remove(b.dataset.del); toast('删除成功', 'success'); renderRules(body); } catch (e) { toast(e.message, 'error'); }
  }));
}

// ================= 分配统计 =================
async function renderAssignStats(body) {
  body.innerHTML = spinner();
  let st;
  try { st = await Assignments.stats(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
  const byUser = st?.by_assignee || st?.by_user || [];
  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card stat-blue"><div><div class="label">总分配次数</div><div class="value">${st?.total_assignments ?? st?.total ?? 0}</div></div></div>
      <div class="stat-card stat-green"><div><div class="label">自动分配</div><div class="value">${st?.auto_assigned ?? 0}</div></div></div>
      <div class="stat-card stat-purple"><div><div class="label">手动分配</div><div class="value">${st?.manual_assigned ?? 0}</div></div></div>
    </div>
    <div class="card"><div class="card-title">按负责人统计</div>
      ${Array.isArray(byUser) && byUser.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>负责人</th><th>分配数量</th></tr></thead><tbody>
        ${byUser.map(u => `<tr><td>${esc(u.name || u.assignee?.real_name || u.assignee)}</td><td>${u.count || u.value || 0}</td></tr>`).join('')}</tbody></table></div>`
      : emptyBox('暂无分配数据')}
    </div>`;
}

// ================= 漏洞详情 =================
async function renderDetail(view, id) {
  view.innerHTML = spinner();
  let v;
  try { v = await Vulns.get(id); } catch (e) { view.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
  const cat = v.owasp_category;
  const attachments = v.attachments || [];
  view.innerHTML = `
    <div class="page-header">
      <div><h1>${esc(v.title)} ${sevBadge(v.severity_level, v.severity_level_text)}</h1>
      <div class="sub">漏洞 #${v.id} · ${statusBadge(v.status, v.status_text)} · 创建于 ${fmtTime(v.created_at)}</div></div>
      <div class="page-actions">
        <button class="btn" id="vd-intel">📖 查看漏洞资料</button>
        <button class="btn" id="vd-status">🔄 状态流转</button>
        <button class="btn" id="vd-assign">👤 指派负责人</button>
        <a class="btn" href="#/vulnerabilities/${v.id}/edit">✏️ 编辑</a>
        <button class="btn btn-danger" id="vd-del">删除</button>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card">
          <div class="card-title">📋 漏洞描述</div>
          <p style="font-size:13.5px">${esc(v.description) || '<span class="muted">暂无描述</span>'}</p>
          ${v.cve_id || v.cnvd_id || cat ? `<div class="mt">
            ${v.cve_id ? `<span class="cve-chip">${esc(v.cve_id)}</span>` : ''}
            ${v.cnvd_id ? `<span class="cve-chip" style="background:#fef3c7;color:#d97706">${esc(v.cnvd_id)}</span>` : ''}
            ${cat ? `<span class="tag-chip">OWASP ${esc(cat.code)} ${esc(cat.name)}</span>` : ''}
          </div>` : ''}
          <div class="section-block"><h4>💥 影响范围</h4><pre>${esc(v.impact_scope) || '暂无'}</pre></div>
          <div class="section-block"><h4>🔁 复现步骤</h4><pre>${esc(v.reproduction_steps) || '暂无'}</pre></div>
          <div class="section-block"><h4>🛠 修复建议</h4><pre>${esc(v.fix_suggestion) || '暂无'}</pre></div>
        </div>
        <div class="card"><div class="card-title">🖼 漏洞截图 / 附件</div>
          ${attachments.length ? `<div class="attach-grid">${attachments.map(a => a.file_type && a.file_type.startsWith('image')
            ? `<img src="/${esc(a.file_path)}" onclick="window.open('/${esc(a.file_path)}')" title="${esc(a.original_name)}">`
            : `<a class="btn" href="/${esc(a.file_path)}" target="_blank">📎 ${esc(a.original_name)}</a>`).join('')}</div>` : emptyBox('暂无附件')}
        </div>
      </div>
      <div>
        <div class="card"><div class="card-title">ℹ️ 基本信息</div>
          <dl class="kv">
            <dt>CVSS 评分</dt><dd>${v.cvss_score != null ? `<b style="color:${v.cvss_score >= 9 ? 'var(--critical)' : v.cvss_score >= 7 ? 'var(--high)' : v.cvss_score >= 4 ? 'var(--medium)' : 'var(--low)'}">${v.cvss_score}</b>` : '-'}</dd>
            ${v.vuln_type ? `<dt>漏洞类型</dt><dd>${esc(v.vuln_type)}</dd>` : ''}
            ${v.source ? `<dt>发现方式</dt><dd>${esc(v.source)}</dd>` : ''}
            <dt>影响资产</dt><dd>${esc(v.asset?.name || '-')}<div class="cell-sub">${esc(v.asset?.ip_address || '')} ${esc(v.asset?.domain || '')}</div>
              <div class="cell-sub">${esc(v.asset?.system_name || '')} · ${esc(v.asset?.environment || '')}环境</div></dd>
            ${v.asset?.owner_name ? `<dt>资产负责人</dt><dd>${esc(v.asset.owner_name)}<div class="cell-sub">${esc(v.asset.department || '')}</div></dd>` : ''}
            ${(v.fingerprint || v.asset?.fingerprint) ? `<dt>资产指纹</dt><dd style="font-size:12px;line-height:1.5">${esc(v.fingerprint || v.asset.fingerprint)}</dd>` : ''}
            <dt>发现人</dt><dd>${esc(v.discoverer?.real_name || v.discoverer?.username || '-')}</dd>
            <dt>负责人</dt><dd>${esc(v.assignee?.real_name || v.assignee?.username || '未分配')}</dd>
            <dt>发现时间</dt><dd>${fmtTime(v.discovered_at)}</dd>
            <dt>指派时间</dt><dd>${fmtTime(v.assigned_at)}</dd>
            <dt>修复时间</dt><dd>${fmtTime(v.fixed_at)}</dd>
            <dt>验证时间</dt><dd>${fmtTime(v.verified_at)}</dd>
            <dt>关闭时间</dt><dd>${fmtTime(v.closed_at)}</dd>
          </dl>
        </div>
        <div class="card"><div class="card-title">🕓 时间线</div><div id="vd-timeline">${spinner()}</div></div>
      </div>
    </div>`;

  // 跳转到「漏洞资料」查看该漏洞的描述与修复建议
  document.getElementById('vd-intel').onclick = () => {
    const iid = intelIdOf(v);
    if (iid) location.hash = `#/intel/${iid}`;
    else { location.hash = `#/intel`; setTimeout(() => toast('未匹配到资料条目，已打开资料库，可手动搜索「' + (v.vuln_type || v.title) + '」', 'warn'), 300); }
  };
  // 状态流转
  document.getElementById('vd-status').onclick = () => modal({
    title: '更新漏洞状态', size: 'sm',
    body: `<div class="form-item"><label>新状态</label><select class="input" id="vs-sel">
      <option value="new" ${v.status === 'new' ? 'selected' : ''}>新建</option>
      <option value="processing" ${v.status === 'processing' ? 'selected' : ''}>处理中</option>
      <option value="fixed" ${v.status === 'fixed' ? 'selected' : ''}>已修复</option>
      <option value="verified" ${v.status === 'verified' ? 'selected' : ''}>已验证</option>
      <option value="closed" ${v.status === 'closed' ? 'selected' : ''}>已关闭</option></select></div>`,
    footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">确定</button>`,
    onMount(m, close) {
      m.querySelector('[data-act=c]').onclick = close;
      m.querySelector('[data-act=ok]').onclick = async () => {
        try { await Vulns.updateStatus(v.id, m.querySelector('#vs-sel').value); toast('状态已更新', 'success'); close(); renderDetail(view, id); }
        catch (e) { toast(e.message, 'error'); }
      };
    },
  });
  // 指派
  document.getElementById('vd-assign').onclick = async () => {
    let users;
    try { users = (await Users.list({ page: 1, page_size: 50 }))?.data || []; } catch (e) { users = []; }
    modal({
      title: '指派负责人', size: 'sm',
      body: `<div class="form-item"><label>负责人</label><select class="input" id="va-user">
        ${users.map(u => `<option value="${u.id}" ${v.assignee_id === u.id ? 'selected' : ''}>${esc(u.real_name || u.username)}（${esc(u.department || '-')}）</option>`).join('')}</select></div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">确定指派</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          try { await Vulns.assign(v.id, { assignee_id: +m.querySelector('#va-user').value }); toast('指派成功', 'success'); close(); renderDetail(view, id); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  };
  // 删除
  document.getElementById('vd-del').onclick = () => confirmDialog(`确定删除漏洞「${v.title}」吗？`, async () => {
    try { await Vulns.remove(v.id); toast('删除成功', 'success'); location.hash = '#/vulnerabilities'; } catch (e) { toast(e.message, 'error'); }
  });
  // 时间线
  try {
    const tl = await Vulns.timeline(id);
    const items = Array.isArray(tl) ? tl : (tl?.data || []);
    document.getElementById('vd-timeline').innerHTML = items.length ? `<div class="timeline">${items.map(t => `
      <div class="timeline-item"><div class="t-title">${esc(t.action || t.title || t.event || '操作')}</div>
      <div class="t-time">${fmtTime(t.created_at || t.time)}</div>
      ${t.description || t.detail ? `<div class="t-desc">${esc(t.description || t.detail)}</div>` : ''}
      ${t.operator?.real_name || t.user?.real_name ? `<div class="t-desc">操作人：${esc(t.operator?.real_name || t.user?.real_name)}</div>` : ''}</div>`).join('')}</div>` : emptyBox('暂无时间线记录');
  } catch (e) { document.getElementById('vd-timeline').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ================= 新建 / 编辑表单 =================
async function renderForm(view, id) {
  view.innerHTML = spinner();
  const [assets, cats] = await Promise.all([
    Assets.list({ page: 1, page_size: 50 }).catch(() => ({ data: [] })),
    Vulns.owaspCategories().catch(() => []),
  ]);
  const assetList = assets?.data || [];
  const catList = Array.isArray(cats) ? cats : (cats?.data || []);
  let v = null;
  if (id) {
    try { v = await Vulns.get(id); } catch (e) { view.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
  } else {
    // 从「漏洞资料」一键带入：标题 / 描述 / 等级 / 修复建议 / 编号
    const pre = sessionStorage.getItem('vulnark_intel_prefill');
    if (pre) {
      try { v = JSON.parse(pre); } catch (e) { v = null; }
      sessionStorage.removeItem('vulnark_intel_prefill');
      if (v) setTimeout(() => toast('已带入漏洞资料内容，补充资产后提交', 'success'), 100);
    }
  }
  view.innerHTML = `
    <div class="page-header">
      <div><h1>${id ? '✏️ 编辑漏洞' : '📝 新增漏洞'}</h1><div class="sub">${id ? `编辑漏洞 #${id}` : '填写漏洞详细信息，支持上传漏洞截图'}</div></div>
      <div class="page-actions"><a class="btn" href="${id ? `#/vulnerabilities/${id}` : '#/vulnerabilities'}">← 返回</a></div>
    </div>
    <div class="card">
      <div class="form-grid">
        <div class="form-item full"><label>漏洞标题<span class="req">*</span></label>
          <input class="input" id="vf-title" maxlength="255" placeholder="简要描述漏洞，如：某系统存在SQL注入漏洞" value="${esc(v?.title || '')}"></div>
        <div class="form-item full"><label>漏洞描述<span class="req">*</span></label>
          <textarea class="input" id="vf-desc" rows="5" placeholder="详细描述漏洞产生的原因、危害及可能造成的损失…">${esc(v?.description || '')}</textarea></div>
        <div class="form-item"><label>严重程度<span class="req">*</span></label>
          <select class="input" id="vf-sev">
            <option value="1" ${v?.severity_level === 1 ? 'selected' : ''}>严重 (Critical)</option>
            <option value="2" ${v?.severity_level === 2 ? 'selected' : ''}>高危 (High)</option>
            <option value="3" ${v?.severity_level === 3 || !v ? 'selected' : ''}>中危 (Medium)</option>
            <option value="4" ${v?.severity_level === 4 ? 'selected' : ''}>低危 (Low)</option></select></div>
        <div class="form-item"><label>CVSS 评分 (0-10)</label>
          <input class="input" id="vf-cvss" type="number" step="0.1" min="0" max="10" placeholder="如 9.8" value="${v?.cvss_score ?? ''}"></div>
        <div class="form-item"><label>CVE 编号</label><input class="input" id="vf-cve" placeholder="CVE-2024-XXXXX" value="${esc(v?.cve_id || '')}"></div>
        <div class="form-item"><label>CNVD 编号</label><input class="input" id="vf-cnvd" placeholder="CNVD-2024-XXXXX" value="${esc(v?.cnvd_id || '')}"></div>
        <div class="form-item"><label>OWASP 分类</label><select class="input" id="vf-owasp">
          <option value="">未分类</option>
          ${catList.map(c => `<option value="${c.id}" ${v?.owasp_category_id === c.id ? 'selected' : ''}>${esc(c.code)} - ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="form-item"><label>影响资产<span class="req">*</span></label>
          <select class="input" id="vf-asset"><option value="">请选择资产</option>
          ${assetList.map(a => `<option value="${a.id}" ${v?.asset_id === a.id ? 'selected' : ''}>${esc(a.name)}（${esc(a.ip_address || a.domain || a.type)}）</option>`).join('')}</select>
          <div class="hint">没有目标资产？<a href="#/assets">先去新增资产</a></div></div>
        <div class="form-item"><label>指派负责人</label><select class="input" id="vf-assignee"><option value="">暂不指派</option></select></div>
        <div class="form-item full"><label>影响范围</label>
          <textarea class="input" id="vf-impact" rows="2" placeholder="受影响的 URL、端口、功能模块等">${esc(v?.impact_scope || '')}</textarea></div>
        <div class="form-item full"><label>复现步骤</label>
          <textarea class="input" id="vf-steps" rows="5" placeholder="1. 访问 http://target/xxx&#10;2. 构造 payload: ' OR 1=1--&#10;3. 观察响应…">${esc(v?.reproduction_steps || '')}</textarea></div>
        <div class="form-item full"><label>修复建议</label>
          <textarea class="input" id="vf-fix" rows="4" placeholder="如：对用户输入进行参数化查询、升级组件版本、添加访问控制…">${esc(v?.fix_suggestion || '')}</textarea></div>
        ${!id ? `<div class="form-item full"><label>漏洞截图</label>
          <input class="input" id="vf-files" type="file" accept="image/*" multiple>
          <div class="hint">支持多张截图，随漏洞一起上传作为证据</div></div>` : ''}
      </div>
      <div class="flex mt" style="justify-content:flex-end">
        <a class="btn" href="${id ? `#/vulnerabilities/${id}` : '#/vulnerabilities'}">取消</a>
        <button class="btn btn-primary" id="vf-save">${id ? '保存修改' : '提交漏洞'}</button>
      </div>
    </div>`;
  // 负责人选项
  Users.list({ page: 1, page_size: 50 }).then(res => {
    const sel = document.getElementById('vf-assignee');
    if (sel) (res?.data || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = `${u.real_name || u.username}（${u.department || '-'}）`;
      if (v?.assignee_id === u.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }).catch(() => {});
  document.getElementById('vf-save').onclick = async () => {
    const data = {
      title: document.getElementById('vf-title').value.trim(),
      description: document.getElementById('vf-desc').value.trim(),
      severity_level: +document.getElementById('vf-sev').value,
      asset_id: +document.getElementById('vf-asset').value || 0,
      cve_id: document.getElementById('vf-cve').value.trim(),
      cnvd_id: document.getElementById('vf-cnvd').value.trim(),
      impact_scope: document.getElementById('vf-impact').value.trim(),
      reproduction_steps: document.getElementById('vf-steps').value.trim(),
      fix_suggestion: document.getElementById('vf-fix').value.trim(),
    };
    const cvss = document.getElementById('vf-cvss').value;
    if (cvss !== '') data.cvss_score = parseFloat(cvss);
    const owasp = document.getElementById('vf-owasp').value;
    if (owasp) data.owasp_category_id = +owasp;
    const assignee = document.getElementById('vf-assignee').value;
    if (assignee) data.assignee_id = +assignee;
    if (!data.title) return toast('请填写漏洞标题', 'warn');
    if (!data.description) return toast('请填写漏洞描述', 'warn');
    if (!data.asset_id) return toast('请选择影响资产', 'warn');
    const btn = document.getElementById('vf-save');
    btn.disabled = true; btn.textContent = '提交中…';
    try {
      if (id) {
        await Vulns.update(id, data);
        toast('漏洞已更新', 'success');
        location.hash = `#/vulnerabilities/${id}`;
      } else {
        const fd = new FormData();
        fd.append('data', JSON.stringify(data));
        const files = document.getElementById('vf-files').files;
        for (const f of files) fd.append('screenshots', f);
        const created = await Vulns.create(fd);
        toast('漏洞提交成功', 'success');
        location.hash = `#/vulnerabilities/${created?.id || ''}`;
      }
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = id ? '保存修改' : '提交漏洞';
    }
  };
}
