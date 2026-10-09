'use client';

import React from 'react';

export interface DetailsProps {
  show?: any;
  runtime?: number | null;
  budget?: number | bigint | null;
  revenue?: number | bigint | null;
  countries?: string[];
  studios?: string[];
  director?: string | null;
  creators?: string[];
  year?: string | null;
  releaseDate?: Date | string | null;
  [key: string]: any;
}

export default function ShowDetails(props: DetailsProps) {
  const data = props.show || props;

  const runtime: number | null | undefined = data.runtime;
  const budget: number | bigint | null | undefined = data.budget;
  const revenue: number | bigint | null | undefined = data.revenue;
  const countries: string[] = Array.isArray(data.countries) ? data.countries : [];
  const studios: string[] = Array.isArray(data.studios) ? data.studios : [];
  const director: string | null | undefined = data.director;
  const creators: string[] = Array.isArray(data.creators) ? data.creators : [];

  const formatCurrency = (val: any) => {
    if (!val || val === 0 || val === '0') return null;
    const num = typeof val === 'bigint' ? Number(val) : Number(val);
    if (isNaN(num) || num <= 0) return null;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatRuntime = (mins: number | null | undefined) => {
    if (!mins || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return `${h} ч ${m > 0 ? `${m} мин` : ''}`;
    }
    return `${m} мин`;
  };

  const formatReleaseDate = (d: any) => {
    if (!d) return null;
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return null;
    }
  };

  const formattedBudget = formatCurrency(budget);
  const formattedRevenue = formatCurrency(revenue);
  const formattedRuntime = formatRuntime(runtime);
  const formattedDate = formatReleaseDate(data.releaseDate);

  const hasAnyDetails =
    director ||
    creators.length > 0 ||
    formattedBudget ||
    formattedRevenue ||
    formattedRuntime ||
    countries.length > 0 ||
    studios.length > 0 ||
    formattedDate;

  if (!hasAnyDetails) {
    return null;
  }

  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-lg">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <span>ℹ️ Информация о тайтле</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
        {/* Режиссер */}
        {director && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Режиссёр</span>
            <span className="text-neutral-200 font-medium">{director}</span>
          </div>
        )}

        {/* Создатели сериала */}
        {creators.length > 0 && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Создатели</span>
            <span className="text-neutral-200 font-medium">{creators.join(', ')}</span>
          </div>
        )}

        {/* Премьера */}
        {formattedDate && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Дата премьеры</span>
            <span className="text-neutral-200 font-medium">{formattedDate}</span>
          </div>
        )}

        {/* Длительность */}
        {formattedRuntime && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Длительность</span>
            <span className="text-neutral-200 font-medium">{formattedRuntime}</span>
          </div>
        )}

        {/* Бюджет */}
        {formattedBudget && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Бюджет</span>
            <span className="text-neutral-200 font-medium">{formattedBudget}</span>
          </div>
        )}

        {/* Сборы */}
        {formattedRevenue && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Сборы</span>
            <span className="text-emerald-400 font-medium">{formattedRevenue}</span>
          </div>
        )}

        {/* Страны */}
        {countries.length > 0 && (
          <div className="sm:col-span-2 md:col-span-3">
            <span className="text-neutral-500 text-xs block mb-1">Страны производства</span>
            <div className="flex flex-wrap gap-1.5">
              {countries.map((c: string, idx: number) => (
                <span
                  key={`${c}-${idx}`}
                  className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs border border-neutral-700/60"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Кинокомпании */}
        {studios.length > 0 && (
          <div className="sm:col-span-2 md:col-span-3">
            <span className="text-neutral-500 text-xs block mb-1">Студии / Компании</span>
            <div className="flex flex-wrap gap-1.5">
              {studios.map((s: string, idx: number) => (
                <span
                  key={`${s}-${idx}`}
                  className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs border border-neutral-700/60"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}