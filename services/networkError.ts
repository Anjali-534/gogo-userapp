import axios from "axios";

// True when a request failed for reasons worth retrying unchanged: no
// response at all (offline, timeout, DNS) or a 5xx from the server. A 4xx is
// the server's real answer — retrying the same request won't change it — and
// anything that isn't an axios error is a client-side bug, not a blip.
export function isRetryableError(e: unknown): boolean {
  if (!axios.isAxiosError(e)) return false;
  const status = e.response?.status;
  return !status || status >= 500;
}
