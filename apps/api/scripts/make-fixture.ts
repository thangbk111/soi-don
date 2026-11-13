/**
 * Tạo fixture parser đã ẩn danh từ file .eml thật.
 * Usage: tsx scripts/make-fixture.ts <out-name> <file.eml>
 * Ghi ra packages/parser-fixtures/shopee/<out-name>.html và .meta.json.
 * Luôn kiểm tra lại output trước khi commit.
 */
import * as cheerio from 'cheerio';
import type { AnyNode, Text } from 'domhandler';
import { simpleParser } from 'mailparser';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeVi } from '@soi-don/shared';

const OUT_DIR = join(__dirname, '../../../packages/parser-fixtures/shopee');
const REDACTED = '[ĐÃ ẨN]';
const PII_LABELS = new Set(['ten nguoi nhan:', 'so dien thoai:', 'dia chi nhan hang:']);

function textNodes(root: AnyNode, out: Text[] = []): Text[] {
  if (root.type === 'text') out.push(root as Text);
  if ('children' in root) for (const c of root.children) textNodes(c, out);
  return out;
}

export function anonymizeHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, img, head, meta, link').remove();
  $('*').each((_, el) => {
    for (const attr of ['href', 'src', 'srcset', 'alt', 'title', 'background'])
      $(el).removeAttr(attr);
  });
  $('*')
    .contents()
    .filter((_, n) => n.type === 'comment')
    .remove();

  const nodes = textNodes($.root()[0]).filter((n) => n.data.trim() !== '');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (PII_LABELS.has(normalizeVi(n.data).replace(/\s+/g, ' ')) && nodes[i + 1]) {
      nodes[i + 1].data = REDACTED;
    }
    n.data = n.data
      .replace(/Xin chào\s+[^,<]+,/g, 'Xin chào nguoimua,')
      .replace(/[\w.+-]+@(?![\w-]*\.?shopee\.(vn|com))[\w-]+(\.[\w-]+)+/g, '[email]')
      .replace(/\b(84|0)\d{8,10}\b/g, REDACTED);
  }
  return $('body').html() ?? '';
}

async function main() {
  const [name, file] = process.argv.slice(2);
  if (!name || !file) throw new Error('Usage: make-fixture <out-name> <file.eml>');
  const mail = await simpleParser(readFileSync(file));
  if (typeof mail.html !== 'string') throw new Error('Email không có phần HTML');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}.html`), anonymizeHtml(mail.html));
  const meta = {
    subject: mail.subject ?? '',
    from: 'Shopee <info@mail.shopee.vn>',
    receivedAt: (mail.date ?? new Date()).toISOString(),
  };
  writeFileSync(join(OUT_DIR, `${name}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`wrote ${name}`);
}

main();
