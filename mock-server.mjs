// VulnArk 前端开发用 Mock 服务（不依赖 Go 后端 / MySQL）
// 用法: node mock-server.mjs  →  http://localhost:8081
// 生产环境请运行 Go 后端 (go run cmd/main.go)，前端代码无需任何修改。
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8081;
const WEB = path.join(__dirname, 'web');

// ---------- 示例数据 ----------
import { assets, vulns, users, admin, vulnStats, assetStats, topRiskAssets, iso } from './mock-data.mjs';
const now = Date.now();
const user = admin;

// 资产、漏洞、人员数据由 mock-data.mjs 生成（约 360 台资产 + 200+ 条真实感漏洞，漏洞关联「漏洞资料」条目）

const reports = [
  { id: 1, title: 'Web应用渗透测试报告', description: '针对主要Web应用系统的全面渗透测试', type: 'penetration_test', severity: 'high', status: 'approved', file_name: 'web_pentest.pdf', file_size: 2e6, file_type: 'pdf', test_date: null, created_at: iso(0.2), tags: ['渗透测试'], asset_ids: [3] },
  { id: 2, title: '数据库安全审计报告', description: 'MySQL数据库安全配置审计', type: 'security_audit', severity: 'medium', status: 'draft', file_name: 'db_audit.pdf', file_size: 1.5e6, file_type: 'pdf', test_date: null, created_at: iso(0.2), tags: [], asset_ids: [4] },
  { id: 3, title: '网络设备配置检查报告', description: '防火墙和网络设备安全配置检查', type: 'compliance_check', severity: 'medium', status: 'pending_review', file_name: 'network_check.pdf', file_size: 1e6, file_type: 'pdf', test_date: null, created_at: iso(0.2), tags: [], asset_ids: [6] },
  { id: 4, title: '代码安全审计报告', description: 'Java应用代码安全漏洞审计', type: 'security_audit', severity: 'high', status: 'approved', file_name: 'code_audit.pdf', file_size: 2.9e6, file_type: 'pdf', test_date: null, created_at: iso(0.2), tags: [], asset_ids: [5] },
  { id: 5, title: '应急响应处理报告', description: '安全事件应急响应处理记录', type: 'other', severity: 'critical', status: 'archived', file_name: 'incident_response.pdf', file_size: 3.1e6, file_type: 'pdf', test_date: null, created_at: iso(0.2), tags: [], asset_ids: [] },
].map(r => ({ ...r, uploader: user, file_path: 'uploads/' + r.file_name, download_url: '/api/v1/reports/' + r.id + '/download' }));

const trend = Array.from({ length: 14 }, (_, i) => ({ date: new Date(now - (13 - i) * 864e5).toISOString().slice(0, 10), count: Math.floor(Math.abs(Math.sin(i * 1.7)) * 4) }));

// ---------- 响应工具 ----------
const ok = (data) => JSON.stringify({ code: 200, message: '操作成功', data });
const paged = (list, q) => {
  const page = +(q.get('page') || 1), ps = +(q.get('page_size') || 10);
  const kw = (q.get('keyword') || '').toLowerCase();
  let filtered = list;
  if (kw) filtered = list.filter(x => JSON.stringify(x).toLowerCase().includes(kw));
  return ok({ total: filtered.length, page, page_size: ps, total_pages: Math.ceil(filtered.length / ps), data: filtered.slice((page - 1) * ps, page * ps) });
};
const trend14 = trend;

