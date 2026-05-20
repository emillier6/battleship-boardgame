import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { attachSocketServer } from './io.js';
import { logger } from './util/logger.js';

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:4321';

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'battleship-server' });
});

const httpServer = createServer(app);
attachSocketServer(httpServer, { origin: WEB_ORIGIN });

httpServer.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`);
  logger.info(`cors origin: ${WEB_ORIGIN}`);
});
