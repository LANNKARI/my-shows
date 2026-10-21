import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/current-user';
import { answerDuel, createDuel, publicDuel, MAX_DUEL_ATTEMPTS, type DuelState } from '@/lib/higher-lower';

export const dynamic = 'force-dynamic';
const jsonState = (state: DuelState) => JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const conflict = () => NextResponse.json({ error: 'Игра уже изменилась. Обновите раунд.' }, { status: 409 });

async function currentGame() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, higherLowerState: true, higherLowerAttempts: true, higherLowerCompleted: true, lastHigherLowerDate: true },
  });
}

export async function GET() {
  try {
    const user = await currentGame();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    const now = new Date();
    const day = dayOf(now);
    const sameDay = user.lastHigherLowerDate && dayOf(user.lastHigherLowerDate) === day;
    const attempts = sameDay ? user.higherLowerAttempts : 0;
    if ((sameDay && user.higherLowerCompleted) || attempts >= MAX_DUEL_ATTEMPTS) {
      return NextResponse.json({ limitReached: true, attemptsLeft: Math.max(0, MAX_DUEL_ATTEMPTS - attempts), message: 'Игра на сегодня завершена. Возвращайтесь завтра!' });
    }
    const previous = user.higherLowerState as unknown as DuelState | null;
    if (previous?.day === day) return NextResponse.json(publicDuel(previous, attempts));
    const state = await createDuel(day);
    const changed = await prisma.user.updateMany({
      where: { id: user.id, higherLowerState: { equals: user.higherLowerState ?? Prisma.DbNull } },
      data: { higherLowerState: jsonState(state), lastHigherLowerDate: now, higherLowerAttempts: attempts, higherLowerCompleted: false },
    });
    if (!changed.count) return conflict();
    return NextResponse.json(publicDuel(state, attempts));
  } catch (error) {
    console.error('Higher/lower round failed:', error);
    return NextResponse.json({ error: 'Не удалось загрузить игру. Проверьте доступность TMDB и попробуйте позже.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentGame();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
    const day = dayOf(new Date());
    const state = user.higherLowerState as unknown as DuelState | null;
    if (!state || state.day !== day || body.roundId !== state.id) return conflict();
    if (user.higherLowerCompleted || user.higherLowerAttempts >= MAX_DUEL_ATTEMPTS) return conflict();
    let next: DuelState;
    let reward = 0;
    let attempts = user.higherLowerAttempts;
    let correct: boolean | undefined;
    if (body.action === 'answer' && state.phase === 'question' && ['higher', 'lower'].includes(body.choice)) {
      const result = answerDuel(state, body.choice);
      next = result.state;
      correct = result.correct;
      if (!correct) attempts++;
      if (next.phase === 'paid') reward = next.bank;
    } else if (body.action === 'cashout' && state.phase === 'answered' && state.bank > 0) {
      next = { ...state, phase: 'paid' };
      reward = state.bank;
    } else if (body.action === 'next' && state.phase === 'answered' && state.round < 5) {
      next = await createDuel(day, state.round + 1, state.bank, state.usedIds);
    } else if (body.action === 'restart' && state.phase === 'failed') {
      next = await createDuel(day);
    } else {
      return NextResponse.json({ error: 'Действие недоступно для этого раунда' }, { status: 400 });
    }
    // Состояние и награда меняются одним SQL UPDATE. Повторные запросы не начисляют награду.
    const changed = await prisma.user.updateMany({
      where: { id: user.id, higherLowerState: { equals: jsonState(state) }, higherLowerCompleted: false },
      data: { higherLowerState: jsonState(next), higherLowerAttempts: attempts, higherLowerCompleted: next.phase === 'paid', lastHigherLowerDate: new Date(), popcorn: { increment: reward } },
    });
    if (!changed.count) return conflict();
    return NextResponse.json({ ...publicDuel(next, attempts), isCorrect: correct, reward, success: true });
  } catch (error) {
    console.error('Higher/lower action failed:', error);
    return NextResponse.json({ error: 'Не удалось выполнить действие. Попробуйте позже.' }, { status: 503 });
  }
}
