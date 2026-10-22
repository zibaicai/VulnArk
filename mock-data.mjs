// ============ Mock 演示数据生成器：几百个资产 + 真实感漏洞 ============
// 资产包含：所属公司 / 业务系统 / 负责人 / 环境与指纹（OS、中间件、框架、开放端口）
// 漏洞与「漏洞资料」条目一一关联（intel_id），前端点击漏洞名可直接跳到资料查看描述与修复建议。
import { INTEL_ALL } from './web/assets/js/data/vuln-intel.js';

// ---------- 确定性随机（保证每次启动数据一致）----------
let _seed = 20261022;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[ri(0, arr.length - 1)];
const pickN = (arr, n) => { const c = [...arr], o = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(ri(0, c.length - 1), 1)[0]); return o; };

const now = Date.now();
export const iso = (d) => new Date(now - d * 864e5).toISOString();

// ---------- 公司 / 组织 ----------
export const COMPANY = '恒邦控股集团（示例数据）';

// ---------- 人员 ----------
const PEOPLE = [
  ['张伟', '安全部', '安全经理'], ['李静', '安全部', '安全工程师'], ['王强', '安全部', '渗透测试工程师'],
  ['刘洋', '运维部', '运维经理'], ['陈晨', '运维部', '数据库管理员'], ['赵敏', '运维部', '系统运维工程师'],
  ['孙磊', '研发中心', '后端负责人'], ['周涛', '研发中心', 'Java 工程师'], ['吴娜', '研发中心', '前端工程师'],
  ['郑凯', '研发中心', '架构师'], ['冯磊', 'IT 部门', '网络工程师'], ['许静', '数据部', '数据平台工程师'],
  ['何超', 'IT 部门', '桌面运维'], ['邓丽', '财务部', '系统管理员'],
];
export const users = PEOPLE.map((p, i) => ({
  id: i + 1, username: 'user' + (i + 1), email: `user${i + 1}@hbjt.com`,
  real_name: p[0], phone: '13' + (100000000 + i * 1234567).toString().slice(0, 9),
  avatar: '', department: p[1], position: p[2], status: 1,
  role: { id: i === 0 ? 1 : 2, name: i === 0 ? '管理员' : (p[1] === '安全部' ? '安全工程师' : '普通用户') },
  last_login_at: iso(ri(0, 3)),
}));
export const admin = { ...users[0], role: { id: 1, name: '管理员', description: '系统管理员', permissions: ['*'] } };

// ---------- 业务系统 ----------
const SYSTEMS = [
  { code: 'erp', name: 'ERP 系统', domain: 'erp.hbjt.com', biz: '核心业务', dept: 'IT 部门', base: '10.20.1', imp: 1 },
  { code: 'oa', name: 'OA 办公系统', domain: 'oa.hbjt.com', biz: '办公协同', dept: 'IT 部门', base: '10.20.2', imp: 1 },
  { code: 'crm', name: 'CRM 客户管理系统', domain: 'crm.hbjt.com', biz: '核心业务', dept: '研发中心', base: '10.20.3', imp: 1 },
  { code: 'fin', name: '财务核算系统', domain: 'fin.hbjt.com', biz: '财务', dept: '财务部', base: '10.20.4', imp: 1 },
  { code: 'hr', name: 'HR 人事系统', domain: 'hr.hbjt.com', biz: '人力', dept: 'IT 部门', base: '10.20.5', imp: 2 },
  { code: 'mail', name: '企业邮件系统', domain: 'mail.hbjt.com', biz: '办公协同', dept: 'IT 部门', base: '10.20.6', imp: 1 },
  { code: 'portal', name: '集团官网门户', domain: 'www.hbjt.com', biz: '对外服务', dept: '研发中心', base: '10.20.7', imp: 2 },
  { code: 'scm', name: '供应链管理系统', domain: 'scm.hbjt.com', biz: '供应链', dept: '研发中心', base: '10.20.8', imp: 1 },
  { code: 'wms', name: '仓储管理系统', domain: 'wms.hbjt.com', biz: '供应链', dept: 'IT 部门', base: '10.20.9', imp: 2 },
  { code: 'shop', name: '电商商城', domain: 'shop.hbjt.com', biz: '对外服务', dept: '研发中心', base: '10.20.10', imp: 1 },
  { code: 'member', name: '会员中心', domain: 'member.hbjt.com', biz: '对外服务', dept: '研发中心', base: '10.20.11', imp: 2 },
  { code: 'pay', name: '支付网关', domain: 'pay.hbjt.com', biz: '资金', dept: '财务部', base: '10.20.12', imp: 1 },
  { code: 'data', name: '数据中台', domain: 'data.hbjt.com', biz: '数据平台', dept: '数据部', base: '10.20.13', imp: 2 },
  { code: 'bi', name: 'BI 报表平台', domain: 'bi.hbjt.com', biz: '数据平台', dept: '数据部', base: '10.20.14', imp: 3 },
  { code: 'cicd', name: 'CI/CD 平台', domain: 'cicd.hbjt.com', biz: '研发效能', dept: '研发中心', base: '10.20.15', imp: 2 },
  { code: 'mon', name: '监控与日志平台', domain: 'mon.hbjt.com', biz: '运维支撑', dept: '运维部', base: '10.20.16', imp: 2 },
  { code: 'net', name: '边界网络区', domain: '', biz: '网络', dept: 'IT 部门', base: '10.20.17', imp: 1 },
  { code: 'office', name: '办公网终端', domain: '', biz: '办公', dept: 'IT 部门', base: '10.30.1', imp: 3 },
  { code: 'test', name: '测试环境', domain: 'test.hbjt.com', biz: '测试', dept: '研发中心', base: '10.40.1', imp: 3 },
  { code: 'dr', name: '灾备机房', domain: '', biz: '灾备', dept: '运维部', base: '10.50.1', imp: 2 },
];

