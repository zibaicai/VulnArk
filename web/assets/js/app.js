// ============ VulnArk App：路由 / 布局 / 登录 ============
import { api, Auth, getToken, setToken, Notifications, publicGet } from './api.js';
import { esc, toast, fmtTime, modal } from './ui.js';
import * as Dashboard from './views/dashboard.js';
import * as VulnsView from './views/vulnerabilities.js';
import * as AssetsView from './views/assets.js';
import * as ReportsView from './views/reports.js';
import * as KnowledgeView from './views/knowledge.js';
import * as IntelView from './views/intel.js';
import * as AnalyticsView from './views/analytics.js';
import * as UsersView from './views/users.js';
import * as AiView from './views/ai.js';
import * as SettingsView from './views/settings.js';
import * as ApiTestView from './views/apitest.js';
import * as NotifyView from './views/notifications.js';

export const App = {
  user: JSON.parse(localStorage.getItem('vulnark_user') || 'null'),
  route: '',
  async loadUser() {
    try { this.user = await Auth.getProfile(); localStorage.setItem('vulnark_user', JSON.stringify(this.user)); }
    catch (e) { /* ignore */ }
    this.renderChrome();
  },
  async refreshNotif() {
    const badge = document.getElementById('notif-badge');
    if (!badge || !getToken()) return;
    try {
      const st = await Notifications.stats();
      const unread = st?.unread ?? st?.unread_count ?? 0;
      badge.style.display = unread > 0 ? '' : 'none';
      badge.textContent = unread > 99 ? '99+' : unread;
    } catch (e) { /* ignore */ }
  },
  renderChrome() {
    const chip = document.getElementById('user-chip');
    if (chip && this.user) {
      chip.querySelector('.avatar').style.backgroundImage = this.user.avatar ? `url(${this.user.avatar})` : '';
      chip.querySelector('.avatar').textContent = this.user.avatar ? '' : (this.user.real_name || this.user.username || '?').slice(0, 1).toUpperCase();
      chip.querySelector('.name').textContent = this.user.real_name || this.user.username || '';
      chip.querySelector('.role').textContent = this.user.role?.name || '';
    }
  },
};

// ---------- 图标 ----------
const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z"/></svg>',
  vuln: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>',
  asset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r=".8" fill="currentColor"/><circle cx="7" cy="16.5" r=".8" fill="currentColor"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/></svg>',
  lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M7 12h7M7 16h5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.2c2.6.3 4.6 1.9 5.3 4.8"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2.5"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="13.5" r="1" fill="currentColor"/><circle cx="15" cy="13.5" r="1" fill="currentColor"/><path d="M9.5 17h5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/></svg>',
  bell: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/></svg>',
  logout: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
};

const NAV = [
  { id: 'dashboard', name: '仪表板', icon: I.dash },
  { id: 'vulnerabilities', name: '漏洞管理', icon: I.vuln },
  { id: 'intel', name: '漏洞资料', icon: I.lib },
  { id: 'assets', name: '资产管理', icon: I.asset },
  { id: 'reports', name: '报告管理', icon: I.report },
  { id: 'knowledge', name: '知识库', icon: I.book },
  { id: 'analytics', name: '统计分析', icon: I.chart },
  { id: 'users', name: '用户管理', icon: I.users },
  { id: 'notifications', name: '通知中心', icon: I.bell },
  { id: 'api-test', name: 'API 调试', icon: I.plug },
  { id: 'ai', name: 'AI 助手', icon: I.robot },
  { id: 'settings', name: '系统设置', icon: I.gear },
];

