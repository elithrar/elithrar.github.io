const DEFAULT_SECURITY_HEADERS = {
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

export default {
  /**
   * Handle the incoming HTTP Request and return a Response.
   *
   * @param {Request} request - the incoming FetchRequest instance
   * @param {Object} env - environmental variables, bindings and runtime config
   * @param {Object} ctx - exposes helper functions - e.g. waitUntil() and passThroughOnException()
   * @returns {Promise<Response>} - the Response to return to the client
   */
  async fetch(request, env, ctx) {
    let response = await fetch(request)
    let respHeaders = new Headers(response.headers)

    // This sets the headers for HTML responses:
    if (respHeaders.has(CONTENT_TYPE_HEADER) && respHeaders.get(CONTENT_TYPE_HEADER).includes(CTYPE_TEXT_HTML)) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      })
    }

    Object.keys(DEFAULT_SECURITY_HEADERS).map(function (name) {
      respHeaders.set(name, DEFAULT_SECURITY_HEADERS[name])
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    })
  },
}
