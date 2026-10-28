import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves conflicting Tailwind utilities, keeping the last one.
 *
 * @param inputs - Class names, conditional objects or arrays.
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
