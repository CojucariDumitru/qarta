import { app } from './app';
import { env } from './env';

app.listen(env.PORT, () => {
  console.log(`QARTA API on http://localhost:${env.PORT}`);
});
