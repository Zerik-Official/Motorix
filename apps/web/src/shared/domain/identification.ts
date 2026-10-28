/**
 * Kinds of identification document a client can be registered with, as business-api names them.
 */
export const IDENTIFICATION_TYPES = ["cc", "nit", "ce", "passport"] as const;

/**
 * Kind of identification document of a client.
 */
export type IdentificationType = (typeof IDENTIFICATION_TYPES)[number];

/**
 * Full name of each document, as shown in forms.
 */
export const IDENTIFICATION_LABELS: Record<IdentificationType, string> = {
  cc: "Cédula de ciudadanía",
  nit: "NIT",
  ce: "Cédula de extranjería",
  passport: "Pasaporte",
};

/**
 * Short name of each document, as shown next to the number.
 */
export const IDENTIFICATION_SHORT_LABELS: Record<IdentificationType, string> = {
  cc: "CC",
  nit: "NIT",
  ce: "CE",
  passport: "Pasaporte",
};

/**
 * Identification of a client as read in the workshop, such as "NIT 900222333".
 *
 * @param type - Kind of document.
 * @param number - Number of the document.
 * @returns The identification.
 */
export function formatIdentification(type: string, number: string): string {
  const label: string = IDENTIFICATION_SHORT_LABELS[type as IdentificationType] ?? type.toUpperCase();
  return `${label} ${number}`;
}
