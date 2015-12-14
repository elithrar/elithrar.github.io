---
layout: post
title: "Preventing Cross-Site Request Forgery in Go"
categories: golang, web, csrf, security
---

Cross-Site Request Forgery (CSRF) is probably one of the most common browser-based attacks on the web. In short, an attacker's site 'tricks' a user into performing an action on your site using the user's existing session. Often this is disguised as an innocuous-looking link/button, and without any way to validate that the request is occurring "cross-site", a user might end up adding an attacker's email address to their account, or transferring currency to them.

If you're coming from a large *framework* in another language—you might have CSRF protection enabled by default. Since Go is a language and not a web framework, there's a little legwork we'll need to do to secure our own applications in the same manner. I contributed the [gorilla/csrf](http://gorillatoolkit.org/pkg/csrf) package to the Gorilla Project (a collection of useful HTTP libs for Go), so we'll use that.

## Adding CSRF Protection

The example below provides a minimal (but practical) example of how to add CSRF protection to a Go web application:

```go
package main

import (
    "net/http"

    // Don't forget to `go get github.com/gorilla/csrf`
    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    r.HandleFunc("/signup", ShowSignupForm)
    // All POST requests without a valid token will return HTTP 403 Forbidden.
    r.HandleFunc("/signup/post", SubmitSignupForm)

    CSRF := csrf.Protect([]byte("32-byte-long-auth-key"))
    // PS: Don't forget to pass csrf.Secure(false) if you're developing locally
    // over plain HTTP (just don't leave it on in production).
    log.Fatal(http.ListenAndServe(":8000", CSRF(r)))
}

func ShowSignupForm(w http.ResponseWriter, r *http.Request) {
    // signup_form.tmpl just needs a {{ .csrfField }} template tag for
    // csrf.TemplateField to inject the CSRF token into. Easy!
    t.ExecuteTemplate(w, "signup_form.tmpl", map[string]interface{
        csrf.TemplateTag: csrf.TemplateField(r),
    })
}

func SubmitSignupForm(w http.ResponseWriter, r *http.Request) {
    // We can trust that requests making it this far have satisfied
    // our CSRF protection requirements.
}
```

With the above we get:

* Automatic CSRF protection on all non-idempotent requests (effectively anything that's not a GET, HEAD, OPTIONS or TRACE)
* A token available in the request context for us to inject into our responses
* A useful template helper via `csrf.TemplateField` that replaces a `{% raw %}{{.csrfField}}{% endraw %}` template tag with a hidden input field containing the CSRF token for you

## JavaScript Clients

Alternatively, if your Go application is the backend for a React, Ember or other client-side JavaScript application, you can render the token in a `<meta>` tag in the head of your `index.html` template (i.e. the entry point of your JS application) provided your Go application is rendering it. Your JavaScript client can then get the token from this tag and return it via the `X-CSRF-Token` header when making AJAX requests.

Here’s a quick demo, with the HTML template representing your `index.html` template first:

```html
<head>
     ...
     {% raw %}<meta name=“gorilla.csrf.Token” content=“{{.csrfToken}}”>{% endraw %}
     ...
</head>
```

… and in your JS code:

```javascript
// Using the the https://github.com/github/fetch polyfill
fetch(‘/auth/login', {
  method: 'post',
  headers: {
     // Vanilla, unadorned JavaScript
     ‘X-CSRF-Token’: document.getElementsByTagName(“meta”)[“gorilla.csrf.Token”].getAttribute(“content”)
  },
  body: new FormData(loginForm)
})
```

If you’re using jQuery, an [AJAX prefilter](http://api.jquery.com/jquery.ajaxprefilter/) is well-suited to this task—pass the header name & token to `xhr.setRequestHeader` inside your prefilter to automatically add the CSRF token header to every request.

## How Does It Work?

The CSRF prevention approach used here is kept simple, and uses the proven [double-submitted cookie](https://www.owasp.org/index.php/Cross-Site_Request_Forgery_(CSRF)_Prevention_Cheat_Sheet#Double_Submit_Cookies) method. This is similar to the approach used by [Django](https://docs.djangoproject.com/en/dev/ref/csrf/) and [Rails](https://github.com/rails/rails/blob/master/actionpack/lib/action_controller/metal/request_forgery_protection.rb), and relies on comparing the cookie value with the submitted form value (or HTTP header value, in the case of AJAX).

gorilla/csrf also attempts to mitigate the [BREACH attack](http://breachattack.com/) (in short: detecting secrets through HTTP compression) by randomizing the CSRF token in the response.
This is done by XOR'ing the CSRF token against a randomly generated nonce (via Go's `crypto/rand`) and creating a 'masked' token that effectively changes on every request. The nonce is then appended to the XOR output - e.g. `$maskedtoken$nonce` - and used to XOR the masked token (reversing it) on the next request. Since underlying token used for comparison (stored in a signed cookie) doesn't change, which means that this approach doesn't break user experience across multiple tabs.

An XOR operation is used over a hash function or AES primarily for performance, but also because the mitigation is provided by making our secrets unpredictable across requests at large.

## What Next?

I’ve pushed a slightly updated version of gorilla/csrf—see [the branch here](https://github.com/goji/csrf/tree/csrf-v2-net-context) over on the goji/csrf repo that leverages [`net/context`](https://golang.org/x/net/context) instead of [`gorilla/context`](http://www.gorillatoolkit.org/pkg/context). 

`context.Context` is quickly becoming the de-facto way to pass request-scoped values in Go HTTP applications and is [likely to be incorporated](https://groups.google.com/d/msg/golang-dev/cQs1z9LrJDU/YlUhWAPZCQAJ) into `net/http` with Go 1.7, but there's little stopping you from adopting it now.


