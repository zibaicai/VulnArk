// ============ 仪表板 ============
import { Analytics, Vulns } from '../api.js';
import { esc, fmtTime, sevBadge, statusBadge, donutChart, lineChart, sevBars, spinner, emptyBox } from '../ui.js';

const STAT_COLORS = { 1: '#dc2626', 2: '#ea580c', 3: '#d97706', 4: '#16a34a' };

export async function renderDashboard(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>仪表板</h1><div class="sub">系统概览和关键指标 · 最后更新: ${fmtTime(new Date().toISOString())}</div></div>
      <div class="page-actions">
        <button class="btn" id="dash-refresh">刷新数据</button>
        <a class="btn btn-primary" href="#/vulnerabilities/new">+ 新增漏洞</a>
      </div>
    </div>
    <div id="dash-body">${spinner()}</div>`;

  const load = async () => {
    const body = document.getElementById('dash-body');
    body.innerHTML = spinner();
    // 并行请求仪表盘分析与漏洞统计
    const [dash, vstats] = await Promise.all([
      Analytics.dashboard().catch(() => null),
      Vulns.stats().catch(() => null),
    ]);
    const totalAssets = dash?.total_assets ?? dash?.asset_count ?? 0;
    const totalVulns = dash?.total_vulnerabilities ?? vstats?.total ?? 0;
    const totalReports = dash?.total_reports ?? 0;
    const totalUsers = dash?.total_users ?? 0;
    const bySeverity = vstats?.by_severity || {};
    const trend = vstats?.recent_trend || [];

    const statCard = (cls, label, value, desc, icon) => `
      <div class="stat-card ${cls}"><div>
        <div class="label">${label}</div><div class="value">${value}</div><div class="desc">${desc}</div>
      </div><div class="icon">${icon}</div></div>`;

    const icons = {
      a: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/></svg>',
      v: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>',
      r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
      u: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/></svg>',
    };

    const recent = (dash?.recent_vulnerabilities || dash?.recent || []).slice(0, 6);

    body.innerHTML = `
      <div class="stat-grid">
        ${statCard('stat-blue', '总资产数', totalAssets, '系统管理的所有资产', icons.a)}
        ${statCard('stat-red', '总漏洞数', totalVulns, '发现的安全漏洞总数', icons.v)}
        ${statCard('stat-green', '总报告数', totalReports, '生成的安全报告', icons.r)}
        ${statCard('stat-purple', '总用户数', totalUsers, '系统注册用户', icons.u)}
      </div>
      <div class="chart-grid">
        <div class="card"><div class="card-title">⚠ 漏洞严重程度分布</div>
          ${donutChart([1, 2, 3, 4].map(lv => ({ label: { 1: '严重', 2: '高危', 3: '中危', 4: '低危' }[lv], value: bySeverity[lv] || bySeverity[String(lv)] || 0, color: STAT_COLORS[lv] })), { centerLabel: '漏洞总数' })}
        </div>
        <div class="card"><div class="card-title">🛡 严重程度概览</div>${sevBars(bySeverity)}
          <div class="section-block"><h4>状态分布</h4>
            <div class="flex" style="flex-wrap:wrap;gap:8px">
              ${Object.entries(vstats?.by_status || {}).map(([k, v]) => `<span class="muted">${esc(k)}: <b>${v}</b></span>`).join(' · ') || '<span class="muted">暂无</span>'}
            </div>
          </div>
        </div>
      </div>
      <div class="card mt"><div class="card-title">📈 近期漏洞趋势</div>${trend.length ? lineChart(trend.map(t => ({ label: (t.date || '').slice(5), value: t.count }))) : emptyBox('暂无趋势数据')}</div>
      <div class="card"><div class="card-title">🕐 最近发现漏洞</div>
        <div class="table-wrap"><table class="table"><thead><tr><th>漏洞</th><th>严重程度</th><th>状态</th><th>发现时间</th></tr></thead><tbody>
        ${recent.length ? recent.map(v => `<tr style="cursor:pointer" onclick="location.hash='#/vulnerabilities/${v.id}'">
          <td><div class="cell-main">${esc(v.title)}</div><div class="cell-sub">${esc(v.asset?.name || '')}</div></td>
          <td>${sevBadge(v.severity_level, v.severity_level_text)}</td>
          <td>${statusBadge(v.status, v.status_text)}</td>
          <td class="muted">${fmtTime(v.discovered_at || v.created_at)}</td></tr>`).join('') : `<tr><td colspan="4">${emptyBox('暂无漏洞数据，点击右上角新增漏洞开始使用')}</td></tr>`}
        </tbody></table></div></div>`;
  };

  document.getElementById('dash-refresh').onclick = () => load().catch(e => { document.getElementById('dash-body').innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; });
  await load();
}
