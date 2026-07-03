import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret',
  PORT: Number(process.env.PORT ?? 5056),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5175',
};
