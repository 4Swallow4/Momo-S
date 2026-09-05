// Astro 7+ 会检测 AI agent 环境变量(如 AI_AGENT、CLAUDECODE),一旦命中就把
// dev server 自动转成后台守护进程。该路径在 Windows 上会间歇性原生崩溃
// (退出码 0xC0000005 / 段错误),且即使成功也会脱离终端运行。
// 这里在启动前清掉这些变量,让 astro 始终以稳定的前台模式运行。
// 参考: https://github.com/withastro/astro/issues/17146
const { spawn } = require('node:child_process');
const path = require('node:path');

// am-i-vibing(astro 的 agent 检测依赖)关注的环境变量
const AGENT_ENV_KEYS = [
  'AI_AGENT', 'AGENT', 'CLAUDECODE', 'CLAUDECODE_AGENT_ID',
  'CODEX_THREAD_ID', 'GEMINI_CLI', 'CRUSH', 'AIDER_API_KEY',
  'AUGMENT_AGENT', 'CURSOR_TRACE_ID', 'QWEN_CODE', 'REPLIT_MODE',
  'REPL_ID', 'OPENCODE', 'OPENCODE_APP_INFO', 'OPENCODE_BIN_PATH',
  'OPENCODE_MODES', 'OPENCODE_SERVER', 'ANTIGRAVITY_AGENT',
  'ANTIGRAVITY_PROJECT_ID', 'AMP_CURRENT_THREAD_ID',
  'CODEIUM_EDITOR_APP_ROOT',
];

const env = { ...process.env };
for (const key of AGENT_ENV_KEYS) delete env[key];

// 转发给 astro 的参数(即脚本自己的参数,如 dev / dev --host 0.0.0.0)
const args = process.argv.slice(2);
const astroBin = path.join(path.dirname(require.resolve('astro/package.json')), 'bin', 'astro.mjs');

const child = spawn(process.execPath, [astroBin, ...args], { env, stdio: 'inherit' });
child.on('error', (err) => {
  console.error('dev.cjs: 启动 astro 失败:', err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
