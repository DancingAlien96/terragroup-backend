import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { Rol } from '../../generated/prisma/enums.js';
import { createCheckout, type PlanSlug } from '../../config/recurrente.js';

export interface RegisterPayload {
  empresa_nombre: string;
  empresa_email?: string;
  empresa_telefono?: string;
  // 'basico' o 'business'. Otros valores caen a 'basico'.
  plan?: string;
  nombre_admin: string;
  email_admin: string;
  username_admin: string;
  password_admin: string;
  // Evidencia legal de aceptación de Términos, Privacidad y Aviso de IA.
  // Debe venir true; el controlador rechaza si no.
  acepto_terminos: boolean;
}

/** Resuelve el slug de plan al PlanSlug conocido. Defaults to 'basico'. */
function resolvePlan(input: string | undefined): PlanSlug {
  return input === 'business' ? 'business' : 'basico';
}

/** Busca el plan.id en BD por su slug. Los slugs deben existir en la tabla planes. */
async function planIdBySlug(slug: PlanSlug): Promise<number> {
  const p = await prisma.plan.findUnique({ where: { nombre: slug }, select: { id: true } });
  if (!p) throw new Error(`Plan '${slug}' no existe en la BD — corre el seed`);
  return p.id;
}

/**
 * Registro público: crea empresa (inactiva) + usuario admin, luego abre un
 * checkout con free trial en Recurrente. La empresa se activa al webhook
 * setup_intent.succeeded (cuando el cliente guarda la tarjeta). NO devuelve
 * JWT — el usuario no puede entrar hasta tener el trial corriendo.
 *
 * Anti-abuse del trial:
 *   - Si el email del admin YA inició un trial alguna vez (trialInicio !=
 *     null) → rechaza. Esto evita que la misma persona cree cuentas nuevas
 *     para conseguir trials infinitos.
 *   - El check se aplica antes de cualquier escritura para no dejar rastro.
 *
 * Retry de registro abandonado (mismo modelo que antes):
 *   - Si el email pertenece a una empresa "pendiente" (trial no iniciado),
 *     se permite el retry SOLO si el password matchea (anti-hijack).
 */
