import { useState, type ComponentProps } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * Password field with a button to show or hide what was typed.
 *
 * Every prop, including the `id` and `aria-*` set by `Field`, reaches the input itself, so the
 * label and the messages stay linked to it.
 *
 * @param props - Class names and every native input prop except `type`.
 * @returns The field.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState<boolean>(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-md text-fg-subtle hover:text-fg"
      >
        {visible ? <LuEyeOff aria-hidden className="size-4" /> : <LuEye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
