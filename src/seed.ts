/**
 * seed.ts — Datos de prueba para TerraGroup
 *
 * Crea:
 *   - 3 planes (basico, profesional, empresarial)
 *   - Empresa sistema + superadmin
 *   - 3 empresas demo + 3 admins
 *   - Carteras demo para María (empresa 3) y Roberto (empresa 4)
 *
 * Uso:  npm run seed
 * Idempotente: usa upsert por campos únicos.
 */

import bcrypt from 'bcryptjs';
import prisma from './config/prisma.js';
import {
  Rol,
  EntidadBancaria,
  EstadoPago,
} from './generated/prisma/enums.js';

const SALT = 12;

/* ── Helpers ───────────────────────────────────────────────── */

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

interface SeedVenta {
  nombre: string;
  email?: string;
  telefono?: string;
  descripcionLote: string;
  precioNeto: number;
  enganche: number;
  numCuotas: number;
  valorCuota: number;
  fechaInicio: string;        // YYYY-MM-DD
  numTransferencia: string;
  entidadBancaria: EntidadBancaria;
  pagosRealizados: number;    // cuántas cuotas se pagaron a tiempo
}

async function seedCarteraEmpresa(empresaId: number, ventas: SeedVenta[]) {
  for (const v of ventas) {
    // 1. Propietario — dedupe por nombre+empresa (no hay unique constraint)
    const propietario =
      (await prisma.propietario.findFirst({ where: { empresaId, nombre: v.nombre } })) ??
      (await prisma.propietario.create({
        data: {
          empresaId,
          nombre: v.nombre,
          email: v.email ?? null,
          telefono: v.telefono ?? null,
        },
      }));

    // 2. Venta (idempotencia por propietario+descripcionLote)
    const existingVenta = await prisma.venta.findFirst({
      where: {
        empresaId,
        propietarioId: propietario.id,
        descripcionLote: v.descripcionLote,
      },
    });

    const venta = existingVenta ?? await prisma.venta.create({
      data: {
        empresaId,
        propietarioId: propietario.id,
        descripcionLote: v.descripcionLote,
        precioTotal: v.precioNeto,
        enganche: v.enganche,
        numCuotas: v.numCuotas,
        valorCuota: v.valorCuota,
        cuotaInicio: 1,
        fechaInicio: new Date(v.fechaInicio),
        numTransferencia: v.numTransferencia,
        metodoPago: 'transferencia',
        entidadBancaria: v.entidadBancaria,
      },
    });

    // 3. Pagos realizados (cuotas pagadas, 1..pagosRealizados)
    const baseDate = new Date(v.fechaInicio);
    for (let i = 1; i <= v.pagosRealizados; i++) {
      const fechaVenc = addMonths(baseDate, i);
      const existingPago = await prisma.pago.findFirst({
        where: { ventaId: venta.id, numCuota: i },
      });
      if (existingPago) continue;

      await prisma.pago.create({
        data: {
          empresaId,
          ventaId: venta.id,
          numCuota: i,
          monto: v.valorCuota,
          fechaPago: fechaVenc,
          fechaVencimiento: fechaVenc,
          estado: EstadoPago.pagado,
          metodoPago: 'transferencia',
        },
      });
    }
  }
}

/* ── Datos ─────────────────────────────────────────────────── */

const planes = [
  { nombre: 'basico',      precio: 45,  maxLotes: 150,  maxUsuarios: 1 },
  { nombre: 'profesional', precio: 90,  maxLotes: 300,  maxUsuarios: 3 },
  { nombre: 'empresarial', precio: 150, maxLotes: 1000, maxUsuarios: 5 },
];

const empresas = [
  {
    nombre: 'Lotificaciones del Norte S.A.',
    rfc: 'LNO901201AA1',
    planNombre: 'basico',
    usuario: { nombre: 'Carlos Mendoza', email: 'carlos@lotenorte.com', username: 'carlos_norte' },
  },
  {
    nombre: 'Terrenos Pacífico S.R.L.',
    rfc: 'TPA150305BB2',
    planNombre: 'profesional',
    usuario: { nombre: 'María Rivas', email: 'maria@terrapacifico.com', username: 'maria_pacifico' },
  },
  {
    nombre: 'Desarrollos San Pablo Corp.',
    rfc: 'DSP200810CC3',
    planNombre: 'empresarial',
    usuario: { nombre: 'Roberto Fuentes', email: 'roberto@sanpablo.com', username: 'roberto_sp' },
  },
];