export async function registerEmpresa(data: RegisterPayload) {
  const conflicting = await prisma.usuario.findMany({
    where: { OR: [{ email: data.email_admin }, { username: data.username_admin }] },
    include: { empresa: { select: {
      id: true, activo: true, pagoSuscripcionId: true,
      trialInicio: true, estadoSuscripcion: true,
    } } },
  });
  for (const u of conflicting) {
    // Anti-abuse: si ya inició trial alguna vez, lo bloqueamos.
    if (u.empresa.trialInicio !== null) {
      throw Object.assign(
        new Error('Esta cuenta ya disfrutó del período de prueba. Para acceder al sistema, contáctanos a soporte@piums.io.'),
        { code: 'TRIAL_ALREADY_USED' },
      );
    }
    // Retry abandonado: empresa pendiente (sin trial iniciado) → solo el
    // titular original puede reclamar el slot.
    const pendiente = !u.empresa.activo && !u.empresa.pagoSuscripcionId;
    if (!pendiente) continue;
    const esMismoUsuario = await bcrypt.compare(data.password_admin, u.password);
    if (!esMismoUsuario) continue;
    await prisma.empresa.delete({ where: { id: u.empresaId } });
  }

  const hashed  = await bcrypt.hash(data.password_admin, 10);
  const planSlug = resolvePlan(data.plan);
  const planId   = await planIdBySlug(planSlug);

  const { empresaId, userId, empresaNombre } = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        nombre:           data.empresa_nombre,
        email:            data.empresa_email ?? null,
        telefono:         data.empresa_telefono ?? null,
        planId,
        activo:           false,
        fechaInicio:      null,
        aceptoTerminosEn: new Date(),
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

  // Si Recurrente falla (config mala, API caída), revertimos manualmente
  // empresa+usuario para no dejar huérfanos en BD. La transacción no puede
  // abrazar la llamada HTTP — sería antipatrón mantener un tx abierto durante
  // I/O externo.
  try {
    const { checkout_url } = await createCheckout({
      empresaId, usuarioId: userId, empresaNombre, plan: planSlug,
    });
    return { empresaId, userId, checkoutUrl: checkout_url };
  } catch (err) {
    await prisma.usuario.delete({ where: { id: userId } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
    throw err;
  }
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
    id:                  e.id,
    nombre:              e.nombre,
    email:               e.email,
    telefono:            e.telefono,
    rfc:                 e.rfc,
    plan_id:             e.planId,
    plan_nombre:         e.plan.nombre,
    activo:              e.activo,
    fecha_inicio:        e.fechaInicio,
    fecha_vence:         e.fechaVence,
    pago_suscripcion_id: e.pagoSuscripcionId,    // para distinguir pagadas vs activas-manualmente
    created_at:          e.createdAt,
    total_usuarios:      totalUsuarios,
    total_lotes:         totalLotes,
    total_ventas:        totalVentas,
  };
}

/* ── Súper-admin: gestión de usuarios de cualquier empresa ─────────── */

/** Lista los usuarios de una empresa específica (uso exclusivo super-admin). */
export async function listUsuariosDeEmpresa(empresaId: number) {
  return prisma.usuario.findMany({
    where:   { empresaId },
    select:  {
      id: true, nombre: true, email: true, username: true,
      rol: true, activo: true, createdAt: true,
    },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });
}

/**
 * Cambia username y/o contraseña de un usuario específico de una empresa.
 * Uso exclusivo super-admin (soporte cuando un cliente olvida credenciales).
 * - Valida que el usuario pertenezca a la empresa indicada (defensa en profundidad).
 * - Contraseña se hashea con bcrypt.
 * - Si username colisiona con otro usuario, lanza P2002 (el controller
 *   lo traduce a 409 amigable).
 */
export async function updateCredencialesUsuario(
  empresaId: number,
  usuarioId: number,
  data: { username?: string; password?: string },
) {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: usuarioId, empresaId },
    select: { id: true },
  });
  if (!usuario) return null;

  const payload: Record<string, unknown> = {};
  if (data.username !== undefined) {
    const trimmed = data.username.trim();
    if (trimmed.length < 3) throw new Error('El username debe tener al menos 3 caracteres');
    payload.username = trimmed;
  }
  if (data.password !== undefined) {
    if (data.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    payload.password = await bcrypt.hash(data.password, 10);
  }
  if (Object.keys(payload).length === 0) return usuario;

  await prisma.usuario.update({ where: { id: usuarioId }, data: payload });
  return prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { id: true, nombre: true, email: true, username: true, rol: true, activo: true },
  });
}

/** Estado mínimo, usado por el polling público de /register/exito. */
export async function getEmpresaEstado(id: number) {
  const e = await prisma.empresa.findUnique({
    where: { id },
    select: { id: true, activo: true },
  });
  return e;
}

/**
 * Datos del trial/suscripción para mostrar en banner y panel.
 * Solo lectura — no expone datos sensibles.
 */