// ---------- 主机角色模板（决定指纹）----------
const ROLES = [
  { key: 'web', type: 'server', cat: 'web', ports: '80,443', os: ['CentOS 7.9', 'Ubuntu 22.04', 'CentOS 6.10'], mw: ['Nginx 1.20.1', 'Apache 2.4.6', 'Nginx 1.18.0'], fw: ['PHP 7.4.33', 'jQuery 3.6.0', 'Bootstrap 4.6'] },
  { key: 'app', type: 'application', cat: 'java', ports: '8080,8009', os: ['CentOS 7.9', 'Windows Server 2019'], mw: ['Tomcat 8.5.31', 'Spring Boot 2.7.12 内嵌 Tomcat', 'WebLogic 12.2.1.4'], fw: ['Spring MVC 5.3.20', 'Fastjson 1.2.68', 'MyBatis 3.5.9', 'Shiro 1.2.4'] },
  { key: 'app2', type: 'application', cat: 'php', ports: '8081,9000', os: ['Ubuntu 20.04', 'CentOS 7.6'], mw: ['Nginx 1.16.1 + PHP-FPM 7.2', 'IIS 10.0 + ASP.NET 4.7'], fw: ['ThinkPHP 5.0.24', 'Laravel 6.20', 'Dedecms 5.7'] },
  { key: 'db', type: 'database', cat: 'mysql', ports: '3306', os: ['Ubuntu 22.04', 'CentOS 7.9'], mw: ['MySQL 8.0.32', 'MySQL 5.7.41', 'MariaDB 10.6'], fw: [] },
  { key: 'db2', type: 'database', cat: 'sqlserver', ports: '1433', os: ['Windows Server 2019', 'Windows Server 2012 R2'], mw: ['SQL Server 2019', 'SQL Server 2014'], fw: ['.NET Framework 4.8'] },
  { key: 'db3', type: 'database', cat: 'oracle', ports: '1521', os: ['CentOS 7.9', 'AIX 7.2'], mw: ['Oracle 19c', 'Oracle 11g'], fw: [] },
  { key: 'cache', type: 'database', cat: 'redis', ports: '6379', os: ['CentOS 7.9'], mw: ['Redis 6.2.7', 'Redis 7.0.11'], fw: [] },
  { key: 'cache2', type: 'database', cat: 'mongodb', ports: '27017', os: ['Ubuntu 22.04'], mw: ['MongoDB 5.0.14', 'MongoDB 4.4.6'], fw: [] },
  { key: 'search', type: 'database', cat: 'elasticsearch', ports: '9200,9300', os: ['CentOS 7.9'], mw: ['Elasticsearch 7.17.9', 'Elasticsearch 6.8.23'], fw: ['Kibana 7.17.9'] },
  { key: 'mq', type: 'application', cat: 'mq', ports: '9092,9876', os: ['CentOS 7.9'], mw: ['Kafka 3.3.1', 'RocketMQ 4.9.4'], fw: ['Zookeeper 3.7.1'] },
  { key: 'mw', type: 'application', cat: 'middleware', ports: '8848,8081', os: ['CentOS 7.9'], mw: ['Nacos 2.1.2', 'Jenkins 2.401.1', 'Nexus 3.38.1'], fw: ['Spring Cloud 2021.0.5'] },
  { key: 'bigdata', type: 'application', cat: 'bigdata', ports: '8088,50070', os: ['CentOS 7.9'], mw: ['Hadoop 3.3.4', 'Spark 3.3.2'], fw: ['Hive 3.1.3'] },
  { key: 'net', type: 'network', cat: 'firewall', ports: '22,443', os: ['华为 USG 固件 V500R005', 'FortiOS 7.0.9'], mw: ['SSL VPN', 'IPSec VPN'], fw: [] },
  { key: 'net2', type: 'network', cat: 'switch', ports: '22,161', os: ['H3C Comware 7.1', 'Cisco IOS 15.2'], mw: ['SNMP v2c'], fw: [] },
  { key: 'lb', type: 'network', cat: 'loadbalancer', ports: '443,8443', os: ['F5 BIG-IP 15.1.5', 'Citrix ADC 13.1'], mw: ['iControl REST'], fw: [] },
  { key: 'win', type: 'server', cat: 'windows', ports: '135,139,445,3389', os: ['Windows Server 2019', 'Windows Server 2016', 'Windows 10 企业版'], mw: ['IIS 10.0', 'Active Directory 域服务'], fw: ['.NET Framework 4.7'] },
];

