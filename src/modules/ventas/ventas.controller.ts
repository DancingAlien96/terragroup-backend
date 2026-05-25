import { Request, Response } from 'express';
import * as svc from './ventas.service.js';
import { sendComprobanteEnganche } from '../../config/mailer.js';
import { logAudit } from '../../utils/audit.js';

/** Aplana una venta+propietario+lote al shape "flat" que el frontend espera. */
function shape(v: any) {
  return {
    id:                v.id,
    empresa_id:        v.empresaId,
    propietario_id:    v.propietarioId,
    lote_id:           v.loteId,
    vendedor_id:       v.vendedorId,
    // Compat: datos del propietario aplanados como si fueran del "cliente"
    nombre_comprador:  v.propietario?.nombre ?? null,
    nit:               v.propietario?.nit ?? null,
    email:             v.propietario?.email ?? null,
    telefono:          v.propietario?.telefono ?? null,
    // Datos de la venta
    descripcion_lote:  v.descripcionLote ?? v.lote?.clave ?? null,
    precio_neto:       Number(v.precioTotal),
    precio_total:      Number(v.precioTotal),
    enganche:          Number(v.enganche),
    tasa_anual:        Number(v.tasaAnual),
    num_cuotas:        v.numCuotas,
    valor_cuota:       Number(v.valorCuota),
    cuota_inicio:      v.cuotaInicio,
    fecha_deposito:    v.fechaInicio,         // alias legacy
    fecha_inicio:      v.fechaInicio,
    fecha_fin:         v.fechaFin,
    num_transferencia: v.numTransferencia,
    metodo_pago:       v.metodoPago,
    entidad_bancaria:  v.entidadBancaria,
    comprobante_enganche_url: v.comprobanteEngancheUrl,
    estado:            v.estado,
    activo:            v.estado !== 'cancelado',
    created_at:        v.createdAt,
    updated_at:        v.updatedAt,
    // Anidados completos por si la UI quiere usarlos
    propietario:       v.propietario ?? null,
    lote:              v.lote ?? null,
    vendedor:          v.vendedor ?? null,
  };
}

