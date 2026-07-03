import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { publicRouter } from './routes/public';
import { adminRouter } from './routes/admin';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: [env.CLIENT_ORIGIN, /\.vercel\.app$/, /localhost:\d+$/, /192\.168\.\d+\.\d+:\d+$/],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'qarta-api' }));
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
