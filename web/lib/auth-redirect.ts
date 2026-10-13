export function safeRedirectPath(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x1f]/.test(value) ? value : fallback;
}
