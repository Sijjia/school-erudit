# Презентация Bilim OS — упаковка

Обновлено: 05.06.2026. Дизайн: тёплый claymorphism + bento (skill ui-ux-pro-max), шрифты Rubik + Golos Text (кириллица), SVG-иконки. Все скрины — с живого прода bilimos.kg (логин-карточки — с локалки, фича ещё не на проде).

## Две версии

| Версия | PDF | PPTX | PNG для Canva |
|---|---|---|---|
| **Полная, 37 слайдов** — подробный рассказ | `Bilim_OS_deck.pdf` | `Bilim_OS_deck.pptx` | `slides-png/` |
| **Короткая, 12 слайдов** — быстрый питч | `Bilim_OS_12_slides.pdf` | `Bilim_OS_deck_12.pptx` | `slides-png-12/` |

Состав короткой: обложка → проблема → событие→действие → нейро-граф → лента ИИ-агента → AI-ассистент → журнал → CRM приёмной → финансы с пенями → 16 ролей → честный слайд «работает/пилот» → контакты.

## Правила упаковки

- **Цен в деке нет** — озвучивает Даткайым.
- **Только рабочий функционал** в разделе «✓ Доступно сейчас»; обещания — только в «Дорожная карта · пилот 2026». Ничего из vision-дек (Guardian, эмоции, коины) не тянуть.
- Контакты: bilimos.kg · Askarova.datkayim@gmail.com · +996 700 144 043.

## Как перегенерировать

Мастер — `deck.html` (правки делать в нём, короткая версия собирается из него автоматически):

```bash
node scripts/shot-deck.mjs        # базовые 18 скринов с прода (если нужно обновить)
node scripts/shot-deck-v2.mjs     # 11 скринов новых фич (граф, ассистент, журнал, CRM, пени…)
# логин-карточки с локалки: npm run dev -- --webpack, затем
#   BASE=http://localhost:3000 node scripts/shot-deck-v2.mjs --only login-cards

node scripts/make-deck-12.mjs     # deck.html → deck-12.html (выбор слайдов внутри скрипта)
node scripts/render-deck.mjs      # полная: PDF + slides-png/
node scripts/render-deck.mjs deck-12   # короткая: PDF + slides-png-12/
python scripts/build_pptx_from_pngs.py      # PPTX полной
python scripts/build_pptx_from_pngs.py 12   # PPTX короткой
```

Гочи: в журнале/посещаемости скрипт сам выбирает класс (иначе пустой экран); ассистенту задавать типовой вопрос («Сводка по финансам») — кастомные дают заглушку demo-режима; нумерация футеров пересчитывается сама.
