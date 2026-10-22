// ============ 通知中心 ============
import { Notifications } from '../api.js';
import { esc, fmtTime, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>通知中心</h1><div class="sub">站内通知管理与发送</div></div>
      <div class="page-actions">
        <button class="btn" id="n-readall">✅ 全部已读</button>
        <button class="btn btn-primary" id="n-create">✉ 新建通知</button>
      </div>
    </div>
    <div class="tabs" id="n-tabs">
      <div class="tab active" data-t="all">全部通知</div>
      <div class="tab" data-t="unread">未读</div>
    </div>
    <div class="card"><div id="n-list">${spinner()}</div><div id="n-pager"></div></div>`;
  let page = 1, mode = 'all';
  document.querySelectorAll('#n-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#n-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); mode = t.dataset.t; page = 1; fetchList();
  });
  document.getElementById('n-readall').onclick = () => confirmDialog('将所有通知标记为已读？', async () => {
    try { await Notifications.markAllRead(); toast('已全部标记为已读', 'success'); fetchList(); } catch (e) { toast(e.message, 'error'); }
  });
  document.getElementById('n-create').onclick = () => createForm();
  await fetchList();

  async function fetchList() {
    const box = document.getElementById('n-list');
    box.innerHTML = spinner();
    let res;
    try {
      res = mode === 'my'
        ? await Notifications.my({ page, page_size: 15 })
        : await Notifications.list({ page, page_size: 15 });
    } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const rows = res?.data || [];
    document.getElementById('n-pager').innerHTML = '';
    document.getElementById('n-pager').appendChild(pager(res?.total || 0, res?.page || page, res?.page_size || 15, p => { page = p; fetchList(); }));
    box.innerHTML = rows.length ? rows.map(n => `
      <div class="dm-item ${n.is_read ? '' : 'unread'}" style="border-radius:8px" data-id="${n.id}">
        <div class="dm-title"><span>${esc(n.title)}</span><span class="dm-time">${fmtTime(n.created_at)}</span></div>
        <div class="dm-body">${esc(n.content || '')}</div>
        <div class="flex mt" style="gap:8px;font-size:12px">
          <span class="badge ${n.type === 'email' ? 'st-new' : n.type === 'alert' ? 'sev-2' : 'st-closed'}">${esc(n.type || 'system')}</span>
          ${n.is_read ? '' : '<span class="badge st-processing">未读</span>'}
          ${!n.is_read ? `<button class="btn-link" data-read="${n.id}">标记已读</button>` : ''}
          <button class="btn-link danger" data-del="${n.id}">删除</button>
        </div>
      </div>`).join('') : emptyBox('暂无通知');
    box.querySelectorAll('[data-read]').forEach(b => b.onclick = async () => {
      try { await Notifications.markRead(b.dataset.read); toast('已标记为已读', 'success'); fetchList(); } catch (e) { toast(e.message, 'error'); }
    });
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该通知？', async () => {
      try { await Notifications.remove(b.dataset.del); toast('删除成功', 'success'); fetchList(); } catch (e) { toast(e.message, 'error'); }
    }));
    box.querySelectorAll('.dm-item').forEach(item => item.onclick = async e => {
      if (e.target.closest('button')) return;
      try {
        const n = await Notifications.get(item.dataset.id);
        modal({
          title: n?.title || '通知详情', size: 'sm',
          body: `<p style="font-size:13.5px">${esc(n?.content || '')}</p><p class="muted mt">${fmtTime(n?.created_at)}</p>`,
          footer: `<button class="btn btn-primary" data-act="c">关闭</button>`,
          onMount(m, close) { m.querySelector('[data-act=c]').onclick = close; },
        });
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function createForm() {
    modal({
      title: '新建通知',
      body: `<div class="form-item"><label>标题<span class="req">*</span></label><input class="input" id="nc-title"></div>
      <div class="form-item"><label>内容</label><textarea class="input" id="nc-content" rows="4"></textarea></div>
      <div class="form-item"><label>类型</label><select class="input" id="nc-type">
        <option value="system">系统</option><option value="alert">告警</option><option value="email">邮件</option></select></div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">发送</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const d = { title: m.querySelector('#nc-title').value.trim(), content: m.querySelector('#nc-content').value.trim(), type: m.querySelector('#nc-type').value };
          if (!d.title) return toast('请输入标题', 'warn');
          try { await Notifications.create(d); toast('通知已创建', 'success'); close(); fetchList(); }
          catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }
}
