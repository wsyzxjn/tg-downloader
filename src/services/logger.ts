import { appendFile } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { LogLevel } from "@/types/setting.js";

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

let activeLevel = normalizeLevel(process.env.LOG_LEVEL);
const logDir = path.resolve(process.cwd(), "log");
const retentionDays = 7;

let prepared = false;
let preparing: Promise<void> | null = null;
let cleanedAtBoot = false;
let currentLogDate = "";
let currentLogFilePath = "";

function formatDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

async function cleanupOldLogs() {
  const entries = await readdir(logDir, { withFileTypes: true });
  const now = Date.now();
  const ttlMs = retentionDays * 24 * 60 * 60 * 1000;
  await Promise.all(
    entries.map(async entry => {
      if (!entry.isFile() || !entry.name.endsWith(".log")) {
        return;
      }
      const matched = /^(\d{4}-\d{2}-\d{2})\.log$/.exec(entry.name);
      if (!matched) {
        return;
      }
      const stamp = new Date(`${matched[1]}T00:00:00.000Z`).getTime();
      if (!Number.isFinite(stamp)) {
        return;
      }
      if (now - stamp <= ttlMs) {
        return;
      }
      await rm(path.join(logDir, entry.name), { force: true });
    })
  );
}

async function ensureLogEnvironment() {
  if (prepared) {
    return;
  }
  if (preparing) {
    await preparing;
    return;
  }
  preparing = (async () => {
    await mkdir(logDir, { recursive: true });
    if (!cleanedAtBoot) {
      cleanedAtBoot = true;
      await cleanupOldLogs();
    }
    prepared = true;
  })().finally(() => {
    preparing = null;
  });
  await preparing;
}

function getLogFilePath(date: Date) {
  const datePart = formatDatePart(date);
  if (datePart !== currentLogDate) {
    currentLogDate = datePart;
    currentLogFilePath = path.join(logDir, `${datePart}.log`);
  }
  return currentLogFilePath;
}

function stringifyExtra(extra: unknown) {
  if (extra === undefined) {
    return "";
  }
  if (typeof extra === "string") {
    return ` ${extra}`;
  }
  try {
    return ` ${JSON.stringify(extra)}`;
  } catch {
    return " [unserializable extra]";
  }
}

function writeLogLine(
  level: LogLevel,
  scope: string,
  message: string,
  extra?: unknown
) {
  void (async () => {
    try {
      await ensureLogEnvironment();
      const now = new Date();
      const line = `[${formatTimestamp(now)}] [${level.toUpperCase()}] [${scope}] ${message}${stringifyExtra(extra)}\n`;
      appendFile(getLogFilePath(now), line, () => undefined);
    } catch {
      // Ignore log write failures to avoid affecting main flow.
    }
  })();
}

export function setLogLevel(level: string | undefined) {
  activeLevel = normalizeLevel(level);
}

export function getLogLevel(): LogLevel {
  return activeLevel;
}

export function createLogger(scope: string) {
  const enabled = (level: LogLevel) =>
    levelWeight[level] >= levelWeight[activeLevel];
  const prefix = `[${scope}]`;

  return {
    debug(message: string, extra?: unknown) {
      if (!enabled("debug")) {
        return;
      }
      writeLogLine("debug", scope, message, extra);
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
      writeLogLine("info", scope, message, extra);
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
      writeLogLine("warn", scope, message, extra);
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
      writeLogLine("error", scope, message, extra);
      if (extra !== undefined) {
        console.error(prefix, message, extra);
        return;
      }
      console.error(prefix, message);
    },
  };
}
