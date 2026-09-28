import { clearSession } from "./session";
import { trackError } from "./analytics";

// Backend error strings (AuthMiddleware, internal/api/middleware/auth.go)
// that mean the credential itself is dead — no account state involved.
const SESSION_INVALID_ERRORS = new Set([
  "invalid token",
  "missing authorization header",
  "invalid authorization header",
]);

const ACCOUNT_DEACTIVATED_ERROR = "account deleted";

export type Auth401Result =
  | { shouldLogout: false }
  | { shouldLogout: true; deactivated: boolean };

// Only meaningful when e.response?.status === 401 — callers check the status
// themselves so they can fall through to their own generic error handling
// otherwise. Distinguishes a genuinely dead session (bad/missing/expired
// token) and a deactivated account — both terminal, both worth a logout —
// from any other 401 (e.g. AuthMiddleware's fail-closed is_active check
// erroring on a transient DB hiccup), which must NOT force a logout: doing
// so would log out an active rider over an unrelated backend blip. Side
// effects (session clearing, error tracking) happen here so every call site
// makes the same decision the same way; the caller still owns the UI
// (alert vs. silent redirect) since that varies by screen.
export async function resolve401(e: any, screen: string): Promise<Auth401Result> {
  const serverError = String(e?.response?.data?.error || "").trim().toLowerCase();

  if (SESSION_INVALID_ERRORS.has(serverError)) {
    await clearSession();
    return { shouldLogout: true, deactivated: false };
  }

  if (serverError === ACCOUNT_DEACTIVATED_ERROR) {
    await clearSession();
    return { shouldLogout: true, deactivated: true };
  }

  trackError({
    error: `Unhandled 401 on ${screen}: status=${e?.response?.status} body=${JSON.stringify(e?.response?.data)}`,
    screen,
  });
  return { shouldLogout: false };
}
