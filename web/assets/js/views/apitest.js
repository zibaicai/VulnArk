// ============ API 调试工具 ============
import { ApiTest } from '../api.js';
import { esc, fmtTime, emptyBox, toast, spinner } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>API 调试</h1><div class="sub">在线测试平台接口、生成临时 Token、查看接口文档</div></div>
    </div>
    <div class="tabs" id="at-tabs">
      <div class="tab active" data-t="test">🧪 接口测试</div>
      <div class="tab" data-t="endpoints">📡 端点列表</div>
      <div class="tab" data-t="token">🔑 Token 生成</div>
      <div class="tab" data-t="docs">📚 接口文档</div>
      <div class="tab" data-t="validate">✔ 请求校验</div>
    </div>
    <div id="at-body"></div>`;
  const body = document.getElementById('at-body');
  const loaders = { test: renderTest, endpoints: renderEndpoints, token: renderToken, docs: renderDocs, validate: renderValidate };
  document.querySelectorAll('#at-tabs .tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('#at-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    (loaders[t.dataset.t] || renderTest)();
  });
  await renderTest();

  function renderTest() {
    body.innerHTML = `
      <div class="card"><div class="card-title">🧪 接口测试</div>
        <div class="form-grid">
          <div class="form-item"><label>请求方法</label><select class="input" id="at-method">
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></div>
          <div class="form-item"><label>路径（/api/v1 开头）</label><input class="input" id="at-path" value="/api/v1/public/ping"></div>
          <div class="form-item full"><label>请求体 JSON（POST/PUT 时使用）</label><textarea class="input" id="at-body" rows="4" placeholder='{"key": "value"}'></textarea></div>
        </div>
        <div class="flex mt"><button class="btn btn-primary" id="at-run">▶ 发送请求</button></div>
        <div class="section-block mt" id="at-result"><span class="muted">等待请求…</span></div>
      </div>`;
    document.getElementById('at-run').onclick = async () => {
      const box = document.getElementById('at-result');
      box.innerHTML = spinner();
      const method = document.getElementById('at-method').value;
      const path = document.getElementById('at-path').value.trim();
      let bodyJson;
      const raw = document.getElementById('at-body').value.trim();
      if (raw && method !== 'GET') { try { bodyJson = JSON.parse(raw); } catch (e) { box.innerHTML = `<span style="color:var(--danger)">请求体 JSON 格式错误：${esc(e.message)}</span>`; return; } }
      const start = performance.now();
      try {
        const res = await fetch(path.startsWith('/') ? path : '/' + path, {
          method,
          headers: { Authorization: 'Bearer ' + (localStorage.getItem('vulnark_token') || ''), 'Content-Type': 'application/json' },
          body: bodyJson ? JSON.stringify(bodyJson) : undefined,
        });
        const text = await res.text();
        const ms = Math.round(performance.now() - start);
        let pretty = text;
        try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* keep */ }
        box.innerHTML = `<div class="flex-between mb"><span class="badge ${res.ok ? 'st-fixed' : 'sev-1'}">${res.status} ${res.statusText}</span><span class="muted">耗时 ${ms}ms</span></div>
          <pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;max-height:360px;overflow:auto">${esc(pretty)}</pre>`;
      } catch (e) { box.innerHTML = `<span style="color:var(--danger)">请求失败：${esc(e.message)}</span>`; }
    };
  }

  async function renderEndpoints() {
    body.innerHTML = spinner();
    let res;
    try { res = await ApiTest.endpoints(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    const data = res?.endpoints || res?.data || res || [];
    const list = Array.isArray(data) ? data : Object.entries(data).map(([k, v]) => ({ group: k, ...(typeof v === 'object' ? v : { path: v }) }));
    body.innerHTML = `<div class="card"><div class="card-title">📡 可用测试端点</div>
      ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>方法</th><th>路径</th><th>说明</th><th>操作</th></tr></thead><tbody>
      ${list.map(e => `<tr>
        <td><span class="badge ${e.method === 'GET' ? 'st-new' : e.method === 'DELETE' ? 'sev-1' : 'st-processing'}">${esc(e.method || 'GET')}</span></td>
        <td><code class="inline">${esc(e.path || e.url || '-')}</code></td>
        <td class="muted">${esc(e.description || e.desc || '-')}</td>
        <td><button class="btn-link" data-path="${esc(e.path || e.url || '')}">测试 →</button></td></tr>`).join('')}
      </tbody></table></div>` : emptyBox('暂无端点信息')}</div>`;
    body.querySelectorAll('[data-path]').forEach(b => b.onclick = () => {
      document.querySelector('[data-t="test"]').click();
      document.getElementById('at-path').value = b.dataset.path;
      document.getElementById('at-run').click();
    });
  }

  function renderToken() {
    body.innerHTML = `
      <div class="card"><div class="card-title">🔑 生成测试 Token</div>
        <div class="form-grid">
          <div class="form-item"><label>用户名</label><input class="input" id="tk-user" placeholder="admin"></div>
          <div class="form-item"><label>密码</label><input class="input" id="tk-pass" type="password"></div>
        </div>
        <div class="flex mt"><button class="btn btn-primary" id="tk-gen">生成 Token</button></div>
        <div class="section-block mt" id="tk-result"><span class="muted">等待生成…</span></div>
      </div>`;
    document.getElementById('tk-gen').onclick = async () => {
      const box = document.getElementById('tk-result');
      box.innerHTML = spinner();
      try {
        const r = await ApiTest.token({ username: document.getElementById('tk-user').value.trim(), password: document.getElementById('tk-pass').value });
        box.innerHTML = `<p style="font-size:13px">✅ Token 生成成功：</p><pre style="white-space:pre-wrap;word-break:break-all;font-family:Consolas,monospace;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px">${esc(r?.token || JSON.stringify(r))}</pre>`;
      } catch (e) { box.innerHTML = `<span style="color:var(--danger)">生成失败：${esc(e.message)}</span>`; }
    };
  }

  async function renderDocs() {
    body.innerHTML = spinner();
    let docs;
    try { docs = await ApiTest.docs(); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = `<div class="card"><div class="card-title">📚 API 文档</div>
      <div class="section-block"><pre style="max-height:400px;overflow:auto">${esc(typeof docs === 'string' ? docs : JSON.stringify(docs, null, 2))}</pre></div>
      <p class="muted mt">完整 Swagger 文档：<a href="/swagger/index.html" target="_blank">/swagger/index.html</a></p></div>`;
  }

  function renderValidate() {
    body.innerHTML = `
      <div class="card"><div class="card-title">✔ 请求校验</div>
        <div class="form-item"><label>待校验的请求 JSON</label><textarea class="input" id="vv-json" rows="6" placeholder='{"method": "GET", "path": "/api/v1/users"}'></textarea></div>
        <div class="flex mt"><button class="btn btn-primary" id="vv-run">校验</button></div>
        <div class="section-block mt" id="vv-result"><span class="muted">等待校验…</span></div>
      </div>`;
    document.getElementById('vv-run').onclick = async () => {
      const box = document.getElementById('vv-result');
      let d;
      try { d = JSON.parse(document.getElementById('vv-json').value); }
      catch (e) { box.innerHTML = `<span style="color:var(--danger)">JSON 格式错误：${esc(e.message)}</span>`; return; }
      box.innerHTML = spinner();
      try {
        const r = await ApiTest.validate(d);
        box.innerHTML = `<span class="badge ${r?.valid ? 'st-fixed' : 'sev-1'}">${r?.valid ? '校验通过' : '校验失败'}</span>
          <pre style="white-space:pre-wrap;margin-top:10px;font-size:12px">${esc(JSON.stringify(r, null, 2))}</pre>`;
      } catch (e) { box.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`; }
    };
  }
}
