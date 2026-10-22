// ============ 系统设置 ============
import { Settings, System, EmailTemplates, Notifications, Auth, publicGet } from '../api.js';
import { App } from '../app.js';
import { esc, fmtTime, pager, emptyBox, toast, modal, confirmDialog, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>系统设置</h1><div class="sub">管理您的账户、安全设置和系统配置</div></div>
    </div>
    <div class="detail-grid">
      <div class="card" style="padding:10px">
        <div id="st-menu"></div>
      </div>
      <div id="st-body">${spinner()}</div>
    </div>`;
  const MENU = [
    ['profile', '👤 个人资料', '个人信息和账户设置'],
    ['security', '🔒 安全设置', '密码、双因素认证'],
    ['prefs', '⚙ 偏好设置', '主题、语言和显示'],
    ['notify', '🔔 通知设置', '邮件和推送通知配置'],
    ['mailtpl', '📧 邮件模板', '邮件模板管理'],
    ['syscfg', '🛠 系统配置', '系统参数配置（管理员）'],
    ['audit', '📋 审计日志', '系统操作记录'],
    ['data', '💾 数据管理', '导入导出、缓存与数据库维护'],
  ];
  const menu = document.getElementById('st-menu');
  const body = document.getElementById('st-body');
  const loaders = { profile: renderProfile, security: renderSecurity, prefs: renderPrefs, notify: renderNotify, mailtpl: renderMailTpl, syscfg: renderSysCfg, audit: renderAudit, data: renderData };
  let cur = 'profile';
  const renderMenu = () => {
    menu.innerHTML = MENU.map(([id, name, desc]) => `
      <div class="nav-item ${id === cur ? 'active' : ''}" data-m="${id}">
        <div><div>${name}</div><div style="font-size:11px;opacity:.75">${desc}</div></div>
      </div>`).join('');
    menu.querySelectorAll('.nav-item').forEach(el => el.onclick = () => { cur = el.dataset.m; renderMenu(); (loaders[cur] || renderProfile)().catch(e => body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`); });
  };
  renderMenu();
  await renderProfile().catch(e => body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`);

  // ---------- 个人资料 ----------
  async function renderProfile() {
    body.innerHTML = spinner();
    let p;
    try { p = await Auth.getProfile(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = `
      <div class="card"><div class="card-title">👤 个人资料</div>
        <div class="form-grid">
          <div class="form-item"><label>用户名</label><input class="input" id="pf-username" value="${esc(p.username || '')}"></div>
          <div class="form-item"><label>真实姓名</label><input class="input" id="pf-real" value="${esc(p.real_name || '')}"></div>
          <div class="form-item"><label>邮箱地址</label><input class="input" id="pf-email" value="${esc(p.email || '')}"></div>
          <div class="form-item"><label>手机号码</label><input class="input" id="pf-phone" value="${esc(p.phone || '')}"></div>
          <div class="form-item"><label>所属部门</label><input class="input" id="pf-dept" value="${esc(p.department || '')}"></div>
        </div>
        <div class="flex mt" style="justify-content:flex-end">
          <button class="btn" id="pf-reset">重 置</button>
          <button class="btn btn-primary" id="pf-save">保存更改</button>
        </div>
      </div>
      <div class="card"><div class="card-title">📇 账户信息</div>
        <dl class="kv">
          <dt>账户角色</dt><dd><span class="badge st-new">${esc(p.role?.name || '-')}</span></dd>
          <dt>账户状态</dt><dd>${p.status === 1 ? '<span class="badge st-fixed">正常</span>' : '<span class="badge st-closed">禁用</span>'}</dd>
          <dt>最后登录</dt><dd>${fmtTime(p.last_login_at)}</dd>
          <dt>双因素认证</dt><dd id="pf-2fa">加载中…</dd>
        </dl>
      </div>`;
    Settings.status2FA().then(s => document.getElementById('pf-2fa').innerHTML = s?.enabled ? '<span class="badge st-fixed">已启用</span>' : '<span class="badge st-closed">未启用</span>').catch(() => document.getElementById('pf-2fa').textContent = '-');
    document.getElementById('pf-reset').onclick = () => renderProfile();
    document.getElementById('pf-save').onclick = async () => {
      try {
        await Auth.updateProfile({
          username: document.getElementById('pf-username').value.trim(),
          real_name: document.getElementById('pf-real').value.trim(),
          email: document.getElementById('pf-email').value.trim(),
          phone: document.getElementById('pf-phone').value.trim(),
          department: document.getElementById('pf-dept').value.trim(),
        });
        toast('个人资料已更新', 'success');
        App.loadUser();
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // ---------- 安全设置 ----------
  async function renderSecurity() {
    body.innerHTML = `
      <div class="card"><div class="card-title">🔑 修改密码</div>
        <div class="form-grid">
          <div class="form-item full"><label>当前密码<span class="req">*</span></label><input class="input" type="password" id="sec-cur"></div>
          <div class="form-item"><label>新密码<span class="req">*</span></label><input class="input" type="password" id="sec-new" placeholder="至少6位"></div>
          <div class="form-item"><label>确认新密码<span class="req">*</span></label><input class="input" type="password" id="sec-confirm"></div>
        </div>
        <div class="flex mt" style="justify-content:flex-end"><button class="btn btn-primary" id="sec-save">修改密码</button></div>
      </div>
      <div class="card"><div class="card-title">🛡 双因素认证 (2FA)</div><div id="sec-2fa">${spinner()}</div></div>`;
    document.getElementById('sec-save').onclick = async () => {
      const cur = document.getElementById('sec-cur').value, nw = document.getElementById('sec-new').value, cf = document.getElementById('sec-confirm').value;
      if (!cur || !nw) return toast('请填写完整', 'warn');
      if (nw !== cf) return toast('两次输入的新密码不一致', 'warn');
      try { await Settings.changePassword({ current_password: cur, new_password: nw, confirm_password: cf }); toast('密码修改成功，下次登录请使用新密码', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    };
    const box = document.getElementById('sec-2fa');
    try {
      const st = await Settings.status2FA();
      if (st?.enabled) {
        box.innerHTML = `<p style="font-size:13px">✅ 双因素认证已启用</p><button class="btn btn-danger mt" id="fa-off">禁用 2FA</button>`;
        document.getElementById('fa-off').onclick = () => confirmDialog('确定禁用双因素认证？这将降低账户安全性。', async () => {
          try { await Settings.disable2FA(); toast('2FA 已禁用', 'success'); renderSecurity(); } catch (e) { toast(e.message, 'error'); }
        });
      } else {
        box.innerHTML = `<p style="font-size:13px" class="muted">双因素认证未启用。启用后登录需输入动态验证码，大幅提升安全性。</p><button class="btn btn-primary mt" id="fa-on">启用 2FA</button>`;
        document.getElementById('fa-on').onclick = async () => {
          try {
            const setup = await Settings.setup2FA();
            modal({
              title: '设置双因素认证', size: 'sm',
              body: `<p style="font-size:13px">1. 使用 Google Authenticator 等验证器扫描二维码或手动输入密钥：</p>
                <div style="text-align:center;margin:12px 0">${setup?.qr_code_url ? `<img src="${esc(setup.qr_code_url)}" style="max-width:180px">` : ''}</div>
                <p style="text-align:center"><code class="inline">${esc(setup?.secret || '')}</code></p>
                ${setup?.backup_codes?.length ? `<p class="muted mt">备份码：${setup.backup_codes.map(esc).join('、')}</p>` : ''}
                <div class="form-item mt"><label>输入 6 位验证码完成绑定</label><input class="input" id="fa-code" maxlength="6" placeholder="123456"></div>`,
              footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">验证并启用</button>`,
              onMount(m, close) {
                m.querySelector('[data-act=c]').onclick = close;
                m.querySelector('[data-act=ok]').onclick = async () => {
                  try { await Settings.verify2FA(m.querySelector('#fa-code').value.trim()); toast('2FA 已启用', 'success'); close(); renderSecurity(); }
                  catch (e) { toast(e.message, 'error'); }
                };
              },
            });
          } catch (e) { toast(e.message, 'error'); }
        };
      }
    } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  // ---------- 偏好设置 ----------
  async function renderPrefs() {
    body.innerHTML = spinner();
    let s;
    try { s = await Settings.getSystem(); } catch (e) { s = {}; }
    body.innerHTML = `
      <div class="card"><div class="card-title">⚙ 偏好设置</div>
        <div class="form-grid">
          <div class="form-item"><label>主题</label><select class="input" id="pr-theme">
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>浅色</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option>
            <option value="system" ${s.theme === 'system' || !s.theme ? 'selected' : ''}>跟随系统</option></select></div>
          <div class="form-item"><label>语言</label><select class="input" id="pr-lang">
            <option value="zh-CN" ${s.language === 'zh-CN' || !s.language ? 'selected' : ''}>简体中文</option>
            <option value="en-US" ${s.language === 'en-US' ? 'selected' : ''}>English</option></select></div>
          <div class="form-item"><label>时区</label><input class="input" id="pr-tz" value="${esc(s.timezone || 'Asia/Shanghai')}"></div>
          <div class="form-item"><label>日期格式</label><select class="input" id="pr-df">
            <option value="YYYY-MM-DD" ${s.date_format === 'YYYY-MM-DD' || !s.date_format ? 'selected' : ''}>YYYY-MM-DD</option>
            <option value="YYYY/MM/DD" ${s.date_format === 'YYYY/MM/DD' ? 'selected' : ''}>YYYY/MM/DD</option></select></div>
          <div class="form-item"><label>时间格式</label><select class="input" id="pr-tf">
            <option value="24h" ${s.time_format === '24h' || !s.time_format ? 'selected' : ''}>24 小时制</option>
            <option value="12h" ${s.time_format === '12h' ? 'selected' : ''}>12 小时制</option></select></div>
        </div>
        <div class="flex mt" style="justify-content:flex-end"><button class="btn btn-primary" id="pr-save">保存设置</button></div>
      </div>`;
    document.getElementById('pr-save').onclick = async () => {
      try {
        await Settings.updateSystem({
          theme: document.getElementById('pr-theme').value,
          language: document.getElementById('pr-lang').value,
          timezone: document.getElementById('pr-tz').value.trim(),
          date_format: document.getElementById('pr-df').value,
          time_format: document.getElementById('pr-tf').value,
        });
        toast('偏好设置已保存', 'success');
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  // ---------- 通知设置 ----------
  async function renderNotify() {
    body.innerHTML = spinner();
    let s;
    try { s = await Notifications.getSetting() || {}; } catch (e) { s = {}; }
    const groups = [
      ['漏洞通知', ['vuln_new', 'vuln_assigned', 'vuln_fixed']],
      ['报告通知', ['report']],
      ['系统通知', ['system']],
      ['社交通知', ['social']],
    ];
    const CH = { Email: '邮件', Push: '推送', SMS: '短信' };
    body.innerHTML = `<div class="card"><div class="card-title">🔔 通知设置</div>
      ${groups.map(([gname, keys]) => `
        <div class="section-block"><h4>${gname}</h4>
          <table class="table"><thead><tr><th>事件</th>${Object.values(CH).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
          ${keys.map(k => `<tr><td>${({ vuln_new: '发现新漏洞', vuln_assigned: '漏洞被指派', vuln_fixed: '漏洞已修复', report: '报告动态', system: '系统消息', social: '互动消息' })[k]}</td>
            ${Object.keys(CH).map(ch => {
              const key = `${k}_${ch.toLowerCase()}`;
              return `<td><input type="checkbox" class="switch ns-cb" data-key="${key}" ${s[key] ? 'checked' : ''}></td>`;
            }).join('')}</tr>`).join('')}
          </tbody></table>
        </div>`).join('')}
      <div class="flex mt" style="justify-content:flex-end"><button class="btn btn-primary" id="ns-save">保存通知设置</button></div>
      <div class="section-block mt"><h4>发送测试邮件</h4>
        <div class="flex"><input class="input" id="ns-email" placeholder="接收邮箱" style="max-width:280px"><button class="btn" id="ns-send">发送测试邮件</button></div>
      </div>
    </div>`;
    document.getElementById('ns-save').onclick = async () => {
      const d = {};
      document.querySelectorAll('.ns-cb').forEach(cb => d[cb.dataset.key] = cb.checked);
      try { await Notifications.updateSetting(d); toast('通知设置已保存', 'success'); } catch (e) { toast(e.message, 'error'); }
    };
    document.getElementById('ns-send').onclick = async () => {
      const to = document.getElementById('ns-email').value.trim();
      if (!to) return toast('请输入邮箱', 'warn');
      try { await Notifications.sendEmail({ to, subject: 'VulnArk 测试邮件', content: '这是一封来自 VulnArk 的测试邮件。' }); toast('测试邮件已发送', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  // ---------- 邮件模板 ----------
  async function renderMailTpl() {
    body.innerHTML = `<div class="card"><div class="flex-between mb"><div class="card-title" style="margin:0">📧 邮件模板</div><button class="btn btn-primary btn-sm" id="et-add">+ 新建模板</button></div><div id="et-list">${spinner()}</div></div>`;
    document.getElementById('et-add').onclick = () => tplForm(null);
    const list = async () => {
      const box = document.getElementById('et-list');
      let res;
      try { res = await EmailTemplates.list({ page: 1, page_size: 50 }); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const rows = res?.data || [];
      box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>模板名称</th><th>主题</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
        ${rows.map(t => `<tr><td class="cell-main">${esc(t.name)}</td><td class="muted">${esc(t.subject || '-')}</td><td class="muted">${fmtTime(t.updated_at)}</td>
        <td><button class="btn-link" data-edit='${esc(JSON.stringify(t))}'>✏️</button><button class="btn-link danger" data-del="${t.id}">🗑</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('暂无邮件模板');
      box.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => tplForm(JSON.parse(b.dataset.edit)));
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => confirmDialog('确定删除该邮件模板？', async () => {
        try { await EmailTemplates.remove(b.dataset.del); toast('删除成功', 'success'); list(); } catch (e) { toast(e.message, 'error'); }
      }));
    };
    await list();
    function tplForm(t) {
      modal({
        title: t ? '编辑邮件模板' : '新建邮件模板',
        body: `<div class="form-item"><label>模板名称<span class="req">*</span></label><input class="input" id="et-name" value="${esc(t?.name || '')}"></div>
        <div class="form-item"><label>邮件主题</label><input class="input" id="et-subject" value="${esc(t?.subject || '')}" placeholder="支持变量 {{username}}"></div>
        <div class="form-item"><label>邮件内容</label><textarea class="input" id="et-content" rows="8" placeholder="支持变量 {{username}} {{title}} 等">${esc(t?.content || '')}</textarea></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            const d = { name: m.querySelector('#et-name').value.trim(), subject: m.querySelector('#et-subject').value.trim(), content: m.querySelector('#et-content').value };
            if (!d.name) return toast('请输入模板名称', 'warn');
            try { t ? await EmailTemplates.update(t.id, d) : await EmailTemplates.create(d); toast('保存成功', 'success'); close(); list(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    }
  }

  // ---------- 系统配置 ----------
  async function renderSysCfg() {
    body.innerHTML = spinner();
    let res;
    try { res = await System.configs(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    const rows = res?.data || res || [];
    body.innerHTML = `<div class="card"><div class="card-title">🛠 系统配置</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>配置项</th><th>键</th><th>值</th><th>分组</th><th>操作</th></tr></thead><tbody>
      ${rows.length ? rows.map(c => `<tr>
        <td class="cell-main">${esc(c.description || c.name || '-')}</td>
        <td><code class="inline">${esc(c.key)}</code></td>
        <td>${esc(String(c.value ?? ''))}</td>
        <td>${esc(c.category || c.group || '-')}</td>
        <td><button class="btn-link" data-edit='${esc(JSON.stringify(c))}'>✏️ 修改</button></td>
      </tr>`).join('') : `<tr><td colspan="5">${emptyBox('暂无系统配置')}</td></tr>`}
      </tbody></table></div></div>`;
    body.querySelectorAll('button[data-edit]').forEach(b => b.onclick = () => {
      const c = JSON.parse(b.dataset.edit);
      modal({
        title: `修改配置 - ${c.key}`, size: 'sm',
        body: `<div class="form-item"><label>配置值</label><input class="input" id="cf-val" value="${esc(String(c.value ?? ''))}"></div>`,
        footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存</button>`,
        onMount(m, close) {
          m.querySelector('[data-act=c]').onclick = close;
          m.querySelector('[data-act=ok]').onclick = async () => {
            try { await System.updateConfig(c.key, { value: m.querySelector('#cf-val').value }); toast('配置已更新', 'success'); close(); renderSysCfg(); }
            catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    });
  }

  // ---------- 审计日志 ----------
  let auditPage = 1;
  async function renderAudit() {
    body.innerHTML = `<div class="card"><div id="audit-stats" class="stat-grid" style="margin-bottom:0"></div></div>
      <div class="card"><div class="card-title">📋 审计日志</div>
        <div class="filter-panel mb">
          <div class="form-item"><label>搜索</label><input class="input" id="al-kw" placeholder="操作内容 / IP"></div>
          <div class="form-item"><label>&nbsp;</label><button class="btn btn-primary" id="al-search" style="width:100%">🔍 搜索</button></div>
          <div class="form-item"><label>&nbsp;</label><button class="btn btn-danger" id="al-clean" style="width:100%">🧹 清理旧日志</button></div>
        </div>
        <div id="al-list">${spinner()}</div></div>`;
    auditPage = 1;
    System.auditLogStats().then(st => {
      document.getElementById('audit-stats').innerHTML = `
        <div class="stat-card stat-blue"><div><div class="label">日志总数</div><div class="value">${st?.total ?? 0}</div></div></div>
        <div class="stat-card stat-red"><div><div class="label">今日操作</div><div class="value">${st?.today ?? 0}</div></div></div>
        <div class="stat-card stat-purple"><div><div class="label">本周操作</div><div class="value">${st?.this_week ?? 0}</div></div></div>`;
    }).catch(() => {});
    document.getElementById('al-search').onclick = () => { auditPage = 1; fetchLogs(); };
    document.getElementById('al-kw').addEventListener('keydown', e => { if (e.key === 'Enter') { auditPage = 1; fetchLogs(); } });
    document.getElementById('al-clean').onclick = () => confirmDialog('清理 90 天前的审计日志？此操作不可恢复。', async () => {
      try { await System.cleanupAuditLogs({ days: 90 }); toast('清理完成', 'success'); fetchLogs(); } catch (e) { toast(e.message, 'error'); }
    });
    await fetchLogs();
  }
  async function fetchLogs() {
    const box = document.getElementById('al-list');
    if (!box) return;
    box.innerHTML = spinner();
    let res;
    try { res = await System.auditLogs({ page: auditPage, page_size: 15, keyword: document.getElementById('al-kw')?.value.trim() }); }
    catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const rows = res?.data || [];
    box.innerHTML = rows.length ? `<div class="table-wrap"><table class="table log-table"><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>IP</th><th>详情</th></tr></thead><tbody>
      ${rows.map(l => `<tr>
        <td>${fmtTime(l.created_at)}</td><td>${esc(l.user?.username || l.username || l.user_id || '-')}</td>
        <td>${esc(l.action || l.operation || '-')}</td><td>${esc(l.ip || l.ip_address || '-')}</td>
        <td class="muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${esc(l.detail || l.description || l.path || '-')}</td></tr>`).join('')}
      </tbody></table></div><div id="al-pager"></div>` : emptyBox('暂无审计日志');
    const pagerBox = box.querySelector('#al-pager');
    if (pagerBox) pagerBox.appendChild(pager(res?.total || 0, res?.page || auditPage, res?.page_size || 15, p => { auditPage = p; fetchLogs(); }));
  }

  // ---------- 数据管理 ----------
  async function renderData() {
    body.innerHTML = `
      <div class="card"><div class="card-title">💾 数据导入导出</div>
        <div class="flex">
          <button class="btn" id="dm-export">⬇ 导出全部数据</button>
          <label class="btn" style="cursor:pointer">⬆ 导入数据<input type="file" id="dm-import-file" accept=".json" style="display:none"></label>
        </div>
        <div class="hint mt">导出内容包含漏洞、资产、报告等业务数据的 JSON 备份</div>
      </div>
      <div class="card"><div class="card-title">🧰 系统维护</div>
        <div class="flex">
          <button class="btn" id="dm-cache">🧹 清理缓存</button>
          <button class="btn" id="dm-optimize">⚡ 优化数据库</button>
        </div>
        <div class="hint mt">数据库优化会重建索引并整理碎片，建议低峰期执行</div>
      </div>
      <div class="card"><div class="card-title">📡 API 状态（公开接口）</div><div id="dm-api">${spinner()}</div></div>`;
    document.getElementById('dm-export').onclick = async () => {
      try {
        const d = await Settings.exportData();
        const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vulnark-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        toast('数据导出成功', 'success');
      } catch (e) { toast(e.message, 'error'); }
    };
    document.getElementById('dm-import-file').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('file', f);
      try { await Settings.importData(fd); toast('数据导入成功', 'success'); } catch (err) { toast(err.message, 'error'); }
    };
    document.getElementById('dm-cache').onclick = () => confirmDialog('确定清理系统缓存？', async () => {
      try { await Settings.clearCache(); toast('缓存已清理', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    document.getElementById('dm-optimize').onclick = () => confirmDialog('确定现在优化数据库？建议在低峰期执行。', async () => {
      try { await Settings.optimizeDatabase(); toast('数据库优化完成', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    // 公开 API 状态
    Promise.all([publicGet('/api/status'), publicGet('/api/health')]).then(([st, h]) => {
      document.getElementById('dm-api').innerHTML = `
        <dl class="kv">
          <dt>服务状态</dt><dd>${h?.status === 'ok' || st?.status === 'ok' ? '<span class="badge st-fixed">运行正常</span>' : '<span class="badge st-closed">未知</span>'}</dd>
          <dt>API 版本</dt><dd>${esc(st?.version || h?.version || '-')}</dd>
          <dt>运行时间</dt><dd>${esc(String(st?.uptime ?? '-'))}</dd>
        </dl>`;
    }).catch(() => document.getElementById('dm-api').innerHTML = '<div class="empty">无法获取 API 状态</div>');
  }
}
