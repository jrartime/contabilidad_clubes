"use client";

import React, { useRef } from "react";

export function AutoSubmitFilters({
  action,
  children,
  className,
}: {
  action: string;
  children: React.ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function submitNow() {
    if (timerRef.current) clearTimeout(timerRef.current);
    formRef.current?.requestSubmit();
  }

  function submitDebounced() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 350);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      className={className ?? "filters-grid"}
      onChange={(event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        if (target instanceof HTMLInputElement && target.type === "search") {
          submitDebounced();
          return;
        }
        submitNow();
      }}
      onInput={(event) => {
        const target = event.target as HTMLInputElement;
        if (target instanceof HTMLInputElement && target.type === "search") {
          submitDebounced();
        }
      }}
    >
      {children}
    </form>
  );
}
