import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calendarUser, CalendarError, calendarFailure } from '@/lib/calendar-server';
export async function POST(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const userId = await calendarUser(request, true), { username } = await params;
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user || user.id !== userId) throw new CalendarError(403, 'Нет прав на изменение');
    throw new CalendarError(403, 'Личные обложки пока недоступны.');
  } catch (error) { return calendarFailure(error); }
}
