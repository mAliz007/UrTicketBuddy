import { RequestState } from "../types";

export function generateCurlCommand(
  baseUrl: string,
  req: RequestState,
): string {
  // Replace path parameters
  let fullUrl = req.url;
  for (const [param, val] of Object.entries(req.pathParams)) {
    if (val) {
      fullUrl = fullUrl.replace(`:${param}`, encodeURIComponent(val));
    }
  }

  // Append query params
  const activeParams = req.queryParams.filter((p) => p.enabled && p.key);
  if (activeParams.length > 0) {
    const qs = new URLSearchParams();
    activeParams.forEach((p) => qs.append(p.key, p.value));
    fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs.toString();
  }

  // Prepend base URL if relative
  const finalUrl = fullUrl.startsWith("http")
    ? fullUrl
    : `${baseUrl.replace(/\/+$/, "")}${fullUrl}`;

  let cmd = `curl -X ${req.method} "${finalUrl}"`;

  // Headers
  const activeHeaders = req.headers.filter((h) => h.enabled && h.key);
  for (const header of activeHeaders) {
    cmd += ` \\\n  -H "${header.key}: ${header.value}"`;
  }

  // Auth header if bearer
  if (req.authType === "bearer" && req.bearerToken) {
    const hasAuth = activeHeaders.some(
      (h) => h.key.toLowerCase() === "authorization",
    );
    if (!hasAuth) {
      cmd += ` \\\n  -H "Authorization: Bearer ${req.bearerToken}"`;
    }
  }

  // Body
  if (req.method !== "GET" && req.body && req.body.trim()) {
    // Escape single quotes for bash
    const escapedBody = req.body.replace(/"/g, '\\"');
    cmd += ` \\\n  -d "${escapedBody}"`;
  }

  return cmd;
}
