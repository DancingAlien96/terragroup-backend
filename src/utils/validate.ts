/**
 * validate.ts — Helpers de validación.
 *
 * Los services llaman estas funciones; lanzan ValidationError cuando el dato
 * es inválido. Los controllers convierten ValidationError → HTTP 400.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Devuelve un número > 0 o lanza. */
export function positive(label: string, v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ValidationError(`${label} debe ser un número mayor a 0`);
  }
  return n;
}

/** Devuelve un número >= 0 o lanza. */
export function nonNegative(label: string, v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new ValidationError(`${label} no puede ser negativo`);
  }
  return n;
}

/** Devuelve un número entre [min, max] o lanza. */
export function between(label: string, v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError(`${label} debe estar entre ${min} y ${max}`);
  }
  return n;
}

/** Devuelve un entero >= 0 o lanza. */
export function intNonNegative(label: string, v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError(`${label} debe ser un número entero no negativo`);
  }
  return n;
}

/** Devuelve un string no vacío con largo <= maxLen o lanza. */
export function nonEmptyString(label: string, v: unknown, maxLen: number): string {
  if (typeof v !== 'string') throw new ValidationError(`${label} es requerido`);
  const trimmed = v.trim();
  if (trimmed.length === 0) throw new ValidationError(`${label} es requerido`);
  if (trimmed.length > maxLen) {
    throw new ValidationError(`${label} excede el límite de ${maxLen} caracteres`);
  }
  return trimmed;
}

/** Para strings opcionales: si viene, recorta y verifica largo. null si vacío. */
export function optionalString(label: string, v: unknown, maxLen: number): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError(`${label} debe ser texto`);
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) {
    throw new ValidationError(`${label} excede el límite de ${maxLen} caracteres`);
  }
  return trimmed;
}

/** Email básico. Si v es null/undefined/'', devuelve null. */
export function optionalEmail(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError('Email debe ser texto');
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 150) throw new ValidationError('Email excede el límite de 150 caracteres');
  // Validación simple: contiene @ y . con texto antes y después
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ValidationError('Email inválido');
  }
  return trimmed;
}
