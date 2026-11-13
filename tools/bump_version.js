#!/usr/bin/env node
/* 发布前给 index.html 里的本地静态资源引用加 / 更新版本号。
 *
 * 背景：平台静态资源没有 Cache-Control / ETag / Expires，只有 last-modified，
 * 浏览器会按 (now - last_modified) * 10% 做启发式缓存。用户可能长时间复用
 * 旧版 js/app.js，导致「保存方案」这类改动看起来没生效（仍下载 json）。
 * 让 URL 带上每次发布都变化的 ?v=，浏览器就必然请求当前文件。
 *
 * 用法：node tools/bump_version.js [版本号]     省略时用当前时间戳
 * 幂等：可重复执行；已带 ?v= 的引用会先剥离再统一写入本次版本号。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const idx = path.join(root, 'index.html');
const ver = process.argv[2] || String(Date.now());

let s = fs.readFileSync(idx, 'utf8');
const before = s;
// 只处理本地 js/ 与 css/ 资源；外部 CDN、data:、锚点等不动
s = s.replace(/((?:src|href)="(?:js|css)\/[^"?#]+\.(?:js|css))\?v=[^"]*"/g, '$1"');
s = s.replace(/((?:src|href)="(?:js|css)\/[^"?#]+\.(?:js|css))"/g, `$1?v=${ver}"`);
fs.writeFileSync(idx, s);

const tagged = (s.match(/\?v=/g) || []).length;
console.log(JSON.stringify({version: ver, tagged, changed: s !== before}));