// ---------- 登录页 ----------
async function renderLogin() {
  const root = document.getElementById('app');
  root.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo"><span class="logo-mark">V</span> VulnArk</div>
      <div class="sub">企业级漏洞管理平台</div>
      <div class="form-item"><label>用户名</label><input class="input" id="lg-user" placeholder="请输入用户名" autocomplete="username"></div>
      <div class="form-item"><label>密码</label><input class="input" id="lg-pass" type="password" placeholder="请输入密码" autocomplete="current-password"></div>
      <button class="btn btn-primary" id="lg-btn">登 录</button>
      <div class="login-foot" id="lg-foot">VulnArk · 安全资产管理与漏洞全生命周期平台</div>
    </div>
  </div>`;
  // 公开系统信息（对接 /api/v1/public/system/info）
  publicGet('/api/v1/public/system/info').then(info => {
    const d = info?.data || info;
    if (d) document.getElementById('lg-foot').textContent = `${d.name || 'VulnArk'} v${d.version || '1.0.0'} · ${d.environment || ''}`;
  }).catch(() => {});
  const doLogin = async () => {
    const u = document.getElementById('lg-user').value.trim();
    const p = document.getElementById('lg-pass').value;
    if (!u || !p) return toast('请输入用户名和密码', 'warn');
    const btn = document.getElementById('lg-btn');
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      const data = await Auth.login(u, p);
      setToken(data.token);
      App.user = data.user;
      localStorage.setItem('vulnark_user', JSON.stringify(data.user));
      toast('登录成功', 'success');
      location.hash = '#/dashboard';
      renderShell();
    } catch (e) {
      toast(e.message || '登录失败', 'error');
      btn.disabled = false; btn.textContent = '登 录';
    }
  };
  document.getElementById('lg-btn').onclick = doLogin;
  root.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
}

// ---------- 主框架 ----------
function renderShell() {
  const root = document.getElementById('app');
  root.innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="logo"><span class="logo-mark">V</span> VulnArk</div>
      <nav class="nav" id="nav"></nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-title" id="tb-title"></div>
        <div class="topbar-right">
          <div class="dropdown" id="notif-dd">
            <button class="icon-btn" id="notif-btn" title="通知">
              ${I.bell}
              <span class="badge-dot" id="notif-badge" style="display:none">0</span>
            </button>
          </div>
          <div class="user-chip" id="user-chip">
            <div class="avatar"></div>
            <div><div class="name"></div><div class="role"></div></div>
            <button class="icon-btn" id="logout-btn" title="退出登录">${I.logout}</button>
          </div>
        </div>
      </header>
      <div class="content" id="view"></div>
    </div>
  </div>`;
  // nav
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(n => `<div class="nav-item" data-id="${n.id}">${n.icon}<span>${n.name}</span></div>`).join('');
  nav.querySelectorAll('.nav-item').forEach(el => el.onclick = () => { location.hash = '#/' + el.dataset.id; });
  document.getElementById('logout-btn').onclick = () => confirmDialog('确定要退出登录吗？', () => {
    setToken(''); localStorage.removeItem('vulnark_user'); App.user = null; location.hash = '#/login';
  }, '退出登录');
  // notification dropdown
  const dd = document.getElementById('notif-dd');
  document.getElementById('notif-btn').onclick = async (e) => {
    e.stopPropagation();
    let menu = dd.querySelector('.dropdown-menu');
    if (menu) { menu.remove(); return; }
    menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.innerHTML = `<div class="dm-head"><span>我的通知</span><a href="#/notifications" id="dm-all">查看全部</a></div><div class="dm-list">${'<div class="spinner" style="margin:30px auto"></div>'}</div>`;
    dd.appendChild(menu);
    menu.addEventListener('click', ev => ev.stopPropagation());
    menu.querySelector('#dm-all').onclick = () => menu.remove();
    try {
      const res = await Notifications.my({ page: 1, page_size: 8 });
      const list = res?.data || res || [];
      menu.querySelector('.dm-list').innerHTML = list.length ? list.map(n => `
        <div class="dm-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
          <div class="dm-title"><span>${esc(n.title)}</span><span class="dm-time">${fmtTime(n.created_at).slice(5, 10)}</span></div>
          <div class="dm-body">${esc((n.content || '').slice(0, 60))}</div>
        </div>`).join('') : '<div class="empty">暂无通知</div>';
      menu.querySelectorAll('.dm-item').forEach(item => item.onclick = async () => {
        try { await Notifications.markRead(item.dataset.id); } catch (e) {}
        menu.remove(); location.hash = '#/notifications';
      });
    } catch (err) { menu.querySelector('.dm-list').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  };
  document.addEventListener('click', () => { const m = dd.querySelector('.dropdown-menu'); if (m) m.remove(); }, { once: false });
  App.renderChrome();
  App.refreshNotif();
}

// ---------- 路由 ----------
const ROUTES = {
  dashboard: { mod: Dashboard, title: '仪表板', fn: 'renderDashboard' },
  vulnerabilities: { mod: VulnsView, title: '漏洞管理', fn: 'render' },
  assets: { mod: AssetsView, title: '资产管理', fn: 'render' },
  reports: { mod: ReportsView, title: '报告管理', fn: 'render' },
  intel: { mod: IntelView, title: '漏洞资料', fn: 'render' },
  knowledge: { mod: KnowledgeView, title: '知识库', fn: 'render' },
  analytics: { mod: AnalyticsView, title: '统计分析', fn: 'render' },
  users: { mod: UsersView, title: '用户管理', fn: 'render' },
  notifications: { mod: NotifyView, title: '通知中心', fn: 'render' },
  'api-test': { mod: ApiTestView, title: 'API 调试', fn: 'render' },
  ai: { mod: AiView, title: 'AI 助手', fn: 'render' },
  settings: { mod: SettingsView, title: '系统设置', fn: 'render' },
};

let lastHash = '';
async function route() {
  const hash = location.hash || '#/dashboard';
  if (hash === lastHash) return;
  lastHash = hash;
  if (!getToken()) { lastHash = ''; return renderLogin(); }
  if (!document.querySelector('.sidebar')) renderShell();

  const parts = hash.replace(/^#\//, '').split('/');
  const pageId = parts[0] || 'dashboard';
  if (pageId === 'login') { lastHash = ''; return renderLogin(); }
  const r = ROUTES[pageId] || ROUTES.dashboard;
  // nav highlight
  document.querySelectorAll('.nav-item').forEach(el => {
    const active = el.dataset.id === pageId;
    el.classList.toggle('active', active);
  });
  document.getElementById('tb-title').textContent = r.title;
  const view = document.getElementById('view');
  view.innerHTML = '<div class="spinner"></div>';
  try {
    await r.mod[r.fn](view, parts.slice(1));
  } catch (e) {
    view.innerHTML = `<div class="card"><div class="empty">加载失败：${esc(e.message)}</div></div>`;
  }
  App.refreshNotif();
  view.closest('.main')?.scrollTo(0, 0);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
// 首次进入：若有 token 直接进框架
if (getToken()) renderShell();
route();
