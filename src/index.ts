/// <reference types="@cloudflare/workers-types" />

const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
  "Content-Security-Policy":
    "script-src 'self' 'unsafe-inline' use.typekit.net p.typekit.net cloudflareinsights.com static.cloudflareinsights.com",
  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection
  "X-XSS-Protection": "1; mode=block",
  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
  "X-Frame-Options": "DENY",
  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Embedder-Policy": 'require-corp; report-to="default";',
  "Cross-Origin-Opener-Policy": 'same-site; report-to="default";',
  "Cross-Origin-Resource-Policy": "same-site",
  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy
  // Also: https://www.w3.org/TR/permissions-policy-1/
  // It's exhausting to list out all of the potential permissions, so we'll disallow the ones
  // that have the largest impact on user privacy (location and A/V capture)
  "Permissions-Policy": "microphone=(), geolocation=(), camera=(), display-capture=()",
}

const CONTENT_TYPE_HEADER = "content-type"
const CTYPE_TEXT_HTML = "text/html"

interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request)
    const respHeaders = new Headers(response.headers)

    // This sets the headers for HTML responses (only) as other MIME types do
    // not need to set security headers.
    const contentType = respHeaders.get(CONTENT_TYPE_HEADER)
    if (contentType && contentType.includes(CTYPE_TEXT_HTML)) {
      for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
        respHeaders.set(name, value)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    })
  },
}
