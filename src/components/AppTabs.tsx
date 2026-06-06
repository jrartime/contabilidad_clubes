"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type AppTab = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppTabs({ tabs }: { tabs: AppTab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="app-tabs" aria-label="Menu principal">
      {tabs.map((tab) => {
        const active = isActivePath(pathname, tab.href);
        const prefetchTab = () => {
          if (!active) router.prefetch(tab.href);
        };

        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={active ? "app-tab app-tab-active" : "app-tab"}
            aria-current={active ? "page" : undefined}
            onFocus={prefetchTab}
            onMouseEnter={prefetchTab}
            onTouchStart={prefetchTab}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
