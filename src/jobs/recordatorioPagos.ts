/**
 * Job diario: Recordatorio de pagos en mora — POR EMPRESA.
 *
 * Se ejecuta cada día a las 08:00 AM (zona America/Guatemala).
 *
 * Agrupa las ventas por empresa, calcula qué cuotas están vencidas sin pago
 * de cada una, y envía un email SEPARADO a los administradores de cada
 * empresa (los datos de cobranza son privados de cada tenant — TerraGroup
 * NO recibe esta información).
 */

import cron from 'node-cron';
import prisma from '../config/prisma.js';
import transporter from '../config/mailer.js';
import { getEmpresaAdminEmails } from '../utils/empresaEmails.js';

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function estadoMora(dias: number): { label: string; color: string } {
  if (dias > 90) return { label: 'Mora grave',    color: '#ef4444' };
  if (dias > 30) return { label: 'Mora media',    color: '#f97316' };
  return            { label: 'Mora temprana', color: '#d4a843' };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 }).format(n);
}

interface MoraCliente {
  nombre: string;
  lote: string;
  cuotasVencidas: number;
  montoVencido: number;
  dias: number;
  esNuevoHoy: boolean;
}

/** Calcula la lista de clientes en mora de UNA empresa específica. */
function calcularMoraDeEmpresa(
  ventas: Array<{
    numCuotas: number;
    valorCuota: { toString: () => string } | number;
    cuotaInicio: number | null;
    fechaInicio: Date;
    descripcionLote: string | null;
    propietario: { nombre: string };
    lote: { clave: string } | null;
    pagos: { numCuota: number | null }[];
  }>,
  today: Date,
): MoraCliente[] {
  const enMora: MoraCliente[] = [];
  for (const v of ventas) {
    const numCuotas   = v.numCuotas;
    const valorCuota  = Number(v.valorCuota);
    const cuotaInicio = v.cuotaInicio ?? 1;
    if (numCuotas <= 0 || valorCuota <= 0) continue;

    const fechaInicio = new Date(v.fechaInicio);
    const fechasVencidas: Date[] = [];
    for (let i = 1; i <= numCuotas; i++) {
      const due = addMonths(fechaInicio, i);
      if (due <= today) fechasVencidas.push(due);
      else break;
    }
    const cuotasPrevias = Math.max(0, cuotaInicio - 1);
    const cuotasVencidas = fechasVencidas.length - v.pagos.length - cuotasPrevias;
    if (cuotasVencidas <= 0) continue;

    const cuotaMasAntigua = fechasVencidas[v.pagos.length + cuotasPrevias];
    const dias = cuotaMasAntigua
      ? Math.floor((today.getTime() - cuotaMasAntigua.getTime()) / 86_400_000)
      : 0;

    enMora.push({
      nombre:         v.propietario.nombre,
      lote:           v.descripcionLote ?? v.lote?.clave ?? '—',
      cuotasVencidas,
      montoVencido:   cuotasVencidas * valorCuota,
      dias,
      esNuevoHoy:     dias <= 1,
    });
  }
  return enMora;
}

