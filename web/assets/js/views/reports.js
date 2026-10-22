// ============ 报告管理 ============
import { Reports, Assets } from '../api.js';
import { esc, fmtTime, fmtSize, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

let curPage = 1;
const pageSize = 10;
const RTYPE = { penetration_test: '渗透测试', vulnerability_assessment: '漏洞评估', security_audit: '安全审计', compliance_check: '合规检查', other: '其他' };
const RSEV = { critical: ['严重', 'sev-1'], high: ['高危', 'sev-2'], medium: ['中危', 'sev-3'], low: ['低危', 'sev-4'], info: ['信息', 'st-new'] };

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>报告管理</h1><div class="sub">管理安全测试报告和文档</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="r-upload">⬆ 上传报告</button></div>
    </div>
    <div class="card mb"><div class="card-title">搜索和筛选</div>
      <div class="filter-panel">
        <div class="form-item"><label>搜索报告</label><input class="input" id="rf-kw" placeholder="报告标题或描述"></div>
        <div class="form-item"><label>报告类型</label><select class="input" id="rf-type"><option value="">全部</option>
          ${Object.entries(RTYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-item"><label>严重程度</label><select class="input" id="rf-sev"><option value="">全部</option>
          ${Object.entries(RSEV).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="form-item"><label>状态</label><select class="input" id="rf-st"><option value="">全部</option>
          <option value="draft">草稿</option><option value="pending_review">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option><option value="archived">已归档</option></select></div>
        <div class="form-item"><button class="btn btn-primary" id="rf-search" style="width:100%">🔍 搜索</button></div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table"><thead><tr>
        <th>报告信息</th><th>类型</th><th>严重程度</th><th>文件信息</th><th>测试日期</th><th>创建时间</th><th>操作</th>
      </tr></thead><tbody id="r-tbody"></tbody></table></div>
      <div id="r-pager"></div>
    </div>`;
  curPage = 1;
  ['rf-kw', 'rf-type', 'rf-sev', 'rf-st'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { curPage = 1; fetchRows(); } }));
  document.getElementById('rf-search').onclick = () => { curPage = 1; fetchRows(); };
  document.getElementById('r-upload').onclick = uploadForm;
  await fetchRows();

  async function fetchRows() {
    const tbody = document.getElementById('r-tbody');
    tbody.innerHTML = '<tr><td colspan="7">' + spinner() + '</td></tr>';
    const q = {
      page: curPage, page_size: pageSize,
      keyword: document.getElementById('rf-kw').value.trim(),
      type: document.getElementById('rf-type').value,
      severity: document.getElementById('rf-sev').value,
      status: document.getElementById('rf-st').value,
    };
    Object.keys(q).forEach(k => { if (!q[k]) delete q[k]; });
    let res;
    try { res = await Reports.list(q); } catch (e) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty">${esc(e.message)}</div></td></tr>`; return; }
    const rows = res?.data || [];
    document.getElementById('r-pager').innerHTML = '';
    document.getElementById('r-pager').appendChild(pager(res?.total || 0, res?.page || curPage, res?.page_size || pageSize, p => { curPage = p; fetchRows(); }));
    tbody.innerHTML = rows.length ? rows.map(r => {
      const sv = RSEV[r.severity] || [r.severity, 'st-closed'];
      return `<tr>
      <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.description || '')}</div>
        ${(r.tags || []).length ? `<div class="mt" style="margin-top:4px">${r.tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}</td>
      <td>${esc(RTYPE[r.type] || r.type)}</td>
      <td><span class="badge ${sv[1]}">${sv[0]}</span></td>
      <td><div class="cell-sub" style="font-size:12px">📄 ${esc(r.file_name)}</div><div class="cell-sub">${fmtSize(r.file_size)}</div></td>
      <td class="muted">${r.test_date ? fmtTime(r.test_date).slice(0, 10) : '-'}</td>
      <td class="muted">${fmtTime(r.created_at)}</td>
      <td><div class="flex" style="gap:2px">
        <button class="btn-link" data-view="${r.id}" title="详情">👁</button>
        <a class="btn-link" href="${Reports.downloadUrl(r.id)}" title="下载">⬇</a>
        ${r.status === 'draft' ? `<button class="btn-link" data-submit="${r.id}" title="提交审核">📤</button>` : ''}
        ${r.status === 'pending_review' ? `<button class="btn-link" data-review="${r.id}" title="审核">✅</button>` : ''}
        ${r.status !== 'archived' ? `<button class="btn-link" data-archive="${r.id}" title="归档">📦</button>` : ''}
        <button class="btn-link danger" data-del="${r.id}" title="删除">🗑</button>
      </div></td></tr>`;
    }).join('') : `<tr><td colspan="7">${emptyBox('暂无报告，点击右上角上传报告')}</td></tr>`;
    tbody.querySelectorAll('button[data-view]').forEach(b => b.onclick = () => viewReport(b.dataset.view));
    tbody.querySelectorAll('button[data-submit]').forEach(b => b.onclick = () => confirmDialog('确定提交该报告进入审核流程？', async () => {
      try { await Reports.submit(b.dataset.submit); toast('已提交审核', 'success'); fetchRows(); } catch (e) { toast(e.message, 'error'); }
    }));
    tbody.querySelectorAll('button[data-archive]').forEach(b => b.onclick = () => confirmDialog('确定归档该报告？', async () => {
      try { await Reports.archive(b.dataset.archive); toast('已归档', 'success'); fetchRows(); } catch (e) { toast(e.message, 'error'); }
    }));
    tbody.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该报告？', async () => {
      try { await Reports.remove(b.dataset.del); toast('删除成功', 'success'); fetchRows(); } catch (e) { toast(e.message, 'error'); }
    }));
    tbody.querySelectorAll('button[data-review]').forEach(b => b.onclick = () => reviewForm(b.dataset.review));
  }

  function reviewForm(id) {
    modal({
      title: '审核报告', size: 'sm',
      body: `<div class="form-item"><label>审核结论</label><select class="input" id="rv-result"><option value="approved">通过</option><option value="rejected">驳回</option></select></div>
      <div class="form-item"><label>审核备注</label><textarea class="input" id="rv-notes" rows="3" placeholder="审核意见…"></textarea></div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">提交审核结果</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          try { await Reports.review(id, { status: m.querySelector('#rv-result').value, review_notes: m.querySelector('#rv-notes').value.trim() }); toast('审核完成', 'success'); close(); fetchRows(); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }

  async function viewReport(id) {
    modal({ title: '报告详情', body: spinner(), size: 'lg' });
    let r, content;
    try { r = await Reports.get(id); } catch (e) { document.querySelector('.modal-body').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    try { content = await Reports.content(id); } catch (e) { content = null; }
    const sv = RSEV[r.severity] || [r.severity, 'st-closed'];
    document.querySelector('.modal-body').innerHTML = `
      <dl class="kv">
        <dt>标题</dt><dd><b>${esc(r.title)}</b></dd>
        <dt>描述</dt><dd>${esc(r.description || '-')}</dd>
        <dt>类型</dt><dd>${esc(RTYPE[r.type] || r.type)}</dd>
        <dt>严重程度</dt><dd><span class="badge ${sv[1]}">${sv[0]}</span></dd>
        <dt>文件</dt><dd>📄 ${esc(r.file_name)}（${fmtSize(r.file_size)}）</dd>
        <dt>上传人</dt><dd>${esc(r.uploader?.real_name || r.uploader?.username || '-')}</dd>
        <dt>测试日期</dt><dd>${r.test_date ? fmtTime(r.test_date).slice(0, 10) : '-'}</dd>
        <dt>创建时间</dt><dd>${fmtTime(r.created_at)}</dd>
        ${r.reviewer ? `<dt>审核人</dt><dd>${esc(r.reviewer.real_name || r.reviewer.username)}</dd>` : ''}
        ${r.review_notes ? `<dt>审核备注</dt><dd>${esc(r.review_notes)}</dd>` : ''}
        ${content ? `<dt>报告内容</dt><dd><div class="section-block" style="margin-top:0"><pre>${esc(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre></div></dd>` : ''}
      </dl>`;
  }

  async function uploadForm() {
    let assetList = [];
    try { assetList = (await Assets.list({ page: 1, page_size: 50 }))?.data || []; } catch (e) { /* ignore */ }
    modal({
      title: '上传报告', size: 'lg',
      body: `<div class="form-grid">
        <div class="form-item"><label>报告文件<span class="req">*</span></label><input class="input" id="ru-file" type="file" accept=".pdf,.doc,.docx"></div>
        <div class="form-item"><label>报告标题<span class="req">*</span></label><input class="input" id="ru-title" placeholder="如 Web应用渗透测试报告"></div>
        <div class="form-item"><label>报告类型<span class="req">*</span></label><select class="input" id="ru-type">
          ${Object.entries(RTYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-item"><label>严重程度<span class="req">*</span></label><select class="input" id="ru-sev">
          ${Object.entries(RSEV).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="form-item"><label>测试日期</label><input class="input" id="ru-date" type="date"></div>
        <div class="form-item full"><label>报告描述</label><textarea class="input" id="ru-desc" rows="2"></textarea></div>
        <div class="form-item full"><label>关联资产</label><select class="input" id="ru-assets" multiple style="height:100px">
          ${assetList.map(a => `<option value="${a.id}">${esc(a.name)}（${esc(a.ip_address || '')}）</option>`).join('')}</select>
          <div class="hint">按住 Ctrl 可多选</div></div>
        <div class="form-item full"><label>标签</label><input class="input" id="ru-tags" placeholder="逗号分隔，如: 内网,Web,2026Q4"></div>
      </div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">上传报告</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const fileInput = m.querySelector('#ru-file');
          if (!fileInput.files.length) return toast('请选择报告文件', 'warn');
          const fd = new FormData();
          fd.append('file', fileInput.files[0]);
          fd.append('title', m.querySelector('#ru-title').value.trim());
          fd.append('description', m.querySelector('#ru-desc').value.trim());
          fd.append('type', m.querySelector('#ru-type').value);
          fd.append('severity', m.querySelector('#ru-sev').value);
          const date = m.querySelector('#ru-date').value;
          if (date) fd.append('test_date', date);
          const assets = [...m.querySelector('#ru-assets').selectedOptions].map(o => o.value).join(',');
          if (assets) fd.append('asset_ids', assets);
          const tags = m.querySelector('#ru-tags').value.trim();
          if (tags) fd.append('tags', tags);
          if (!fd.get('title')) return toast('请填写报告标题', 'warn');
          try { await Reports.upload(fd); toast('报告上传成功', 'success'); close(); fetchRows(); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }
}
