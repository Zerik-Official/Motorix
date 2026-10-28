import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Accessibility props a {@link Field} passes to its control.
 */
export interface FieldControlProps {
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
  /**
   * Control of the field. An element receives the accessibility props directly; a function
   * receives them to place on the right element of a composite control, such as a select trigger.
   */
  children: ReactElement<FieldControlProps> | ((controlProps: FieldControlProps) => ReactNode);
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
  const controlProps: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  };
  const control: ReactNode =
    typeof children === "function"
      ? children(controlProps)
      : isValidElement(children)
        ? cloneElement(children, controlProps)
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
