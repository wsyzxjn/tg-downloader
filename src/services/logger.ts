type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(input: string | undefined): LogLevel {
  const value = (input || "").toLowerCase();
  if (value === "debug" || value === "info" || value === "warn") {
    return value;
  }
  return "error";
}

const activeLevel = normalizeLevel(process.env.LOG_LEVEL);

export function createLogger(scope: string) {
  const enabled = (level: LogLevel) =>
    levelWeight[level] >= levelWeight[activeLevel];
  const prefix = `[${scope}]`;

  return {
    debug(message: string, extra?: unknown) {
      if (!enabled("debug")) {
        return;
      }
      if (extra !== undefined) {
        console.debug(prefix, message, extra);
        return;
      }
      console.debug(prefix, message);
    },
    info(message: string, extra?: unknown) {
      if (!enabled("info")) {
        return;
      }
      if (extra !== undefined) {
        console.info(prefix, message, extra);
        return;
      }
      console.info(prefix, message);
    },
    warn(message: string, extra?: unknown) {
      if (!enabled("warn")) {
        return;
      }
      if (extra !== undefined) {
        console.warn(prefix, message, extra);
        return;
      }
      console.warn(prefix, message);
    },
    error(message: string, extra?: unknown) {
      if (!enabled("error")) {
        return;
      }
      if (extra !== undefined) {
        console.error(prefix, message, extra);
        return;
      }
      console.error(prefix, message);
    },
  };
}
