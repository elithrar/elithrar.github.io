---
layout: post
title: "A Guide To Writing Logging Middleware in Go"
categories: golang, observability, http
---

This is an opinionated guide on how to write extensible logging middleware for Go web services.

I've had a number of requests to add a built-in logger to [gorilla/mux](https://github.com/gorilla/mux) and to extend what is logged by [gorilla/handlers](https://github.com/gorilla/handlers), and they're hard to triage. Many of the asks are for different things, since "what" to log, how much to log, and which library to use are not agreed-upon by all. Further, and especially in _mux_'s case, logging is not the focus of the library, and writing your own logging "middleware" can be simpler than you expect.

The patterns in this guide can be extended to any HTTP middleware use-cases, including authentication & authorization, metrics, tracing, and web security. Logging just happens to be one of the most common use-cases and makes for a great example.

### Why is Middleware Useful?

> If you've been writing Go for a while, you can [skip to the code](#a-full-example) at the end of this post.

Middleware allows us to separate concerns and write composable applications—and in a world of micro-services, allow clearer lines of ownership for specific components.

Specifically:

- Authentication and authorization ("authn" and "authz") can be handled uniformly: we can both keep it separate from our primary business logic, and/or share the same authn/authz handling across our organization. Separating this can make adding new authentication providers easier, or (importantly) fixing potential security issues easier as a team grows.
- Similar to authn & authz, we can define a set of re-usable logging, metrics & tracing middleware for our applications, so that troubleshooting across services and/or teams isn't a pot-luck.
- Testing becomes simpler, as we can draw clearer boundaries around each component: noting that integration testing is still important for end-to-end validation.

With this in mind, let's see how defining "re-usable" middleware in Go actually works.

### A Common Middleware Interface

One thing that's important when writing any middleware is that it be loosely coupled from your choice of framework or router-specific APIs. Handlers should be usable by any HTTP-speaking Go service: if team A chooses `net/http`, team B chooses [`gorilla/mux`](https://github.com/gorilla/mux), and team C wants to use [`Twirp`](https://twitchtv.github.io/twirp/docs/mux.html), then our middleware shouldn't force a choice or be constrained within a particular framework.

Go's net/http library defines the [`http.Handler`](https://golang.org/pkg/net/http/#Handler) interface, and satisfying this makes it easy to write portable HTTP handling code.

