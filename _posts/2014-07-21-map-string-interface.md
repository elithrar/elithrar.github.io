---
layout: post
title: HTTP Request Contexts &amp; Go
---

> **Updated (2020)**: The approaches discussed here were once all valid options, but Go has matured significantly since then! You should use Go's [`http.Request.WithContext()`](https://golang.org/pkg/net/http/#Request.WithContext) method for per-request contexts, passing a [`context.Background()`](https://golang.org/pkg/context/) around as needed.
>
> For outbound requests, use [`NewRequestWithContext`](https://golang.org/pkg/net/http/#NewRequestWithContext) and [`ctx.WithTimeout()`](https://golang.org/pkg/context/#WithTimeout) to enforce timeouts on those requests as needed.

Alternatively titled map[string]interface. 

Request contexts, for those new to the terminology, are typically a way to pass data alongside a HTTP request as it is processed by composable handlers (or middleware). This data could be a user ID, a CSRF token, whether a user is logged in or not—something typically derived from logic that you don't want to repeat over-and-over again in every handler. If you've ever used Django, the request context is synonymous with the request.META dictionary.

As an example:

```go

func CSRFMiddleware(http.Handler) http.Handler {
    return func(w http.ResponseWriter, r *http.Request) {
        maskedToken, err := csrf.GenerateNewToken(r)
        if err != nil {
			http.Error(w, "No good!", http.StatusInternalServerError)
			return
        }

        // How do we pass the maskedToken from here...
    }
}

func MyHandler(w http.ResponseWriter, r *http.Request) {
    // ... to here, without relying on the overhead of a session store,
    // and without either handler being explicitly tied to the other?
    // What about a CSRF token? Or an auth-key from a request header?
    // We certainly don't want to re-write that logic in every handler!
}

```

There's three ways that Go's web libraries/frameworks have attacked the problem of request contexts:

1. A global map, with `*http.Request` as the key, mutexes to synchronise writes, and middleware to cleanup old requests ([gorilla/context](http://www.gorillatoolkit.org/pkg/context))

2. A strictly per-request map by creating custom handler types ([goji](https://goji.io/))
3. Structs, and creating middleware as methods with pointer receivers or passing the struct to your handlers ([gocraft/web](https://github.com/gocraft/web)).

So how do these approaches differ, what are the benefits, and what are the downsides?

## Global Context Map

[gorilla/context](http://www.gorillatoolkit.org/pkg/context)'s approach is the simplest, and the easiest to plug into an existing architecture.

Gorilla actually uses a `map[interface{}]interface{}`, which means you need to (and should) create types for your keys. The benefit is that you can use any types that support equality as a key; the downside is that you need to implement your keys in advance if you want to avoid any run-time issues with key types.

You also often want to create setters for the types you store in the context map, to avoid littering your handlers with the same type assertions.

```go

import (
    "net/http"
    "github.com/gorilla/context"
)

type contextKey int

// Define keys that support equality.
const csrfKey contextKey = 0
const userKey contextKey = 1

var ErrCSRFTokenNotPresent = errors.New("CSRF token not present in the request context.")

// We'll need a helper function like this for every key:type
// combination we store in our context map else we repeat this
// in every middleware/handler that needs to access the value.
func GetCSRFToken(r *http.Request) (string, error) {
	val, ok := context.GetOk(r, csrfKey)
	if !ok {
		return "", ErrCSRFTokenNotPresent
	}

	token, ok := val.(string)
	if !ok {
		return "", ErrCSRFTokenNotPresent
	}

	return token, nil
}

// A bare-bones example
func CSRFMiddleware(h http.Handler) http.Handler {
    return func(w http.ResponseWriter, r *http.Request) {
        token, err := GetCSRFToken(r)
        if err != nil {
            http.Error(w, "No good!", http.StatusInternalServerError)
            return
        }

        // The map is global, so we just call the Set function
        context.Set(r, csrfKey, token)

        h.ServeHTTP(w, r)
    }
}

func ShowSignupForm(w http.ResponseWriter, r *http.Request) {
	// We'll use our helper function so we don't have to type assert
	// the result in every handler that triggers/handles a POST request.
	csrfToken, err := GetCSRFToken(r)
	if err != nil {
		http.Error(w, "No good!", http.StatusInternalServerError)
		return
	}

	// We can access this token in every handler we wrap with our
	// middleware. No need to set/get from a session multiple times per
	// request (which is slow!)
	fmt.Fprintf(w, "Our token is %v", csrfToken)
}


func main() {
	r := http.NewServeMux()
	r.Handle("/signup", CSRFMiddleware(http.HandlerFunc(ShowSignupForm)))
	// Critical that we call context.ClearHandler here, else
    // we leave old requests in the map.
	http.ListenAndServe("localhost:8000", context.ClearHandler(r))
}
```

[Full Example](https://gist.github.com/elithrar/015e2a561eee0ca71a77#file-gorilla-go)

The plusses? It's flexible, loosely coupled, and easy for third party packages to use. You can tie it into almost any `net/http` application since all you need is access to `http.Request`&mdash;the rest relies on the global map.

The downsides? The global map and its mutexes *may* result in contention at high loads, and you need to call [`context.Clear()`](http://www.gorillatoolkit.org/pkg/context#Clear) at the end of every request (i.e. on each handler). Forget to do that (or wrap your top-level server handler) and you'll open yourself up to a memory leak where old requests remain in the map. If you're writing middleware that uses gorilla/context, then you need to make sure your package user imports context calls `context.ClearHandler` on their handlers/router.

## Per Request map[string]interface

As another take, Goji provides a request context as part of an (optional) handler type that embeds Go's usual http.Handler. Because it's tied to Goji's (fast) router implementation, it no longer needs to be a global map and avoids the need for mutexes.

Goji provides a [web.HandlerFunc](https://github.com/zenazn/goji/blob/master/web/web.go#L109-L128) type that extends the default `http.HandlerFunc` with a request context: `func(c web.C, w http.ResponseWriter, r *http.Request)`.


```go

var ErrTypeNotPresent = errors.New("Expected type not present in the request context.")

// A little simpler: we just need this for every *type* we store.
func GetContextString(c web.C, key string) (string, error) {
	val, ok := c.Env[key].(string)
	if !ok {
		return "", ErrTypeNotPresent
	}

	return val, nil
}

// A bare-bones example
func CSRFMiddleware(c *web.C, h http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		maskedToken, err := GenerateToken(r)
		if err != nil {
			http.Error(w, "No good!", http.StatusInternalServerError)
			return
		}

		// Goji only allocates a map when you ask for it.
        if c.Env == nil {
			c.Env = make(map[string]interface{})
		}

		// Not a global - a reference to the context map
		// is passed to our handlers explicitly.
		c.Env["csrf_token"] = maskedToken

		h.ServeHTTP(w, r)
	}

	return http.HandlerFunc(fn)
}

// Goji's web.HandlerFunc type is an extension of net/http's
// http.HandlerFunc, except it also passes in a request
// context (aka web.C.Env)
func ShowSignupForm(c web.C, w http.ResponseWriter, r *http.Request) {
	// We'll use our helper function so we don't have to type assert
	// the result in every handler.
	csrfToken, err := GetContextString(c, "csrf_token")
	if err != nil {
		http.Error(w, "No good!", http.StatusInternalServerError)
		return
	}

	// We can access this token in every handler we wrap with our
	// middleware. No need to set/get from a session multiple times per
	// request (which is slow!)
	fmt.Fprintf(w, "Our token is %v", csrfToken)
}

```

[Full Example](https://gist.github.com/elithrar/015e2a561eee0ca71a77#file-goji-go)

The biggest immediate gain is the performance improvement, since Goji only allocates a map when you ask it to: there's no global map with locks. Note that for many applications, your database or template rendering will be the bottleneck (by far), so the "real" impact is likely pretty small, but it's a sensible touch. 

Most useful is that you retain the ability to write modular middleware that doesn't need further information about your application: if you want to use the request context, you can do so, but for anything else it's just `http.Handler`. The downside is that you still need to type assert anything you retrieve from the context, although like gorilla/context we can simplify this by writing helper functions. A `map[string]interface{}` also restricts us to string keys: simpler for most (myself included), but potentially less flexible for some.

## Context Structs

A third approach is to initialise a struct per-request and define our middleware/handler as methods on the struct. The big plus here is type-safety: we explicitly define the fields of our request context, and so we know the type (unless we do something naive like setting a field to `interface{}`).

Of course, what you gain in type safety you lose in flexibility. You can't create "modular" middleware that uses the popular `func(http.Handler) http.Handler` pattern, because that middleware can't know what your request context struct looks like. It could provide it's own struct that you embed into yours, but that still doesn't solve re-use: not ideal. Still, it's a good approach: no need to type assert things out of `interface{}`.

```go

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gocraft/web"
)

type Context struct {
	CSRFToken string
	User      string
}

// Our middleware *and* handlers must be defined as methods on our context struct,
// or accept the type as their first argument. This ties handlers/middlewares to our
// particular application structure/design.
func (c *Context) CSRFMiddleware(w web.ResponseWriter, r *web.Request, next web.NextMiddlewareFunc) {
	token, err := GenerateToken(r)
	if err != nil {
		http.Error(w, "No good!", http.StatusInternalServerError)
		return
	}

	c.CSRFToken = token
	next(w, r)
}

func (c *Context) ShowSignupForm(w web.ResponseWriter, r *web.Request) {
	// No need to type assert it: we know the type.
	// We can just use the value directly.
	fmt.Fprintf(w, "Our token is %v", c.CSRFToken)
}

func main() {
	router := web.New(Context{}).Middleware((*Context).CSRFMiddleware)
	router.Get("/signup", (*Context).ShowSignupForm)

	err := http.ListenAndServe(":8000", router)
	if err != nil {
		log.Fatal(err)
	}
}

```

[Full Example](https://gist.github.com/elithrar/015e2a561eee0ca71a77#file-gocraftweb-go)

The plus here is obvious: no type assertions! We have a struct with concrete types that we initialise on every request and pass to our middleware/handlers. But the downside is that we can no longer "plug and play" middleware from the community, because it's not defined on our own context struct.

We could anonymously embed their type into ours, but that starts to become pretty messy and doesn't help if their fields share the same names as our own. The real solution is to fork and modify the code to accept your struct, at the cost of time/effort. gocraft/web also wraps the ResponseWriter interface/Request struct with its own types, which ties things a little more closely to the framework itself.


## How Else?

One suggestion would be to provide a `Context` field on Go's `http.Request` struct, but actually implementing it in a "sane" way that suits the common use case is easier said than done.

The field would likely end up being a `map[string]interface{}` (or with `interface{}` as the key). This means that we either need to initialise the map for users&mdash;which won't be useful on all of those requests where you *don't* need to use the request context. Or require package users to check that the map is initialised before using it, which can be a big "gotcha" for newbies who will wonder (at first) why their application panics on some requests but not others.

I don't think these are huge barriers unto themselves, but Go's strong preference for being clear and understandable&mdash;at the cost of a little verbosity now and then&mdash;is potentially at odds with this approach. I also don't believe that having options in the form of third-party packages/frameworks is a Bad Thing either: you choose the approach that best fits your idioms or requirements.

## Wrap

So which approach should you choose for your own projects? It's going to depend on your use-case (as always). Writing a standalone package and want to provide a request context that the package user can easily access? gorilla/context is probably going to be a good fit (just document the need to call ClearHandler!). Writing something from scratch, or have a net/http app you want to extend easily? Goji is easy to drop in. Starting from nothing? gocraft/web's "inclusive" approach might fit.

Personally, I like Goji's approach: I don't mind writing a couple of helpers to type-assert things I commonly store in a request context (CSRF tokens, usernames, etc), and I get to avoid the global map. It's also easy for me to write middleware that others can plug into their applications (and for me to use theirs). But those are my use cases, so do your research first!
