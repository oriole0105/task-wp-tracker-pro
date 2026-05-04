import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tokenFile = join(homedir(), '.task-time-tracker', 'token');
const token = await readFile(tokenFile, 'utf-8').then(s => s.trim()).catch(() => {
  process.stderr.write(`警告：找不到 token 檔案（${tokenFile}），請先啟動 server 產生 token\n`);
  return 'YOUR_TOKEN_HERE';
});

const tsxBin = resolve(__dirname, '../../..', 'node_modules', '.bin', 'tsx');
const indexPath = resolve(__dirname, 'index.ts');
const apiUrl = process.env.TT_API_URL ?? 'http://127.0.0.1:5174';

const config = {
  mcpServers: {
    'task-time-tracker': {
      command: tsxBin,
      args: [indexPath],
      env: {
        TT_API_URL: apiUrl,
        TT_TOKEN: token,
      },
    },
  },
};

process.stdout.write(JSON.stringify(config, null, 2) + '\n');
process.stdout.write('\n// 將上方 JSON 的 mcpServers 區塊貼入 Claude Desktop 的 claude_desktop_config.json\n');
process.stdout.write('// 或執行: claude mcp add task-time-tracker <上方 command> -- <上方 args 逗號分隔>\n');
