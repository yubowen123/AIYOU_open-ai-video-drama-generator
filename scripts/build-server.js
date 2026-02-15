/**
 * AIYOU Server Build Script
 * 将 Express 后端打包为 Tauri sidecar
 *
 * 策略：
 * 1. 用 esbuild 将 server/index.js 打包为单文件 CJS bundle
 * 2. 生成 shell 脚本 wrapper 作为 sidecar 入口
 * 3. 产物放入 src-tauri/binaries/
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const BINARIES_DIR = path.join(ROOT, 'src-tauri', 'binaries');
const SERVER_DIR = path.join(ROOT, 'server');

// 获取当前平台的 target triple
function getTargetTriple() {
  try {
    const output = execSync('rustc -vV', { encoding: 'utf8' });
    const match = output.match(/host:\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const platform = process.platform;
    if (platform === 'darwin') return `${arch}-apple-darwin`;
    if (platform === 'win32') return `${arch}-pc-windows-msvc`;
    return `${arch}-unknown-linux-gnu`;
  }
}

async function build() {
  const targetTriple = getTargetTriple();
  console.log(`[build-server] Target: ${targetTriple}`);

  // 1. 确保 binaries 目录存在
  fs.mkdirSync(BINARIES_DIR, { recursive: true });

  // 2. 安装 server 依赖
  console.log('[build-server] Installing server dependencies...');
  execSync('pnpm install', { cwd: SERVER_DIR, stdio: 'inherit' });

  // 3. 用 esbuild JS API 打包 server
  console.log('[build-server] Bundling server with esbuild...');
  const bundlePath = path.join(BINARIES_DIR, 'server-bundle.cjs');

  await esbuild.build({
    entryPoints: [path.join(SERVER_DIR, 'index.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: bundlePath,
    external: [
      'better-sqlite3',
      // Knex optional database drivers (not installed, loaded dynamically)
      'mysql', 'mysql2', 'pg-query-stream', 'tedious', 'sqlite3', 'oracledb',
    ],
    banner: {
      js: [
        '// ESM compatibility shim for CJS bundle',
        'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
      ].join('\n'),
    },
    define: {
      'import.meta.url': '__importMetaUrl',
    },
  });

  console.log(`[build-server] Bundle created: ${bundlePath}`);

  // 4. 复制 better-sqlite3 native addon
  const sqliteModuleSrc = path.join(SERVER_DIR, 'node_modules', 'better-sqlite3');
  const sqliteModuleDst = path.join(BINARIES_DIR, 'node_modules', 'better-sqlite3');
  if (fs.existsSync(sqliteModuleSrc)) {
    console.log('[build-server] Copying better-sqlite3 native module...');
    fs.mkdirSync(path.dirname(sqliteModuleDst), { recursive: true });
    // Remove old copy if exists
    if (fs.existsSync(sqliteModuleDst)) {
      fs.rmSync(sqliteModuleDst, { recursive: true });
    }
    fs.cpSync(sqliteModuleSrc, sqliteModuleDst, { recursive: true });
  }

  // 5. 复制 .env 文件（如果存在）
  const envSrc = path.join(ROOT, '.env');
  const envDst = path.join(BINARIES_DIR, '.env');
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDst);
    console.log('[build-server] Copied .env');
  }

  // 6. 创建 sidecar 启动脚本
  // 支持通过 CLI 参数指定额外的 target triples（用于 Universal / 多平台构建）
  const extraTargets = process.argv.slice(2);
  const allTargets = new Set([targetTriple, ...extraTargets]);

  // macOS: 如果包含任一 darwin target，自动添加 universal
  const hasDarwin = [...allTargets].some(t => t.includes('apple-darwin'));
  if (hasDarwin) {
    allTargets.add('aarch64-apple-darwin');
    allTargets.add('x86_64-apple-darwin');
    allTargets.add('universal-apple-darwin');
  }

  for (const target of allTargets) {
    const isWindows = target.includes('windows');

    if (isWindows) {
      const batContent = `@echo off\r\nset "DIR=%~dp0"\r\nset "NODE_PATH=%DIR%node_modules"\r\nset "DB_CLIENT=sqlite"\r\nnode "%DIR%server-bundle.cjs" %*\r\n`;
      const cmdPath = path.join(BINARIES_DIR, `aiyou-server-${target}.cmd`);
      fs.writeFileSync(cmdPath, batContent);
      console.log(`[build-server] Created Windows launcher: ${cmdPath}`);
    } else {
      const shContent = `#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="$DIR/node_modules"
export DB_CLIENT=sqlite
exec node "$DIR/server-bundle.cjs" "$@"
`;
      const shPath = path.join(BINARIES_DIR, `aiyou-server-${target}`);
      fs.writeFileSync(shPath, shContent);
      fs.chmodSync(shPath, 0o755);
      console.log(`[build-server] Created sidecar: ${shPath}`);
    }
  }

  console.log('[build-server] Done!');
}

build().catch((err) => {
  console.error('[build-server] Failed:', err);
  process.exit(1);
});
