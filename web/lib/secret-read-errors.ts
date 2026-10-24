// Only known error codes become UI messages; never display arbitrary API bodies.
export function secretReadErrorMessage(code: unknown, status?: number): string {
  switch (code) {
    case "READ_SETUP_REQUIRED":
      return "Secret reads are not configured in Supabase. Apply 202610130005_restore_secret_reads.sql, then retry.";
    case "SESSION_EXPIRED":
      return "Your session has expired. Sign in again to reveal this value.";
    case "ACCESS_DENIED":
      return "Your account does not have access to this project's secrets.";
    case "PROJECT_CONTEXT":
      return "This project is outside the selected workspace. Reopen it from your workspace and retry.";
    case "SECRET_NOT_FOUND":
      return "This variable has no stored value in the selected environment.";
    case "ENCRYPTION_NOT_CONFIGURED":
      return "The server encryption key is missing or invalid. Restore the existing encryption key before retrying.";
    case "SECRET_UNREADABLE":
      return "This stored value cannot be decrypted. Check that the server uses its original encryption key.";
    default:
      if (status === 401) return "Your session has expired. Sign in again to reveal this value.";
      if (status === 403) return "Your account does not have access to this project's secrets.";
      if (status === 404) return "This variable has no stored value in the selected environment.";
      return "Secret reads are temporarily unavailable. Check your connection and retry.";
  }
}
