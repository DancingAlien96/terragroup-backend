/**
 * Helpers para resolver los destinatarios de notificaciones administrativas
 * de cada empresa. Garantiza que los emails operativos (mora, comprobantes,
 * etc.) lleguen al dueño de la empresa y NO a la cuenta del SaaS.
 *
 * Reglas:
 *   - Se incluyen TODOS los usuarios con rol=admin de la empresa.
 *   - Si Empresa.email está seteado, también se incluye.
 *   - Se deduplican (mismo email no aparece dos veces).
 *   - Si la empresa no tiene admins ni email registrado, devuelve [] (el
 *     llamador debe decidir si log + skip o usar fallback).
 */

import prisma from '../config/prisma.js';
import { Rol } from '../generated/prisma/enums.js';

/** Devuelve la lista de emails a los que notificar acciones de esta empresa. */
export async function getEmpresaAdminEmails(empresaId: number): Promise<string[]> {
  const [empresa, admins] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { email: true },
    }),
    prisma.usuario.findMany({
      where: { empresaId, rol: Rol.admin, activo: true },
      select: { email: true },
    }),
  ]);

  const seen = new Set<string>();
  const emails: string[] = [];
  const push = (e: string | null | undefined) => {
    const t = e?.trim().toLowerCase();
    if (!t || seen.has(t)) return;
    seen.add(t);
    emails.push(e!.trim());
  };

  for (const a of admins) push(a.email);
  push(empresa?.email);

  return emails;
}
