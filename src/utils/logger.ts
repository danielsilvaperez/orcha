import pino from "pino";

export const logger = pino({
  level: process.env.ORCHA_LOG_LEVEL ?? "info",
  name: "orcha"
});
