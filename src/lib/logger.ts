// Tiny structured logger. Keeps the surface small so it's easy to swap for
// pino/winston later. Honors LOG_LEVEL (debug | info | warn | error | silent).

type Level = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

function envLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw in ORDER) return raw as Level;
  return process.env.NODE_ENV === "test" ? "silent" : "info";
}

const threshold = ORDER[envLevel()];

function emit(level: Exclude<Level, "silent">, msg: string, meta?: unknown): void {
  if (ORDER[level] < threshold) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta && typeof meta === "object" ? (meta as Record<string, unknown>) : meta != null ? { meta } : {})
  };
  // We deliberately use stdout/stderr through console here — this is the one
  // central place allowed to do so. Everywhere else uses log.*.
  // eslint-disable-next-line no-console
  const fn = level === "error" || level === "warn" ? console.error : console.log;
  fn(JSON.stringify(payload));
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta)
};