const ROLE_LABEL = { web: 'web', app: 'app', app2: 'php', db: 'mysql', db2: 'sqlserver', db3: 'oracle', cache: 'redis', cache2: 'mongo', search: 'es', mq: 'mq', mw: 'mw', bigdata: 'big', net: 'fw', net2: 'sw', lb: 'lb', win: 'win' };

// ---------- 资产生成 ----------
const assets = [];
let aid = 0;
SYSTEMS.forEach(sys => {
  const roleKeys = sys.code === 'net' ? ['net', 'net2', 'lb']
    : sys.code === 'office' ? ['win', 'win']
      : sys.code === 'dr' ? ['db', 'cache', 'web']
        : sys.code === 'test' ? ['web', 'app', 'db', 'mw']
          : ['web', 'web', 'app', 'app2', 'db', 'db2', 'cache', 'mq', 'mw', 'search', 'bigdata', 'win'];
  const count = ri(14, 21); // 每系统 14~21 台 → 共约 360 台
  for (let i = 1; i <= count; i++) {
    const role = ROLES.find(r => r.key === roleKeys[(i - 1) % roleKeys.length]);
    const os = pick(role.os);
    const mw = pick(role.mw);
    const fw = role.fw.length ? pickN(role.fw, ri(1, Math.min(2, role.fw.length))) : [];
    const env = sys.code === 'test' ? '测试' : (sys.code === 'dr' ? '灾备' : (i % 9 === 0 ? '预发' : '生产'));
    const owner = pick(users.filter(u => u.department === sys.dept).length ? users.filter(u => u.department === sys.dept) : users);
    const ip = `${sys.base}.${20 + i}`;
    const domain = sys.domain ? (i === 1 ? sys.domain : (role.cat === 'web' ? `${sys.code}-web${i}.hbjt.com` : '')) : '';
    const fingerprint = [os, mw, ...fw].filter(Boolean).join(' | ');
    aid++;
    assets.push({
      id: aid,
      name: `${sys.code}-${ROLE_LABEL[role.key]}-${String(i).padStart(2, '0')}`,
      type: role.type, category: role.cat,
      ip_address: ip, domain, port: role.ports,
      importance_level: env === '生产' ? sys.imp : (env === '测试' ? 3 : 2),
      department: sys.dept, business_line: sys.biz,
      os, version: (mw.match(/[\d.]+/) || [''])[0],
      description: `${sys.name} · ${env}环境 · ${role.cat.toUpperCase()} 节点`,
      status: ri(1, 30) === 1 ? 0 : 1,
      // ---- 扩展字段（用于展示真实感信息）----
      company: COMPANY,
      system_name: sys.name,
      environment: env,
      owner_id: owner.id,
      owner: { id: owner.id, real_name: owner.real_name, department: owner.department, position: owner.position },
      owner_name: owner.real_name,
      fingerprint,
      services: role.ports.split(',').map(p => `${p}/tcp`).join(', '),
      middleware: mw,
      framework: fw.join(', '),
      tags: [sys.biz, env, role.cat],
      vuln_count: 0,
      created_at: iso(ri(30, 300)), updated_at: iso(ri(0, 20)),
    });
  }
});

