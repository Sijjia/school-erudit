import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентная предзагрузка СТАНДАРТНЫХ методик психолога (ответ Эмира #9:
 * «пусть будут стандартные готовые шаблоны + возможность собрать в конструкторе»).
 * Грузим классические проективные тесты: «Нарисуй человека», «ДАП-П», «DAP-R».
 * Психолог берёт их из коробки; конструктор по-прежнему доступен для своих методик.
 *
 * Формат schema совпадает с тем, что пишет POST /api/v1/psy/templates:
 *   { metric, scaleMin, scaleMax, questions: [{ text, type }] }
 * Идемпотентность: пропускаем шаблон, если методика с таким именем уже есть.
 */

type Q = { text: string; type: 'scale' | 'text' | 'symptom' | 'file' }

const STANDARD: Array<{ name: string; metric: string; scaleMin: number; scaleMax: number; questions: Q[] }> = [
  {
    name: 'Нарисуй человека',
    metric: 'эмоциональное состояние',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок ребёнка (фото бланка)', type: 'file' },
      { text: 'Уровень тревожности', type: 'scale' },
      { text: 'Самооценка', type: 'scale' },
      { text: 'Агрессивность', type: 'scale' },
      { text: 'Эмоциональная зрелость', type: 'scale' },
      { text: 'Признаки замкнутости / трудностей контакта', type: 'symptom' },
      { text: 'Общее заключение психолога', type: 'text' },
    ],
  },
  {
    name: 'ДАП-П',
    metric: 'личностные особенности',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок «Дом-Дерево-Человек» (фото бланка)', type: 'file' },
      { text: 'Тревожность', type: 'scale' },
      { text: 'Чувство незащищённости', type: 'scale' },
      { text: 'Конфликтность в семье', type: 'scale' },
      { text: 'Трудности в общении', type: 'scale' },
      { text: 'Признаки эмоционального неблагополучия', type: 'symptom' },
      { text: 'Интерпретация психолога', type: 'text' },
    ],
  },
  {
    name: 'DAP-R',
    metric: 'эмоциональный риск',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок (фото бланка)', type: 'file' },
      { text: 'Эмоциональный дистресс', type: 'scale' },
      { text: 'Импульсивность', type: 'scale' },
      { text: 'Депрессивные проявления', type: 'scale' },
      { text: 'Тревожно-фобические проявления', type: 'symptom' },
      { text: 'Заключение и рекомендации', type: 'text' },
    ],
  },
]

async function main() {
  const prisma = new PrismaClient()
  try {
    const author =
      (await prisma.user.findFirst({ where: { role: 'senior_psychologist', isActive: true }, select: { id: true } })) ||
      (await prisma.user.findFirst({ where: { role: 'super_admin', isActive: true }, select: { id: true } }))
    if (!author) {
      console.log('  ! seed-psy-templates: нет senior_psychologist/super_admin — пропускаем')
      return
    }

    let created = 0
    for (const t of STANDARD) {
      const exists = await prisma.psyDiagnosticTemplate.findFirst({ where: { name: t.name } })
      if (exists) continue
      await prisma.psyDiagnosticTemplate.create({
        data: {
          name: t.name,
          version: 1,
          authorId: author.id,
          schema: { metric: t.metric, scaleMin: t.scaleMin, scaleMax: t.scaleMax, questions: t.questions },
          isActive: true,
        },
      })
      created++
    }
    console.log(`  + seed-psy-templates: добавлено стандартных методик: ${created} (всего эталонных: ${STANDARD.length})`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('seed-psy-templates error:', e)
  process.exit(1)
})
