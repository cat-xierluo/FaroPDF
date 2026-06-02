export function isCredentialReference(value: string): boolean {
  return /^(keychain|env|credential|credential-ref|api-key-ref):[A-Za-z0-9_.:/-]+$/.test(value);
}

export function isMaskedSecret(value: string): boolean {
  return value.includes("...") || /^\*+$/.test(value);
}

export function isSafeApiKeyRef(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || isCredentialReference(trimmed) || isMaskedSecret(trimmed);
}

export function isAllowedOcrEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint || endpoint.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(endpoint.trim());
    if (!parsed.hostname) {
      return false;
    }

    if (parsed.protocol === "https:") {
      return true;
    }

    return parsed.protocol === "http:" && isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}
