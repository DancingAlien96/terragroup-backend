/**
 * files.ts — Helpers para manejo de archivos del usuario.
 *
 * Los archivos se guardan en UPLOADS_DIR (ver app.ts) y se sirven públicamente
 * vía /uploads/<filename>. Los URLs guardados en BD pueden ser:
 *   - locales: "/uploads/abc123.webp"
 *   - externos legacy: "https://utfs.io/f/..." (UploadThing, sigue funcionando)
 *
 * deleteFileIfLocal solo borra los locales — los externos no son nuestros.
 */

import fs from 'fs/promises';
import path from 'path';

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ?? path.join(process.cwd(), 'uploads');

/** ¿La URL apunta a un archivo local de este servidor? */
export function isLocalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.includes('/uploads/');
}

/** Extrae el nombre de archivo de un URL local. */
export function localFilename(url: string): string | null {
  const m = url.match(/\/uploads\/([^/?#]+)$/);
  return m ? m[1] : null;
}

/**
 * Si la URL apunta a un archivo local, lo borra del disco.
 * No falla si el archivo ya no existe (puede haber sido eliminado manualmente).
 */
export async function deleteFileIfLocal(url: string | null | undefined): Promise<void> {
  if (!isLocalUrl(url)) return;
  const filename = localFilename(url!);
  if (!filename) return;
  // Sanitiza para evitar path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    console.warn(`[uploads] Filename rechazado por seguridad: ${filename}`);
    return;
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  try {
    await fs.unlink(filePath);
    console.log(`[uploads] Archivo borrado: ${filename}`);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.error(`[uploads] Error borrando ${filename}:`, err);
    }
  }
}
