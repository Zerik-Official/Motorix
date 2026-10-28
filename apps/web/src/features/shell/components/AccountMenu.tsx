import { useEffect, useId, useRef, useState } from "react";
import { LuChevronDown, LuLoaderCircle, LuLogOut } from "react-icons/lu";

import { cn } from "@/lib/utils";
import { useToast } from "@shared/feedback/useToast";
import { ROLE_LABELS } from "@shared/session/roles";
import { useSession } from "@shared/session/useSession";

/**
 * Builds the initials of a full name.
 *
 * @param fullName - Name of the account.
 * @returns Up to two initials.
 */
function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Button with the signed in account that opens a menu to log out.
 *
 * The menu closes with Escape or a click outside, and its trigger reports whether it is open.
 *
 * @returns The menu.
 */
export function AccountMenu() {
  const { profile, logout } = useSession();
  const { notify } = useToast();
  const [open, setOpen] = useState<boolean>(false);
  const [leaving, setLeaving] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId: string = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profile) {
    return null;
  }

  /**
   * Ends the session and confirms it.
   */
  const handleLogout = async (): Promise<void> => {
    setLeaving(true);
    try {
      await logout();
      notify({ tone: "success", title: "Sesión cerrada", description: "Hasta la próxima." });
    } catch {
      notify({ tone: "info", title: "Sesión cerrada en este equipo", description: "No pudimos avisar al servidor, pero ya no estás conectado aquí." });
    }
  };

  return (
    <div ref={wrapperRef} className="relative" data-tour="account-menu">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        className="flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-raised"
      >
        <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-fg font-wide text-xs font-bold text-canvas">
          {initials(profile.full_name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-fg">{profile.full_name}</span>
          <span className="block text-xs text-fg-subtle">{ROLE_LABELS[profile.role]}</span>
        </span>
        <LuChevronDown aria-hidden className={cn("size-4 text-fg-subtle transition-transform", open && "rotate-180")} />
        <span className="sr-only">Menú de la cuenta</span>
      </button>
      {open && (
        <div id={menuId} className="absolute right-0 z-40 mt-2 w-64 rounded-md border border-line bg-panel p-1.5 shadow-lg">
          <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
            <p className="truncate text-sm font-semibold text-fg">{profile.full_name}</p>
            <p className="truncate text-xs text-fg-subtle">{profile.email}</p>
            <p className="mt-1 text-xs text-fg-muted">{ROLE_LABELS[profile.role]}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={leaving}
            className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-fg hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
          >
            {leaving ? <LuLoaderCircle aria-hidden className="size-4 animate-spin" /> : <LuLogOut aria-hidden className="size-4" />}
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