/** Construye el HTML del email de mora para los datos de UNA empresa. */
function buildHtmlMora(empresaNombre: string, enMora: MoraCliente[]): string {
  enMora.sort((a, b) => (b.esNuevoHoy ? 1 : 0) - (a.esNuevoHoy ? 1 : 0) || b.dias - a.dias);
  const totalMora = enMora.reduce((s, c) => s + c.montoVencido, 0);
  const nuevosHoy = enMora.filter((c) => c.esNuevoHoy);

  const filas = enMora.map((c) => {
      const { label, color } = estadoMora(c.dias);
      const bgRow = c.esNuevoHoy ? 'background:#fffbeb;' : '';
      return `
        <tr style="${bgRow}">
          <td style="padding:8px 12px;font-size:13px;color:#1a1a1a;font-weight:${c.esNuevoHoy ? 'bold' : 'normal'};">
            ${c.esNuevoHoy ? '🆕 ' : ''}${c.nombre}
          </td>
          <td style="padding:8px 12px;font-size:13px;color:#555;">${c.lote}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center;">${c.cuotasVencidas}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:bold;color:#ef4444;">${fmt(c.montoVencido)}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center;">${c.dias} días</td>
          <td style="padding:8px 12px;font-size:12px;">
            <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:999px;font-weight:600;">${label}</span>
          </td>
        </tr>`;
    }).join('');

    const alertaNuevos = nuevosHoy.length > 0 ? `
      <div style="background:#fef3c7;border-left:4px solid #d4a843;border-radius:4px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#92700a;font-weight:bold;">
          ⚠️ ${nuevosHoy.length} cliente(s) entraron en mora HOY
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:#92700a;">
          Verifica si recibiste algún pago en efectivo o depósito que aún no ha sido registrado en el sistema.
        </p>
      </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recordatorio de pagos — ${empresaNombre}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1a1a;padding:22px 32px;">
            <span style="font-size:20px;font-weight:bold;color:#d4a843;">${empresaNombre}</span>
            <span style="font-size:12px;color:#888;margin-left:10px;">Recordatorio diario de pagos</span>
          </td>
        </tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:18px;">📋 Resumen de cartera vencida</h2>
          <p style="margin:0 0 20px;color:#555;font-size:13px;">
            ${new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          ${alertaNuevos}

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td width="33%" style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:bold;color:#ef4444;">${enMora.length}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#888;">Clientes en mora</p>
              </td>
              <td width="4%"></td>
              <td width="29%" style="padding:12px;background:#fffbeb;border-radius:8px;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:bold;color:#d4a843;">${nuevosHoy.length}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#888;">Nuevos hoy</p>
              </td>
              <td width="4%"></td>
              <td width="30%" style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
                <p style="margin:0;font-size:18px;font-weight:bold;color:#ef4444;">${fmt(totalMora)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#888;">Total vencido</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Cliente</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Lote</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Cuotas</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Monto</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Días</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Estado</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>

          <p style="margin:20px 0 0;font-size:12px;color:#aaa;text-align:center;">
            Recordatorio diario · 8:00 AM · TerraGroup Sistema de Gestión
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function ejecutarRecordatorio() {
  const today = new Date();
  today.setHours(23, 59, 59, 0);

  try {
    // Solo procesamos empresas activas — no tiene sentido mandar mails a
    // empresas suspendidas o canceladas.
    const empresas = await prisma.empresa.findMany({
      where:  { activo: true },
      select: { id: true, nombre: true },
    });
    if (empresas.length === 0) return;

    const FROM = process.env.MAIL_FROM ?? `"TerraGroup" <${process.env.MAIL_USER}>`;

    let totalEnviados = 0;
    let totalSinDestinatario = 0;
    let totalSinMora = 0;

    for (const empresa of empresas) {
      const ventas = await prisma.venta.findMany({
        where: { empresaId: empresa.id, estado: { not: 'cancelado' } },
        include: {
          propietario: { select: { nombre: true } },
          lote:        { select: { clave: true } },
          pagos:       { select: { numCuota: true } },
        },
      });
      if (ventas.length === 0) continue;

      const enMora = calcularMoraDeEmpresa(ventas, today);
      if (enMora.length === 0) {
        totalSinMora++;
        continue;
      }

      const destinatarios = await getEmpresaAdminEmails(empresa.id);
      if (destinatarios.length === 0) {
        console.warn(`[cron] Empresa "${empresa.nombre}" (id=${empresa.id}) tiene ${enMora.length} en mora pero NO tiene admin emails — skip`);
        totalSinDestinatario++;
        continue;
      }

      const html = buildHtmlMora(empresa.nombre, enMora);
      const nuevosHoy = enMora.filter((c) => c.esNuevoHoy).length;

      try {
        await transporter.sendMail({
          from:    FROM,
          to:      destinatarios.join(', '),
          subject: `📋 ${empresa.nombre} — ${enMora.length} cliente(s) en mora${nuevosHoy > 0 ? ` (${nuevosHoy} nuevo(s) hoy)` : ''} · ${new Date().toLocaleDateString('es-GT')}`,
          html,
        });
        totalEnviados++;
        console.log(`[cron] Enviado a ${destinatarios.length} admin(s) de "${empresa.nombre}" — ${enMora.length} en mora`);
      } catch (err) {
        console.error(`[cron] Error enviando a "${empresa.nombre}":`, err);
      }
    }

    console.log(`[cron] Resumen: ${totalEnviados} empresas notificadas, ${totalSinMora} sin mora, ${totalSinDestinatario} sin destinatarios.`);
  } catch (err) {
    console.error('[cron] Error en recordatorio de pagos:', err);
  }
}

export function iniciarJobRecordatorioPagos() {
  cron.schedule('0 8 * * *', () => {
    console.log('[cron] Ejecutando recordatorio de pagos...');
    ejecutarRecordatorio();
  }, { timezone: 'America/Guatemala' });

  console.log('[cron] Job de recordatorio de pagos registrado (08:00 AM diario)');
}