export async function getSuscripcionInfo(empresaId: number) {
  const e = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      estadoSuscripcion: true,
      trialInicio:       true,
      trialFin:          true,
      suscripcionId:     true,
    },
  });
  if (!e) return null;
  const ahora = new Date();
  const diasRestantes = e.trialFin
    ? Math.max(0, Math.ceil((e.trialFin.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  return {
    estado:          e.estadoSuscripcion,
    trial_inicio:    e.trialInicio,
    trial_fin:       e.trialFin,
    dias_restantes:  diasRestantes,
    puede_cancelar:  e.estadoSuscripcion === 'trial' || e.estadoSuscripcion === 'pago_fallido',
  };
}

/**
 * Cancela la suscripción de la empresa desde su propio panel admin.
 * El webhook subscription.cancel actualiza el estado.
 * Idempotente: si ya está cancelada o pagada, no falla.
 */
export async function cancelarSuscripcionEmpresa(empresaId: number) {
  const e = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { suscripcionId: true, estadoSuscripcion: true },
  });
  if (!e) return { ok: false, message: 'Empresa no encontrada' };
  // Si ya pagó, no se puede "cancelar" — el contrato ya se ejecutó.
  if (e.estadoSuscripcion === 'pagada') {
    return { ok: false, message: 'La suscripción ya fue pagada y no puede cancelarse' };
  }
  if (e.estadoSuscripcion === 'cancelada') {
    return { ok: true, already_canceled: true };
  }
  if (!e.suscripcionId) {
    // Sin id de suscripción en Recurrente, marcamos local nomás.
    await prisma.empresa.update({
      where: { id: empresaId },
      data:  { activo: false, estadoSuscripcion: 'cancelada' },
    });
    return { ok: true, marked_local: true };
  }
  const { cancelSubscription } = await import('../../config/recurrente.js');
  await cancelSubscription(e.suscripcionId);
  // El webhook subscription.cancel hará el update final. Por las dudas
  // también lo marcamos acá (idempotente).
  await prisma.empresa.update({
    where: { id: empresaId },
    data:  { activo: false, estadoSuscripcion: 'cancelada' },
  });
  return { ok: true };
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
  const e = await prisma.empresa.findUnique({
    where: { id },
    select: { activo: true, pagoSuscripcionId: true, fechaInicio: true },
  });
  if (!e) return;

  const nuevoActivo = !e.activo;
  const data: { activo: boolean; pagoSuscripcionId?: string; fechaInicio?: Date } = {
    activo: nuevoActivo,
  };

  // Activación manual desde el panel super-admin: si la empresa nunca
  // completó el pago vía webhook (pagoSuscripcionId == null), la marcamos
  // con el prefijo MANUAL para:
  //   1) Sacarla de la lista de "pendientes de pago" (la lógica de retry
  //      del registro no la borrará al ver el mismo email).
  //   2) Que cuente como ingreso del SaaS (presumiblemente el admin
  //      activó porque hubo un pago externo a Recurrente).
  if (nuevoActivo && !e.pagoSuscripcionId) {
    data.pagoSuscripcionId = `MANUAL:${Date.now()}`;
    if (!e.fechaInicio) data.fechaInicio = new Date();
  }

  await prisma.empresa.update({ where: { id }, data });
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
  const ahora     = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(),     1);
  // Ventana de 12 meses para el gráfico de crecimiento MoM.
  const inicio12meses = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);
  // Ventana de 6 meses para la serie de ingresos.
  const inicio6meses  = new Date(ahora.getFullYear(), ahora.getMonth() - 5,  1);

  const [
    empresasActivas, empresasTotal, usuariosTotal, ventasTotal,
    empresasPagadas, empresasPagadasMesAnterior, registrosMes, pagosVencidos,
    empresasPorPlan, empresasParaSerie,
    gmvAgg, cobranzaAgg, registrosHistorico, activacionesHistorico,
  ] = await Promise.all([
    prisma.empresa.count({ where: { activo: true } }),
    prisma.empresa.count(),
    prisma.usuario.count({ where: { rol: { not: Rol.superadmin } } }),
    prisma.venta.count(),
    // Empresas que pagaron el SaaS — sea por Recurrente (pagoSuscripcionId
    // = "in_..." o "pi_...") o activación manual desde admin ("MANUAL:...").
    prisma.empresa.count({ where: { activo: true, pagoSuscripcionId: { not: null } } }),
    // Para el delta del mes: pagadas hasta antes de iniciado este mes.
    prisma.empresa.count({
      where: { activo: true, pagoSuscripcionId: { not: null }, updatedAt: { lt: inicioMes } },
    }),
    prisma.empresa.count({ where: { createdAt: { gte: inicioMes } } }),
    prisma.pago.count({ where: { estado: 'vencido' } }),
    // Distribución por plan (para el donut). Devuelve [{planId, _count}].
    prisma.empresa.groupBy({
      by:      ['planId'],
      where:   { activo: true },
      _count:  { id: true },
    }),
    // Empresas con pago en los últimos 6 meses para serie temporal de ingresos.
    prisma.empresa.findMany({
      where: {
        activo: true,
        pagoSuscripcionId: { not: null },
        updatedAt: { gte: inicio6meses },
      },
      select: { updatedAt: true },
    }),
    // GMV: suma de precio_total de todas las ventas en todas las empresas.
    prisma.venta.aggregate({ _sum: { precioTotal: true } }),
    // Salud de cobranza global: cuotas agrupadas por estado.
    prisma.pago.groupBy({ by: ['estado'], _count: { id: true } }),
    // Registros por mes (12 meses) — usa createdAt.
    prisma.empresa.findMany({
      where:  { createdAt: { gte: inicio12meses } },
      select: { createdAt: true },
    }),
    // Activaciones por mes (12 meses) — empresas con pago suscripción.
    prisma.empresa.findMany({
      where:  {
        pagoSuscripcionId: { not: null },
        updatedAt: { gte: inicio12meses },
      },
      select: { updatedAt: true },
    }),
  ]);

  const montoUsd = Number(process.env.RECURRENTE_MONTO_CENTS ?? '200000') / 100;
  const ingresosSaas              = empresasPagadas              * montoUsd;
  const ingresosMesAnteriorTotal  = empresasPagadasMesAnterior   * montoUsd;
  const ingresosDeltaMes          = ingresosSaas - ingresosMesAnteriorTotal;

  // Tasa de activación: % de empresas creadas que ya pagaron.
  const tasaActivacion = empresasTotal > 0 ? Math.round((empresasPagadas / empresasTotal) * 100) : 0;

  // Resuelve nombres de planes en una query.
  const planIds      = empresasPorPlan.map((p) => p.planId);
  const planes       = planIds.length > 0
    ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, nombre: true } })
    : [];
  const planNombreById = new Map(planes.map((p) => [p.id, p.nombre]));
  const distribPlanes  = empresasPorPlan.map((p) => ({
    plan:  planNombreById.get(p.planId) ?? `Plan ${p.planId}`,
    count: p._count.id,
  }));

  // Serie temporal de ingresos — agrupa por YYYY-MM últimos 6 meses.
  const ingresosPorMes: { mes: string; monto: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ingresosPorMes.push({ mes: key, monto: 0 });
  }
  for (const e of empresasParaSerie) {
    const d   = e.updatedAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const slot = ingresosPorMes.find((s) => s.mes === key);
    if (slot) slot.monto += montoUsd;
  }

  // Crecimiento MoM — registros vs activaciones por mes (12 meses).
  const crecimientoMensual: { mes: string; registros: number; activaciones: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    crecimientoMensual.push({ mes: key, registros: 0, activaciones: 0 });
  }
  for (const e of registrosHistorico) {
    const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const slot = crecimientoMensual.find((s) => s.mes === key);
    if (slot) slot.registros++;
  }
  for (const e of activacionesHistorico) {
    const key = `${e.updatedAt.getFullYear()}-${String(e.updatedAt.getMonth() + 1).padStart(2, '0')}`;
    const slot = crecimientoMensual.find((s) => s.mes === key);
    if (slot) slot.activaciones++;
  }

  // Salud de cobranza global — counts agrupados por estado.
  const cobranzaSalud = {
    pagados:    cobranzaAgg.find((p) => p.estado === 'pagado')?._count.id    ?? 0,
    pendientes: cobranzaAgg.find((p) => p.estado === 'pendiente')?._count.id ?? 0,
    vencidos:   cobranzaAgg.find((p) => p.estado === 'vencido')?._count.id   ?? 0,
  };

  // Embudo de conversión all-time.
  const conversionFunnel = {
    registros:      empresasTotal,
    pagaron:        empresasPagadas,
    conversion_pct: empresasTotal > 0 ? Math.round((empresasPagadas / empresasTotal) * 100) : 0,
  };

  return {
    empresas_activas:    empresasActivas,
    empresas_total:      empresasTotal,
    usuarios_total:      usuariosTotal,
    contratos_total:     ventasTotal,             // alias para no romper UI
    ventas_total:        ventasTotal,
    empresas_pagadas:    empresasPagadas,
    registros_mes:       registrosMes,
    ingresos_total:      ingresosSaas,            // USD
    ingresos_delta_mes:  ingresosDeltaMes,        // USD vs mes anterior
    tasa_activacion:     tasaActivacion,          // 0–100
    pagos_vencidos:      pagosVencidos,
    distribucion_planes: distribPlanes,           // [{plan, count}]
    ingresos_por_mes:    ingresosPorMes,          // [{mes, monto}]
    // Nuevas métricas:
    gmv_gestionado:      Number(gmvAgg._sum.precioTotal ?? 0),   // GTQ — suma de precio_total de todas las ventas
    cobranza_salud:      cobranzaSalud,           // {pagados, pendientes, vencidos}
    conversion_funnel:   conversionFunnel,        // {registros, pagaron, conversion_pct}
    crecimiento_mensual: crecimientoMensual,      // [{mes, registros, activaciones}] últimos 12 meses
  };
}
