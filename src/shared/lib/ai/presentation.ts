import { z } from 'zod';

/**
 * ИИ-генератор презентаций для учителя (мультимодальный оркестратор, фаза 1).
 *
 * Провайдер-агностичен: вызывает OpenRouter (OpenAI-совместимый REST) если задан
 * OPENROUTER_API_KEY, иначе отдаёт детерминированный стаб — фича работает и
 * демится локально без ключа, а с ключом включается реальный LLM.
 *
 * Сменить модель/провайдера = переменная OPENROUTER_MODEL (по умолчанию Claude).
 */

export const slideSchema = z.object({
  title: z.string().min(1).max(200),
  bullets: z.array(z.string().min(1).max(400)).min(1).max(8),
  notes: z.string().max(1500).optional().default(''),
});

export const deckSchema = z.object({
  title: z.string().min(1).max(200),
  slides: z.array(slideSchema).min(3).max(20),
});

export type Slide = z.infer<typeof slideSchema>;
export type Deck = z.infer<typeof deckSchema>;

export interface PresentationRequest {
  topic: string;
  subject?: string | null;
  gradeLevel?: string | null;
  emphasis?: string | null;
  slideCount?: number;
}

export interface PresentationResult {
  title: string;
  slides: Slide[];
  model: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

function buildPrompt(req: PresentationRequest): { system: string; user: string } {
  const count = Math.min(Math.max(req.slideCount ?? 8, 3), 20);
  const system = [
    'Ты — методист и опытный учитель. Составляешь структуру учебной презентации для урока.',
    'Отвечай СТРОГО валидным JSON без markdown-обёрток и комментариев.',
    'Язык — русский. Формулировки чёткие, по делу, без воды.',
    'Схема ответа: {"title": string, "slides": [{"title": string, "bullets": string[], "notes": string}]}.',
    'Первый слайд — титульный (тема + класс). Последний — итоги/домашнее задание.',
    'bullets — 2–6 коротких тезисов на слайд. notes — короткая подсказка учителю что сказать (1–3 предложения).',
  ].join(' ');
  const parts = [
    `Тема урока: ${req.topic}.`,
    req.subject ? `Предмет: ${req.subject}.` : '',
    req.gradeLevel ? `Класс/уровень: ${req.gradeLevel}.` : '',
    req.emphasis ? `Особый акцент: ${req.emphasis}.` : '',
    `Сделай ровно ${count} слайдов.`,
  ].filter(Boolean);
  return { system, user: parts.join(' ') };
}

/** Извлечь JSON-объект из ответа модели (на случай если обёрнут в текст/```). */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('LLM вернул не-JSON ответ');
  }
}

/** Детерминированный стаб — каркас презентации без LLM. */
function stubDeck(req: PresentationRequest): PresentationResult {
  const count = Math.min(Math.max(req.slideCount ?? 8, 3), 20);
  const grade = req.gradeLevel ? `, ${req.gradeLevel}` : '';
  const slides: Slide[] = [
    {
      title: req.topic,
      bullets: [
        `Урок${req.subject ? ` по предмету «${req.subject}»` : ''}${grade}`,
        req.emphasis ? `Акцент: ${req.emphasis}` : 'Цели и план урока',
      ],
      notes: 'Титульный слайд. Поприветствуйте класс и обозначьте тему.',
    },
    {
      title: 'Цели урока',
      bullets: ['Что узнаем', 'Чему научимся', 'Где применим'],
      notes: 'Сформулируйте 2–3 измеримые цели.',
    },
  ];
  const middle = count - 3;
  for (let i = 0; i < Math.max(middle, 0); i++) {
    slides.push({
      title: `Раздел ${i + 1}`,
      bullets: ['Ключевая идея', 'Пример', 'Мини-задание для проверки'],
      notes: 'Разберите идею на примере, затем дайте быстрый вопрос классу.',
    });
  }
  slides.push({
    title: 'Итоги и домашнее задание',
    bullets: ['Что повторили', 'Главные выводы', 'Домашнее задание'],
    notes: 'Подведите итог и проверьте понимание парой вопросов.',
  });
  return {
    title: req.topic,
    slides: slides.slice(0, count),
    model: 'stub',
  };
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function generatePresentation(req: PresentationRequest): Promise<PresentationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return stubDeck(req);
  }

  const { system, user } = buildPrompt(req);
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter рекомендует указывать источник запроса (необязательно).
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://bilimos.kg',
      'X-Title': 'Bilim OS — AI Presentation',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter вернул пустой ответ');

  const parsed = deckSchema.parse(extractJson(content));
  return {
    title: parsed.title,
    slides: parsed.slides,
    model: DEFAULT_MODEL,
  };
}
