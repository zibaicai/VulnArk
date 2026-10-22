// ============ VulnArk API Client ============
// 相对路径：同一套静态文件在“站点根”与“/VulnArk/ 子路径”下都能工作
const BASE = 'api/v1';
const TOKEN_KEY = 'vulnark_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

async function request(method, path, body, opts = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const isGet = method === 'GET' || method === 'HEAD';
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (!isGet && body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let url = BASE + path;
  if (isGet && body && Object.keys(body).length) {
    const qs = new URLSearchParams(body).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  const res = await fetch(url, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch (e) { /* empty */ }
  if (res.status === 401 && !opts.noRedirect) {
    setToken('');
    if (!location.hash.startsWith('#/login')) location.hash = '#/login';
    throw new Error(json?.message || '登录已过期，请重新登录');
  }
  if (!res.ok || (json && json.code && json.code !== 200)) {
    throw new Error(json?.message || `请求失败 (${res.status})`);
  }
  return json ? json.data : json;
}

export const api = {
  get: (p, q) => request('GET', p, q || {}),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  upload: (p, formData) => request('POST', p, formData),
};

// ---------- 认证 / 个人资料 ----------
export const Auth = {
  login: (username, password) => api.post('/login', { username, password }),
  getProfile: () => api.get('/profile'),
  updateProfile: (d) => api.put('/profile', d),
  changePassword: (d) => api.post('/change-password', d),
};

// ---------- 用户 ----------
export const Users = {
  list: (q) => api.get('/users', q),
  get: (id) => api.get(`/users/${id}`),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.put(`/users/${id}`, d),
  remove: (id) => api.del(`/users/${id}`),
  departments: () => api.get('/users/departments'),
};

// ---------- 角色 ----------
export const Roles = {
  list: (q) => api.get('/roles', q),
  get: (id) => api.get(`/roles/${id}`),
  create: (d) => api.post('/roles', d),
  update: (id, d) => api.put(`/roles/${id}`, d),
  remove: (id) => api.del(`/roles/${id}`),
  options: () => api.get('/roles/options'),
};

// ---------- 资产 ----------
export const Assets = {
  list: (q) => api.get('/assets', q),
  get: (id) => api.get(`/assets/${id}`),
  create: (d) => api.post('/assets', d),
  update: (id, d) => api.put(`/assets/${id}`, d),
  remove: (id) => api.del(`/assets/${id}`),
  stats: () => api.get('/assets/stats'),
  types: () => api.get('/assets/types'),
  importanceLevels: () => api.get('/assets/importance-levels'),
  import: (assets) => api.post('/assets/import', { assets }),
};

// ---------- 漏洞 ----------
export const Vulns = {
  list: (q) => api.get('/vulnerabilities', q),
  get: (id) => api.get(`/vulnerabilities/${id}`),
  create: (formData) => api.upload('/vulnerabilities', formData),
  update: (id, d) => api.put(`/vulnerabilities/${id}`, d),
  remove: (id) => api.del(`/vulnerabilities/${id}`),
  updateStatus: (id, status) => api.put(`/vulnerabilities/${id}/status`, { status }),
  assign: (id, d) => api.post(`/vulnerabilities/${id}/assign`, d),
  timeline: (id) => api.get(`/vulnerabilities/${id}/timeline`),
  stats: (q) => api.get('/vulnerabilities/stats', q),
  owaspCategories: () => api.get('/vulnerabilities/owasp-categories'),
  severityLevels: () => api.get('/vulnerabilities/severity-levels'),
  statusList: () => api.get('/vulnerabilities/status-list'),
  batchAssign: (d) => api.post('/vulnerabilities/batch-assign', d),
  autoAssign: (d) => api.post('/vulnerabilities/auto-assign', d),
};

// ---------- 分配规则 ----------
export const Rules = {
  list: (q) => api.get('/assignment-rules', q),
  get: (id) => api.get(`/assignment-rules/${id}`),
  create: (d) => api.post('/assignment-rules', d),
  update: (id, d) => api.put(`/assignment-rules/${id}`, d),
  remove: (id) => api.del(`/assignment-rules/${id}`),
  types: () => api.get('/assignment-rules/types'),
};
export const Assignments = { stats: () => api.get('/assignments/stats') };

// ---------- 报告 ----------
export const Reports = {
  list: (q) => api.get('/reports', q),
  get: (id) => api.get(`/reports/${id}`),
  content: (id) => api.get(`/reports/${id}/content`),
  upload: (fd) => api.upload('/reports', fd),
  update: (id, d) => api.put(`/reports/${id}`, d),
  remove: (id) => api.del(`/reports/${id}`),
  submit: (id) => api.post(`/reports/${id}/submit`),
  review: (id, d) => api.post(`/reports/${id}/review`, d),
  archive: (id) => api.post(`/reports/${id}/archive`),
  stats: () => api.get('/reports/stats'),
  downloadUrl: (id) => `${BASE}/reports/${id}/download`,
};

// ---------- 通知 ----------
export const Notifications = {
  list: (q) => api.get('/notifications', q),
  my: (q) => api.get('/notifications/my', q),
  get: (id) => api.get(`/notifications/${id}`),
  create: (d) => api.post('/notifications', d),
  remove: (id) => api.del(`/notifications/${id}`),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  stats: () => api.get('/notifications/stats'),
  getSetting: () => api.get('/notifications/settings'),
  updateSetting: (d) => api.put('/notifications/settings', d),
  sendEmail: (d) => api.post('/notifications/email', d),
};

// ---------- 邮件模板 ----------
export const EmailTemplates = {
  list: (q) => api.get('/email-templates', q),
  get: (id) => api.get(`/email-templates/${id}`),
  create: (d) => api.post('/email-templates', d),
  update: (id, d) => api.put(`/email-templates/${id}`, d),
  remove: (id) => api.del(`/email-templates/${id}`),
};

// ---------- 权限 ----------
export const Permissions = {
  list: (q) => api.get('/permissions', q),
  get: (id) => api.get(`/permissions/${id}`),
  create: (d) => api.post('/permissions', d),
  update: (id, d) => api.put(`/permissions/${id}`, d),
  remove: (id) => api.del(`/permissions/${id}`),
  my: () => api.get('/permissions/my'),
  check: (q) => api.get('/permissions/check', q),
  byModule: (m) => api.get(`/permissions/module/${m}`),
  rolePermissions: (rid) => api.get(`/role-permissions/${rid}`),
  assignRolePermissions: (rid, d) => api.post(`/role-permissions/${rid}`, d),
};

// ---------- 系统 ----------
export const System = {
  configs: (q) => api.get('/system/configs', q),
  configsByCategory: (c) => api.get(`/system/configs/category/${c}`),
  getConfig: (k) => api.get(`/system/configs/${k}`),
  updateConfig: (k, d) => api.put(`/system/configs/${k}`, d),
  auditLogs: (q) => api.get('/system/audit-logs', q),
  auditLogStats: () => api.get('/system/audit-logs/stats'),
  auditLog: (id) => api.get(`/system/audit-logs/${id}`),
  cleanupAuditLogs: (d) => api.post('/system/audit-logs/cleanup', d),
};

// ---------- 知识库 ----------
export const Knowledge = {
  list: (q) => api.get('/knowledge', q),
  get: (id) => api.get(`/knowledge/${id}`),
  create: (d) => api.post('/knowledge', d),
  update: (id, d) => api.put(`/knowledge/${id}`, d),
  remove: (id) => api.del(`/knowledge/${id}`),
  stats: () => api.get('/knowledge/stats'),
  search: (q) => api.get('/knowledge/search', q),
  popular: (q) => api.get('/knowledge/popular', q),
  recent: (q) => api.get('/knowledge/recent', q),
  related: (id) => api.get(`/knowledge/${id}/related`),
  like: (id) => api.post(`/knowledge/${id}/like`),
  publish: (id) => api.post(`/knowledge/${id}/publish`),
  archive: (id) => api.post(`/knowledge/${id}/archive`),
};

// ---------- 标签 ----------
export const Tags = {
  list: (q) => api.get('/tags', q),
  get: (id) => api.get(`/tags/${id}`),
  create: (d) => api.post('/tags', d),
  update: (id, d) => api.put(`/tags/${id}`, d),
  remove: (id) => api.del(`/tags/${id}`),
  popular: () => api.get('/tags/popular'),
};

// ---------- 模板 ----------
export const Tpls = {
  list: (q) => api.get('/templates', q),
  get: (id) => api.get(`/templates/${id}`),
  create: (d) => api.post('/templates', d),
  update: (id, d) => api.put(`/templates/${id}`, d),
  remove: (id) => api.del(`/templates/${id}`),
  use: (id) => api.post(`/templates/${id}/use`),
};

// ---------- 统计分析 ----------
export const Analytics = {
  dashboard: () => api.get('/analytics/dashboard'),
  overview: () => api.get('/analytics/overview'),
  vulnerability: (q) => api.get('/analytics/vulnerability', q),
  vulnTrend: (q) => api.get('/analytics/vulnerability/trend', q),
  severityTrend: (q) => api.get('/analytics/vulnerability/severity-trend', q),
  monthlyTrends: (q) => api.get('/analytics/vulnerability/monthly-trends', q),
  asset: (q) => api.get('/analytics/asset', q),
  assetRisk: (q) => api.get('/analytics/asset/risk', q),
  report: (q) => api.get('/analytics/report', q),
  user: (q) => api.get('/analytics/user', q),
  export: (d) => api.post('/analytics/export', d),
};

// ---------- API 测试 ----------
export const ApiTest = {
  test: (d) => api.post('/api-test/test', d),
  endpoints: () => api.get('/api-test/endpoints'),
  token: (d) => api.post('/api-test/token', d),
  docs: () => api.get('/api-test/docs'),
  validate: (d) => api.post('/api-test/validate', d),
};

// ---------- 个人设置 ----------
export const Settings = {
  updateProfile: (d) => api.put('/settings/profile', d),
  changePassword: (d) => api.put('/settings/password', d),
  setup2FA: () => api.post('/settings/2fa/setup'),
  verify2FA: (code) => api.post('/settings/2fa/verify', { code }),
  disable2FA: () => api.del('/settings/2fa'),
  status2FA: () => api.get('/settings/2fa/status'),
  getSystem: () => api.get('/settings/system'),
  updateSystem: (d) => api.put('/settings/system', d),
  getNotificationSettings: () => api.get('/settings/notifications'),
  updateNotificationSettings: (d) => api.put('/settings/notifications', d),
  exportData: () => api.get('/settings/export'),
  importData: (fd) => api.upload('/settings/import', fd),
  clearCache: () => api.post('/settings/cache/clear'),
  optimizeDatabase: () => api.post('/settings/database/optimize'),
};

// ---------- AI 助手 ----------
export const AI = {
  getConfig: () => api.get('/ai/config'),
  saveConfig: (d) => api.post('/ai/config', d),
  test: (d) => api.post('/ai/test', d),
  providers: () => api.get('/ai/providers'),
  startConversation: (d) => api.post('/ai/conversation', d),
  chat: (d) => api.post('/ai/chat', d),
  conversations: (q) => api.get('/ai/conversations', q),
  deleteConversation: (sid) => api.del(`/ai/conversation/${sid}`),
  stats: () => api.get('/ai/stats'),
};

// ---------- 公开接口（免认证） ----------
export async function publicGet(path) {
  // 去掉前导斜杠，改用相对路径，兼容 / 与 /VulnArk/ 两种部署前缀
  const rel = String(path).replace(/^\/+/, '');
  const res = await fetch(rel);
  const json = await res.json().catch(() => null);
  return json;
}
