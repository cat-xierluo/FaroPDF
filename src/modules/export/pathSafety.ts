export function isPdfPath(path: string): boolean {
  return normalizePathForComparison(path).toLowerCase().endsWith(".pdf");
}

export function pathsAreSame(left: string, right: string): boolean {
  return normalizePathForComparison(left) === normalizePathForComparison(right);
}

export function isAbsolutePath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
}

export function sanitizePdfExportError(message: string): string {
  return message
    .replace(/\b[A-Za-z]:[\\/][^\n\r]*?\.pdf/gi, "[path]")
    .replace(/\/[^\n\r]*?\.pdf/gi, "[path]")
    .replace(/\b(api[-_]?key|token|secret|password)=\S+/gi, "$1=[redacted]");
}

export function normalizePathForComparison(path: string): string {
  const normalizedSeparators = path.trim().replace(/\\/g, "/");
  const driveMatch = /^([A-Za-z]:)(.*)$/.exec(normalizedSeparators);
  const drivePrefix = driveMatch?.[1]?.toLowerCase() ?? "";
  const pathBody = driveMatch ? driveMatch[2] : normalizedSeparators;
  const isAbsolute = pathBody.startsWith("/");
  const parts: string[] = [];

  for (const part of pathBody.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      const lastPart = parts.at(-1);
      if (lastPart && lastPart !== "..") {
        parts.pop();
      } else if (!isAbsolute) {
        parts.push(part);
      }
      continue;
    }

    parts.push(part);
  }

  const prefix = `${drivePrefix}${isAbsolute ? "/" : ""}`;
  return `${prefix}${parts.join("/")}`.replace(/\/+$/, "").toLowerCase();
}