const carteraMaria: SeedVenta[] = [
  {
    nombre: 'Roberto Aguilar Vega', descripcionLote: 'Lote 5 Manzana D',
    precioNeto: 80000,  enganche: 8000,  numCuotas: 24, valorCuota: 3000,
    fechaInicio: '2025-11-10', numTransferencia: 'TRF-M001',
    entidadBancaria: EntidadBancaria.Banrural, pagosRealizados: 2,
  },
  {
    nombre: 'Luisa Fernanda Pérez', descripcionLote: 'Lote 14 Manzana A',
    precioNeto: 55000,  enganche: 5000,  numCuotas: 18, valorCuota: 2777.78,
    fechaInicio: '2026-01-10', numTransferencia: 'TRF-M002',
    entidadBancaria: EntidadBancaria.Industrial, pagosRealizados: 1,
  },
  {
    nombre: 'Diego Castillo Ruiz', descripcionLote: 'Lote 8 Manzana E',
    precioNeto: 120000, enganche: 10000, numCuotas: 36, valorCuota: 3055.56,
    fechaInicio: '2025-09-10', numTransferencia: 'TRF-M003',
    entidadBancaria: EntidadBancaria.GT, pagosRealizados: 3,
  },
];

const carteraRoberto: SeedVenta[] = [
  {
    nombre: 'Carlos Mendoza Pérez', descripcionLote: 'Lote 3 Manzana B',
    precioNeto: 95000,  enganche: 9500,  numCuotas: 24, valorCuota: 3562.50,
    fechaInicio: '2025-11-10', numTransferencia: 'TRF-R001',
    entidadBancaria: EntidadBancaria.Banrural, pagosRealizados: 2,
  },
  {
    nombre: 'Sandra Ramos Ortiz', descripcionLote: 'Lote 22 Manzana C',
    precioNeto: 65000,  enganche: 6500,  numCuotas: 18, valorCuota: 3250,
    fechaInicio: '2026-01-10', numTransferencia: 'TRF-R002',
    entidadBancaria: EntidadBancaria.Industrial, pagosRealizados: 1,
  },
  {
    nombre: 'Héctor Villalobos', descripcionLote: 'Lote 7 Manzana A',
    precioNeto: 140000, enganche: 14000, numCuotas: 36, valorCuota: 3500,
    fechaInicio: '2025-08-10', numTransferencia: 'TRF-R003',
    entidadBancaria: EntidadBancaria.GT, pagosRealizados: 3,
  },
];

/* ── Main ──────────────────────────────────────────────────── */

async function main() {
  console.log('🌱 Seed TerraGroup\n');

  /* 1. Planes */
  for (const p of planes) {
    await prisma.plan.upsert({
      where: { nombre: p.nombre },
      create: p,
      update: { precio: p.precio, maxLotes: p.maxLotes, maxUsuarios: p.maxUsuarios },
    });
  }
  console.log(`✅ ${planes.length} planes`);

  /* 2. Empresa sistema + superadmin */
  const planEmp = await prisma.plan.findUniqueOrThrow({ where: { nombre: 'empresarial' } });

  const empresaSistema = await prisma.empresa.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombre: 'TerraGroup Sistema',
      email: 'admin@terragroup.com',
      planId: planEmp.id,
      fechaInicio: new Date(),
    },
    update: {},
  });

  const superHash = await bcrypt.hash('Admin1234!', SALT);
  await prisma.usuario.upsert({
    where: { username: 'superadmin' },
    create: {
      empresaId: empresaSistema.id,
      nombre: 'Super Administrador',
      email: 'superadmin@terragroup.com',
      username: 'superadmin',
      password: superHash,
      rol: Rol.superadmin,
    },
    update: {},
  });
  console.log('✅ Empresa sistema + superadmin (superadmin / Admin1234!)');

  /* 3. Empresas demo + admins */
  const adminHash = await bcrypt.hash('Admin123!', SALT);
  const empresasCreated: Record<string, number> = {};

  for (const data of empresas) {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { nombre: data.planNombre } });

    let empresa = await prisma.empresa.findFirst({ where: { rfc: data.rfc } });
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: data.nombre,
          rfc: data.rfc,
          planId: plan.id,
          fechaInicio: new Date(),
          fechaVence: addMonths(new Date(), 12),
        },
      });
    }
    empresasCreated[data.usuario.username] = empresa.id;

    await prisma.usuario.upsert({
      where: { username: data.usuario.username },
      create: {
        empresaId: empresa.id,
        nombre: data.usuario.nombre,
        email: data.usuario.email,
        username: data.usuario.username,
        password: adminHash,
        rol: Rol.admin,
      },
      update: {},
    });

    console.log(`✅ ${data.nombre} (${data.planNombre}) — admin: ${data.usuario.username} / Admin123!`);
  }

  /* 4. Cartera demo */
  const idMaria   = empresasCreated['maria_pacifico'];
  const idRoberto = empresasCreated['roberto_sp'];

  if (idMaria) {
    await seedCarteraEmpresa(idMaria, carteraMaria);
    console.log(`✅ Cartera demo de María (empresa ${idMaria}): ${carteraMaria.length} ventas`);
  }
  if (idRoberto) {
    await seedCarteraEmpresa(idRoberto, carteraRoberto);
    console.log(`✅ Cartera demo de Roberto (empresa ${idRoberto}): ${carteraRoberto.length} ventas`);
  }

  console.log('\n✔  Seed completado.');
}

main()
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
