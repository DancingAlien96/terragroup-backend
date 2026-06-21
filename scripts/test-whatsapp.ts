/**
 * Script de prueba de WhatsApp.
 *
 * Uso:
 *   npx tsx scripts/test-whatsapp.ts
 *
 * Lee WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID de .env, y dispara un mensaje
 * de "cuota_vencida" a los números hardcodeados abajo, simulando que Juan
 * tiene una cuota vencida hace 12 días por Q3,480.
 *
 * Requisitos:
 *   - Token permanente en .env
 *   - Plantilla `cuota_vencida` aprobada por Meta (idioma "es")
 *   - Los números deben haber recibido el opt-in (en sandbox: estar registrados
 *     como "test recipients" en Meta WhatsApp Manager).
 */

import dotenv from 'dotenv';
dotenv.config();

import { sendCuotaVencidaWA } from '../src/config/whatsapp.js';

const NUMEROS = [
  '+502 33074483',
  '+502 57494629',
];

async function main() {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error('ERROR: WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID son requeridos en .env');
    process.exit(1);
  }

  console.log('Enviando mensajes de prueba (cuota_vencida)...\n');

  for (const numero of NUMEROS) {
    console.log(`→ ${numero}`);
    await sendCuotaVencidaWA({
      to:            numero,
      clienteNombre: 'Cliente Demo',
      numCuota:      5,
      lote:          'Lote demo 7 Manzana A',
      diasMora:      12,
      monto:         3480.35,
    });
  }

  console.log('\nListo. Revisa los logs arriba — si dice "Enviado", llegó a Meta.');
  console.log('Si Meta rechazó (template no aprobado, número no registrado en sandbox, etc.) verás el detalle del error.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
