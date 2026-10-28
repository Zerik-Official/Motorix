import { useState } from "react";
import { LuMenu, LuX } from "react-icons/lu";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { BrandMark } from "@shared/components/BrandMark";
import { useSession } from "@shared/session/useSession";
import { ThemeToggle } from "@shared/theme/ThemeToggle";

import { AccountMenu } from "./components/AccountMenu";
import { NAV_ITEMS, type NavItem } from "./navigation";

/**
 * Classes of a navigation link, depending on whether its section is open.
 *
 * @param state - Whether the link points to the current section.
 * @returns The classes.
 */
function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors",
    isActive ? "bg-fg text-canvas" : "text-fg-muted hover:bg-raised hover:text-fg",
  );
}

/**
 * Frame of every page of the app: top bar with the sections, theme and account, and the page below.
 *
 * On narrow screens the sections move into a menu opened from the top bar. A skip link lets
 * keyboard users jump straight to the content.
 *
 * @returns The layout.
 */
export function AppLayout() {
  const { can } = useSession();
  const location = useLocation();
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen: boolean = menuOpenedAt === location.pathname;
  const items: NavItem[] = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="xl:hidden"
            onClick={() => setMenuOpenedAt(menuOpen ? null : location.pathname)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {menuOpen ? <LuX aria-hidden /> : <LuMenu aria-hidden />}
          </Button>
          <Link to="/app" aria-label="Motorix, ir al tablero" className="rounded-md">
            <BrandMark />
          </Link>
          <nav aria-label="Secciones" className="ml-4 hidden xl:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === "/app"} className={navLinkClass} data-tour={item.tourId}>
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-nav" aria-label="Secciones" className="border-t border-line px-4 py-3 xl:hidden">
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === "/app"} className={navLinkClass}>
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
