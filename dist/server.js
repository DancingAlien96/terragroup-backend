import dotenv from 'dotenv';
import app from './app.js';
dotenv.config();
const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
    console.log(`TerraGroup backend listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map