// ---------- 漏洞生成（与资料条目关联）----------
const MODULES = [
  '登录接口', '订单查询接口', '用户中心', '后台管理系统', '文件上传接口', '支付回调接口', '数据导出功能',
  '短信验证码接口', '商品搜索接口', '评论提交接口', '个人信息接口', '报表中心', 'API 网关', '管理后台',
  '会员注册接口', '优惠券领取接口', '发票管理模块', '审批流程接口', '附件下载接口', '消息推送接口',
];
const SOURCES = ['Web 漏洞扫描（AWVS）', '主机漏洞扫描（Nessus）', '代码安全审计（Fortify）', '渗透测试（人工）', '众测平台上报', '安全基线核查', '开源组件扫描（SCA）', '外部监管机构通报'];
const OWASP = [
  { id: 1, code: 'A01:2021', name: 'Broken Access Control', kw: ['越权', '未授权', '权限', 'IDOR', '目录遍历', 'CSRF'] },
  { id: 2, code: 'A02:2021', name: 'Cryptographic Failures', kw: ['加密', 'TLS', '证书', '口令', '密码学'] },
  { id: 3, code: 'A03:2021', name: 'Injection', kw: ['注入', '命令', '代码注入', '表达式', '模板'] },
  { id: 4, code: 'A04:2021', name: 'Insecure Design', kw: ['逻辑', '并发', '流程', '风控', '业务'] },
  { id: 5, code: 'A05:2021', name: 'Security Misconfiguration', kw: ['配置', '响应头', '示例', '备份', '目录', '默认', 'Swagger', 'Actuator', 'HTTP'] },
  { id: 6, code: 'A06:2021', name: 'Vulnerable Components', kw: ['组件', '反序列化', '框架', '依赖', '中间件', 'WordPress'] },
  { id: 7, code: 'A07:2021', name: 'Identification and Authentication Failures', kw: ['认证', '口令', '会话', 'JWT', '验证码', 'MFA', 'OAuth', 'SSO'] },
  { id: 8, code: 'A08:2021', name: 'Software and Data Integrity Failures', kw: ['供应链', 'CI/CD', '镜像', '签名', '完整性'] },
  { id: 9, code: 'A09:2021', name: 'Logging & Monitoring Failures', kw: ['日志', '审计', '监控'] },
  { id: 10, code: 'A10:2021', name: 'Server-Side Request Forgery', kw: ['SSRF', '服务端请求'] },
];

