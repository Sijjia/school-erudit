// Рендер презентации Bilim OS: school/deck/<file>.html → PDF (16:9) + PNG каждого слайда (2x).
// Запуск: node scripts/render-deck.mjs [deck-12]   (по умолчанию deck)
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

const NAME = process.argv[2] || 'deck';
const HTML = path.join(process.cwd(), 'school', 'deck', `${NAME}.html`);
const OUTDIR = path.join(process.cwd(), 'school', 'deck');
const PNGDIR = path.join(OUTDIR, NAME === 'deck' ? 'slides-png' : `slides-png-${NAME.replace('deck-', '')}`);
const W = 1280, H = 720;

async function run() {
  if (!fs.existsSync(PNGDIR)) fs.mkdirSync(PNGDIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
  await page.waitForTimeout(1200);

  // PDF — многостраничный, фон печатаем
  const pdfPath = path.join(OUTDIR, NAME === 'deck' ? 'Bilim_OS_deck.pdf' : `Bilim_OS_${NAME.replace('deck-', '')}_slides.pdf`);
  await page.pdf({
    path: pdfPath,
    width: `${W}px`, height: `${H}px`,
    printBackground: true, pageRanges: '', preferCSSPageSize: false,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  // PNG каждого слайда (2x) для Canva
  const slides = await page.locator('.slide').all();
  let i = 0;
  for (const s of slides) {
    i++;
    await s.screenshot({ path: path.join(PNGDIR, `slide-${String(i).padStart(2, '0')}.png`), type: 'png' });
  }
  await browser.close();
  console.log(`✅ PDF: ${pdfPath}`);
  console.log(`✅ PNG (${i} слайдов, 2x): ${PNGDIR}`);
}
run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
