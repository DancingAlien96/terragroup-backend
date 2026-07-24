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

/**
 * ¿La URL apunta a un archivo local de este servidor?
 *
 * Estricto: solo URLs que arrancan exactamente con "/uploads/" (path absoluto).
 * Rechaza:
 *   - "//evil.com/uploads/..."  (URL protocol-relative externa)
 *   - "https://evil.com/uploads/..." (URL absoluta externa)
 *   - "uploads/..." sin / inicial (relativa)
 */
export function isLocalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  return u.startsWith('/uploads/') && !u.startsWith('//');
}

/** Extrae el nombre de archivo de un URL local "/uploads/<name>". */
export function localFilename(url: string): string | null {
  if (!isLocalUrl(url)) return null;
  const m = url.match(/^\/uploads\/([^/?#]+)$/);
  return m ? m[1] : null;
}

/**
 * Convierte una URL de upload (`/uploads/xxx.webp`) en URL absoluta usando el
 * host que llegó en el request. Usado por endpoints públicos (croquis) para
 * evitar que el frontend tenga que armar el URL con NEXT_PUBLIC_API_URL —
 * cualquier ambigüedad en configuración (mixed content, reverse proxy, etc.)
 * se elimina porque el backend devuelve URLs listas para usar.
 *
 * Respeta X-Forwarded-Proto (via trust proxy en app.ts).
 * Si la URL ya es absoluta (legacy UploadThing), pass-through.
 */
export function absolutizeUploadUrl(
  url: string | null | undefined,
  req: { protocol: string; get: (h: string) => string | undefined },
): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const host = req.get('host');
  if (!host) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${req.protocol}://${host}${path}`;
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
