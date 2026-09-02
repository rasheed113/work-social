const SECRET_VALUE_PATTERNS: RegExp[] = [
  /^eyJ[A-Za-z0-9_-]+\./,
  /^sk-[A-Za-z0-9_-]{16,}$/,
  /^AIza[A-Za-z0-9_-]{20,}$/,
  /^gh[pousr]_[A-Za-z0-9_]{20,}$/,
  /^xox[baprs]-[A-Za-z0-9-]{20,}$/,
  /^-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^Bearer\s+\S+/i,
];

const SECRET_KEY_PATTERN = /(?:password|passcode|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|cookie|private[_-]?key|service[_-]?role|secret)/i;

export function isSecretLikeKey(value: string): boolean {
  return SECRET_KEY_PATTERN.test(value);
}

export function isSecretLikeValue(value: string): boolean {
  const trimmed = value.trim();
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function containsSecretLikeText(value: string): boolean {
  return isSecretLikeValue(value) || /(?:authorization\s*:\s*bearer\s+\S+|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|private[_-]?key)\s*[=:]\s*\S+)/i.test(value);
}

/** Keep diagnostics useful while preventing common credential/path disclosure. */
export function sanitizeErrorMessage(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|private[_-]?key)\s*[=:])\s*[^\s,;]+/gi, '$1 [REDACTED]')
    .replace(/(authorization\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/((?:cookie|set-cookie)\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/(?:[A-Za-z]:\\|\\\\|\/)(?:[^\s\\/]+[\\/])+[^\s]+/g, '[REDACTED_PATH]');
}
