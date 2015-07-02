---
layout: post
title: http.Handler and Error Handling in Go
categories: golang, http, web
---

I wrote [an article a while back](http://elithrar.github.io/article/custom-handlers-avoiding-globals/) on implementing custom handler types to avoid a few common problems with the existing `http.HandlerFunc`—the `func MyHandler(w http.ResponseWriter, r *http.Request)` signature you often see. It's a useful "general purpose" handler type that covers the basics, but&mdash;as with anything generic&mdash;there are a few shortcomings:

* Having to remember to explicitly call a naked `return` when you want to stop processing in the handler. This is a common case when you want to raise a re-direct (301/302), not found (404) or internal server error (500) status. Failing to do so can be the cause of subtle bugs (the function will continue) and because the function signature doesn't *require* a return value, the compiler won't alert you.
* You can't easily pass in additional arguments (i.e. database pools, configuration values). You end up having to either use a bunch of globals (not terrible, but tracking them can scale poorly) or stash those things into a request context and then type assert each of them out. Can be clunky.
* You end up repeating yourself. Want to log the error returned by your DB package? You can either call `log.Printf` in your database package (in each query func), or in every handler when an error is returned. It'd be great if your handlers could just return that to a function that centrally logs errors and raise a HTTP 500 on the ones that call for it.

My previous approach used the `func(http.ResponseWriter, *http.Request) (int, error)` signature. This has proven to be pretty neat, but a quirk is that returning "non error" status codes like 200, 302, 303 was often superfluous—you're either setting it elsewhere or it's effectively unused - e.g.

```go
func SomeHandler(w http.ResponseWriter, r *http.Request) (int, error) {
    db, err := someDBcall()
    if err != nil {
        // This makes sense.
        return 500, err
    }

    if user.LoggedIn {
        http.Redirect(w, r, "/dashboard", 302)
        // Superfluous! Our http.Redirect function handles the 302, not 
        // our return value (which is effectively ignored).
        return 302, nil
    }

}
```

It's not *terrible*, but we can do better.

## A Little Different

So how can we improve on this? Let's lay out some code:

```go
package handler

// Error represents a handler error. It provides methods for a HTTP status 
// code and embeds the built-in error interface.
type Error interface {
	error
	Status() int
}

// StatusError represents an error with an associated HTTP status code.
type StatusError struct {
	Code int
	Err  error
}

// Allows StatusError to satisfy the error interface.
func (se StatusError) Error() string {
	return se.Err.Error()
}

// Returns our HTTP status code.
func (se StatusError) Status() int {
	return se.Code
}

// A (simple) example of our application-wide configuration.
type Env struct {
	DB   *sql.DB
	Port string
	Host string
}

// The Handler struct that takes a configured Env and a function matching
// our useful signature.
type Handler struct {
	*Env
	h func(e *Env, w http.ResponseWriter, r *http.Request) error
}

// ServeHTTP allows our Handler type to satisfy http.Handler.
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	err := h.h(h.Env, w, r)
	if err != nil {
		switch e := err.(type) {
		case Error:
			// We can retrieve the status here and write out a specific
			// HTTP status code.
			log.Printf("HTTP %d - %s", e.Status(), e)
			http.Error(w, e.Error(), e.Status())
		default:
			// Any error types we don't specifically look out for default
			// to serving a HTTP 500
			http.Error(w, http.StatusText(http.StatusInternalServerError),
				http.StatusInternalServerError)
		}
	}
}
```

The code above should be self-explanatory, but to clarify any outstanding points:

* We create a custom `Error` type (an interface) that embeds Go's built-in error interface and also has a `Status() int` method.
* We provide a simple `StatusError` type (a struct) that satisfies our `handler.Error` type. Our StatusError type accepts a HTTP status code (an int) and an error that allows us to wrap the root cause for logging/inspection.
* Our `ServeHTTP` method contains a type switch—which is the `e := err.(type)` part that tests for the errors we care about and allows us to handle those specific cases. In our example that's just `StatusError` Other error types—be they from other packages (e.g. `net.Error`) or additional error types we have defined—can also be inspected (if we care about their details).

If we don't want to inspect them, our `default` case catches them. Remember that the `ServeHTTP` method allows our `Handler` type to satisfy the `http.Handler` interface and be used anywhere http.Handler is accepted: Go's net/http package and all good third party frameworks. This is what makes custom handler types so useful: they're flexible about where they can be used. 

Note that the `net` package [does something very similar](http://golang.org/pkg/net/#Error). It has a `net.Error` interface that embeds the built-in `error` interface and then a handful of concrete types that implement it. Functions return the concrete type that suits the type of error they're returning (a DNS error, a parsing error, etc). A good example would be defining a `DBError` type with a `Query() string` method in a 'datastore' package that we can use to log failed queries.

## Full Example

What does the end result look like? And how would we split it up into packages (sensibly)?

```go
package handler

import (
    "net/http"
)

// Error represents a handler error. It provides methods for a HTTP status 
// code and embeds the built-in error interface.
type Error interface {
	error
	Status() int
}

// StatusError represents an error with an associated HTTP status code.
type StatusError struct {
	Code int
	Err  error
}

// Allows StatusError to satisfy the error interface.
func (se StatusError) Error() string {
	return se.Err.Error()
}

// Returns our HTTP status code.
func (se StatusError) Status() int {
	return se.Code
}

// A (simple) example of our application-wide configuration.
type Env struct {
	DB   *sql.DB
	Port string
	Host string
}

// The Handler struct that takes a configured Env and a function matching
// our useful signature.
type Handler struct {
	*Env
	h func(e *Env, w http.ResponseWriter, r *http.Request) error
}

// ServeHTTP allows our Handler type to satisfy http.Handler.
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	err := h.h(h.Env, w, r)
	if err != nil {
		switch e := err.(type) {
		case Error:
			// We can retrieve the status here and write out a specific
			// HTTP status code.
			log.Printf("HTTP %d - %s", e.Status(), e)
			http.Error(w, e.Error(), e.Status())
		default:
			// Any error types we don't specifically look out for default
			// to serving a HTTP 500
			http.Error(w, http.StatusText(http.StatusInternalServerError),
				http.StatusInternalServerError)
		}
	}
}

func GetIndex(w http.ResponseWriter, r *http.Request) error {
    users, err := env.DB.GetAllUsers()
    if err != nil {
        // We return a status error here, which conveniently wraps the error
        // returned from our DB queries. We can clearly define which errors 
        // are worth raising a HTTP 500 over vs. which might just be a HTTP 
        // 404, 403 or 401 (as appropriate). It's also clear where our 
        // handler should stop processing by returning early.
        return StatusError{500, err}
    }

    fmt.Fprintf(w, "%+v", users)
    return nil
}
```

... and in our main package:

```go
package main

import (
    "net/http"
    "github.com/you/somepkg/handler"
)

func main() {
    db, err := sql.Open("connectionstringhere")
    if err != nil {
          log.Fatal(err)
    }

    // Initialise our app-wide environment with the services/info we need.
    env := &handler.Env{
             DB: db,
             Port: os.Getenv("PORT"),
             Host: os.Getenv("HOST"),
             // We might also have a custom log.Logger, our 
             // template instance, and a config struct as fields 
             // in our Env struct.
    }

    // Note that we're using http.Handle, not http.HandleFunc. The 
    // latter only accepts the http.HandlerFunc type, which is not 
    // what we have here.
    http.Handle("/", handler.Handler{env, handler.GetIndex})

    // Logs the error if ListenAndServe fails.
    log.Fatal(http.ListenAndServe(":8000", nil))
}
```

In the real world, you're likely to define your `Handler` and `Env` types in a separate file (of the same package) from your handler functions, but I've keep it simple here for the sake of brevity. So what did we end up getting from this?

* A practical `Handler` type that satisfies `http.Handler` can be used with
  frameworks like [net/http](http://golang.org/pkg/net/http/), [gorilla/mux](http://www.gorillatoolkit.org/pkg/mux),
  [Goji](https://goji.io/) and any others that sensibly accept a `http.Handler` type.
* Clear, centralised error handling. We inspect the errors we want to handle
  specifically&mdash;our `StatusError` type&mdash;and fall back to a default
  for generic errors. If you're interested in better error handling practices in Go, 
  read [Dave Cheney's blog post](http://dave.cheney.net/2014/12/24/inspecting-errors), 
  which dives a into defining package-level `Error` interfaces.
* A useful application-wide "environment" via our `Env` type. We don't have to
  scatter a bunch of globals across our applications: instead we define them in
  one place and pass them explicitly to our handlers.

If you have questions about the post, drop me a line via [@elithrar](https://twitter.com/elithrar) on Twitter,
or the [Gopher community](http://blog.gopheracademy.com/gophers-slack-community/) on Slack. 


