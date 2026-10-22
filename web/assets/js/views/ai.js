// ============ AI 助手 ============
import { AI } from '../api.js';
import { esc, fmtTime, toast, modal, spinner, emptyBox } from '../ui.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div><h1>AI 助手</h1><div class="sub">智能问答 · 漏洞分析辅助 · 修复建议生成</div></div>
      <div class="page-actions">
        <div class="flex muted" id="ai-stats-mini"></div>
        <button class="btn" id="ai-config-btn">⚙ AI 配置</button>
      </div>
    </div>
    <div class="ai-layout">
      <div class="card" style="display:flex;flex-direction:column;overflow:hidden;padding:0">
        <div style="padding:14px"><button class="btn btn-primary" id="ai-new" style="width:100%;justify-content:center">+ 新对话</button></div>
        <div id="ai-conv-list" style="flex:1;overflow-y:auto;padding:0 10px 10px"></div>
      </div>
      <div class="chat-panel">
        <div class="chat-msgs" id="ai-msgs">
          <div style="text-align:center;margin:auto">
            <div style="font-size:44px">🤖</div>
            <h3 style="margin:8px 0 4px">欢迎使用 AI 助手</h3>
            <p class="muted">我可以帮你分析漏洞、生成修复建议、编写复现步骤</p>
          </div>
        </div>
        <div class="chat-suggests" id="ai-suggests">
          <div class="sg">分析一个 SQL 注入漏洞的危害和修复方案</div>
          <div class="sg">帮我写一份漏洞复现步骤模板</div>
          <div class="sg">解释 OWASP Top 10 中的 SSRF</div>
          <div class="sg">如何对内网主机做安全加固？</div>
        </div>
        <div class="chat-input">
          <textarea class="input" id="ai-input" placeholder="输入你的问题… (Enter 发送, Shift+Enter 换行)"></textarea>
          <button class="btn btn-primary" id="ai-send" style="align-self:flex-end">发送</button>
        </div>
      </div>
    </div>`;

  let sessionId = null;
  let convs = [];
  const msgsEl = document.getElementById('ai-msgs');

  // 加载统计与对话列表
  loadStats();
  loadConvs();

  async function loadStats() {
    try {
      const st = await AI.stats();
      document.getElementById('ai-stats-mini').innerHTML = `
        <span><b>${st?.total_conversations ?? st?.conversations ?? 0}</b> 总对话</span>
        <span><b>${st?.total_tokens ?? st?.tokens_used ?? 0}</b> 总Token</span>`;
    } catch (e) { /* ignore */ }
  }

  async function loadConvs() {
    const box = document.getElementById('ai-conv-list');
    try {
      const res = await AI.conversations({ page: 1, page_size: 30 });
      convs = res?.data || res || [];
      box.innerHTML = convs.length ? convs.map(c => `
        <div class="flex-between" style="padding:9px 10px;border-radius:8px;cursor:pointer" data-sid="${esc(c.session_id)}" data-title="${esc(c.title || '新对话')}">
          <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">💬 ${esc(c.title || c.session_id.slice(0, 12))}</span>
          <button class="btn-link danger" data-del="${esc(c.session_id)}" style="flex-shrink:0">×</button>
        </div>`).join('') : `<div class="empty" style="padding:20px 0">暂无对话记录</div>`;
      box.querySelectorAll('[data-sid]').forEach(el => el.onclick = e => {
        if (e.target.dataset.del !== undefined) return;
        openConv(el.dataset.sid, el.dataset.title);
      });
      box.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => {
        confirmDialog('确定删除该对话？', async () => {
          try { await AI.deleteConversation(b.dataset.del); toast('已删除', 'success'); if (b.dataset.del === sessionId) sessionId = null; loadConvs(); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function openConv(sid, title) {
    sessionId = sid;
    msgsEl.innerHTML = `<div class="spinner"></div>`;
    try {
      const conv = convs.find(c => c.session_id === sid);
      let messages = [];
      if (conv?.messages) { try { messages = JSON.parse(conv.messages); } catch (e) { /* ignore */ } }
      msgsEl.innerHTML = '';
      (messages || []).forEach(m => addMsg(m.role, m.content));
      if (!messages || !messages.length) {
        msgsEl.innerHTML = `<div style="text-align:center;margin:auto"><div style="font-size:40px">🤖</div><p class="muted">${esc(title)} · 继续对话</p></div>`;
      }
    } catch (e) { msgsEl.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  function addMsg(role, content) {
    const welcome = msgsEl.querySelector('[style*="margin:auto"]');
    if (welcome) welcome.remove();
    const div = document.createElement('div');
    div.className = `msg ${role === 'user' ? 'user' : 'assistant'}`;
    div.textContent = content;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  async function send(text) {
    if (!text.trim()) return;
    addMsg('user', text);
    const input = document.getElementById('ai-input');
    input.value = '';
    const loading = addMsg('assistant', '思考中…');
    try {
      const payload = { message: text };
      if (sessionId) payload.session_id = sessionId; else payload.new_conversation = true;
      const res = await AI.chat(payload);
      sessionId = res?.session_id || sessionId;
      loading.textContent = res?.reply || res?.content || res?.message || '(空回复)';
      if (!sessionId) sessionId = res?.session_id;
      loadConvs(); loadStats();
    } catch (e) {
      loading.textContent = '❌ ' + (e.message || '请求失败');
      loading.style.background = '#fee2e2';
    }
  }

  document.getElementById('ai-send').onclick = () => send(document.getElementById('ai-input').value);
  document.getElementById('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); }
  });
  document.getElementById('ai-new').onclick = () => { sessionId = null; msgsEl.innerHTML = `<div style="text-align:center;margin:auto"><div style="font-size:40px">🤖</div><p class="muted">新对话已就绪，输入你的问题吧</p></div>`; };
  document.querySelectorAll('#ai-suggests .sg').forEach(sg => sg.onclick = () => send(sg.textContent));

  // AI 配置
  document.getElementById('ai-config-btn').onclick = async () => {
    let cfg = {}, providers = [];
    try { cfg = await AI.getConfig() || {}; } catch (e) { /* ignore */ }
    try { providers = await AI.providers(); } catch (e) { /* ignore */ }
    const provs = Array.isArray(providers) ? providers : (providers?.data || []);
    modal({
      title: 'AI 配置', size: 'lg',
      body: `<div class="form-grid">
        <div class="form-item"><label>提供商</label><select class="input" id="ac-provider">
          ${provs.map(p => `<option value="${esc(p.id)}" ${cfg.provider === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="form-item"><label>模型</label><select class="input" id="ac-model"></select></div>
        <div class="form-item full"><label>API Key</label><input class="input" id="ac-key" type="password" value="${esc(cfg.api_key || '')}" placeholder="sk-..."></div>
        <div class="form-item full"><label>API 地址</label><input class="input" id="ac-url" value="${esc(cfg.api_url || '')}" placeholder="留空使用默认地址"></div>
        <div class="form-item"><label>最大 Tokens</label><input class="input" id="ac-tokens" type="number" value="${cfg.max_tokens ?? 2000}"></div>
        <div class="form-item"><label>Temperature</label><input class="input" id="ac-temp" type="number" step="0.1" min="0" max="2" value="${cfg.temperature ?? 0.7}"></div>
        <div class="form-item"><label>超时时间 (秒)</label><input class="input" id="ac-timeout" type="number" value="${cfg.timeout ?? 30}"></div>
        <div class="form-item"><label>启用 AI</label><select class="input" id="ac-enabled"><option value="1" ${cfg.enabled ? 'selected' : ''}>启用</option><option value="0" ${!cfg.enabled ? 'selected' : ''}>停用</option></select></div>
      </div>`,
      footer: `<button class="btn" data-act="test">测试连接</button><button class="btn" data-act="c">取消</button><button class="btn btn-primary" data-act="ok">保存配置</button>`,
      onMount(m, close) {
        const provSel = m.querySelector('#ac-provider'), modelSel = m.querySelector('#ac-model');
        const fillModels = () => {
          const p = provs.find(x => x.id === provSel.value);
          const models = p?.models || [];
          modelSel.innerHTML = models.map(mo => `<option value="${esc(mo)}" ${cfg.model === mo ? 'selected' : ''}>${esc(mo)}</option>`).join('') + (models.length ? '' : `<option value="">自定义（在API地址中指定）</option>`);
          if (p && !p.requires_key) m.querySelector('#ac-key').placeholder = '此提供商无需密钥';
        };
        provSel.onchange = fillModels; fillModels();
        if (!cfg.api_url && provs.length) { const p = provs.find(x => x.id === provSel.value); if (p?.api_url) m.querySelector('#ac-url').value = ''; }
        m.querySelector('[data-act=c]').onclick = close;
        m.querySelector('[data-act=ok]').onclick = async () => {
          const d = {
            provider: provSel.value,
            model: modelSel.value,
            api_key: m.querySelector('#ac-key').value.trim(),
            api_url: m.querySelector('#ac-url').value.trim(),
            max_tokens: +m.querySelector('#ac-tokens').value || 2000,
            temperature: parseFloat(m.querySelector('#ac-temp').value) || 0.7,
            timeout: +m.querySelector('#ac-timeout').value || 30,
            enabled: m.querySelector('#ac-enabled').value === '1',
          };
          try { await AI.saveConfig(d); toast('AI 配置已保存', 'success'); close(); }
          catch (e) { toast(e.message, 'error'); }
        };
        m.querySelector('[data-act=test]').onclick = async () => {
          toast('正在测试 AI 连接…');
          try {
            await AI.test({ provider: provSel.value, api_key: m.querySelector('#ac-key').value.trim(), api_url: m.querySelector('#ac-url').value.trim(), model: modelSel.value });
            toast('AI 连接测试成功', 'success');
          } catch (e) { toast('连接失败：' + e.message, 'error'); }
        };
      },
    });
  };
}