The only method required to satisfy `http.Handler` is `ServeHTTP(http.ResponseWriter, *http.Request)` - and the concrete [`http.HandlerFunc`](https://golang.org/pkg/net/http/#HandlerFunc) type means that you can convert any type with a matching signature into a type that satisfies `http.Handler`.

Example:

```go
func ExampleMiddleware(next http.Handler) http.Handler {
  // We wrap our anonymous function, and cast it to a http.HandlerFunc
  // Because our function signature matches ServeHTTP(w, r), this allows
  // our function (type) to implicitly satisify the http.Handler interface.
  return http.HandlerFunc(
    func(w http.ResponseWriter, r *http.Request) {
      // Logic before - reading request values, putting things into the
      // request context, performing authentication

      // Important that we call the 'next' handler in the chain. If we don't,
      // then request handling will stop here.
      next.ServeHTTP(w, r)
      // Logic after - useful for logging, metrics, etc.
      //
      // It's important that we don't use the ResponseWriter after we've called the
      // next handler: we may cause conflicts when trying to write the response
    }
  )
}
```

This is effectively the recipe for any middleware we want to build. Each middleware component (which is just a `http.Handler` implementation!) wraps another, performs any work it needs to, and then calls the handler it wrapped via `next.ServeHTTP(w, r)`.

If we need to pass values between handlers, such as the ID of the authenticated user, or a request or trace ID, we can the use the `context.Context` attached to the `*http.Request` via the `*Request.Context()` [method](https://golang.org/pkg/net/http/#Request.Context) introduced back in Go 1.7.

A stack of middleware would look like the below:

```go
router := http.NewServeMux()
router.HandleFunc("/", indexHandler)

// Requests traverse LoggingMiddleware -> OtherMiddleware -> YetAnotherMiddleware -> final handler
configuredRouter := LoggingMiddleware(OtherMiddleware(YetAnotherMiddleware(router))))
log.Fatal(http.ListenAndServe(":8000", configuredRouter))
```

This looks composable (check!), but what about if we want to inject dependencies or otherwise customize the behaviour of each handler in the stack?

### Injecting Dependencies

In the above `ExampleMiddleware`, we created a simple function that accepted a `http.Handler` and returned a `http.Handler`. But what if we wanted to provide our own logger implementation, inject other config, and/or not rely on global singletons?

Let's take a look at how we can achieve that while still having our middleware accept (and return) `http.Handler`.

```go
func NewExampleMiddleware(someThing string) func(http.Handler) http.Handler {
  return func(next http.Handler) http.Handler {
    fn := func(w http.ResponseWriter, r *http.Request) {
      // Logic here

      // Call the next handler
      next.ServeHTTP(w, r)
    }

    return http.HandlerFunc(fn)
  }
}
```

By _returning_ a `func(http.Handler) http.Handler` we can make the dependencies of our middleware clearer, and allow consumers of our middleware to configure it to their needs.

In our logging example, we make want to pass an application-level logger with some existing configuration—say, the service name, and a timestamp format—to our `LoggingMiddleware`, without having to copy-paste it or otherwise rely on package globals, which make our code harder to reason about & test.

### The Code: LoggingMiddleware

Let's take everything we've learned above, with a middleware function that logs:

- The request method & path
- The status code written to the response, using our own implementation of `http.ResponseWriter` (more on this below)
- The duration of the HTTP request & response - until the last bytes are written to the response
- Allows us to inject our own `logger.Log` instance from _kit/log_.

[Source on GitHub](https://github.com/elithrar/admission-control/blob/v0.6.3/request_logger.go)

```go
// request_logger.go
import (
  "net/http"
  "runtime/debug"
  "time"

  log "github.com/go-kit/kit/log"
)

// responseWriter is a minimal wrapper for http.ResponseWriter that allows the
// written HTTP status code to be captured for logging.
type responseWriter struct {
  http.ResponseWriter
  status      int
  wroteHeader bool
}

func wrapResponseWriter(w http.ResponseWriter) *responseWriter {
  return &responseWriter{ResponseWriter: w}
}

func (rw *responseWriter) Status() int {
  return rw.status
}

func (rw *responseWriter) WriteHeader(code int) {
  if rw.wroteHeader {
    return
  }

  rw.status = code
  rw.ResponseWriter.WriteHeader(code)
  rw.wroteHeader = true

  return
}

// LoggingMiddleware logs the incoming HTTP request & its duration.
func LoggingMiddleware(logger log.Logger) func(http.Handler) http.Handler {
  return func(next http.Handler) http.Handler {
    fn := func(w http.ResponseWriter, r *http.Request) {
      defer func() {
        if err := recover(); err != nil {
          w.WriteHeader(http.StatusInternalServerError)
          logger.Log(
            "err", err,
            "trace", debug.Stack(),
          )
        }
      }()

      start := time.Now()
      wrapped := wrapResponseWriter(w)
      next.ServeHTTP(wrapped, r)
      logger.Log(
        "status", wrapped.status,
        "method", r.Method,
        "path", r.URL.EscapedPath(),
        "duration", time.Since(start),
      )
    }

    return http.HandlerFunc(fn)
  }
}
```

Review:

- We implement our own `responseWriter` type that captures the status code of a response, allowing us to log it (since it's not known until the response is written). Importantly, we don't have to re-implement every method of the `http.ResponseWriter` - we embed the one we receive, and override only the `Status() int` and `WriteHeader(int)` methods, so we can carry state in our `.status` and `.wroteHeader` struct fields.
- http.HandlerFunc converts our return type into a http.HandlerFunc, which automatically allows it to satisfy the `ServeHTTP` method of `http.Handler`.
- Our Logger also logs panics (optional, but useful) so we can capture them in our logging system too.
- Because we directly inject the `log.Logger` - we can both configure it, and mock it during tests.
- Calling `.Log()` allows us to pass whichever values we need - we may not want to log all values at once, but it's also easy to expand as necessary. There is no "one size fits all" logger.

Notably, I use [`kit/log`](https://github.com/go-kit/kit/tree/master/log) here, although you could use any logger you like, including the standard library - noting that you'd be missing the benefits of structured logging if you went down that path.

### A Full Example

Below is a full (runnable!) example, using a version of `LoggingMiddleware` we defined earlier from the `elithrar/admission-control` package:

```go
// server.go
package main

import (
  "fmt"
  stdlog "log"
  "net/http"
  "os"

  "github.com/elithrar/admission-control"
  log "github.com/go-kit/kit/log"
)

func myHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintln(w, "hello!")
}

func main() {
  router := http.NewServeMux()
  router.HandleFunc("/", myHandler)

  var logger log.Logger
  // Logfmt is a structured, key=val logging format that is easy to read and parse
  logger = log.NewLogfmtLogger(log.NewSyncWriter(os.Stderr))
  // Direct any attempts to use Go's log package to our structured logger
  stdlog.SetOutput(log.NewStdlibAdapter(logger))
  // Log the timestamp (in UTC) and the callsite (file + line number) of the logging
  // call for debugging in the future.
  logger = log.With(logger, "ts", log.DefaultTimestampUTC, "loc", log.DefaultCaller)

  // Create an instance of our LoggingMiddleware with our configured logger
  loggingMiddleware := admissioncontrol.LoggingMiddleware(logger)
  loggedRouter := loggingMiddleware(router)

  // Start our HTTP server
  if err := http.ListenAndServe(":8000", loggedRouter); err != nil {
    logger.Log("status", "fatal", "err", err)
    os.Exit(1)
  }
}
```

If we run this server, and then make a request against it, we'll see our log line output to stderr:

```sh
    $ go run server.go
    # Make a request with: curl localhost:8000/
    ts=2020-03-21T18:30:58.8816186Z loc=server.go:62 status=0 method=GET path=/ duration=7.6µs
```

If we wanted to log more information - such as `*Request.Host`, a value from `*Request.Context()` (e.g. a trace ID), or specific response headers, we could easily do that by extending the call to `logger.Log` as needed in our own version of the middleware.

### Summary

We were able to build a flexible, re-usable middleware component by:

- Satisfying Go’s existing `http.Handler` interface, allowing our code to be loosely coupled from underlying framework choices
- Returning closures to inject our dependencies and avoid global (package-level) config
- Using _composition_ - when we defined a wrapper around the `http.ResponseWriter` interface - to override specific methods, as we did with our logging middleware.

Taking this, you can hopefully see how you might provide the basis for authentication middleware, or metrics middleware that counts status codes and response sizes.

And because we used `http.Handler` as our foundation, the middleware we author can be easily consumed by others!

Pretty good, huh?

### Postscript: Logs vs Metrics vs Traces

It's worth taking a moment to define what we mean by "logging". Logging is about capturing (hopefully) structured event data, and logs are good for detailed investigation, but are large in volume and can be slow(er) to query. Metrics are directional (think: # of requests, login failures, etc) and good for monitoring trends, but don't give you the full picture. Traces track the lifecycle of a request or query across systems.

Although this article talks about better logging for Go web services, a production application should consider all dimensions. I recommend reading Peter Bourgon's [post on Metrics, tracing & logging](https://peter.bourgon.org/blog/2017/02/21/metrics-tracing-and-logging.html) for a deeper dive on this topic.