const CAT_STEPS = {
  注入: `1. 访问 {target} 定位到目标参数\n2. 提交测试 payload：' 观察页面是否报错或返回差异\n3. 构造 payload：' AND 1=1-- / ' UNION SELECT 1,2,database()--\n4. 使用 sqlmap -p 参数名 --batch --dbs 验证数据可读取`,
  文件上传: `1. 登录系统进入上传功能\n2. Burp 抓包将文件名改为 shell.php 并将 Content-Type 改为 image/jpeg\n3. 尝试绕过：shell.php%00.jpg、shell.php;.jpg、大小写混合\n4. 访问返回的文件路径确认可解析执行`,
  跨站脚本: `1. 在目标输入点提交 payload：<svg/onload=alert(document.domain)>\n2. 观察是否原样输出或弹窗\n3. 存储型场景刷新列表页确认脚本持久化\n4. 使用 document.cookie 外带验证危害（仅授权环境）`,
  服务端请求伪造: `1. 定位支持 URL 输入的功能（图片下载/导入/预览）\n2. 提交 http://169.254.169.254/latest/meta-data/ 观察是否返回元数据\n3. 提交 http://127.0.0.1:6379 与内网网段做端口探测\n4. 用 DNS 外带（xxx.ceye.io）验证无回显场景`,
  反序列化: `1. 抓取可被反序列化的数据（Cookie / 接口参数 / MQ 消息）\n2. 使用 ysoserial 生成利用链 payload\n3. 目标为 Shiro 时使用已知密钥加密后替换 rememberMe Cookie\n4. 通过 DNSLog 或时延确认执行成功`,
  未授权访问: `1. 直接访问 {target}（不携带任何认证信息）\n2. 确认可直接查看数据或执行命令\n3. Redis 场景执行 info / config get dir 验证\n4. 记录可访问的路径与数据样例作为证据`,
  文件操作: `1. 定位下载或读取接口\n2. 修改参数值为 ../../../../etc/passwd\n3. 观察响应是否返回系统文件内容\n4. 尝试读取 Web 配置文件获取数据库凭据`,
  越权: `1. 准备两个测试账号 A、B\n2. A 登录后抓取查询自身数据的请求\n3. 替换请求中的对象 ID 为 B 的资源 ID\n4. 若返回 B 的数据即确认越权，遍历 ID 验证影响面`,
  逻辑漏洞: `1. 梳理正常业务流程与状态机\n2. 跳过中间步骤直接请求最终接口\n3. 篡改金额/数量/用户标识等关键参数\n4. 并发重放验证条件竞争与幂等问题`,
  身份认证: `1. 定位登录/验证码/找回密码接口\n2. 尝试暴力破解与验证码复用\n3. 检查响应是否返回验证码或存在用户名枚举\n4. 验证重置 Token 是否可预测或可复用`,
  安全配置: `1. 使用 curl -I 检查响应头与 TLS 配置\n2. 检查是否存在示例文件、备份文件与目录浏览\n3. 用 testssl.sh / SSL Labs 检查协议与套件\n4. 对照 CIS 基线逐项核查`,
  信息泄露: `1. 访问常见敏感路径（/.git/config、/.env、/www.zip）\n2. 检查 JS 文件中是否包含密钥与内网地址\n3. 触发异常观察是否回显堆栈与 SQL\n4. 使用 Google/FOFA 语法做外部资产排查`,
};

function stepsFor(cat, target) {
  for (const k in CAT_STEPS) if (cat.includes(k)) return CAT_STEPS[k].replace(/\{target\}/g, target);
  return `1. 定位功能点：${target}\n2. 构造测试 payload 并观察响应差异\n3. 使用工具（Burp / Nuclei）复现验证\n4. 截图记录请求与响应作为证据`;
}

const SEV_CVSS = [[9.4, 10], [7.2, 8.9], [4.3, 6.9], [1.2, 3.9]];
const STATUS_POOL = ['new', 'new', 'processing', 'processing', 'fixed', 'fixed', 'verified', 'closed'];
const IMPACT_TMPL = [
  '攻击者可获取系统控制权限，进而横向渗透内网',
  '可批量读取敏感业务数据，存在个人信息泄露风险',
  '可导致业务数据被篡改，影响业务连续性与数据完整性',
  '可被用于钓鱼与会话劫持，危及相关用户账号安全',
  '可作为内网横向移动的跳板，扩大入侵影响范围',
  '仅泄露少量技术信息，需结合其他漏洞形成利用链',
];

