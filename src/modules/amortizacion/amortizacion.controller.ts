import { Request, Response } from 'express';
import * as svc from './amortizacion.service.js';
import prisma from '../../config/prisma.js';

/** POST /api/amortizacion/simular — calculadora sin persistir. */
export async function simular(req: Request, res: Response) {
  try {
    const { capital, enganche, tasaAnual, plazoAños, plazoAnios, fechaInicio } = req.body;
    const años = plazoAños ?? plazoAnios;
    if (capital == null || enganche == null || tasaAnual == null || !años || !fechaInicio) {
      return res.status(400).json({
        success: false,
        message: 'capital, enganche, tasaAnual, plazoAños y fechaInicio son requeridos',
      });
    }
    const cuotas = svc.calcularPlan({
      capital:     Number(capital),
      enganche:    Number(enganche),
      tasaAnual:   Number(tasaAnual),
      plazoAños:   Number(años),
      fechaInicio: new Date(fechaInicio),
    });
    return res.json({ success: true, data: cuotas });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

/** GET /api/amortizacion/venta/:ventaId — devuelve plan + pagos cruzados. */
export async function getPlanByVenta(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.ventaId);
    const result = await svc.obtenerPlanVenta(ventaId, req.user!.empresaId);
    if (!result) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

/** POST /api/amortizacion/venta/:ventaId/liquidar — liquida todas las cuotas pendientes. */
export async function liquidar(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.ventaId);
    const empresaId = req.user!.empresaId;
    const venta = await prisma.venta.findFirst({ where: { id: ventaId, empresaId } });
    if (!venta) return res.status(404).json({ success: false, message: 'Venta no encontrada' });

    const b = req.body ?? {};
    const result = await svc.liquidarVenta(ventaId, empresaId, {
      metodoPago:     b.metodo_pago ?? b.metodoPago ?? null,
      referencia:     b.referencia ?? null,
      descripcion:    b.descripcion ?? null,
      comprobanteUrl: b.comprobante_url ?? b.comprobanteUrl ?? null,
      fechaPago:      b.fecha_pago ? new Date(b.fecha_pago) : (b.fechaPago ? new Date(b.fechaPago) : new Date()),
    });
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

/** POST /api/amortizacion/venta/:ventaId/regenerar — borra y recrea el plan. */
export async function regenerar(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.ventaId);
    const empresaId = req.user!.empresaId;
    const venta = await prisma.venta.findFirst({ where: { id: ventaId, empresaId } });
    if (!venta) return res.status(404).json({ success: false, message: 'Venta no encontrada' });

    if (venta.numCuotas <= 0) {
      return res.status(400).json({ success: false, message: 'La venta no tiene plazo definido' });
    }
    const plazoAños = Math.ceil(venta.numCuotas / 12);
    const generadas = await svc.regenerarPlanVenta(ventaId, empresaId, {
      capital:     Number(venta.precioTotal),
      enganche:    Number(venta.enganche),
      tasaAnual:   Number(venta.tasaAnual),
      plazoAños,
      fechaInicio: venta.fechaInicio,
    });
    return res.json({ success: true, message: `Plan regenerado (${generadas} cuotas)` });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}
