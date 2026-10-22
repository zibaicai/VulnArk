// ============ 用户管理（用户 / 角色 / 权限） ============
import { Users, Roles, Permissions } from '../api.js';
import { esc, fmtTime, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>用户管理</h1><div class="sub">管理系统用户账号和权限</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="u-add">+ 新增用户</button></div>
    </div>
    <div class="tabs" id="u-tabs">
      <div class="tab active" data-t="users">👤 用户列表</div>
      <div class="tab" data-t="roles">🎭 角色管理</div>
      <div class="tab" data-t="perms">🔐 权限管理</div>
    </div>
    <div id="u-body"></div>`;
  const body = document.getElementById('u-body');
  document.querySelectorAll('#u-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#u-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    ({ users: renderUsers, roles: renderRoles, perms: renderPerms })[t.dataset.t]();
  });
  document.getElementById('u-add').onclick = () => userForm(null);
  let page = 1;
  await renderUsers();

  // ---------- 用户 ----------
  async function renderUsers() {
    body.innerHTML = `
      <div class="card mb"><div class="card-title">搜索和筛选</div>
        <div class="filter-panel">
          <div class="form-item"><label>搜索用户</label><input class="input" id="uf-kw" placeholder="用户名、姓名或邮箱"></div>
          <div class="form-item"><label>部门</label><select class="input" id="uf-dept"><option value="">全部</option></select></div>
          <div class="form-item"><label>状态</label><select class="input" id="uf-st"><option value="">全部</option><option value="1">正常</option><option value="0">禁用</option></select></div>
          <div class="form-item"><button class="btn btn-primary" id="uf-search" style="width:100%">🔍 搜索</button></div>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap"><table class="table"><thead><tr>
          <th>用户信息</th><th>角色</th><th>部门</th><th>状态</th><th>最后登录</th><th>操作</th>
        </tr></thead><tbody id="u-tbody"></tbody></table></div>
        <div id="u-pager"></div>
      </div>`;
    page = 1;
    // 部门选项
    Users.departments().then(deps => {
      const sel = document.getElementById('uf-dept');
      (Array.isArray(deps) ? deps : deps?.data || []).forEach(d => {
        const o = document.createElement('option'); o.value = typeof d === 'string' ? d : d.name || d.value; o.textContent = o.value; sel.appendChild(o);
      });
    }).catch(() => {});
    document.getElementById('uf-search').onclick = () => { page = 1; fetchUsers(); };
    document.getElementById('uf-kw').addEventListener('keydown', e => { if (e.key === 'Enter') { page = 1; fetchUsers(); } });
    await fetchUsers();
  }

  async function fetchUsers() {
    const tbody = document.getElementById('u-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">' + spinner() + '</td></tr>';
    const q = {
      page, page_size: 10,
      keyword: document.getElementById('uf-kw')?.value.trim(),
      department: document.getElementById('uf-dept')?.value,
      status: document.getElementById('uf-st')?.value,
    };
    Object.keys(q).forEach(k => { if (!q[k]) delete q[k]; });
    let res;
    try { res = await Users.list(q); } catch (e) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty">${esc(e.message)}</div></td></tr>`; return; }
    const rows = res?.data || [];
    document.getElementById('u-pager').innerHTML = '';
    document.getElementById('u-pager').appendChild(pager(res?.total || 0, res?.page || page, res?.page_size || 10, p => { page = p; fetchUsers(); }));
    tbody.innerHTML = rows.length ? rows.map(u => `
      <tr>
        <td><div class="flex">
          <div class="avatar" style="width:34px;height:34px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:600">${esc((u.real_name || u.username || '?').slice(0, 1))}</div>
          <div><div class="cell-main">${esc(u.real_name || u.username)}</div><div class="cell-sub">${esc(u.username)} · ${esc(u.email)}</div></div>
        </div></td>
        <td><span class="badge st-new">${esc(u.role?.name || '-')}</span></td>
        <td class="muted">${esc(u.department || '-')}</td>
        <td>${u.status === 1 ? '<span class="badge st-fixed">正常</span>' : '<span class="badge st-closed">禁用</span>'}</td>
        <td class="muted">${fmtTime(u.last_login_at)}</td>
        <td><div class="flex" style="gap:2px">
          <button class="btn-link" data-edit='${esc(JSON.stringify(u))}'>✏️</button>
          <button class="btn-link danger" data-del="${u.id}" data-name="${esc(u.username)}">🗑</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="6">${emptyBox('暂无用户')}</td></tr>`;
    tbody.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => userForm(JSON.parse(b.dataset.edit)));
    tbody.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog(`确定删除用户「${b.dataset.name}」吗？`, async () => {
      try { await Users.remove(b.dataset.del); toast('删除成功', 'success'); fetchUsers(); } catch (e) { toast(e.message, 'error'); }
    }));
  }

  async function userForm(u) {
    const [roles, deps] = await Promise.all([
      Roles.options().catch(() => []),
      Users.departments().catch(() => []),
    ]);
    const roleList = Array.isArray(roles) ? roles : (roles?.data || []);
    const depList = Array.isArray(deps) ? deps : (deps?.data || []);
    modal({
      title: u ? '编辑用户' : '新增用户', size: 'lg',
      body: `<div class="form-grid">
        ${u ? '' : `<div class="form-item"><label>用户名<span class="req">*</span></label><input class="input" id="us-username" value="${esc(u?.username || '')}" placeholder="3-50位字母数字"></div>
        <div class="form-item"><label>初始密码<span class="req">*</span></label><input class="input" id="us-pass" type="password" placeholder="至少6位"></div>`}
        <div class="form-item"><label>真实姓名<span class="req">*</span></label><input class="input" id="us-real" value="${esc(u?.real_name || '')}"></div>
        <div class="form-item"><label>邮箱<span class="req">*</span></label><input class="input" id="us-email" type="email" value="${esc(u?.email || '')}"></div>
        <div class="form-item"><label>手机号码</label><input class="input" id="us-phone" value="${esc(u?.phone || '')}"></div>
        <div class="form-item"><label>角色<span class="req">*</span></label><select class="input" id="us-role">
          ${roleList.map(r => `<option value="${r.id}" ${u?.role_id === r.id || u?.role?.id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="form-item"><label>所属部门</label><input class="input" id="us-dept" list="dep-list" value="${esc(u?.department || '')}">
          <datalist id="dep-list">${depList.map(d => `<option value="${esc(typeof d === 'string' ? d : d.name || d.value || '')}">`).join('')}</datalist></div>
        ${u ? `<div class="form-item"><label>状态</label><select class="input" id="us-st"><option value="1" ${u.status === 1 ? 'selected' : ''}>正常</option><option value="0" ${u.status === 0 ? 'selected' : ''}>禁用</option></select></div>` : ''}
      </div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">${u ? '保存修改' : '创建用户'}</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          try {
            if (u) {
              const d = {
                real_name: m.querySelector('#us-real').value.trim(),
                email: m.querySelector('#us-email').value.trim(),
                phone: m.querySelector('#us-phone').value.trim(),
                role_id: +m.querySelector('#us-role').value,
                department: m.querySelector('#us-dept').value.trim(),
                status: +m.querySelector('#us-st').value,
              };
              await Users.update(u.id, d);
            } else {
              const d = {
                username: m.querySelector('#us-username').value.trim(),
                password: m.querySelector('#us-pass').value,
                real_name: m.querySelector('#us-real').value.trim(),
                email: m.querySelector('#us-email').value.trim(),
                phone: m.querySelector('#us-phone').value.trim(),
                role_id: +m.querySelector('#us-role').value,
                department: m.querySelector('#us-dept').value.trim(),
              };
              if (!d.username || d.username.length < 3) return toast('用户名至少3位', 'warn');
              if (!d.password || d.password.length < 6) return toast('密码至少6位', 'warn');
              await Users.create(d);
            }
            toast('保存成功', 'success'); close(); renderUsers();
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  }

  // ---------- 角色 ----------
  async function renderRoles() {
    body.innerHTML = `<div class="card"><div class="flex-between mb"><div class="card-title" style="margin:0">角色管理</div><button class="btn btn-primary btn-sm" id="role-add">+ 新增角色</button></div><div id="role-list">${spinner()}</div></div>`;
    document.getElementById('role-add').onclick = () => roleForm(null);
    const list = async () => {
      const box = document.getElementById('role-list');
      let res;
      try { res = await Roles.list({ page: 1, page_size: 50 }); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const rows = res?.data || [];
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>角色</th><th>权限数量</th><th>描述</th><th>操作</th></tr></thead><tbody>
        ${rows.map(r => `<tr>
          <td class="cell-main">${esc(r.name)}</td>
          <td>${(r.permissions || []).length} 项 <button class="btn-link" data-perm="${r.id}" data-name="${esc(r.name)}">配置权限</button></td>
          <td class="muted">${esc(r.description || '-')}</td>
          <td><button class="btn-link" data-edit='${esc(JSON.stringify(r))}'>✏️</button><button class="btn-link danger" data-del="${r.id}">🗑</button></td>
        </tr>`).join('')}</tbody></table></div>` : emptyBox('暂无角色');
      box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => roleForm(JSON.parse(b.dataset.edit)));
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该角色？', async () => {
        try { await Roles.remove(b.dataset.del); toast('删除成功', 'success'); list(); } catch (e) { toast(e.message, 'error'); }
      }));
      box.querySelectorAll('button[data-perm]').forEach(b => b.onclick = () => permEditor(b.dataset.perm, b.dataset.name));
    };
    await list();
    function roleForm(r) {
      modal({
        title: r ? '编辑角色' : '新增角色', size: 'sm',
        body: `<div class="form-item"><label>角色名称<span class="req">*</span></label><input class="input" id="rl-name" value="${esc(r?.name || '')}" placeholder="如 安全工程师"></div>
        <div class="form-item"><label>描述</label><input class="input" id="rl-desc" value="${esc(r?.description || '')}"></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const d = { name: m.querySelector('#rl-name').value.trim(), description: m.querySelector('#rl-desc').value.trim() };
            if (!d.name) return toast('请输入角色名称', 'warn');
            try { r ? await Roles.update(r.id, d) : await Roles.create(d); toast('保存成功', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
    async function permEditor(roleId, roleName) {
      let allPerms = [], rolePerms = [];
      try { allPerms = (await Permissions.list({ page: 1, page_size: 100 }))?.data || []; } catch (e) { /* ignore */ }
      try { const rp = await Permissions.rolePermissions(roleId); rolePerms = (rp?.permissions || rp || []).map(p => p.code || p.name || p); } catch (e) { /* ignore */ }
      modal({
        title: `配置角色权限 - ${roleName}`, size: 'lg',
        body: allPerms.length ? `<div style="max-height:46vh;overflow-y:auto">
          ${allPerms.map(p => {
            const code = p.code || p.name;
            return `<label class="flex" style="padding:7px 10px;border-bottom:1px solid #f8fafc;cursor:pointer">
              <input type="checkbox" class="perm-cb" value="${esc(code)}" ${rolePerms.includes(code) ? 'checked' : ''}>
              <span><b style="font-size:13px">${esc(code)}</b> <span class="muted">${esc(p.description || '')}</span></span></label>`;
          }).join('')}</div>` : emptyBox('暂无权限定义，请先在「权限管理」中创建'),
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存权限</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const codes = [...m.querySelectorAll('.perm-cb:checked')].map(c => c.value);
            try { await Permissions.assignRolePermissions(roleId, { permission_ids: codes, permissions: codes }); toast('权限已保存', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
  }

  // ---------- 权限 ----------
  async function renderPerms() {
    body.innerHTML = `<div class="card"><div class="flex-between mb">
      <div class="card-title" style="margin:0">权限定义</div>
      <div class="flex"><input class="input" id="pm-check-code" placeholder="检查权限码，如 vuln:read" style="width:200px"><button class="btn" id="pm-check">检查</button>
      <button class="btn btn-primary btn-sm" id="pm-add">+ 新增权限</button></div></div>
      <div id="pm-list">${spinner()}</div><div id="pm-check-result" class="mt"></div></div>`;
    document.getElementById('pm-add').onclick = () => permForm(null);
    document.getElementById('pm-check').onclick = async () => {
      const code = document.getElementById('pm-check-code').value.trim();
      if (!code) return;
      const box = document.getElementById('pm-check-result');
      try {
        const r = await Permissions.check({ permission: code });
        box.innerHTML = `<span class="badge ${r?.has_permission || r?.allowed ? 'st-fixed' : 'st-closed'}">${r?.has_permission || r?.allowed ? `当前用户拥有 ${esc(code)} 权限` : `当前用户无 ${esc(code)} 权限`}</span>`;
      } catch (e) { box.innerHTML = `<span class="muted">${esc(e.message)}</span>`; }
    };
    const list = async () => {
      const box = document.getElementById('pm-list');
      let res;
      try { res = await Permissions.list({ page: 1, page_size: 100 }); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const rows = res?.data || [];
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>权限码</th><th>描述</th><th>模块</th><th>操作</th></tr></thead><tbody>
        ${rows.map(p => `<tr><td><code class="inline">${esc(p.code || p.name)}</code></td><td class="muted">${esc(p.description || '-')}</td><td>${esc(p.module || '-')}</td>
        <td><button class="btn-link" data-edit='${esc(JSON.stringify(p))}'>✏️</button><button class="btn-link danger" data-del="${p.id}">🗑</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('暂无权限定义');
      box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => permForm(JSON.parse(b.dataset.edit)));
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该权限？', async () => {
        try { await Permissions.remove(b.dataset.del); toast('删除成功', 'success'); list(); } catch (e) { toast(e.message, 'error'); }
      }));
    };
    await list();
    function permForm(p) {
      modal({
        title: p ? '编辑权限' : '新增权限', size: 'sm',
        body: `<div class="form-item"><label>权限码<span class="req">*</span></label><input class="input" id="pc-code" value="${esc(p?.code || p?.name || '')}" placeholder="如 vuln:read"></div>
        <div class="form-item"><label>描述</label><input class="input" id="pc-desc" value="${esc(p?.description || '')}"></div>
        <div class="form-item"><label>模块</label><input class="input" id="pc-module" value="${esc(p?.module || '')}" placeholder="如 vulnerability"></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const d = { code: m.querySelector('#pc-code').value.trim(), name: m.querySelector('#pc-code').value.trim(), description: m.querySelector('#pc-desc').value.trim(), module: m.querySelector('#pc-module').value.trim() };
            if (!d.code) return toast('请输入权限码', 'warn');
            try { p ? await Permissions.update(p.id, d) : await Permissions.create(d); toast('保存成功', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
  }
}
