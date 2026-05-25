/**
 * audit.ts — Helper para registrar acciones en el log de auditoría.
 *
 * Llamar desde controllers después de una operación exitosa (post-commit).
 * Errores al guardar el log NO se propagan — el log no debe romper la operación.
 */

import prisma from '../config/prisma.js';

export interface AuditEntry {
  empresaId:   number;
  usuarioId?:  number | null;
  entidad:     string;
  entidadId:   number;
  accion:      'crear' | 'actualizar' | 'eliminar';
  descripcion?: string | null;
  cambios?:    unknown;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        empresaId:   entry.empresaId,
        usuarioId:   entry.usuarioId ?? null,
        entidad:     entry.entidad,
        entidadId:   entry.entidadId,
        accion:      entry.accion,
        descripcion: entry.descripcion ?? null,
        cambios:     entry.cambios as any,
      },
    });
  } catch (err) {
    // Auditoría no debe romper el flujo principal.
    console.error('[audit] Error registrando entrada:', err);
  }
}
