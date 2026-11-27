#!/usr/bin/env node
/*
 * Сверка сборки с эталоном (tools/reference.sha256).
 * Пока идёт рефакторинг без изменения поведения, сборка обязана совпадать с эталоном побайтно.
 * После намеренного изменения поведения: проверить вручную/смоук-тестом и обновить эталон
 *   node tools/verify.mjs --update
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, build } from './build.mjs';

const refPath = path.join(ROOT, 'tools/reference.sha256');
const sha = crypto.createHash('sha256').update(build()).digest('hex');
if (process.argv.includes('--update')) {
  const ver = (/<title>[^<]*v([\d.]+)/.exec(fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8')) || [])[1] || 'dev';
  fs.writeFileSync(refPath, `${sha}  genplan-3d-oskemen_v${ver}.html\n`);
  console.log('эталон обновлён:', sha);
  process.exit(0);
}
const [ref, name] = fs.readFileSync(refPath, 'utf8').trim().split(/\s+/);
if (sha === ref) { console.log(`OK: сборка побайтно совпадает с эталоном ${name}`); process.exit(0); }
console.error(`ОТЛИЧИЕ от эталона ${name}\n  эталон: ${ref}\n  сборка: ${sha}`);
process.exit(1);
