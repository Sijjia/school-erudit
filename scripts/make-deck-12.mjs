// Собирает короткую версию деки: deck.html → deck-12.html (12 ключевых слайдов).
// Шапка (CSS + SVG-спрайт) берётся как есть, слайды выбираются по порядковому номеру.
// Запуск: node scripts/make-deck-12.mjs
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(process.cwd(), 'school', 'deck');
const src = fs.readFileSync(path.join(DIR, 'deck.html'), 'utf8');

// 1-based номера слайдов полной деки:
// 1 обложка · 3 проблема · 4 событие→действие · 7 нейро-граф · 9 агент-лента ·
// 11 ассистент · 17 журнал · 21 CRM · 22 финансы · 25 роли · 26 что работает · 37 контакты
const PICK = [1, 3, 4, 7, 9, 11, 17, 21, 22, 25, 26, 37];

const sections = src.match(/<section class="slide[\s\S]*?<\/section>/g);
if (!sections || sections.length < 37) throw new Error(`нашёл ${sections?.length} слайдов, ожидал 37`);

const head = src.slice(0, src.indexOf('<section class="slide'));
const tail = src.slice(src.lastIndexOf('</section>') + '</section>'.length);

const out = head + PICK.map((n) => sections[n - 1]).join('\n\n') + tail;
fs.writeFileSync(path.join(DIR, 'deck-12.html'), out.replace('<title>Bilim OS — дек</title>', '<title>Bilim OS — дек (12)</title>'), 'utf8');
console.log(`✅ deck-12.html: ${PICK.length} слайдов`);
