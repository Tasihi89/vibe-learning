#!/usr/bin/env node
// 在 Mac 上做一个「Vibe Learning.app」：双击它，和在终端里运行 node serve.mjs 一样，
// 服务没开就在后台开起来，再在浏览器里打开首页。它自己没有窗口。
// 用法：node mac/make-app.mjs [放在哪个文件夹]（默认 /Applications，写不进去就放 ~/Applications）
// 应用里记着 node 和这个项目的位置，还有现在终端里的 PATH（从程序坞、启动台打开的应用拿不到终端的 PATH，
// 就找不到 claude）。项目搬了家、命令行工具装到了别处，重新运行一次。
// 上网要走代理、代理写在 ~/.zshrc 这类文件里的：应用每次打开时从登录 shell 里取一次代理设置，交给 claude。
// 图标的原图是 icon.svg，icon.icns 是用它生成的。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const NAME = 'Vibe Learning';
const ID = 'local.visual-learning';
const ENV = ['VIBE_LEARNING_HOME', 'VIBE_LEARNING_PORT', 'VISUAL_LEARNING_HOME', 'VISUAL_LEARNING_PORT'];

if (process.platform !== 'darwin') {
  console.error('只能在 Mac 上用。');
  process.exit(1);
}

const dest = process.argv[2] ? path.resolve(process.argv[2]) : writable('/Applications') ? '/Applications' : path.join(os.homedir(), 'Applications');
const app = path.join(dest, NAME + '.app');

// 同名的别的应用不动
if (fs.existsSync(app)) {
  let id = '';
  try { id = execFileSync('/usr/bin/defaults', ['read', path.join(app, 'Contents', 'Info.plist'), 'CFBundleIdentifier'], { encoding: 'utf8' }).trim(); } catch { /* 读不出来就当不是 */ }
  if (id !== ID) {
    console.error(`${app} 已经有一个别的应用了，没有动它。`);
    process.exit(1);
  }
  fs.rmSync(app, { recursive: true });
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const exports = [['PATH', process.env.PATH], ...ENV.map((k) => [k, process.env[k]])].filter(([, v]) => v).map(([k, v]) => `export ${k}=${q(v)}`);
const launcher = `#!/bin/bash
# 由 ${q(path.join(REPO, 'mac', 'make-app.mjs'))} 生成。服务没开就在后台开起来，再在浏览器里打开首页。
${exports.join('\n')}
# 代理：从登录 shell 里取（最多等 5 秒），只认这几个变量
while IFS= read -r line; do
  case "$line" in
    http_proxy=*|https_proxy=*|all_proxy=*|no_proxy=*|HTTP_PROXY=*|HTTPS_PROXY=*|ALL_PROXY=*|NO_PROXY=*) export "$line" ;;
  esac
done < <(/usr/bin/perl -e 'alarm 5; exec @ARGV' "\${SHELL:-/bin/zsh}" -lic 'echo __VIBE_ENV__; env' 2>/dev/null </dev/null | /usr/bin/sed -n '/^__VIBE_ENV__$/,$p')
out=$(${q(process.execPath)} ${q(path.join(REPO, 'serve.mjs'))} 2>&1) && exit 0
/usr/bin/osascript - "$out" <<'EOF'
on run argv
  display alert "${NAME} 没能打开" message (item 1 of argv) as critical
end run
EOF
`;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>${ID}</string>
  <key>CFBundleName</key><string>${NAME}</string>
  <key>CFBundleDisplayName</key><string>${NAME}</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`;

const contents = path.join(app, 'Contents');
fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true });
fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });
fs.writeFileSync(path.join(contents, 'Info.plist'), plist);
fs.writeFileSync(path.join(contents, 'MacOS', 'launcher'), launcher, { mode: 0o755 });
fs.copyFileSync(path.join(HERE, 'icon.icns'), path.join(contents, 'Resources', 'icon.icns'));
// 让访达、程序坞马上认出新图标
try {
  execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', app]);
} catch { /* 认不出来也能用，过一会儿图标会自己出来 */ }
console.log(`做好了：${app}\n可以拖到程序坞里。`);

function writable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}
