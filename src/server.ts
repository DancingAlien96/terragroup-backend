import dotenv from 'dotenv';
import app from './app.js';
import { iniciarJobRecordatorioPagos } from './jobs/recordatorioPagos.js';

dotenv.config();

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TerraGroup backend listening on http://0.0.0.0:${PORT}`);
  iniciarJobRecordatorioPagos();
});
