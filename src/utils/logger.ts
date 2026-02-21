import pino from "pino";

export const logger = pino({
  level: process.env.COUNCIL_LOG_LEVEL ?? "info",
  name: "council"
});
