---
layout: post
title: httpauth - Basic Auth Middleware For Go
categories: go, programming
---

[httpauth](https://github.com/goji/httpauth) is a HTTP Basic Authentication middleware for Go.

I originally designed it for the [Goji](https://goji.io/) micro-framework, but it's compatible with vanilla net/http. We can thank Go's http.Handler interface for that, but I'd recommend [Alice](https://github.com/justinas/alice) to minimise the function wrapping if you're particularly framework adverse.

```go
package main

import(
    "net/http"
    "github.com/goji/httpauth"
    "github.com/zenazn/goji/web"
)

func main() {

    goji.Use(httpauth.SimpleBasicAuth("dave", "password"), SomeOtherMiddleware)
    // myHandler requires HTTP Basic Auth to access
    goji.Get("/thing", myHandler)
    
    goji.Serve()
}
```

As always, note that HTTP Basic Auth credentials are sent over the wire in plain-text, so serve your application over HTTPS (TLS) using Go's built-in ListenAndServeTLS or nginx up front.

Full examples are in the README, and I'm open to any pull requests.
