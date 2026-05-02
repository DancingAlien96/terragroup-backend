import pool from '../../config/database.js';

export interface CarteraItem {
  propietario_id: number;
  propietario_nombre: string;
  lote_clave: string;
  dias_mora: number;
  monto_vencido: number;
  estado_mora: 'temprana' | 'media' | 'grave';
  pagos_vencidos: number;
}

export async function getCarteraVencida(empresaId: number): Promise<CarteraItem[]> {
  const [rows] = await pool.query(
    `SELECT
       p.id AS propietario_id,
       p.nombre AS propietario_nombre,
       l.clave AS lote_clave,
       DATEDIFF(CURDATE(), MIN(pg.fecha_vencimiento)) AS dias_mora,
       SUM(pg.monto) AS monto_vencido,
       COUNT(pg.id) AS pagos_vencidos
     FROM pagos pg
     JOIN propietarios p ON p.id = pg.propietario_id
     JOIN contratos c ON c.id = pg.contrato_id
     JOIN lotes l ON l.id = c.lote_id
     WHERE pg.empresa_id = ? AND pg.estado = 'vencido'
     GROUP BY p.id, l.id
     ORDER BY dias_mora DESC`,
    [empresaId],
  );

  return (rows as any[]).map((row) => {
    const dias: number = row.dias_mora ?? 0;
    let estado_mora: CarteraItem['estado_mora'] = 'temprana';
    if (dias > 90) estado_mora = 'grave';
    else if (dias > 30) estado_mora = 'media';
    return { ...row, dias_mora: dias, estado_mora };
  });
}
