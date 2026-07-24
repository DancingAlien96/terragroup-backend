import crypto from 'crypto';
import prisma from '../../config/prisma.js';

/**
 * Token público del croquis — 32 bytes en base64url. No es secreto criptográfico
 * (solo evita enumeración por fuerza bruta / índices); el dueño puede regenerar
 * o apagar la vista pública cuando quiera.
 */
function generarToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function normalizarCoord(v: unknown, campo: string): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${campo} debe estar entre 0 y 1 (coordenada normalizada)`);
  }
  return n;
}

/** DTO para la UI del dueño (incluye datos privados). */
function shapeCroquisPrivado(c: {
  id: number; empresaId: number; proyectoId: number;
  imagenUrl: string; imagenAncho: number | null; imagenAlto: number | null;
  publicoActivo: boolean; publicoToken: string | null;
  contactoWhatsapp: string | null; contactoEmail: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id:                 c.id,
    empresa_id:         c.empresaId,
    proyecto_id:        c.proyectoId,
    imagen_url:         c.imagenUrl,
    imagen_ancho:       c.imagenAncho,
    imagen_alto:        c.imagenAlto,
    publico_activo:     c.publicoActivo,
    publico_token:      c.publicoToken,
    contacto_whatsapp:  c.contactoWhatsapp,
    contacto_email:     c.contactoEmail,
    created_at:         c.createdAt,
    updated_at:         c.updatedAt,
  };
}

async function shapeLoteConPin(loteId: number) {
  const l = await prisma.lote.findUnique({ where: { id: loteId } });
  if (!l) return null;
  return {
    id:                     l.id,
    clave:                  l.clave,
    manzana:                l.manzana,
    numero:                 l.numero,
    superficie:             l.superficie ? Number(l.superficie) : null,
    precio_venta:           l.precioVenta ? Number(l.precioVenta) : null,
    estado:                 l.estado,
    punto_x:                l.puntoX,
    punto_y:                l.puntoY,
    mostrar_precio_publico: l.mostrarPrecioPublico,
    notas_publicas:         l.notasPublicas,
  };
}

/**
 * Obtiene el croquis + todos los lotes del proyecto (con o sin pin colocado).
 * Devuelve null si el proyecto no tiene croquis aún.
 */
export async function getCroquisPorProyecto(proyectoId: number, empresaId: number) {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, empresaId },
    include: {
      croquis: true,
      lotes: {
        orderBy: [{ manzana: 'asc' }, { numero: 'asc' }, { clave: 'asc' }],
      },
    },
  });
  if (!proyecto) return { notFound: true as const };
  if (!proyecto.croquis) return { croquis: null, lotes: proyecto.lotes.map(l => ({
    id: l.id, clave: l.clave, manzana: l.manzana, numero: l.numero,
    superficie: l.superficie ? Number(l.superficie) : null,
    precio_venta: l.precioVenta ? Number(l.precioVenta) : null,
    estado: l.estado,
    punto_x: l.puntoX, punto_y: l.puntoY,
    mostrar_precio_publico: l.mostrarPrecioPublico,
    notas_publicas: l.notasPublicas,
  })) };

  return {
    croquis: shapeCroquisPrivado(proyecto.croquis),
    lotes: proyecto.lotes.map(l => ({
      id: l.id, clave: l.clave, manzana: l.manzana, numero: l.numero,
      superficie: l.superficie ? Number(l.superficie) : null,
      precio_venta: l.precioVenta ? Number(l.precioVenta) : null,
      estado: l.estado,
      punto_x: l.puntoX, punto_y: l.puntoY,
      mostrar_precio_publico: l.mostrarPrecioPublico,
      notas_publicas: l.notasPublicas,
    })),
  };
}

/**
 * Crea o actualiza el croquis del proyecto (upsert). Si ya existía, reemplaza
 * la imagen pero conserva el token público y los pines ya colocados.
 */
export async function upsertCroquis(
  proyectoId: number,
  empresaId: number,
  data: {
    imagen_url: string;
    imagen_ancho?: number | null;
    imagen_alto?: number | null;
    contacto_whatsapp?: string | null;
    contacto_email?: string | null;
  },
) {
  const proyecto = await prisma.proyecto.findFirst({ where: { id: proyectoId, empresaId } });
  if (!proyecto) return null;

  if (!data.imagen_url || typeof data.imagen_url !== 'string') {
    throw new Error('imagen_url es requerida');
  }

  const c = await prisma.croquis.upsert({
    where: { proyectoId },
    create: {
      empresaId, proyectoId,
      imagenUrl:        data.imagen_url,
      imagenAncho:      data.imagen_ancho ?? null,
      imagenAlto:       data.imagen_alto  ?? null,
      contactoWhatsapp: data.contacto_whatsapp ?? null,
      contactoEmail:    data.contacto_email    ?? null,
    },
    update: {
      imagenUrl:        data.imagen_url,
      imagenAncho:      data.imagen_ancho ?? null,
      imagenAlto:       data.imagen_alto  ?? null,
      // contacto_* solo se sobrescribe si viene en el payload (no forzar null en
      // update accidental)
      ...(data.contacto_whatsapp !== undefined && { contactoWhatsapp: data.contacto_whatsapp }),
      ...(data.contacto_email    !== undefined && { contactoEmail:    data.contacto_email    }),
    },
  });
  return shapeCroquisPrivado(c);
}

export async function updateContacto(
  croquisId: number,
  empresaId: number,
  data: { contacto_whatsapp?: string | null; contacto_email?: string | null },
) {
  const c = await prisma.croquis.findFirst({ where: { id: croquisId, empresaId } });
  if (!c) return null;
  const upd = await prisma.croquis.update({
    where: { id: croquisId },
    data: {
      ...(data.contacto_whatsapp !== undefined && { contactoWhatsapp: data.contacto_whatsapp }),
      ...(data.contacto_email    !== undefined && { contactoEmail:    data.contacto_email    }),
    },
  });
  return shapeCroquisPrivado(upd);
}

/** Activa la vista pública. Si no había token, se genera uno. */
export async function activarPublico(croquisId: number, empresaId: number) {
  const c = await prisma.croquis.findFirst({ where: { id: croquisId, empresaId } });
  if (!c) return null;
  const token = c.publicoToken ?? generarToken();
  const upd = await prisma.croquis.update({
    where: { id: croquisId },
    data:  { publicoActivo: true, publicoToken: token },
  });
  return shapeCroquisPrivado(upd);
}

export async function desactivarPublico(croquisId: number, empresaId: number) {
  const c = await prisma.croquis.findFirst({ where: { id: croquisId, empresaId } });
  if (!c) return null;
  const upd = await prisma.croquis.update({
    where: { id: croquisId },
    data:  { publicoActivo: false },
  });
  return shapeCroquisPrivado(upd);
}

/**
 * Regenera el token público (invalida el link viejo). Uso: dueño quiere cortar
 * acceso al link que ya compartió y emitir uno nuevo.
 */
export async function regenerarToken(croquisId: number, empresaId: number) {
  const c = await prisma.croquis.findFirst({ where: { id: croquisId, empresaId } });
  if (!c) return null;
  const upd = await prisma.croquis.update({
    where: { id: croquisId },
    data:  { publicoToken: generarToken() },
  });
  return shapeCroquisPrivado(upd);
}

export async function deleteCroquis(croquisId: number, empresaId: number) {
  const c = await prisma.croquis.findFirst({ where: { id: croquisId, empresaId } });
  if (!c) return { ok: false as const, notFound: true };
  await prisma.croquis.delete({ where: { id: croquisId } });
  // Los pines (puntoX/puntoY) se quedan en los lotes por si el dueño resube el
  // mismo plano — no perdemos su trabajo.
  return { ok: true as const };
}

/** Coloca o mueve el pin de un lote sobre el croquis del proyecto. */
export async function setPinLote(
  loteId: number,
  empresaId: number,
  data: { punto_x: unknown; punto_y: unknown },
) {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, empresaId } });
  if (!lote) return null;
  const x = normalizarCoord(data.punto_x, 'punto_x');
  const y = normalizarCoord(data.punto_y, 'punto_y');
  await prisma.lote.update({ where: { id: loteId }, data: { puntoX: x, puntoY: y } });
  return shapeLoteConPin(loteId);
}

export async function quitarPinLote(loteId: number, empresaId: number) {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, empresaId } });
  if (!lote) return null;
  await prisma.lote.update({ where: { id: loteId }, data: { puntoX: null, puntoY: null } });
  return shapeLoteConPin(loteId);
}

export async function updateVisibilidadPublicaLote(
  loteId: number,
  empresaId: number,
  data: { mostrar_precio_publico?: boolean; notas_publicas?: string | null },
) {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, empresaId } });
  if (!lote) return null;
  const payload: Record<string, unknown> = {};
  if (data.mostrar_precio_publico !== undefined) payload.mostrarPrecioPublico = !!data.mostrar_precio_publico;
  if (data.notas_publicas         !== undefined) payload.notasPublicas        = data.notas_publicas;
  if (Object.keys(payload).length === 0) return shapeLoteConPin(loteId);
  await prisma.lote.update({ where: { id: loteId }, data: payload });
  return shapeLoteConPin(loteId);
}

/**
 * Vista pública por token — no requiere auth. Solo devuelve lo mínimo para
 * mostrar el mapa; nombres/emails de propietarios NO salen. Precio de cada
 * lote depende de su flag mostrar_precio_publico.
 */
export async function getPublicoPorToken(token: string) {
  if (!token || typeof token !== 'string') return null;
  const c = await prisma.croquis.findUnique({
    where: { publicoToken: token },
    include: {
      empresa:  { select: { nombre: true } },
      proyecto: {
        include: {
          lotes: {
            where: { puntoX: { not: null }, puntoY: { not: null } },
            orderBy: [{ manzana: 'asc' }, { numero: 'asc' }, { clave: 'asc' }],
          },
        },
      },
    },
  });
  if (!c || !c.publicoActivo) return null;

  return {
    empresa_nombre:    c.empresa.nombre,
    proyecto_nombre:   c.proyecto.nombre,
    proyecto_ubicacion: c.proyecto.ubicacion,
    imagen_url:        c.imagenUrl,
    imagen_ancho:      c.imagenAncho,
    imagen_alto:       c.imagenAlto,
    contacto_whatsapp: c.contactoWhatsapp,
    contacto_email:    c.contactoEmail,
    lotes: c.proyecto.lotes.map((l) => ({
      id:            l.id,
      clave:         l.clave,
      manzana:       l.manzana,
      numero:        l.numero,
      superficie:    l.superficie ? Number(l.superficie) : null,
      // Solo expone el precio si el dueño lo autorizó lote por lote
      precio_venta:  l.mostrarPrecioPublico && l.precioVenta ? Number(l.precioVenta) : null,
      estado:        l.estado,
      punto_x:       l.puntoX,
      punto_y:       l.puntoY,
      notas_publicas: l.notasPublicas,
    })),
  };
}
