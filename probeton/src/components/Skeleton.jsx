import React from "react";
import { cn } from "@/lib/utils";

// Простой "скелетон" — серый пульсирующий блок вместо содержимого,
// пока оно грузится. Использовать вместо спиннера там, где заранее
// известна примерная форма будущего контента (карточки, текст).
export function Skeleton({ className }) {
  return (
    <div className={cn("animate-pulse bg-neutral-200 rounded-lg", className)} />
  );
}

// Готовый скелетон для карточки заявки/остатка в списке.
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}

// Готовый скелетон для отдельной страницы заказа/остатка (детали).
export function DetailPageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-4 w-16" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-[28vh] w-full rounded-2xl" />
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

// Список из нескольких карточек-скелетонов подряд.
export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
