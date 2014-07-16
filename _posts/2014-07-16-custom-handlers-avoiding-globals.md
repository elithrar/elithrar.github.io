---
layout: post
title: Custom Handlers and Avoiding Globals in Go Web Applications
---

Go's [net/http](http://golang.org/pkg/net/http/) package is extremely flexible, thanks to the fact that it centres on the [http.Handler](http://golang.org/pkg/net/http/#Handler) interface. But there's often times when you both want to extend what's there and still keep it compatible with existing interfaces and conventions. We'll look at how we can build our own handler type, and how to extend it so we can explicitly pass a "context" containing our database pool, template map, a custom logger and so on and remove a reliance on global variables.

## Creating Our Custom Handler Type

net/http provides a basic `HandlerFunc` type that is just `func(w http.ResponseWriter, r *http.Request)`. It's easy to understand, pervasive, and covers most simple use-cases. But for anything more than that, there's two immediate "issues": a) we can't pass any additional parameters to http.HandlerFunc, and b) we have to repeat a lot of error handling code in each handler. If you're new to Go it may not seem immediately obvious how to resolve this but still retain compatibility with other HTTP packages, but thankfully it's an easy problem to solve.

We create our own handler type that satisfies http.Handler (read: it has a `ServeHTTP(http.ResponseWriter, *http.Request)` method), which allows it to remain compatible with net/http, generic HTTP middleware packages like [nosurf](https://github.com/justinas/nosurf), and routers/frameworks like [gorilla/mux](http://www.gorillatoolkit.org/pkg/mux) or [Goji](https://goji.io/).

First, let's highlight the problem:

```go
func myHandler(w http.ResponseWriter, r *http.Request) {
    session, err := store.Get(r, "myapp")
    if err != nil {
        http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
        return // Forget to return, and the handler will continue on
    }

    id := // get id from URL param; strconv.AtoI it; making sure to return on those errors too...
    post := Post{ID: id}
    exists, err := db.GetPost(&post)
    if err != nil {
        http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
        return // Repeating ourselves again 
    }

    if !exists {
        http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
        return // ... and again.
    }

    err = renderTemplate(w, "post.tmpl", post)
    if err != nil {
        // Yep, here too...
    }
}
```

Things are not only verbose (we have to do this in every handler), but we're at the risk of a subtle and hard-to-catch bug. If we don't explicitly `return` when we encounter an error&mdash;such as a serious database error or when a password comparison fails&mdash;our handler will *continue*. At best this might mean we render an empty struct to our template and confuse the user. At worst, this might mean we write a HTTP 401 (Not Authorised) response and then continue to do things that (potentially) only a logged in user should see or be able to do. 

Thankfully, we can fix this pretty easily by creating a handler type that returns an explicit error:

```go

type appHandler func(http.ResponseWriter, *http.Request) (int, error)

// Our appHandler type will now satisify http.Handler 
func (fn appHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if status, err := fn(w, r); err != nil {
        // We could also log our errors centrally:
        // i.e. log.Printf("HTTP %d: %v", err)
        switch status {
        // We can have cases as granular as we like, if we wanted to
        // return custom errors for specific status codes.
        case http.StatusNotFound:
            notFound(w, r)
        case http.StatusInternalServerError:
            http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
        default:
            // Catch any other errors we haven't explicitly handled
            http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
        }
}

func myHandler(w http.ResponseWriter, r *http.Request) (int, error) {
    session, err := store.Get(r, "myapp")
    if err != nil {
        // Much better!
        return http.StatusInternalServerError, err
    }

    post := Post{ID: id}
    exists, err := db.GetPost(&post)
    if err != nil {
        return http.StatusInternalServerError, err
    }

    // We can shortcut this: since renderTemplate returns `error`,
    // our ServeHTTP method will return a HTTP 500 instead and won't 
    // attempt to write a broken template out with a HTTP 200 status.
    // (see the postscript for how renderTemplate is implemented)
    // If it doesn't return an error, things will go as planned.
    return http.StatusOK, renderTemplate(w, "post.tmpl", data)
}

func main() {
	// Cast myHandler to an appHandler
	http.HandleFunc("/", appHandler(myHandler))
	http.ListenAndServe(":8000", nil)
}
```

This is, of course, nothing new: Andrew Gerrand [highlighted a similar approach](http://blog.golang.org/error-handling-and-go) on the Go blog back in 2011. Our implementation is just an adaptation with a little extra error handling. I prefer to return `(int, error)` as I find it more idiomatic than returning a concrete type, but you could certainly create your own error type if you wished (but let's just keep it simple for now).

## Extending Our Custom Handler Further

A quick aside: global variables get a lot of hate: you don't control what can modify them, it can be tricky to track their state, and they may not be suitable for concurrent access. Still, used correctly they can be convenient, and plenty of Go docs & projects lean on them (e.g. [here](http://golang.org/doc/articles/wiki/#tmp_10) & [here](http://www.gorillatoolkit.org/pkg/schema)). database/sql's `*sql.DB` type can be safely used as a global as it represents a pool and is protected by mutexes, maps (i.e. template maps) can be read from (but not written to, of course) concurrently, and session stores take a similar approach to database/sql.

After being inspired by [@benbjohnson's article from last week](https://medium.com/@benbjohnson/structuring-applications-in-go-3b04be4ff091) on structuring Go applications and a debate with a fellow Gopher on Reddit ([who takes a similar approach](http://www.jerf.org/iri/post/2929)), I figured I'd take a look at my codebase (which has a few globals of the above types) and refactor it to explicitly pass a context struct to my handlers. Most of it was smooth sailing, but there's a couple of potential pitfalls you can run into if you want your context instance to be available in more than just the handlers themselves.

Here's the actual global variables I had before:

```go
var (
    decoder   *schema.Decoder
    bufpool   *bpool.Bufferpool
    templates map[string]*template.Template
    db        *sqlx.DB
    store     *redistore.RediStore
    mandrill  *gochimp.MandrillAPI
    twitter   *anaconda.TwitterApi
    log       *log.Logger
    conf      *config // app-wide configuration: hostname, ports, etc.
)
```

So, given the custom handler type we created above, how can we turn this list of global variables into a context we can pass to our handlers *and* our `ServeHTTP` method&mdash;which may want to access our template map to render "pretty" errors or our custom logger&mdash;and still keep everything compatible with `http.Handler`?

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"html/template"

	"github.com/gorilla/sessions"
	"github.com/jmoiron/sqlx"
	"github.com/zenazn/goji/graceful"
	"github.com/zenazn/goji/web"
)

// appContext contains our local context; our database pool, session store, template
// registry and anything else our handlers need to access. We'll create an instance of it
// in our main() function and then explicitly pass a reference to it for our handlers to access.
type appContext struct {
	db        *sqlx.DB
	store     *sessions.CookieStore
	templates map[string]*template.Template
    decoder *schema.Decoder
    // ... and the rest of our globals.
}

// We've turned our original appHandler into a struct with two fields:
// - A function type similar to our original handler type (but that now takes an *appContext)
// - An embedded field of type *appContext
type appHandler struct {
	*appContext
	h func(*appContext, http.ResponseWriter, *http.Request) (int, error)
}

// Our ServeHTTP method is mostly the same, and also has the ability to
// access our *appContext's fields (templates, loggers, etc.) as well.
func (ah appHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Updated to pass ah.appContext as a parameter to our handler type.
    status, err := ah.h(ah.appContext, w, r)
    if err != nil {
        log.Printf("HTTP %d: %q", status, err)
        switch status {
        case http.StatusNotFound:
            http.NotFound(w, r)
            // And if we wanted a friendlier error page:
            // err := ah.renderTemplate(w, "http_404.tmpl", nil)
        case http.StatusInternalServerError:
            http.Error(w, http.StatusText(status), status)
        default:
            http.Error(w, http.StatusText(status), status)
        }
    }
}

func main() {
	// These are 'nil' for our example, but we'd either assign
    // the values as below or use a constructor function like
    // (NewAppContext(conf config) *appContext) that initialises
    // it for us based on our application's configuration file.
	context := &appContext{db: nil, store: nil} // Simplified for this example

	r := web.New()
	// We pass an instance to our context pointer, and our handler.
    r.Get("/", appHandler{context, IndexHandler})

	graceful.ListenAndServe(":8000", r)
}

func IndexHandler(a *appContext, w http.ResponseWriter, r *http.Request) (int, error) {
    // Our handlers now have access to the members of our context struct.
    // e.g. we can call methods on our DB type via err := a.db.GetPosts()
	fmt.Fprintf(w, "IndexHandler: db is %q and store is %q", a.db, a.store)
	return 200, nil
}
```

Everything still remains very readable: we lean on the type system and existing interfaces, and if we just want to use a regular http.HandlerFunc, we can do that too. Our handlers are still wrappable by anything that takes (and spits out) a http.Handler, and if we wanted to ditch Goji and use gorilla/mux or even just net/http, we don't have to change our handler at all. Just make sure that your context's fields are safe for concurrent access. Putting a map in there that requests write to would not be, for example: you'll need a mutex from the [sync](http://golang.org/pkg/sync/) package for that.

Other than that, it just works. We've reduced repetition around our error handling, we've removed our reliance on globals and our code is still readable.

## Addendum

* Worth reading is Justinas' [great article on errors](http://justinas.org/best-practices-for-errors-in-go/) in Go: read the section on implementing a custom `httpError`.
* Writing some HTTP middleware for your Go application? Align with `func(http.Handler) http.Handler` and you'll end up with something portable. The only "exception" to this rule is when you need to pass state between handlers (i.e. a CSRF token), which is when you'll need to tie yourself to a request context (like Goji's [web.C](https://godoc.org/github.com/zenazn/goji/web#C), or [gorilla/context](http://gorillatoolkit.org/pkg/context)). Plenty of middleware doesn't need to do that however.
* There's a compilable version of [the final example](https://gist.github.com/elithrar/5aef354a54ba71a32e23) that you can leave comments on.