export async function list(req: Request, res: Response) {
  try {
    const items = await svc.listVentas(req.user!.empresaId);
    return res.json({ success: true, data: items.map(shape) });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getVenta(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    return res.json({ success: true, data: shape(item) });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function create(req: Request, res: Response) {
  // Acepta tanto el formato nuevo (propietarioId/propietario) como el formato legacy plano (nombre_comprador, fecha_deposito, precio_neto)
  const b = req.body;
  const input = {
    propietarioId:    b.propietarioId ?? b.propietario_id,
    propietario:      b.propietario ?? (b.nombre_comprador ? {
      nombre: b.nombre_comprador, nit: b.nit, email: b.email, telefono: b.telefono,
    } : undefined),
    loteId:           b.loteId ?? b.lote_id ?? null,
    descripcionLote:  b.descripcionLote ?? b.descripcion_lote ?? null,
    vendedorId:       b.vendedorId ?? b.vendedor_id ?? null,
    precioTotal:      b.precioTotal ?? b.precio_total ?? b.precio_neto,
    enganche:         b.enganche,
    tasaAnual:        b.tasaAnual ?? b.tasa_anual,
    numCuotas:        b.numCuotas ?? b.num_cuotas,
    valorCuota:       b.valorCuota ?? b.valor_cuota,
    cuotaInicio:      b.cuotaInicio ?? b.cuota_inicio,
    fechaInicio:      b.fechaInicio ?? b.fecha_inicio ?? b.fecha_deposito,
    fechaFin:         b.fechaFin ?? b.fecha_fin ?? null,
    numTransferencia: b.numTransferencia ?? b.num_transferencia ?? null,
    metodoPago:       b.metodoPago ?? b.metodo_pago ?? null,
    entidadBancaria:  b.entidadBancaria ?? b.entidad_bancaria ?? null,
    comprobanteEngancheUrl: b.comprobanteEngancheUrl ?? b.comprobante_enganche_url ?? null,
  };

  if (!input.precioTotal || !input.fechaInicio) {
    return res.status(400).json({ success: false, message: 'precioTotal y fechaInicio son requeridos' });
  }
  if (!input.propietarioId && !input.propietario?.nombre) {
    return res.status(400).json({ success: false, message: 'Se requiere propietarioId o propietario.nombre' });
  }

  try {
    const item = await svc.createVenta(req.user!.empresaId, input);

    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Venta', entidadId: item.id, accion: 'crear',
      descripcion: `Venta a ${item.propietario.nombre}${item.descripcionLote ? ` · ${item.descripcionLote}` : ''}`,
    });

    // Fire-and-forget: enviar comprobante de enganche (al admin siempre, al propietario si tiene email)
    sendComprobanteEnganche({
      to:               item.propietario.email,
      clienteNombre:    item.propietario.nombre,
      descripcionLote:  item.descripcionLote ?? item.lote?.clave ?? null,
      precioNeto:       Number(item.precioTotal),
      enganche:         Number(item.enganche),
      numCuotas:        item.numCuotas,
      valorCuota:       Number(item.valorCuota),
      fechaDeposito:    item.fechaInicio.toISOString().slice(0, 10),
      numTransferencia: item.numTransferencia,
      metodoPago:       item.metodoPago,
      entidadBancaria:  item.entidadBancaria,
    }).catch((err) => console.error('[mailer] Error enviando comprobante de enganche:', err));

    return res.status(201).json({ success: true, data: shape(item) });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const b = req.body;
    const data = {
      ...b,
      // Propietario (legacy: nombre_comprador / email / telefono vienen del form de cliente)
      ...(b.nombre_comprador !== undefined && { propietarioNombre:   b.nombre_comprador }),
      ...(b.nit              !== undefined && { propietarioNit:      b.nit || null }),
      ...(b.email            !== undefined && { propietarioEmail:    b.email || null }),
      ...(b.telefono         !== undefined && { propietarioTelefono: b.telefono || null }),
      // Venta
      ...(b.tasa_anual       !== undefined && { tasaAnual:   b.tasa_anual  }),
      ...(b.precio_total     !== undefined && { precioTotal: b.precio_total }),
      ...(b.precio_neto      !== undefined && { precioTotal: b.precio_neto }),
      ...(b.descripcion_lote !== undefined && { descripcionLote: b.descripcion_lote || null }),
      ...(b.num_cuotas       !== undefined && { numCuotas:   b.num_cuotas  }),
      ...(b.valor_cuota      !== undefined && { valorCuota:  b.valor_cuota }),
      ...(b.cuota_inicio     !== undefined && { cuotaInicio: b.cuota_inicio }),
      ...(b.fecha_inicio     !== undefined && { fechaInicio: b.fecha_inicio }),
      ...(b.fecha_deposito   !== undefined && { fechaInicio: b.fecha_deposito }),
      ...(b.fecha_fin        !== undefined && { fechaFin:    b.fecha_fin   }),
      ...(b.num_transferencia !== undefined && { numTransferencia: b.num_transferencia || null }),
      ...(b.metodo_pago      !== undefined && { metodoPago:  b.metodo_pago || null }),
      ...(b.entidad_bancaria !== undefined && { entidadBancaria: b.entidad_bancaria || null }),
      ...(b.comprobante_enganche_url !== undefined && { comprobanteEngancheUrl: b.comprobante_enganche_url || null }),
    };
    const item = await svc.updateVenta(Number(req.params.id), req.user!.empresaId, data);
    if (!item) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Venta', entidadId: item.id, accion: 'actualizar',
      descripcion: `Venta de ${item.propietario.nombre}`,
      cambios: data,
    });
    return res.json({ success: true, data: shape(item) });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.id);
    const ok = await svc.deleteVenta(ventaId, req.user!.empresaId);
    if (!ok) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Venta', entidadId: ventaId, accion: 'eliminar',
    });
    return res.json({ success: true, message: 'Venta eliminada' });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}
