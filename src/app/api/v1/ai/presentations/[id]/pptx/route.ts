import { NextRequest } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import { prisma } from '@/shared/lib/prisma';
import { errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { deckSchema, type Slide } from '@/shared/lib/ai/presentation';

const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

/** GET /api/v1/ai/presentations/[id]/pptx — экспорт в .pptx (только автор). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const item = await prisma.presentation.findUnique({ where: { id } });
    if (!item) return errorResponse('NOT_FOUND', 'Презентация не найдена', 404);
    if (item.authorId !== auth.session.user.id && auth.session.user.role !== 'super_admin') {
      return errorResponse('FORBIDDEN', 'Это не ваша презентация', 403);
    }

    // slides хранятся как JSON — валидируем форму перед рендером.
    const slides: Slide[] = deckSchema.shape.slides.parse(item.slides);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Bilim OS';
    pptx.title = item.title;

    const BRAND = '1E40AF';
    const DARK = '1F2937';

    // Титульный слайд.
    const cover = pptx.addSlide();
    cover.background = { color: 'F8FAFC' };
    cover.addText(item.title, {
      x: 0.6, y: 2.0, w: 12.1, h: 1.6, fontSize: 40, bold: true, color: BRAND, align: 'center',
    });
    const subtitle = [item.subject, item.gradeLevel].filter(Boolean).join(' · ');
    if (subtitle) {
      cover.addText(subtitle, {
        x: 0.6, y: 3.6, w: 12.1, h: 0.8, fontSize: 22, color: DARK, align: 'center',
      });
    }
    cover.addText('Сгенерировано в Bilim OS', {
      x: 0.6, y: 6.6, w: 12.1, h: 0.4, fontSize: 12, color: '94A3B8', align: 'center',
    });

    // Контент-слайды (первый слайд деки = титул, его текст уже на cover, но рендерим все для полноты).
    slides.forEach((s, idx) => {
      if (idx === 0) return; // первый слайд деки — титульный, заменён cover'ом
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };
      slide.addText(s.title, {
        x: 0.6, y: 0.4, w: 12.1, h: 1.0, fontSize: 28, bold: true, color: BRAND,
      });
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 18, color: DARK, paraSpaceAfter: 8 } })),
        { x: 0.8, y: 1.6, w: 11.7, h: 4.8, valign: 'top' },
      );
      if (s.notes) slide.addNotes(s.notes);
    });

    const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    const safeName = item.title.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().slice(0, 60) || 'presentation';

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.pptx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/v1/ai/presentations/[id]/pptx error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось собрать .pptx', 500);
  }
}
