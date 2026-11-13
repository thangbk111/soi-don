/**
 * Dev tool: in nội dung .eml dưới dạng text (bảng → dòng "ô | ô") để xem cấu trúc template.
 * Chỉ dùng local với file của chính mình. Usage: tsx scripts/dump-eml.ts <file.eml>...
 */
import * as cheerio from 'cheerio';
import { simpleParser } from 'mailparser';
import { readFileSync } from 'node:fs';

async function main() {
  for (const file of process.argv.slice(2)) {
    const mail = await simpleParser(readFileSync(file));
    console.log(`\n===== ${file}`);
    console.log(
      `From: ${mail.from?.text}\nSubject: ${mail.subject}\nDate: ${mail.date?.toISOString()}`,
    );
    const html = typeof mail.html === 'string' ? mail.html : '';
    console.log(`html: ${html.length} chars, text part: ${mail.text ? 'yes' : 'no'}`);
    const $ = cheerio.load(html);
    $('script,style,head').remove();
    // Lấy các "lá" chứa text theo thứ tự tài liệu.
    const lines: string[] = [];
    $('body *').each((_, el) => {
      const own = $(el)
        .contents()
        .filter((_, n) => n.type === 'text')
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (own) lines.push(own);
    });
    lines.forEach((l, i) => console.log(String(i).padStart(3), l));
  }
}
main();
