/**
 * Verificación manual del cálculo contra los números del Excel "Hoja1"
 * (sección Detalle Anual): Capital 300,000, Enganche 30,000, Tasa 10%, Plazo 5 años.
 *
 * Ejecutar con: npx tsx src/modules/amortizacion/amortizacion.verify.ts
 */

import { calcularPlan } from './amortizacion.service.js';

const cuotas = calcularPlan({
  capital:     300_000,
  enganche:     30_000,
  tasaAnual:    0.10,
  plazoAños:    5,
  fechaInicio:  new Date('2021-03-05'),
});

// Expected values from the Excel ("Detalle Anual" section, Hoja1)
const expected = [
  { anio: 1, interes: 27000.00,  capital: 44225.32,  saldo: 225774.68, propInt: 0.379079 },
  { anio: 2, interes: 22577.47,  capital: 48647.85,  saldo: 177126.83, propInt: 0.316987 },
  { anio: 3, interes: 17712.68,  capital: 53512.64,  saldo: 123614.19, propInt: 0.248685 },
  { anio: 4, interes: 12361.42,  capital: 58863.90,  saldo:  64750.29, propInt: 0.173554 },
  { anio: 5, interes:  6475.03,  capital: 64750.29,  saldo:      0.00, propInt: 0.090909 },
];

console.log('Cuota mensual referencial: Q', cuotas[0].cuotaReferencial.toFixed(2), '(esperado 5,935.44)');
console.log('Cuota anual equivalente:   Q', (cuotas[0].cuotaReferencial * 12).toFixed(2), '(esperado 71,225.32)');
console.log();
console.log('Comparación año a año (sumando los 12 meses de cada año):');
console.log('───────────────────────────────────────────────────────────');

let ok = true;
for (let y = 1; y <= 5; y++) {
  const mesesDelAño = cuotas.filter(c => c.anio === y);
  const sumInteres  = mesesDelAño.reduce((s, c) => s + c.interesReferencial, 0);
  const sumCapital  = mesesDelAño.reduce((s, c) => s + c.capitalReferencial, 0);
  const saldoFinal  = mesesDelAño[mesesDelAño.length - 1].saldoReferencial;
  const propInt     = mesesDelAño[0].propInteresAnual;

  const exp = expected[y - 1];
  const diff = (a: number, b: number) => Math.abs(a - b);
  const tol = 0.05; // 5 centavos por año está bien

  const checks = [
    { label: 'interes', got: sumInteres, exp: exp.interes },
    { label: 'capital', got: sumCapital, exp: exp.capital },
    { label: 'saldo',   got: saldoFinal, exp: exp.saldo   },
    { label: 'propInt', got: propInt,    exp: exp.propInt },
  ];
  const status = checks.every(c => diff(c.got, c.exp) <= tol) ? 'OK' : 'FAIL';
  if (status === 'FAIL') ok = false;

  console.log(`Año ${y}: int=${sumInteres.toFixed(2)} (exp ${exp.interes.toFixed(2)}) | cap=${sumCapital.toFixed(2)} (exp ${exp.capital.toFixed(2)}) | saldo=${saldoFinal.toFixed(2)} (exp ${exp.saldo.toFixed(2)}) | propInt=${propInt.toFixed(6)} (exp ${exp.propInt.toFixed(6)}) → ${status}`);
}

console.log();
console.log(ok ? 'Todos los valores coinciden con el Excel.' : 'Hay diferencias — revisar.');
process.exit(ok ? 0 : 1);
