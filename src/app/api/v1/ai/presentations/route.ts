import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { generatePresentation, isLlmConfigured } from '@/shared/lib/ai/presentation';

const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

/**
 * ИИ-презентации (мультимодальный оркестратор учителя, фаза 1).
 * GET  — мои презентации (по authorId сессии).
 * POST — сгенерировать по теме (LLM/стаб) и сохранить.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const items = await prisma.presentation.findMany({
      where: { authorId: auth.session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, topic: true, subject: true, gradeLevel: true,
        emphasis: true, model: true, createdAt: true,
      },
    });
    return successResponse({ items, llmConfigured: isLlmConfigured() });
  } catch (error) {
    console.error('GET /api/v1/ai/presentations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить презентации', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const topic = String(body.topic ?? '').trim();
    if (topic.length < 3) {
      return errorResponse('VALIDATION_ERROR', 'Укажите тему урока (минимум 3 символа)');
    }
    const subject = body.subject ? String(body.subject).trim().slice(0, 200) : null;
    const gradeLevel = body.gradeLevel ? String(body.gradeLevel).trim().slice(0, 100) : null;
    const emphasis = body.emphasis ? String(body.emphasis).trim().slice(0, 500) : null;
    const slideCount = Number.isFinite(body.slideCount) ? Number(body.slideCount) : 8;

    let deck;
    try {
      deck = await generatePresentation({ topic, subject, gradeLevel, emphasis, slideCount });
    } catch (genErr) {
      console.error('LLM generation failed:', genErr);
      return errorResponse('AI_ERROR', 'ИИ не смог сгенерировать презентацию. Попробуйте ещё раз.', 502);
    }

    const saved = await prisma.presentation.create({
      data: {
        title: deck.title.slice(0, 200),
        topic: topic.slice(0, 500),
        subject,
        gradeLevel,
        emphasis,
        slides: deck.slides,
        model: deck.model,
        authorId: auth.session.user.id,
      },
    });
    return successResponse(saved, 201);
  } catch (error) {
    console.error('POST /api/v1/ai/presentations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сгенерировать презентацию', 500);
  }
}
