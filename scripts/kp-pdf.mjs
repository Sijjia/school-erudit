// PDF-версия КП: каждый слайд — страница 16:9. node scripts/kp-pdf.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(pathToFileURL(path.resolve('docs/kp-intellect/index.html')).href, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000); // шрифты и картинки

await p.pdf({
  path: 'docs/KP_Intellect_OS.pdf',
  width: '13.33in',
  height: '7.5in',
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});
console.log('✓ docs/KP_Intellect_OS.pdf');
await b.close();
