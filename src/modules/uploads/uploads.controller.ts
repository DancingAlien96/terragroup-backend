/**
 * uploads.controller.ts — Subida de archivos al servidor.
 *
 * POST /api/uploads
 *   - multipart/form-data, field name: "file"
 *   - Imágenes → convertidas a WebP (q80, max 2000px) por sharp
 *   - PDFs    → se aceptan tal cual hasta 4 MB
 *   - Otros tipos → 415
 *
 *   Respuesta: { success: true, data: { url: "/uploads/<uuid>.webp", size, mime } }
 *
 * Limita por authMiddleware (requiere token). Los URLs son UUIDs no adivinables.
 */

import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { UPLOADS_DIR } from '../../utils/files.js';

const MAX_BYTES_PDF   = 4 * 1024 * 1024;
const MAX_BYTES_IMG   = 12 * 1024 * 1024;     // imagen original antes de optimizar
const IMG_MAX_DIM     = 2000;
const WEBP_QUALITY    = 80;

const ALLOWED_IMG_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

export async function upload(req: Request, res: Response) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No se recibió archivo (campo "file")' });
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const id = uuid();
    let outPath: string;
    let outUrl:  string;
    let outMime: string;
    let outSize: number;

    if (ALLOWED_IMG_MIMES.has(file.mimetype)) {
      if (file.size > MAX_BYTES_IMG) {
        return res.status(413).json({ success: false, message: 'Imagen demasiado grande (máximo 12 MB).' });
      }
      // Optimiza → WebP
      const filename = `${id}.webp`;
      outPath = path.join(UPLOADS_DIR, filename);
      const buffer = await sharp(file.buffer, { failOn: 'none' })
        .rotate()                                           // respeta orientación EXIF
        .resize({ width: IMG_MAX_DIM, height: IMG_MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      await fs.writeFile(outPath, buffer);
      outUrl  = `/uploads/${filename}`;
      outMime = 'image/webp';
      outSize = buffer.length;
    } else if (file.mimetype === 'application/pdf') {
      if (file.size > MAX_BYTES_PDF) {
        return res.status(413).json({ success: false, message: 'PDF demasiado grande (máximo 4 MB).' });
      }
      const filename = `${id}.pdf`;
      outPath = path.join(UPLOADS_DIR, filename);
      await fs.writeFile(outPath, file.buffer);
      outUrl  = `/uploads/${filename}`;
      outMime = 'application/pdf';
      outSize = file.size;
    } else {
      return res.status(415).json({
        success: false,
        message: `Tipo de archivo no permitido: ${file.mimetype}. Solo imágenes y PDF.`,
      });
    }

    return res.json({
      success: true,
      data: { url: outUrl, mime: outMime, size: outSize },
    });
  } catch (err) {
    console.error('[uploads] Error procesando archivo:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}
