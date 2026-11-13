import * as cheerio from 'cheerio';

/**
 * HTML email → danh sách dòng text theo thứ tự tài liệu.
 * Mỗi phần tử đóng góp phần text trực tiếp của nó, nên nhãn ("Giá:") và giá trị ("₫729,600")
 * nằm ở các ô khác nhau sẽ thành các dòng liên tiếp.
 */
export function htmlToLines(html: string): string[] {
  const $ = cheerio.load(html);
  $('script, style, head').remove();
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
  return lines;
}
