import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Accessibility props a {@link Field} passes to its control.
 */
interface FieldControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}

/**
 * Props of {@link Field}.
 */
interface FieldProps {
  /** Visible label of the control. */
  label: string;
  /** Control of the field: an input, a select or a textarea. */
  children: ReactElement<FieldControlProps>;
  /** Help shown under the control. */
  hint?: ReactNode;
  /** Validation message; marks the control invalid. */
  error?: string;
  /** Marks the field as required. */
  required?: boolean;
  /** Extra classes of the wrapper. */
  className?: string;
}

/**
 * Label, control, help and error of a form field, wired together for assistive technology:
 * the label names the control, and the help and the error describe it.
 *
 * @param props - Label, control, help, error and required flag.
 * @returns The field.
 */
export function Field({ label, children, hint, error, required = false, className }: FieldProps) {
  const id: string = useId();
  const hintId: string = `${id}-hint`;
  const errorId: string = `${id}-error`;
  const describedBy: string | undefined =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control: ReactNode = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
