// Reads CORS_WHITELIST fresh on every call (not cached at module load) so
// it always reflects whatever dotenv has loaded into process.env by the
// time it's actually used — module-top-level reads can run before
// dotenv.config() has executed, depending on ES module evaluation order.
export const getCorsWhitelist = () =>
  (process.env.CORS_WHITELIST || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// Builds a cors/socket.io-compatible origin check against a whitelist of
// allowed origins. Requests with no Origin header (curl, server-to-server,
// mobile apps) aren't subject to CORS, so they're let through.
export const buildCorsOriginCheck = (whitelist) => (origin, callback) => {
  if (!origin || whitelist.includes(origin)) {
    callback(null, true);
    return;
  }
  const err = new Error(`Origin ${origin} is not allowed by CORS`);
  err.status = 403;
  callback(err);
};
