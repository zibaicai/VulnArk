// ============ 统计分析 ============
import { Analytics } from '../api.js';
import { esc, donutChart, lineChart, barChart, emptyBox, toast, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>统计分析</h1><div class="sub">漏洞趋势、资产风险与团队效能全方位分析</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="an-export">⬇ 导出数据</button></div>
    </div>
    <div class="tabs" id="an-tabs">
      <div class="tab active" data-t="vuln">漏洞分析</div>
      <div class="tab" data-t="asset">资产分析</div>
      <div class="tab" data-t="report">报告分析</div>
      <div class="tab" data-t="user">用户分析</div>
      <div class="tab" data-t="overview">系统概览</div>
    </div>
    <div id="an-body">${spinner()}</div>`;
  const body = document.getElementById('an-body');
  const loaders = { vuln: renderVuln, asset: renderAsset, report: renderReport, user: renderUser, overview: renderOverview };
  document.querySelectorAll('#an-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#an-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    (loaders[t.dataset.t] || renderVuln)().catch(e => body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`);
  });
  document.getElementById('an-export').onclick = () => {
    modal({
      title: '导出数据', size: 'sm',
      body: `<div class="form-item"><label>数据类型</label><select class="input" id="ex-type">
        <option value="vulnerabilities">漏洞数据</option><option value="assets">资产数据</option><option value="reports">报告数据</option></select></div>
      <div class="form-item"><label>格式</label><select class="input" id="ex-fmt"><option value="csv">CSV</option><option value="json">JSON</option></select></div>`,
      footer: `<button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">导出</button>`,
      onMount(m, close) {
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          try {
            const r = await Analytics.export({ type: m.querySelector('#ex-type').value, format: m.querySelector('#ex-fmt').value });
            toast('导出任务已生成' + (r?.download_url ? `，下载地址：${r.download_url}` : ''), 'success');
            if (r?.download_url) window.open(r.download_url);
            close();
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  };
  await renderVuln().catch(e => body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`);

  async function renderVuln() {
    body.innerHTML = spinner();
    const [trend, sevTrend, monthly, vuln] = await Promise.all([
      Analytics.vulnTrend({ days: 30 }).catch(() => null),
      Analytics.severityTrend().catch(() => null),
      Analytics.monthlyTrends().catch(() => null),
      Analytics.vulnerability().catch(() => null),
    ]);
    const sevData = sevTrend || vuln?.by_severity;
    body.innerHTML = `
      <div class="chart-grid">
        <div class="card"><div class="card-title">📈 漏洞发现趋势（近30天）</div>${trend ? lineChart(trend.map(t => ({ label: (t.date || '').slice(5), value: t.count }))) : emptyBox()}</div>
        <div class="card"><div class="card-title">🍩 严重程度占比</div>${donutChart(
          [['严重', '#dc2626'], ['高危', '#ea580c'], ['中危', '#d97706'], ['低危', '#16a34a']].map(([n, c]) => ({ label: n, value: sevData?.[n] ?? sevData?.[c] ?? 0, color: c })),
          { centerLabel: '漏洞总数' })}</div>
      </div>
      <div class="chart-grid mt">
        <div class="card"><div class="card-title">📊 月度趋势</div>${monthly && monthly.length ? lineChart(monthly.map(m => ({ label: m.month || m.date || '', value: m.count || m.value || 0 }))) : emptyBox('暂无月度数据')}</div>
        <div class="card"><div class="card-title">🗂 按漏洞类型分布</div>${vuln?.by_type || vuln?.by_owasp ? barChart(Object.entries(vuln.by_type || vuln.by_owasp || {}).map(([k, v]) => ({ label: k, value: v })), { horizontal: true }) : emptyBox('暂无数据')}</div>
      </div>`;
  }

  async function renderAsset() {
    body.innerHTML = spinner();
    const [asset, risk] = await Promise.all([Analytics.asset().catch(() => null), Analytics.assetRisk().catch(() => null)]);
    const riskList = Array.isArray(risk) ? risk : (risk?.data || risk?.assets || []);
    body.innerHTML = `
      <div class="chart-grid">
        <div class="card"><div class="card-title">🖥 资产类型分布</div>${asset?.by_type ? donutChart(Object.entries(asset.by_type).map(([k, v], i) => ({ label: k, value: v, color: ['#2563eb', '#8b5cf6', '#06b6d4', '#64748b'][i % 4] })), { centerLabel: '资产总数' }) : emptyBox()}</div>
        <div class="card"><div class="card-title">🏢 按部门分布</div>${asset?.by_department ? barChart(Object.entries(asset.by_department).map(([k, v]) => ({ label: k || '未分配', value: v })), { horizontal: true }) : emptyBox()}</div>
      </div>
      <div class="card mt"><div class="card-title">⚠ 资产风险评估</div>
        ${riskList.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>资产</th><th>漏洞数</th><th>风险分</th><th>风险等级</th></tr></thead><tbody>
          ${riskList.map(a => {
            const score = a.risk_score ?? a.score ?? 0;
            const lv = score >= 80 ? ['高风险', 'sev-1'] : score >= 50 ? ['中风险', 'sev-3'] : ['低风险', 'sev-4'];
            return `<tr><td class="cell-main">${esc(a.name || a.asset?.name || '-')}</td><td>${a.vulnerability_count ?? a.vuln_count ?? 0}</td><td>${score}</td><td><span class="badge ${lv[1]}">${lv[0]}</span></td></tr>`;
          }).join('')}</tbody></table></div>` : emptyBox('暂无风险评估数据')}
      </div>`;
  }

  async function renderReport() {
    body.innerHTML = spinner();
    let rep;
    try { rep = await Analytics.report(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = `
      <div class="chart-grid">
        <div class="card"><div class="card-title">📄 报告类型分布</div>${rep?.by_type ? donutChart(Object.entries(rep.by_type).map(([k, v], i) => ({ label: k, value: v })), { centerLabel: '报告总数' }) : emptyBox()}</div>
        <div class="card"><div class="card-title">📦 报告状态分布</div>${rep?.by_status ? barChart(Object.entries(rep.by_status).map(([k, v]) => ({ label: k, value: v })), { horizontal: true }) : emptyBox()}</div>
      </div>`;
  }

  async function renderUser() {
    body.innerHTML = spinner();
    let ua;
    try { ua = await Analytics.user(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = `
      <div class="chart-grid">
        <div class="card"><div class="card-title">👥 用户活跃度</div>${ua?.active_users || ua?.activity ? lineChart((ua.active_users || ua.activity || []).map(a => ({ label: (a.date || '').slice(5), value: a.count || a.value || 0 }))) : emptyBox('暂无活跃度数据')}</div>
        <div class="card"><div class="card-title">🏆 漏洞发现排行</div>${ua?.top_discoverers || ua?.by_discoverer ? barChart((ua.top_discoverers || ua.by_discoverer || []).map(u => ({ label: u.name || u.username || '-', value: u.count || u.value || 0 })), { horizontal: true, color: '#8b5cf6' }) : emptyBox('暂无排行数据')}</div>
      </div>`;
  }

  async function renderOverview() {
    body.innerHTML = spinner();
    let ov;
    try { ov = await Analytics.overview(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = `<div class="card"><div class="card-title">🌐 系统概览</div>
      <div class="stat-grid" style="margin:0">
        ${Object.entries(ov || {}).filter(([k, v]) => typeof v === 'number').slice(0, 8).map(([k, v]) => `
        <div class="stat-card stat-blue"><div><div class="label">${esc(k)}</div><div class="value">${v}</div></div></div>`).join('') || '<div class="empty">暂无概览数据</div>'}
      </div></div>`;
  }
}
