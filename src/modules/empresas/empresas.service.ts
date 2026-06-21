import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { Rol } from '../../generated/prisma/enums.js';
import { createCheckout } from '../../config/recurrente.js';

export interface RegisterPayload {
  empresa_nombre: string;
  empresa_email?: string;
  empresa_telefono?: string;
  // plan_id es opcional; si no viene se usa DEFAULT_PLAN_ID (modelo de pago único).
  plan_id?: number;
  nombre_admin: string;
  email_admin: string;
  username_admin: string;
  password_admin: string;
}

const DEFAULT_PLAN_ID = Number(process.env.DEFAULT_PLAN_ID ?? '1');

/**
 * Registro público: crea empresa (inactiva) + usuario admin, luego abre un
 * checkout en Recurrente. La empresa se activa cuando llega el webhook
 * intent.succeeded. NO devuelve JWT — el usuario no puede entrar hasta pagar.
 */
export async function registerEmpresa(data: RegisterPayload) {
  const hashed = await bcrypt.hash(data.password_admin, 10);

  const { empresaId, userId, empresaNombre } = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        nombre:      data.empresa_nombre,
        email:       data.empresa_email ?? null,
        telefono:    data.empresa_telefono ?? null,
        planId:      data.plan_id ?? DEFAULT_PLAN_ID,
        activo:      false,
        fechaInicio: null,
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nombre:    data.nombre_admin,
        email:     data.email_admin,
        username:  data.username_admin,
        password:  hashed,
        rol:       Rol.admin,
      },
    });

    return { empresaId: empresa.id, userId: usuario.id, empresaNombre: empresa.nombre };
  });

  const { checkout_url } = await createCheckout({ empresaId, usuarioId: userId, empresaNombre });
  return { empresaId, userId, checkoutUrl: checkout_url };
}

/** Detalle de una empresa con estadísticas (totales). */
async function empresaWithStats(empresaId: number) {
  const e = await prisma.empresa.findUnique({
    where:   { id: empresaId },
    include: { plan: true },
  });
  if (!e) return null;
  const [totalUsuarios, totalLotes, totalVentas] = await Promise.all([
    prisma.usuario.count({ where: { empresaId, rol: { not: Rol.superadmin } } }),
    prisma.lote.count({ where: { empresaId } }),
    prisma.venta.count({ where: { empresaId } }),
  ]);
  return {
    id:             e.id,
    nombre:         e.nombre,
    email:          e.email,
    telefono:       e.telefono,
    rfc:            e.rfc,
    plan_id:        e.planId,
    plan_nombre:    e.plan.nombre,
    activo:         e.activo,
    fecha_inicio:   e.fechaInicio,
    fecha_vence:    e.fechaVence,
    created_at:     e.createdAt,
    total_usuarios: totalUsuarios,
    total_lotes:    totalLotes,
    total_ventas:   totalVentas,
  };
}

/** Estado mínimo, usado por el polling público de /register/exito. */
export async function getEmpresaEstado(id: number) {
  const e = await prisma.empresa.findUnique({
    where: { id },
    select: { id: true, activo: true },
  });
  return e;
}

export async function listEmpresas() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { createdAt: 'desc' },
    select:  { id: true },
  });
  const results = await Promise.all(empresas.map(({ id }) => empresaWithStats(id)));
  return results.filter((e) => e !== null);
}

export function getEmpresa(id: number) {
  return empresaWithStats(id);
}

export async function toggleEmpresa(id: number): Promise<void> {
  const e = await prisma.empresa.findUnique({ where: { id }, select: { activo: true } });
  if (!e) return;
  await prisma.empresa.update({ where: { id }, data: { activo: !e.activo } });
}

export async function updateEmpresaPlan(id: number, planId: number): Promise<void> {
  await prisma.empresa.update({ where: { id }, data: { planId } });
}

export async function updateEmpresa(
  id: number,
  data: Partial<{ nombre: string; email: string; telefono: string; rfc: string; fecha_vence: string }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (data.nombre !== undefined)      payload.nombre     = data.nombre;
  if (data.email !== undefined)       payload.email      = data.email;
  if (data.telefono !== undefined)    payload.telefono   = data.telefono;
  if (data.rfc !== undefined)         payload.rfc        = data.rfc;
  if (data.fecha_vence !== undefined) payload.fechaVence = new Date(data.fecha_vence);
  if (Object.keys(payload).length === 0) return;
  await prisma.empresa.update({ where: { id }, data: payload });
}

/** Estadísticas globales para el panel super-admin. */
export async function getGlobalStats() {
  const [empresasActivas, empresasTotal, usuariosTotal, ventasTotal, ingresosAgg, pagosVencidos] = await Promise.all([
    prisma.empresa.count({ where: { activo: true } }),
    prisma.empresa.count(),
    prisma.usuario.count({ where: { rol: { not: Rol.superadmin } } }),
    prisma.venta.count(),
    prisma.pago.aggregate({ where: { estado: 'pagado' }, _sum: { monto: true } }),
    prisma.pago.count({ where: { estado: 'vencido' } }),
  ]);
  return {
    empresas_activas: empresasActivas,
    empresas_total:   empresasTotal,
    usuarios_total:   usuariosTotal,
    contratos_total:  ventasTotal,                 // alias para no romper UI
    ventas_total:     ventasTotal,
    ingresos_total:   Number(ingresosAgg._sum.monto ?? 0),
    pagos_vencidos:   pagosVencidos,
  };
}