// ---------- 路由 ----------
function route(method, pathname, q, body) {
  const P = pathname;
  const M = (re) => re.test(P);
  if (P === '/api/v1/login') return ok({ token: 'mock-token-' + now, expires_at: new Date(now + 36e5).toISOString(), user });
  if (P === '/api/v1/profile') return ok(user);
  if (P === '/api/v1/change-password') return ok(null);

  if (P === '/api/v1/users/departments') return ok([...new Set(users.map(u => u.department))]);
  if (P === '/api/v1/users') return method === 'POST' ? ok({ id: 99, ...body, role: { id: body.role_id, name: '安全工程师' } }) : paged(users, q);
  if (M(/^\/api\/v1\/users\/\d+$/)) return method === 'DELETE' ? ok(null) : ok(users.find(u => u.id === +(/(\d+)$/.exec(P) || [])[1]) || user);
  if (P === '/api/v1/roles/options') return ok([{ id: 1, name: '管理员' }, { id: 2, name: '安全工程师' }, { id: 3, name: '普通用户' }]);
  if (P === '/api/v1/roles') return method === 'POST' ? ok({ id: 99, ...body }) : paged([{ id: 1, name: '管理员', description: '系统管理员', permissions: ['vuln:read', 'vuln:manage', 'asset:read', 'user:manage', 'role:manage'] }], q);
  if (M(/^\/api\/v1\/roles\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1, name: '管理员', description: '', permissions: [] });

  if (P === '/api/v1/assets/stats') return ok(assetStats());
  if (P === '/api/v1/assets/types') return ok([{ value: 'server', label: '服务器' }, { value: 'database', label: '数据库' }, { value: 'application', label: '应用' }, { value: 'network', label: '网络设备' }]);
  if (P === '/api/v1/assets/importance-levels') return ok([{ value: 1, label: '高' }, { value: 2, label: '中' }, { value: 3, label: '低' }]);
  if (P === '/api/v1/assets/import') return ok({ success: body?.assets?.length || 0, failed: 0 });
  if (P === '/api/v1/assets') {
    if (method === 'POST') return ok({ id: assets.length + 1, ...body, status: 1 });
    const type = q.get('type'), imp = q.get('importance_level'), dept = q.get('department');
    let l = assets;
    if (type) l = l.filter(a => a.type === type);
    if (imp) l = l.filter(a => a.importance_level === +imp);
    if (dept) l = l.filter(a => a.department === dept);
    return paged(l, q);
  }
  if (M(/^\/api\/v1\/assets\/\d+$/)) {
    const id = +(/(\d+)$/.exec(P) || [])[1];
    return method === 'DELETE' ? ok(null) : ok(assets.find(a => a.id === id) || assets[0]);
  }

  if (P === '/api/v1/vulnerabilities/stats') return ok(vulnStats());
  if (P === '/api/v1/vulnerabilities/owasp-categories') return ok([{ id: 1, code: 'A01:2021', name: 'Broken Access Control', year: 2021 }, { id: 2, code: 'A02:2021', name: 'Cryptographic Failures', year: 2021 }, { id: 3, code: 'A03:2021', name: 'Injection', year: 2021 }, { id: 4, code: 'A04:2021', name: 'Insecure Design', year: 2021 }, { id: 5, code: 'A05:2021', name: 'Security Misconfiguration', year: 2021 }, { id: 6, code: 'A06:2021', name: 'Vulnerable Components', year: 2021 }, { id: 7, code: 'A07:2021', name: 'Auth Failures', year: 2021 }, { id: 8, code: 'A08:2021', name: 'Integrity Failures', year: 2021 }, { id: 9, code: 'A09:2021', name: 'Logging Failures', year: 2021 }, { id: 10, code: 'A10:2021', name: 'SSRF', year: 2021 }]);
  if (P === '/api/v1/vulnerabilities/severity-levels') return ok([{ value: 1, label: '严重' }, { value: 2, label: '高危' }, { value: 3, label: '中危' }, { value: 4, label: '低危' }]);
  if (P === '/api/v1/vulnerabilities/status-list') return ok([{ value: 'new', label: '新建' }, { value: 'processing', label: '处理中' }, { value: 'fixed', label: '已修复' }, { value: 'verified', label: '已验证' }, { value: 'closed', label: '已关闭' }]);
  if (P === '/api/v1/vulnerabilities/batch-assign') return ok({ assigned: body?.vulnerability_ids?.length || 0 });
  if (P === '/api/v1/vulnerabilities/auto-assign') return ok({ assigned: 2 });
  if (P === '/api/v1/vulnerabilities') {
    if (method === 'POST') {
      const d = body?.data ? JSON.parse(body.data) : body;
      return ok({ id: vulns.length + 1, ...d, severity_level_text: { 1: '严重', 2: '高危', 3: '中危', 4: '低危' }[d.severity_level], status: 'new', status_text: '新建', asset: assets.find(a => a.id === d.asset_id), attachments: [], created_at: new Date().toISOString() });
    }
    // 支持筛选：严重程度 / 状态 / 资产 / 负责人
    const sev = q.get('severity_level'), st = q.get('status'), aid2 = q.get('asset_id'), uid = q.get('assignee_id');
    let l = vulns;
    if (sev) l = l.filter(v => v.severity_level === +sev);
    if (st) l = l.filter(v => v.status === st);
    if (aid2) l = l.filter(v => v.asset_id === +aid2);
    if (uid) l = l.filter(v => v.assignee_id === +uid);
    return paged(l, q);
  }
  if (M(/^\/api\/v1\/vulnerabilities\/(\d+)\/timeline$/)) {
    const v = vulns.find(x => x.id === +RegExp.$1) || vulns[0];
    const tl = [{ id: 1, action: '漏洞创建', description: `由「${v.source}」发现并录入，发现人：${v.discoverer?.real_name || '-'}`, created_at: v.created_at, user: v.discoverer }];
    if (v.assignee) tl.push({ id: 2, action: '指派负责人', description: `指派给 ${v.assignee.real_name}（${v.assignee.department}）`, created_at: v.assigned_at, user: admin });
    if (v.status !== 'new') tl.push({ id: 3, action: '状态变更: 新建 → 处理中', description: '开始分析验证并制定修复方案', created_at: iso(0.8), user: v.assignee });
    if (['fixed', 'verified', 'closed'].includes(v.status)) tl.push({ id: 4, action: '状态变更: 处理中 → 已修复', description: '开发完成修复并上线', created_at: v.fixed_at, user: v.assignee });
    if (['verified', 'closed'].includes(v.status)) tl.push({ id: 5, action: '状态变更: 已修复 → 已验证', description: '安全复测通过', created_at: v.verified_at, user: admin });
    if (v.status === 'closed') tl.push({ id: 6, action: '状态变更: 已验证 → 已关闭', description: '漏洞归档关闭', created_at: v.closed_at, user: admin });
    return ok(tl);
  }
  if (M(/^\/api\/v1\/vulnerabilities\/(\d+)\/assign$/)) return ok(null);
  if (M(/^\/api\/v1\/vulnerabilities\/(\d+)\/status$/)) return ok(null);
  if (M(/^\/api\/v1\/vulnerabilities\/(\d+)$/)) {
    if (method === 'DELETE') return ok(null);
    if (method === 'PUT') return ok({ ...vulns[0], ...body });
    return ok(vulns.find(v => v.id === +RegExp.$1) || vulns[0]);
  }

  if (P === '/api/v1/assignment-rules/types') return ok([{ value: 'severity', label: '按严重程度' }, { value: 'asset_type', label: '按资产类型' }, { value: 'keyword', label: '按关键词' }, { value: 'round_robin', label: '轮流分配' }]);
  if (P === '/api/v1/assignment-rules') return method === 'POST' ? ok({ id: 99, ...body }) : paged([{ id: 1, name: '严重漏洞指派安全经理', type: 'severity', condition: '1', priority: 1, enabled: true, assignee: user }], q);
  if (M(/^\/api\/v1\/assignment-rules\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1, name: '规则', type: 'severity', condition: '1', priority: 1, enabled: true });
  if (P === '/api/v1/assignments/stats') return ok({ total_assignments: 42, auto_assigned: 27, manual_assigned: 15, by_assignee: [{ name: '系统管理员', count: 42 }] });

  if (P === '/api/v1/reports/stats') return ok({ total: reports.length, by_type: { penetration_test: 1, security_audit: 2, compliance_check: 1, other: 1 }, by_status: { draft: 1, pending_review: 1, approved: 2, archived: 1 } });
  if (P === '/api/v1/reports') {
    if (method === 'POST') return ok(reports[0]);
    return paged(reports, q);
  }
  if (M(/^\/api\/v1\/reports\/(\d+)\/download$/)) return 'FILE:' + reports.find(r => r.id === +RegExp.$1)?.file_name;
  if (M(/^\/api\/v1\/reports\/(\d+)\/content$/)) return ok({ summary: '本报告为演示数据：包含3个高危、2个中危漏洞的详细分析与复现过程。' });
  if (M(/^\/api\/v1\/reports\/(\d+)$/)) {
    if (method === 'DELETE') return ok(null);
    if (method === 'POST') return ok(null); // submit/review/archive
    return ok(reports.find(r => r.id === +RegExp.$1) || reports[0]);
  }

  if (P === '/api/v1/notifications/stats') return ok({ unread: 2, total: 3, today: 1 });
  if (P === '/api/v1/notifications/read-all' || P === '/api/v1/notifications/email') return ok(null);
  if (P === '/api/v1/notifications/my' || P === '/api/v1/notifications') {
    if (method === 'POST') return ok(null);
    return paged([
      { id: 1, title: '发现新的严重漏洞', content: `漏洞「${vulns[0]?.title || ''}」(CVSS ${vulns[0]?.cvss_score || '-'}) 已录入系统，请及时处理`, type: 'alert', is_read: false, created_at: iso(0.1) },
      { id: 2, title: '漏洞已指派给您', content: `「${vulns[1]?.title || ''}」已指派给您处理，资产：${vulns[1]?.asset?.name || '-'}`, type: 'system', is_read: false, created_at: iso(0.6) },
      { id: 3, title: '报告审核通过', content: 'Web应用渗透测试报告 已通过审核', type: 'system', is_read: true, created_at: iso(1.2) },
    ], q);
  }
  if (P === '/api/v1/notifications/settings') return method === 'PUT' ? ok(null) : ok({ vuln_new_email: true, vuln_new_push: true, vuln_assigned_email: true, vuln_assigned_push: true, vuln_fixed_email: true, report_email: true, system_email: true, system_push: true });
  if (M(/^\/api\/v1\/notifications\/\d+$/)) return method === 'DELETE' ? ok(null) : method === 'POST' ? ok(null) : ok({ id: 1, title: '通知', content: '内容', created_at: iso(0) });

  if (P === '/api/v1/email-templates') return method === 'POST' ? ok({ id: 99, ...body }) : paged([{ id: 1, name: '漏洞告警模板', subject: '[VulnArk] 发现{{severity}}漏洞: {{title}}', content: '您好 {{username}}，系统发现新漏洞…', updated_at: iso(2) }], q);
  if (M(/^\/api\/v1\/email-templates\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1, name: '模板', subject: '', content: '' });

  if (P === '/api/v1/permissions/my') return ok(['vuln:read', 'vuln:manage', 'asset:read', 'user:manage']);
  if (P === '/api/v1/permissions/check') return ok({ has_permission: true, allowed: true });
  if (P === '/api/v1/permissions') return method === 'POST' ? ok({ id: 99, ...body }) : paged([
    { id: 1, code: 'vuln:read', description: '查看漏洞', module: 'vulnerability' },
    { id: 2, code: 'vuln:manage', description: '管理漏洞', module: 'vulnerability' },
    { id: 3, code: 'asset:read', description: '查看资产', module: 'asset' },
    { id: 4, code: 'asset:manage', description: '管理资产', module: 'asset' },
    { id: 5, code: 'user:manage', description: '管理用户', module: 'user' },
    { id: 6, code: 'role:manage', description: '管理角色', module: 'role' },
    { id: 7, code: 'report:manage', description: '管理报告', module: 'report' },
    { id: 8, code: 'api:test', description: 'API 调试', module: 'system' },
  ], q);
  if (M(/^\/api\/v1\/role-permissions\/\d+$/)) return method === 'POST' ? ok(null) : ok({ permissions: ['vuln:read', 'vuln:manage', 'asset:read'] });
  if (M(/^\/api\/v1\/permissions\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1 });

  if (P === '/api/v1/system/configs') return paged([
    { key: 'site.name', value: 'VulnArk 漏洞管理平台', description: '站点名称', category: 'basic' },
    { key: 'security.session_timeout', value: '3600', description: '会话超时(秒)', category: 'security' },
    { key: 'email.smtp_host', value: 'smtp.example.com', description: 'SMTP 服务器', category: 'email' },
    { key: 'vuln.auto_assign', value: 'true', description: '漏洞自动分配', category: 'vulnerability' },
  ], q);
  if (M(/^\/api\/v1\/system\/configs\/[^/]+$/)) return method === 'PUT' ? ok(null) : ok({ key: 'site.name', value: 'VulnArk' });
  if (P === '/api/v1/system/audit-logs/stats') return ok({ total: 328, today: 26, this_week: 154 });
  if (P === '/api/v1/system/audit-logs/cleanup') return ok(null);
  if (P === '/api/v1/system/audit-logs') return paged([
    { id: 1, action: '用户登录', username: 'admin', ip: '192.168.1.66', detail: '登录成功', created_at: iso(0.05) },
    { id: 2, action: '创建漏洞', username: 'admin', ip: '192.168.1.66', detail: 'POST /api/v1/vulnerabilities', created_at: iso(0.2) },
    { id: 3, action: '上传报告', username: 'admin', ip: '192.168.1.66', detail: 'web_pentest.pdf', created_at: iso(0.3) },
    { id: 4, action: '修改配置', username: 'admin', ip: '192.168.1.66', detail: 'PUT /api/v1/system/configs/site.name', created_at: iso(0.8) },
  ], q);
  if (M(/^\/api\/v1\/system\/audit-logs\/\d+$/)) return ok({ id: 1, action: '登录', ip: '192.168.1.66', created_at: iso(0) });

  if (P === '/api/v1/knowledge/stats') return ok({ total: 12, published: 9, total_views: 1580, total_likes: 96 });
  if (P === '/api/v1/knowledge/popular') return paged([
    { id: 2, title: 'Shiro 反序列化漏洞复现手册', views: 520 },
    { id: 5, title: '内网横向移动常用手法总结', views: 431 },
    { id: 3, title: 'Log4j2 JNDI 注入原理与检测', views: 388 },
    { id: 8, title: '应急响应排查清单（Windows/Linux）', views: 240 },
  ], q);
  if (P === '/api/v1/knowledge/search') return paged(knowledgeList, q);
  if (P === '/api/v1/knowledge') {
    if (method === 'POST') return ok({ id: 99, ...body });
    return paged(knowledgeList, q);
  }
  if (M(/^\/api\/v1\/knowledge\/(\d+)\/related$/)) return ok(knowledgeList.slice(0, 2));
  if (M(/^\/api\/v1\/knowledge\/(\d+)\/(like|publish|archive)$/)) return ok(null);
  if (M(/^\/api\/v1\/knowledge\/(\d+)$/)) return method === 'DELETE' ? ok(null) : ok(knowledgeList[0]);

  if (P === '/api/v1/tags/popular') return paged([{ id: 1, name: 'SQL注入', usage_count: 15 }, { id: 2, name: '复现', usage_count: 9 }], q);
  if (P === '/api/v1/tags') return method === 'POST' ? ok({ id: 99, ...body }) : paged([
    { id: 1, name: 'SQL注入', color: '#dc2626', usage_count: 15 },
    { id: 2, name: '复现', color: '#2563eb', usage_count: 9 },
    { id: 3, name: '内网渗透', color: '#16a34a', usage_count: 6 },
    { id: 4, name: '应急响应', color: '#d97706', usage_count: 4 },
  ], q);
  if (M(/^\/api\/v1\/tags\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1 });

  if (P === '/api/v1/templates') return method === 'POST' ? ok({ id: 99, ...body }) : paged([
    { id: 1, name: '渗透测试报告模板', description: '标准渗透测试报告结构', content: '1. 项目概述\n2. 测试范围\n3. 漏洞详情\n4. 修复建议', use_count: 12, updated_at: iso(3) },
    { id: 2, name: '漏洞复现文档模板', description: '漏洞复现标准结构', content: '漏洞编号/影响版本/复现步骤/payload/修复方案', use_count: 8, updated_at: iso(6) },
  ], q);
  if (M(/^\/api\/v1\/templates\/(\d+)\/use$/)) return ok({ title: '（来自模板）', content: '1. 项目概述\n2. 测试范围\n3. 漏洞详情\n4. 修复建议' });
  if (M(/^\/api\/v1\/templates\/\d+$/)) return method === 'DELETE' ? ok(null) : ok({ id: 1, name: '模板' });

  if (P === '/api/v1/analytics/dashboard') return ok({ total_assets: assets.length, total_vulnerabilities: vulns.length, total_reports: reports.length, total_users: users.length, recent_vulnerabilities: vulns.slice(0, 5) });
  if (P === '/api/v1/analytics/overview') return ok({
    assets: assets.length, vulnerabilities: vulns.length, reports: reports.length, users: users.length,
    open_vulns: vulns.filter(v => v.status === 'new' || v.status === 'processing').length,
    fixed_rate: Math.round(vulns.filter(v => ['fixed', 'verified', 'closed'].includes(v.status)).length / vulns.length * 100) + '%',
  });
  if (P === '/api/v1/analytics/vulnerability') {
    const by_type = {};
    vulns.forEach(v => { by_type[v.vuln_type] = (by_type[v.vuln_type] || 0) + 1; });
    const by_severity = { 严重: 0, 高危: 0, 中危: 0, 低危: 0 };
    vulns.forEach(v => by_severity[v.severity_level_text]++);
    return ok({ by_severity, by_type });
  }
  if (P === '/api/v1/analytics/vulnerability/trend') return ok(vulnStats().recent_trend);
  if (P === '/api/v1/analytics/vulnerability/severity-trend') { const s = vulnStats().by_severity; return ok({ 严重: s[1], 高危: s[2], 中危: s[3], 低危: s[4] }); }
  if (P === '/api/v1/analytics/vulnerability/monthly-trends') return ok([{ month: '2026-05', count: 6 }, { month: '2026-06', count: 9 }, { month: '2026-07', count: 4 }, { month: '2026-08', count: 11 }, { month: '2026-09', count: 7 }, { month: '2026-10', count: 12 }]);
  if (P === '/api/v1/analytics/asset') return ok({ by_type: assetStats().by_type, by_department: assetStats().by_department });
  if (P === '/api/v1/analytics/asset/risk') return ok(topRiskAssets(8));
  if (P === '/api/v1/analytics/report') return ok({ by_type: { penetration_test: 1, security_audit: 2, compliance_check: 1, other: 1 }, by_status: { draft: 1, pending_review: 1, approved: 2, archived: 1 } });
  if (P === '/api/v1/analytics/user') {
    const top = {};
    vulns.forEach(v => { const n = v.discoverer?.real_name || '-'; top[n] = (top[n] || 0) + 1; });
    return ok({
      active_users: vulnStats().recent_trend.slice(-7).map(t => ({ date: t.date, count: t.count + 3 })),
      top_discoverers: Object.entries(top).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    });
  }
  if (P === '/api/v1/analytics/export') return ok({ download_url: '/api/mock-export.json', message: '导出任务已生成' });

  if (P === '/api/v1/api-test/endpoints') return ok([
    { method: 'GET', path: '/api/v1/public/ping', description: '存活检测' },
    { method: 'GET', path: '/api/v1/users', description: '用户列表' },
    { method: 'GET', path: '/api/v1/vulnerabilities', description: '漏洞列表' },
    { method: 'GET', path: '/api/v1/assets', description: '资产列表' },
    { method: 'GET', path: '/api/v1/analytics/dashboard', description: '仪表板' },
  ]);
  if (P === '/api/v1/api-test/docs') return ok({ title: 'VulnArk API', version: '1.0.0', swagger_url: '/swagger/index.html' });
  if (P === '/api/v1/api-test/token') return ok({ token: 'mock-test-token-' + now, expires_in: 3600 });
  if (P === '/api/v1/api-test/validate') return ok({ valid: true, message: '请求格式正确' });
  if (P === '/api/v1/api-test/test') return ok({ status: 200, message: '模拟请求成功' });

  if (P === '/api/v1/settings/2fa/status') return ok({ enabled: false });
  if (P === '/api/v1/settings/2fa/setup') return ok({ qr_code_url: '', secret: 'JBSWY3DPEHPK3PXP', backup_codes: ['12345678', '87654321'] });
  if (P === '/api/v1/settings/2fa/verify') return ok(null);
  if (P === '/api/v1/settings/2fa') return ok(null);
  if (P === '/api/v1/settings/profile' || P === '/api/v1/settings/password') return ok(null);
  if (P === '/api/v1/settings/system') return method === 'PUT' ? ok(null) : ok({ theme: 'light', language: 'zh-CN', timezone: 'Asia/Shanghai', date_format: 'YYYY-MM-DD', time_format: '24h' });
  if (P === '/api/v1/settings/notifications') return method === 'PUT' ? ok(null) : ok({ vuln_new_email: true, vuln_new_push: true, vuln_assigned_email: true, vuln_assigned_push: true, vuln_fixed_email: true, report_email: true, system_email: true, system_push: true });
  if (P === '/api/v1/settings/export') return ok({ exported_at: new Date().toISOString(), vulnerabilities: vulns.length, assets: assets.length, reports: reports.length });
  if (P === '/api/v1/settings/import' || P === '/api/v1/settings/cache/clear' || P === '/api/v1/settings/database/optimize') return ok(null);

  if (P === '/api/v1/ai/config') return method === 'POST' ? ok(null) : ok({ provider: 'deepseek', api_key: '', api_url: '', model: 'deepseek-chat', max_tokens: 2000, temperature: 0.7, timeout: 30, enabled: false });
  if (P === '/api/v1/ai/providers') return ok([{ id: 'openai', name: 'OpenAI', description: 'GPT系列', api_url: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'], default_model: 'gpt-3.5-turbo', requires_key: true }, { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek AI模型', api_url: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder'], default_model: 'deepseek-chat', requires_key: true }, { id: 'qwen', name: '通义千问', description: '阿里云通义千问', api_url: 'https://dashscope.aliyuncs.com/api/v1', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], default_model: 'qwen-turbo', requires_key: true }, { id: 'custom', name: '自定义', description: '自定义AI服务', models: [], default_model: '', requires_key: true }]);
  if (P === '/api/v1/ai/test') return ok({ success: true });
  if (P === '/api/v1/ai/stats') return ok({ total_conversations: 5, total_tokens: 1126 });
  if (P === '/api/v1/ai/conversations') return paged([{ id: 1, session_id: 'sess-demo-1', title: 'SQL注入修复方案', tokens_used: 412, messages: JSON.stringify([{ role: 'user', content: 'SQL注入漏洞怎么修复？' }, { role: 'assistant', content: 'SQL 注入修复建议：\n1. 使用参数化查询（预编译语句）\n2. ORM 框架绑定参数\n3. 最小权限原则配置数据库账号\n4. 对输入做白名单校验' }]), created_at: iso(1) }], q);
  if (M(/^\/api\/v1\/ai\/conversation\/[^/]+$/)) return ok(null);
  if (P === '/api/v1/ai/conversation') return ok({ session_id: 'sess-' + now });
  if (P === '/api/v1/ai/chat') return ok({ session_id: 'sess-' + now, reply: `【Mock 演示回复】收到问题：「${body?.message || ''}」\n\n1. 先确认漏洞类型与影响面（CVSS 打分）\n2. 给出可执行的复现步骤与 payload\n3. 提供针对性修复建议与验证方法\n\n（连接真实 AI 提供商后，这里会返回大模型回答：在「AI 配置」里填入 API Key 即可）` });

  // 公开接口
  if (P === '/api/status') return JSON.stringify({ code: 200, data: { status: 'ok', version: '1.0.0-mock', uptime: '3h 24m' } });
  if (P === '/api/health' || P === '/health') return JSON.stringify({ status: 'ok', timestamp: Math.floor(now / 1000), version: '1.0.0' });
  if (P === '/api/v1/public/system/info') return JSON.stringify({ code: 200, data: { name: 'VulnArk', version: '1.0.0-mock', environment: 'mock' } });
  if (P === '/api/v1/public/ping') return JSON.stringify({ message: 'pong' });

  return JSON.stringify({ code: 404, message: 'Mock: 未实现的接口 ' + method + ' ' + P });
}

const knowledgeList = [
  { id: 1, title: 'SQL 注入从入门到 bypass WAF', summary: '联合查询、报错注入、盲注与 WAF 绕过技巧汇总', content: '联合查询注入：\n1. order by 判断列数\n2. union select 联合查询\n3. information_schema 拿表列\n\nWAF 绕过：内联注释、大小写混合、编码变换…', category: '漏洞复现', status: 'published', views: 356, likes: 42, tags: [{ name: 'SQL注入' }, { name: '复现' }], author: user, created_at: iso(4), updated_at: iso(2) },
  { id: 2, title: 'Shiro 反序列化漏洞复现手册', summary: 'Shiro-550 (CVE-2016-4437) 完整复现流程', content: 'Shiro-550：默认 AES 密钥 kPH+bIxk5D2deZiIxcaaaA==…', category: '漏洞复现', status: 'published', views: 520, likes: 61, tags: [{ name: '复现' }], author: user, created_at: iso(6), updated_at: iso(3) },
  { id: 3, title: 'Log4j2 JNDI 注入原理与检测', summary: 'CVE-2021-44228 原理、利用与检测规则', content: '${jndi:ldap://…} 触发点与流量检测规则…', category: '组件漏洞', status: 'published', views: 388, likes: 37, tags: [{ name: '复现' }], author: user, created_at: iso(8), updated_at: iso(5) },
];

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.pdf': 'application/pdf' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(u.pathname);

  // API
  if (pathname.startsWith('/api/')) {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = { data: raw }; }
      const out = route(req.method, pathname, u.searchParams, body);
      if (typeof out === 'string' && out.startsWith('FILE:')) {
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${out.slice(5)}"` });
        res.end('%PDF-1.4 mock');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(out);
    });
    return;
  }

  // 静态文件
  let file = pathname === '/' ? '/index.html' : pathname;
  let fp = path.join(WEB, file);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(WEB, 'index.html'); // SPA fallback
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

server.listen(PORT, () => console.log(`[VulnArk Mock] http://localhost:${PORT}`));
