// ============ 知识库（文章 / 标签 / 模板） ============
import { Knowledge, Tags, Tpls } from '../api.js';
import { esc, fmtTime, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>知识库</h1><div class="sub">安全知识沉淀 · 漏洞案例 · 复现手册</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="k-add">+ 新建文章</button></div>
    </div>
    <div class="tabs" id="k-tabs">
      <div class="tab active" data-t="articles">📄 文章</div>
      <div class="tab" data-t="tags">🏷 标签</div>
      <div class="tab" data-t="templates">📋 模板</div>
    </div>
    <div id="k-body"></div>`;
  const body = document.getElementById('k-body');
  let cur = 'articles';
  document.querySelectorAll('#k-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#k-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); cur = t.dataset.t;
    if (cur === 'articles') renderArticles(); else if (cur === 'tags') renderTags(); else renderTpls();
  });
  document.getElementById('k-add').onclick = () => articleForm(null, () => cur === 'articles' && renderArticles());
  let page = 1;
  await renderArticles();

  // ---------- 文章 ----------
  async function renderArticles() {
    body.innerHTML = spinner();
    const [stats, popular] = await Promise.all([
      Knowledge.stats().catch(() => null),
      Knowledge.popular({ limit: 5 }).catch(() => []),
    ]);
    const pop = Array.isArray(popular) ? popular : (popular?.data || []);
    body.innerHTML = `
      ${stats ? `<div class="stat-grid">
        <div class="stat-card stat-blue"><div><div class="label">文章总数</div><div class="value">${stats.total ?? 0}</div></div></div>
        <div class="stat-card stat-green"><div><div class="label">已发布</div><div class="value">${stats.published ?? 0}</div></div></div>
        <div class="stat-card stat-purple"><div><div class="label">总阅读量</div><div class="value">${stats.total_views ?? stats.total_read ?? 0}</div></div></div>
        <div class="stat-card stat-red"><div><div class="label">总点赞数</div><div class="value">${stats.total_likes ?? 0}</div></div></div>
      </div>` : ''}
      <div class="detail-grid">
        <div class="card">
          <div class="filter-panel mb">
            <div class="form-item" style="grid-column: span 2"><label>搜索知识库</label><input class="input" id="kf-kw" placeholder="输入关键词搜索文章标题或内容"></div>
            <div class="form-item"><label>&nbsp;</label><button class="btn btn-primary" id="kf-search" style="width:100%">🔍 搜索</button></div>
          </div>
          <div id="k-list">${spinner()}</div>
        </div>
        <div class="card"><div class="card-title">🔥 热门文章</div>
          ${pop.length ? pop.map((p, i) => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer" data-open="${p.id}">
            <span style="font-size:13px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i] || '·'} ${esc(p.title)}</span>
            <span class="muted">${p.views ?? p.view_count ?? 0}阅</span></div>`).join('') : '<div class="empty">暂无热门文章</div>'}
        </div>
      </div>`;
    body.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openArticle(el.dataset.open));
    const doSearch = () => { page = 1; fetchArticles(); };
    document.getElementById('kf-search').onclick = doSearch;
    document.getElementById('kf-kw').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    await fetchArticles();
  }

  async function fetchArticles() {
    const box = document.getElementById('k-list');
    if (!box) return;
    box.innerHTML = spinner();
    const kw = document.getElementById('kf-kw')?.value.trim();
    let res;
    try { res = kw ? await Knowledge.search({ keyword: kw, page, page_size: 10 }) : await Knowledge.list({ page, page_size: 10 }); }
    catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const rows = res?.data || [];
    box.innerHTML = rows.length ? rows.map(a => `
      <div style="padding:13px 0;border-bottom:1px solid #f1f5f9">
        <div class="flex-between">
          <div style="cursor:pointer" data-open="${a.id}"><b>${esc(a.title)}</b>
            <div class="cell-sub">${esc((a.summary || a.content || '').slice(0, 80))}</div></div>
          <div class="flex" style="gap:2px;flex-shrink:0">
            ${a.status === 'draft' ? '<span class="badge st-draft">草稿</span>' : a.status === 'published' ? '<span class="badge st-fixed">已发布</span>' : a.status === 'archived' ? '<span class="badge st-archived">已归档</span>' : ''}
            <button class="btn-link" data-edit='${esc(JSON.stringify(a))}'>✏️</button>
            <button class="btn-link danger" data-del="${a.id}">🗑</button>
          </div>
        </div>
        <div class="flex mt" style="gap:12px;font-size:12px;color:var(--muted)">
          <span>👁 ${a.views ?? 0}</span><span>👍 ${a.likes ?? 0}</span><span>🕐 ${fmtTime(a.updated_at || a.created_at)}</span>
          ${(a.tags || []).slice(0, 3).map(t => `<span class="tag-chip">${esc(t.name || t)}</span>`).join('')}
        </div>
      </div>`).join('') + '<div id="k-pager"></div>' : emptyBox('暂无文章，点击右上角新建');
    box.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openArticle(el.dataset.open));
    box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => articleForm(JSON.parse(b.dataset.edit), () => cur === 'articles' && renderArticles()));
    box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该文章？', async () => {
      try { await Knowledge.remove(b.dataset.del); toast('删除成功', 'success'); renderArticles(); } catch (e) { toast(e.message, 'error'); }
    }));
    const pagerBox = box.querySelector('#k-pager');
    if (pagerBox) pagerBox.appendChild(pager(res?.total || 0, res?.page || page, res?.page_size || 10, p => { page = p; fetchArticles(); }));
  }

  async function openArticle(id) {
    modal({ title: '文章详情', body: spinner(), size: 'lg' });
    let a, related = [];
    try { a = await Knowledge.get(id); } catch (e) { document.querySelector('.modal-body').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    try { related = await Knowledge.related(id); } catch (e) { /* ignore */ }
    const rel = Array.isArray(related) ? related : (related?.data || []);
    document.querySelector('.modal-body').innerHTML = `
      <h3>${esc(a.title)}</h3>
      <div class="flex mt" style="gap:14px;font-size:12px;color:var(--muted)">
        <span>✍ ${esc(a.author?.real_name || a.author?.username || '-')}</span>
        <span>👁 ${a.views ?? 0}</span><span>👍 ${a.likes ?? 0}</span>
        <span>🕐 ${fmtTime(a.created_at)}</span>
      </div>
      <div class="section-block mt"><pre>${esc(a.content || '暂无内容')}</pre></div>
      ${(a.tags || []).length ? `<div class="mt">${a.tags.map(t => `<span class="tag-chip">${esc(t.name || t)}</span>`).join('')}</div>` : ''}
      ${rel.length ? `<div class="mt"><b style="font-size:13px">相关文章：</b>${rel.map(r => `<a href="javascript:void(0)" class="rel-link" data-id="${r.id}" style="margin-right:10px">${esc(r.title)}</a>`).join('')}</div>` : ''}`;
    document.querySelectorAll('.rel-link').forEach(l => l.onclick = () => openArticle(l.dataset.id));
    // 点赞
    const foot = document.querySelector('.modal-foot');
    if (foot) foot.innerHTML = `<button class="btn" id="k-like">👍 点赞</button><button class="btn btn-primary" data-act="c">关闭</button>`;
    else document.querySelector('.modal').insertAdjacentHTML('beforeend', `<div class="modal-foot"><button class="btn" id="k-like">👍 点赞</button><button class="btn btn-primary" data-act="c">关闭</button></div>`);
    document.querySelector('[data-act=c]').onclick = () => document.querySelector('.modal-mask').remove();
    document.getElementById('k-like').onclick = async () => {
      try { await Knowledge.like(id); toast('已点赞', 'success'); } catch (e) { toast(e.message, 'error'); }
    };
  }

  function articleForm(a, done) {
    modal({
      title: a ? '编辑文章' : '新建文章', size: 'lg',
      body: `<div class="form-grid">
        <div class="form-item full"><label>标题<span class="req">*</span></label><input class="input" id="ka-title" value="${esc(a?.title || '')}"></div>
        <div class="form-item full"><label>分类</label><input class="input" id="ka-cat" placeholder="如 漏洞复现 / 应急响应" value="${esc(a?.category || '')}"></div>
        <div class="form-item full"><label>内容<span class="req">*</span></label><textarea class="input" id="ka-content" rows="10" placeholder="支持纯文本 / Markdown 语法…">${esc(a?.content || '')}</textarea></div>
        <div class="form-item full"><label>标签</label><input class="input" id="ka-tags" placeholder="逗号分隔，如: SQL注入,复现" value="${esc((a?.tags || []).map(t => t.name || t).join(','))}"></div>
      </div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const d = {
            title: m.querySelector('#ka-title').value.trim(),
            content: m.querySelector('#ka-content').value,
            category: m.querySelector('#ka-cat').value.trim(),
            tags: m.querySelector('#ka-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          };
          if (!d.title || !d.content) return toast('标题和内容为必填', 'warn');
          try {
            if (a) await Knowledge.update(a.id, d); else await Knowledge.create(d);
            toast('保存成功', 'success'); close(); done && done();
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }

  // ---------- 标签 ----------
  async function renderTags() {
    body.innerHTML = `<div class="card"><div class="flex-between mb"><div class="card-title" style="margin:0">标签管理</div><button class="btn btn-primary btn-sm" id="tag-add">+ 新建标签</button></div><div id="tag-list">${spinner()}</div></div>`;
    document.getElementById('tag-add').onclick = () => tagForm(null);
    const list = async () => {
      const box = document.getElementById('tag-list');
      let res;
      try { res = await Tags.list({ page: 1, page_size: 50 }); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const rows = res?.data || [];
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>标签</th><th>名称</th><th>使用次数</th><th>操作</th></tr></thead><tbody>
        ${rows.map(t => `<tr><td><span class="tag-chip">${esc(t.color ? '●' : '#')} ${esc(t.name)}</span></td><td>${esc(t.name)}</td><td>${t.usage_count ?? t.count ?? 0}</td>
        <td><button class="btn-link" data-edit='${esc(JSON.stringify(t))}'>✏️</button><button class="btn-link danger" data-del="${t.id}">🗑</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('暂无标签');
      box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => tagForm(JSON.parse(b.dataset.edit)));
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该标签？', async () => {
        try { await Tags.remove(b.dataset.del); toast('删除成功', 'success'); list(); } catch (e) { toast(e.message, 'error'); }
      }));
    };
    await list();
    function tagForm(t) {
      modal({
        title: t ? '编辑标签' : '新建标签', size: 'sm',
        body: `<div class="form-item"><label>标签名称<span class="req">*</span></label><input class="input" id="tg-name" value="${esc(t?.name || '')}" placeholder="如 SQL注入"></div>
        <div class="form-item"><label>颜色</label><input class="input" id="tg-color" type="color" value="${esc(t?.color || '#2563eb')}"></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const d = { name: m.querySelector('#tg-name').value.trim(), color: m.querySelector('#tg-color').value };
            if (!d.name) return toast('请输入标签名称', 'warn');
            try { t ? await Tags.update(t.id, d) : await Tags.create(d); toast('保存成功', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
  }

  // ---------- 模板 ----------
  async function renderTpls() {
    body.innerHTML = `<div class="card"><div class="flex-between mb"><div class="card-title" style="margin:0">报告模板</div><button class="btn btn-primary btn-sm" id="tpl-add">+ 新建模板</button></div><div id="tpl-list">${spinner()}</div></div>`;
    document.getElementById('tpl-add').onclick = () => tplForm(null);
    const list = async () => {
      const box = document.getElementById('tpl-list');
      let res;
      try { res = await Tpls.list({ page: 1, page_size: 50 }); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const rows = res?.data || [];
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>模板名称</th><th>描述</th><th>使用次数</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
        ${rows.map(t => `<tr><td class="cell-main">${esc(t.name)}</td><td class="muted">${esc((t.description || t.content || '').slice(0, 50))}</td>
        <td>${t.use_count ?? 0}</td><td class="muted">${fmtTime(t.updated_at)}</td>
        <td><button class="btn-link" data-use="${t.id}" title="使用此模板">✅</button>
        <button class="btn-link" data-edit='${esc(JSON.stringify(t))}'>✏️</button><button class="btn-link danger" data-del="${t.id}">🗑</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('暂无模板');
      box.querySelectorAll('button[data-use]').forEach(b => b.onclick = async () => {
        try { const r = await Tpls.use(b.dataset.use); toast('已使用模板', 'success'); articleForm(r || { name: '' }, () => cur === 'templates' && renderTpls()); } catch (e) { toast(e.message, 'error'); }
      });
      box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => tplForm(JSON.parse(b.dataset.edit)));
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该模板？', async () => {
        try { await Tpls.remove(b.dataset.del); toast('删除成功', 'success'); list(); } catch (e) { toast(e.message, 'error'); }
      }));
    };
    await list();
    function tplForm(t) {
      modal({
        title: t ? '编辑模板' : '新建模板',
        body: `<div class="form-item"><label>模板名称<span class="req">*</span></label><input class="input" id="tp-name" value="${esc(t?.name || '')}"></div>
        <div class="form-item"><label>描述</label><input class="input" id="tp-desc" value="${esc(t?.description || '')}"></div>
        <div class="form-item"><label>模板内容</label><textarea class="input" id="tp-content" rows="8">${esc(t?.content || '')}</textarea></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const d = { name: m.querySelector('#tp-name').value.trim(), description: m.querySelector('#tp-desc').value.trim(), content: m.querySelector('#tp-content').value };
            if (!d.name) return toast('请输入模板名称', 'warn');
            try { t ? await Tpls.update(t.id, d) : await Tpls.create(d); toast('保存成功', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
  }
}
