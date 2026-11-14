import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`Rohan Core Lite API listening on http://localhost:${env.PORT}`);
});

/** Finish in-flight requests, close the database connections, then exit. */
function shutDown(): void {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