const vulns = [];
const used = new Set();
let vid = 0;
// 只给约 55% 的资产生成漏洞，避免每台都有
assets.forEach(a => {
  if (a.status === 0) return;
  const n = rnd() < 0.45 ? 0 : ri(1, a.importance_level === 1 ? 3 : 2);
  for (let i = 0; i < n; i++) {
    // 按资产类型挑选匹配的资料条目（保证漏洞与资产说得通）
    const pool = INTEL_ALL.filter(x => {
      const s = x.category + x.name;
      const c = a.category;
      if (['mysql', 'sqlserver', 'oracle'].includes(c)) return /注入|数据库|未授权|弱口令|备份|权限|明文|日志/.test(s);
      if (['redis', 'mongodb', 'elasticsearch'].includes(c)) return /未授权|配置|弱口令|密钥|备份|数据/.test(s);
      if (c === 'java') return /反序列化|注入|远程代码|表达式|模板|文件|未授权|组件|越权|认证|配置|日志|密钥/.test(s);
      if (c === 'php') return /注入|上传|跨站|文件|逻辑|越权|代码注入|认证|信息泄露|配置|解析/.test(s);
      if (['mq', 'middleware', 'bigdata'].includes(c)) return /未授权|反序列化|远程代码|配置|组件|密钥|注入|监控|日志/.test(s);
      if (['firewall', 'switch', 'loadbalancer'].includes(c)) return /边界|网络设备|弱口令|组件|认证|协议|配置|DNS|证书|拒绝服务|远程代码/.test(s);
      if (c === 'windows') return /域|提权|弱口令|内网|补丁|权限|配置|认证|日志|终端|杀软|基线|端口/.test(s);
      return /注入|跨站|上传|配置|信息泄露|越权|认证|文件|拒绝服务|目录|备份|响应头|证书|TLS|HTTPS/.test(s); // web
    });
    const intel = pick(pool.length ? pool : INTEL_ALL);
    const key = a.id + '|' + intel.id;
    if (used.has(key)) continue;
    used.add(key);
    vid++;
    const sev = intel.level;
    const cvss = +(SEV_CVSS[sev - 1][0] + rnd() * (SEV_CVSS[sev - 1][1] - SEV_CVSS[sev - 1][0])).toFixed(1);
    const status = pick(STATUS_POOL);
    const isWeb = !!a.domain;
    const mod = isWeb ? pick(MODULES) : `${a.ip_address}:${a.port.split(',')[0]}`;
    const target = isWeb ? `https://${a.domain}/${mod === '后台管理系统' ? 'admin' : 'api'}` : `${a.ip_address}:${a.port.split(',')[0]}`;
    const discoverer = pick(users.filter(u => u.department === '安全部'));
    const assignee = rnd() < 0.75 ? pick(users.filter(u => ['安全部', '运维部', '研发中心'].includes(u.department))) : null;
    const days = ri(1, 120);
    const owasp = OWASP.find(o => o.kw.some(k => (intel.category + intel.name).includes(k))) || OWASP[4];
    // 发现方式随漏洞性质走：Web 类走扫描器/渗透/代码审计，主机与组件类走主机扫描/基线/SCA
    const source = /反序列化|组件|依赖|镜像|供应链|框架/.test(intel.category + intel.name) ? pick(['开源组件扫描（SCA）', '主机漏洞扫描（Nessus）', '渗透测试（人工）'])
      : /配置|基线|补丁|弱口令|默认/.test(intel.category + intel.name) ? pick(['安全基线核查', '主机漏洞扫描（Nessus）', '外部监管机构通报'])
        : isWeb ? pick(['Web 漏洞扫描（AWVS）', '渗透测试（人工）', '代码安全审计（Fortify）', '众测平台上报'])
          : pick(['主机漏洞扫描（Nessus）', '安全基线核查', '渗透测试（人工）']);
    const harm = sev <= 2
      ? pick(['攻击者可获取服务器控制权限，进而横向渗透内网其他系统', '可批量读取敏感业务数据（含个人信息），存在数据泄露与合规风险', '可直接导致核心业务中断或被篡改，影响业务连续性', '可被用于植入后门或勒索加密，恢复成本高'])
      : sev === 3
        ? pick(['可被用于钓鱼与会话劫持，危及相关用户账号安全', '可作为内网横向移动的辅助信息，扩大入侵影响面', '可导致部分业务数据被越权访问或篡改'])
        : pick(['仅泄露有限的技术信息，需结合其他漏洞形成完整利用链', '不直接造成损失，但会降低整体安全水位并暴露资产特征']);
    const title = isWeb
      ? `${a.domain} ${mod} 存在 ${intel.name}${intel.name.endsWith('漏洞') ? '' : '漏洞'}`
      : `${a.name}（${a.ip_address}）存在 ${intel.name}${intel.name.endsWith('漏洞') ? '' : '漏洞'}`;
    vulns.push({
      id: vid,
      title,
      vuln_type: intel.name,
      intel_id: intel.id,
      description: `【发现方式】${source}\n【资产指纹】${a.fingerprint}\n【所属系统】${a.system_name}（${a.company}）\n【漏洞位置】${target}\n【漏洞描述】${intel.desc}\n【实际危害】${harm}`,
      cve_id: /^CVE/i.test(intel.cve) ? intel.cve : '',
      cnvd_id: /^CNVD/i.test(intel.cve) ? intel.cve : '',
      severity_level: sev,
      severity_level_text: { 1: '严重', 2: '高危', 3: '中危', 4: '低危' }[sev],
      cvss_score: cvss,
      status,
      status_text: { new: '新建', processing: '处理中', fixed: '已修复', verified: '已验证', closed: '已关闭' }[status],
      asset_id: a.id,
      asset: a,
      impact_scope: `${target}\n影响资产：${a.name}（${a.ip_address}）\n开放端口：${a.services}\n环境：${a.environment}\n负责人：${a.owner_name}`,
      reproduction_steps: stepsFor(intel.category, target),
      fix_suggestion: intel.fix,
      source,
      fingerprint: a.fingerprint,
      discoverer_id: discoverer.id,
      discoverer,
      assignee_id: assignee?.id || null,
      assignee,
      owasp_category_id: owasp.id,
      owasp_category: { id: owasp.id, code: owasp.code, name: owasp.name, year: 2021 },
      discovered_at: iso(days),
      created_at: iso(days),
      updated_at: iso(Math.max(0, days - ri(0, 10))),
      assigned_at: assignee ? iso(Math.max(0, days - ri(0, 3))) : null,
      fixed_at: ['fixed', 'verified', 'closed'].includes(status) ? iso(Math.max(0, days - ri(5, 20))) : null,
      verified_at: ['verified', 'closed'].includes(status) ? iso(Math.max(0, days - ri(8, 25))) : null,
      closed_at: status === 'closed' ? iso(Math.max(0, days - ri(10, 30))) : null,
      attachments: [],
    });
    a.vuln_count++;
  }
});

