import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").toLowerCase().trim();
    const username = String(body.username || "").toLowerCase().trim();
    const password = String(body.password || "");
    const name = body.name ? String(body.name).trim() : null;

    // Валидация
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Неверный email" }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username: 3–20 символов, только a-z, 0-9, _" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль — минимум 6 символов" },
        { status: 400 }
      );
    }

    // Проверка на занятость
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.email === email
              ? "Этот email уже зарегистрирован"
              : "Этот username занят",
        },
        { status: 409 }
      );
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        name,
      },
      select: { id: true, email: true, username: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: err.message || "Ошибка сервера" },
      { status: 500 }
    );
  }
}