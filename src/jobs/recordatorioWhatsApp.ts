/**
 * Job diario de WhatsApp para clientes:
 *  - Recordatorio: cuota que vence en los próximos 3 días.
 *  - Alerta: cuota vencida sin pago.
 *
 * Se ejecuta cada día a las 09:00 AM (zona America/Guatemala).
 * Envía un solo mensaje por cliente (recordatorio o alerta, según prioridad).
 */

import cron from 'node-cron';
import prisma from '../config/prisma.js';
import {
  sendRecordatorioCuotaWA,
  sendCuotaVencidaWA,
} from '../config/whatsapp.js';

const DIAS_ANTICIPACION = Number(process.env.WHATSAPP_RECORDATORIO_DIAS ?? 3);

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function ejecutarRecordatorioWA(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limite = new Date(today);
  limite.setDate(limite.getDate() + DIAS_ANTICIPACION);

  try {
    const ventas = await prisma.venta.findMany({
      where: { estado: { not: 'cancelado' } },
      include: {
        propietario: { select: { nombre: true, telefono: true } },
        lote:        { select: { clave: true } },
        pagos:       { select: { numCuota: true, estado: true } },
      },
    });

    let recordatorios = 0, alertas = 0;

    for (const v of ventas) {
      if (!v.propietario.telefono) continue;          // sin teléfono no podemos avisar
      if (v.numCuotas <= 0 || Number(v.valorCuota) <= 0) continue;

      const lote = v.descripcionLote ?? v.lote?.clave ?? 'Sin lote';
      const fechaInicio = new Date(v.fechaInicio);
      const cuotasPrevias = Math.max(0, (v.cuotaInicio ?? 1) - 1);
      const pagadasCount = v.pagos.filter((p) => p.estado === 'pagado').length;

      // Próxima cuota = 1ra no-pagada (considerando cuotaInicio + ya pagadas)
      const proximaNum = cuotasPrevias + pagadasCount + 1;
      if (proximaNum > v.numCuotas) continue;

      const fechaProxima = addMonths(fechaInicio, proximaNum);
      fechaProxima.setHours(0, 0, 0, 0);

      // 1) Vencida: ya pasó la fecha
      if (fechaProxima < today) {
        const diasMora = Math.floor((today.getTime() - fechaProxima.getTime()) / 86_400_000);
        await sendCuotaVencidaWA({
          to:            v.propietario.telefono,
          clienteNombre: v.propietario.nombre,
          numCuota:      proximaNum,
          lote,
          diasMora,
          monto:         Number(v.valorCuota),
        });
        alertas++;
        continue;
      }

      // 2) Recordatorio: vence dentro de DIAS_ANTICIPACION días (inclusive hoy)
      if (fechaProxima <= limite) {
        await sendRecordatorioCuotaWA({
          to:               v.propietario.telefono,
          clienteNombre:    v.propietario.nombre,
          numCuota:         proximaNum,
          lote,
          fechaVencimiento: fmtFecha(fechaProxima),
          monto:            Number(v.valorCuota),
        });
        recordatorios++;
      }
    }

    console.log(`[cron-wa] ${recordatorios} recordatorio(s) y ${alertas} alerta(s) enviados.`);
  } catch (err) {
    console.error('[cron-wa] Error en recordatorio WhatsApp:', err);
  }
}

export function iniciarJobRecordatorioWhatsApp(): void {
  cron.schedule('0 9 * * *', () => {
    console.log('[cron-wa] Ejecutando recordatorio de WhatsApp...');
    ejecutarRecordatorioWA();
  }, { timezone: 'America/Guatemala' });

  console.log('[cron-wa] Job de recordatorio WhatsApp registrado (09:00 AM diario)');
}