export { assets, vulns, INTEL_ALL, OWASP };

// ---------- 统计 ----------
export function vulnStats() {
  const by_severity = { 1: 0, 2: 0, 3: 0, 4: 0 }, by_status = {}, by_asset_type = {}, by_owasp = {};
  vulns.forEach(v => {
    by_severity[v.severity_level]++;
    by_status[v.status] = (by_status[v.status] || 0) + 1;
    const t = v.asset?.type || 'unknown';
    by_asset_type[t] = (by_asset_type[t] || 0) + 1;
    const o = v.owasp_category ? `${v.owasp_category.code} ${v.owasp_category.name}` : '未分类';
    by_owasp[o] = (by_owasp[o] || 0) + 1;
  });
  const recent_trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 864e5).toISOString().slice(0, 10);
    const count = vulns.filter(v => v.discovered_at.slice(0, 10) === d).length;
    return { date: d, count: count || ri(0, 4) };
  });
  return { total: vulns.length, by_severity, by_status, by_asset_type, by_owasp, recent_trend };
}

export function assetStats() {
  const by_type = {}, by_department = {}, by_importance = { 1: 0, 2: 0, 3: 0 }, by_status = { 1: 0, 0: 0 };
  assets.forEach(a => {
    by_type[a.type] = (by_type[a.type] || 0) + 1;
    by_department[a.department] = (by_department[a.department] || 0) + 1;
    by_importance[a.importance_level] = (by_importance[a.importance_level] || 0) + 1;
    by_status[a.status] = (by_status[a.status] || 0) + 1;
  });
  return { total: assets.length, by_type, by_department, by_importance, by_status };
}

export function topRiskAssets(n = 8) {
  return [...assets].sort((x, y) => y.vuln_count - x.vuln_count).slice(0, n)
    .map(a => ({ id: a.id, name: a.name, system_name: a.system_name, vulnerability_count: a.vuln_count, risk_score: Math.min(99, a.vuln_count * 23 + (4 - a.importance_level) * 8) }));
}
