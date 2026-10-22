// 把 mock-data.mjs 生成的演示数据导出为 seed/demo-data.json
// 用法：node deploy/export-seed.mjs      （需要 Node 18+）
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { users, assets, vulns, OWASP, COMPANY } from '../mock-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../seed/demo-data.json');

const data = {
  company: COMPANY,
  owasp: OWASP.map(o => ({ id: o.id, code: o.code, name: o.name, year: 2021 })),
  users: users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    real_name: u.real_name,
    phone: u.phone,
    department: u.department,
    role_id: u.role.id,
    password: 'VulnArk@2026',
  })),
  assets: assets.map(a => ({
    id: a.id,
    name: a.name, type: a.type, category: a.category,
    ip_address: a.ip_address, domain: a.domain, port: a.port,
    os: a.os, version: a.version,
    department: a.department, business_line: a.business_line,
    importance_level: a.importance_level,
    description: a.description, status: a.status,
    owner_id: a.owner_id,
    company: a.company, system_name: a.system_name, environment: a.environment,
    fingerprint: a.fingerprint, services: a.services,
    middleware: a.middleware, framework: a.framework,
  })),
  vulns: vulns.map(v => ({
    id: v.id,
    title: v.title, vuln_type: v.vuln_type, intel_id: String(v.intel_id || ''),
    description: v.description,
    cve_id: v.cve_id, cnvd_id: v.cnvd_id,
    owasp_category_id: v.owasp_category_id,
    severity_level: v.severity_level, cvss_score: v.cvss_score,
    asset_id: v.asset_id,
    assignee_id: v.assignee_id,
    status: v.status,
    impact_scope: v.impact_scope,
    reproduction_steps: v.reproduction_steps,
    fix_suggestion: v.fix_suggestion,
    source: v.source, fingerprint: v.fingerprint,
    discovered_at: v.discovered_at,
    assigned_at: v.assigned_at, fixed_at: v.fixed_at,
    verified_at: v.verified_at, closed_at: v.closed_at,
  })),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data), 'utf8');
console.log('written:', out);
console.log('users', data.users.length, '| assets', data.assets.length, '| vulns', data.vulns.length, '| owasp', data.owasp.length);
