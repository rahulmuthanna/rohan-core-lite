import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}. Copy backend/.env.example to backend/.env.`);
  }
  return value;
}

function readPort(): number {
  const port = Number(process.env.PORT ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number between 1 and 65535.');
  }
  return port;
}

function readDatabaseUrl(nodeEnv: string): string {
  if (nodeEnv !== 'test') {
    return required('DATABASE_URL');
  }
  // Automated tests wipe their database, so they must never point at the real one.
  const testUrl = required('TEST_DATABASE_URL');
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL.');
  }
  return testUrl;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const env = {
  NODE_ENV,
  PORT: readPort(),
  DATABASE_URL: readDatabaseUrl(NODE_ENV),
};
