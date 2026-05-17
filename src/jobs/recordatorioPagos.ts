/**
 * Job diario: Recordatorio de registro de pagos
 *
 * Se ejecuta cada día a las 08:00 AM.
 * Calcula qué clientes tienen cuotas vencidas sin pago registrado
 * y envía un resumen al administrador para que verifique si
 * recibió algún pago físico que aún no ha sido capturado en el sistema.
 */

import cron from 'node-cron';
import pool from '../config/database.js';
import transporter from '../config/mailer.js';

interface ClienteRow {
  id: number;
  empresa_id: number;
  nombre_comprador: string;
  descripcion_lote: string | null;
  num_cuotas: number;
  valor_cuota: number;
  cuota_inicio: number;
  fecha_deposito: string;
}

interface PagoCount {
  cliente_id: number;
  total: number;
}

function calcularCuotasVencidas(cliente: ClienteRow, pagosCount: number, today: Date): number {
  const deposito = new Date(cliente.fecha_deposito);
  const cuotasPrevias = Math.max(0, (cliente.cuota_inicio ?? 1) - 1);
  let vencidas = 0;
  for (let i = 1; i <= cliente.num_cuotas; i++) {
    const due = new Date(deposito);
    due.setMonth(due.getMonth() + i);
    if (due <= today) vencidas++;
    else break;
  }
  return Math.max(0, vencidas - pagosCount - cuotasPrevias);
}

function diasDesde(cliente: ClienteRow, pagosCount: number, today: Date): number {
  const deposito = new Date(cliente.fecha_deposito);
  const cuotasPrevias = Math.max(0, (cliente.cuota_inicio ?? 1) - 1);
  // Fecha de la cuota más antigua sin pagar
  let cuotasSuperadas = 0;
  for (let i = 1; i <= cliente.num_cuotas; i++) {
    const due = new Date(deposito);
    due.setMonth(due.getMonth() + i);
    if (due > today) break;
    cuotasSuperadas++;
    if (cuotasSuperadas > pagosCount + cuotasPrevias) {
      return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  return 0;
}

function estadoMora(dias: number): { label: string; color: string } {
  if (dias > 90) return { label: 'Mora grave',    color: '#ef4444' };
  if (dias > 30) return { label: 'Mora media',    color: '#f97316' };
  return            { label: 'Mora temprana', color: '#d4a843' };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 }).format(n);
}

async function ejecutarRecordatorio() {
  const today = new Date();
  today.setHours(23, 59, 59, 0);

  try {
    // 1. Traer todos los clientes activos
    const [clienteRows] = await pool.query(
      `SELECT id, empresa_id, nombre_comprador, descripcion_lote, num_cuotas, valor_cuota, cuota_inicio, fecha_deposito
       FROM clientes WHERE activo = TRUE`,
    ) as [ClienteRow[], any];

    if (clienteRows.length === 0) return;

    // 2. Contar pagos por cliente
    const [pagoRows] = await pool.query(
      `SELECT cliente_id, COUNT(*) AS total FROM pagos WHERE cliente_id IS NOT NULL GROUP BY cliente_id`,
    ) as [PagoCount[], any];

    const pagoMap = new Map<number, number>();
    for (const p of pagoRows) pagoMap.set(p.cliente_id, Number(p.total));

    // 3. Calcular mora
    type MoraCliente = {
      nombre: string;
      lote: string;
      cuotasVencidas: number;
      montoVencido: number;
      dias: number;
      esNuevoHoy: boolean;
    };
    const enMora: MoraCliente[] = [];

    for (const c of clienteRows) {
      const pagos = pagoMap.get(c.id) ?? 0;
      const cuotasVencidas = calcularCuotasVencidas(c, pagos, today);
      if (cuotasVencidas <= 0) continue;

      const dias = diasDesde(c, pagos, today);
      enMora.push({
        nombre:         c.nombre_comprador,
        lote:           c.descripcion_lote ?? '—',
        cuotasVencidas,
        montoVencido:   cuotasVencidas * Number(c.valor_cuota),
        dias,
        esNuevoHoy:     dias <= 1,
      });
    }

    if (enMora.length === 0) {
      console.log('[cron] Sin clientes en mora hoy. No se envía recordatorio.');
      return;
    }

    // Ordenar: primero los de hoy, luego por días desc
    enMora.sort((a, b) => (b.esNuevoHoy ? 1 : 0) - (a.esNuevoHoy ? 1 : 0) || b.dias - a.dias);

    const totalMora = enMora.reduce((s, c) => s + c.montoVencido, 0);
    const nuevosHoy = enMora.filter(c => c.esNuevoHoy);

    // 4. Construir HTML del correo
    const filas = enMora.map(c => {
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

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recordatorio de pagos</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1a1a;padding:22px 32px;">
            <span style="font-size:20px;font-weight:bold;color:#d4a843;">TerraGroup</span>
            <span style="font-size:12px;color:#888;margin-left:10px;">Recordatorio diario de pagos</span>
          </td>
        </tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:18px;">📋 Resumen de cartera vencida</h2>
          <p style="margin:0 0 20px;color:#555;font-size:13px;">
            ${new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          ${alertaNuevos}

          <!-- KPIs -->
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

          <!-- Tabla -->
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
            Este recordatorio se envía automáticamente cada día a las 8:00 AM · TerraGroup Sistema de Gestión
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const adminEmail = process.env.MAIL_USER!;
    const FROM = process.env.MAIL_FROM ?? `"TerraGroup" <${adminEmail}>`;

    await transporter.sendMail({
      from: FROM,
      to: adminEmail,
      subject: `📋 TerraGroup — ${enMora.length} cliente(s) en mora${nuevosHoy.length > 0 ? ` (${nuevosHoy.length} nuevo(s) hoy)` : ''} · ${new Date().toLocaleDateString('es-GT')}`,
      html,
    });

    console.log(`[cron] Recordatorio enviado a ${adminEmail}. Clientes en mora: ${enMora.length}, nuevos hoy: ${nuevosHoy.length}`);
  } catch (err) {
    console.error('[cron] Error en recordatorio de pagos:', err);
  }
}

export function iniciarJobRecordatorioPagos() {
  // Todos los días a las 08:00 AM
  cron.schedule('0 8 * * *', () => {
    console.log('[cron] Ejecutando recordatorio de pagos...');
    ejecutarRecordatorio();
  }, { timezone: 'America/Guatemala' });

  console.log('[cron] Job de recordatorio de pagos registrado (08:00 AM diario)');
}
