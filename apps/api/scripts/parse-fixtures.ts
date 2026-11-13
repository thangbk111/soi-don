/** Dev tool: chạy parser trên mọi fixture và in kết quả JSON. Usage: tsx scripts/parse-fixtures.ts [--write] */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEmail } from '../src/parser/registry';

const DIR = join(__dirname, '../../../packages/parser-fixtures/shopee');

for (const f of readdirSync(DIR)
  .filter((f) => f.endsWith('.html'))
  .sort()) {
  const name = f.replace(/\.html$/, '');
  const meta = JSON.parse(readFileSync(join(DIR, `${name}.meta.json`), 'utf8'));
  const res = parseEmail({
    messageId: name,
    from: meta.from,
    subject: meta.subject,
    receivedAt: new Date(meta.receivedAt),
    html: readFileSync(join(DIR, f), 'utf8'),
  });
  const out = { parser: res?.parser.id ?? null, events: res?.events ?? [] };
  if (process.argv.includes('--write')) {
    writeFileSync(join(DIR, `${name}.expected.json`), JSON.stringify(out, null, 2) + '\n');
  } else {
    console.log(`\n### ${name}`);
    console.log(JSON.stringify(out, null, 1));
  }
}
