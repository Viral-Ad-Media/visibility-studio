export class DatabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

/** @param {string | undefined} value */
export function validateDatabaseUrl(value) {
  const connectionString = value?.trim();
  if (!connectionString) {
    throw new DatabaseConfigurationError("Missing DATABASE_URL: configure the server PostgreSQL connection string");
  }
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new DatabaseConfigurationError("Invalid DATABASE_URL: expected a PostgreSQL connection string");
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new DatabaseConfigurationError("Invalid DATABASE_URL: expected a PostgreSQL connection string");
  }
  return connectionString;
}
