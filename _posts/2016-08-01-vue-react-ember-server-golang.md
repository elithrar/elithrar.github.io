---
layout: post
title: Serving a Vue, React or Ember JavaScript Application with Go.
categories: go, web, programming, javascript
---

It's 2016. You're about to tie together a Popular Front-End JavaScript framework with a web service
written in Go, but you're also looking for a way to have Go serve the static files as well as your
REST API. You want to:

* Serve your `/api/` routes from your Go service
* Also have it serve the static content for your application (e.g. your JS bundle, CSS, assets)
* Any other route will serve the `index.html` entrypoint, so that deep-linking into your JavaScript
  application still works when using a front-end router - e.g.
  [vue-router](https://github.com/vuejs/vue-router),
  [react-router](https://github.com/reactjs/react-router), Ember's routing.

Here's how.

## The Folder Layout

Here's a fairly simple folder layout: we have a simple [Vue.js](https://vuejs.org/) application
sitting alongside a Go service. Our Go's `main()` is contained in `serve.go`, with the datastore
interface and handlers inside `datastore/` and `handlers/`, respectively.

```sh
~ gorilla-vue tree -L 1
.
├── README.md
├── datastore
├── dist
├── handlers
├── index.html
├── node_modules
├── package.json
├── serve.go
├── src
└── webpack.config.js

~ gorilla-vue tree -L 1 dist
dist
├── build.js
└── build.js.map
```

With this in mind, let's see how we can serve `index.html` and the contents of our `dist/`
directory.

> Note: If you're looking for tips on how to structure a Go service, read through
> [@benbjohnson](https://twitter.com/benbjohnson)'s excellent Gophercon 2016
> [talk](http://go-talks.appspot.com/github.com/gophercon/2016-talks/BenJohnson-StructuringApplicationsForGrowth/main.slide#8).

## Serving Your JavaScript Entrypoint.

The example below uses [gorilla/mux](https://github.com/gorilla/mux), but you can achieve this with
vanilla [net/http](https://golang.org/pkg/net/http/) or
[httprouter](https://godoc.org/github.com/julienschmidt/httprouter), too.

The main takeaway is the combination of a catchall route and `http.ServeFile`, which effectively
serves our `index.html` for any unknown routes (instead of 404'ing). This allows something like
`example.com/deep-link` to still run your JS application, letting it handle the route explicitly.

```go
package main

import (
	"encoding/json"
	"flag"
	"net/http"
	"os"
	"time"

	"log"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	var entry string
	var static string
	var port string

	flag.StringVar(&entry, "entry", "./index.html", "the entrypoint to serve.")
	flag.StringVar(&static, "static", ".", "the directory to serve static files from.")
	flag.StringVar(&port, "port", "8000", "the `port` to listen on.")
	flag.Parse()

	r := mux.NewRouter()

    // Note: In a larger application, we'd likely extract our route-building logic into our handlers
    // package, given the coupling between them.

	// It's important that this is before your catch-all route ("/")
	api := r.PathPrefix("/api/v1/").Subrouter()
	api.HandleFunc("/users", GetUsersHandler).Methods("GET")
	// Optional: Use a custom 404 handler for our API paths.
	// api.NotFoundHandler = JSONNotFound

	// Serve static assets directly.
	r.PathPrefix("/dist").Handler(http.FileServer(http.Dir(static)))

	// Catch-all: Serve our JavaScript application's entry-point (index.html).
	r.PathPrefix("/").HandlerFunc(IndexHandler(entry))

	srv := &http.Server{
		Handler: handlers.LoggingHandler(os.Stdout, r),
		Addr:    "127.0.0.1:" + port,
		// Good practice: enforce timeouts for servers you create!
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}

func IndexHandler(entrypoint string) func(w http.ResponseWriter, r *http.Request) {
	fn := func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, entrypoint)
	}

	return http.HandlerFunc(fn)
}

func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"id": "12345",
		"ts": time.Now().Format(time.RFC3339),
	}

	b, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	w.Write(b)
}
```

Build that, and then run it, specifying where to find the files:

```sh
go build serve.go
./serve -entry=~/gorilla-vue/index.html -static=~/gorilla-vue/dist/
```

> You can see an example app [live here](https://gorilla-dashboard.herokuapp.com)

## Summary

That's it! It's pretty simple to get this up and running, and there's already a few 'next steps' we
could take: some useful caching middleware for setting `Cache-Control` headers when serving our
static content or `index.html` or using Go's [html/template](https://golang.org/pkg/html/template/)
package to render the initial `index.html` (adding a CSRF meta tag, injecting hashed asset URLs).

If something is non-obvious and/or you get stuck, reach out [via
Twitter](http://twitter.com/elithrar).
