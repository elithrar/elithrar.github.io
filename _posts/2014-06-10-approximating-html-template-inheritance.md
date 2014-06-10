---
layout: post
title: Approximating html/template Inheritance
categories: go, web
---

Go's [html/template](http://golang.org/pkg/html/template/) package is fairly minimal compared to templating packages associated with other languages (Jinja, Mustache, even Django's templates), although it makes up for this with [security](http://js-quasis-libraries-and-repl.googlecode.com/svn/trunk/safetemplate.html#problem_definition) and great docs.

There are however a few "tricks" to using it: specifically when it comes to approximating template inheritance. Being able to specify a base layout (or layouts), stake out your blocks and then fill those blocks with template snippets isn't immediately clear. So how do we do this?

First, we define `base.tmpl`:

```jinja
{% raw %}
{{ define "base" }}
<html>
<head>
    {{ template "title" . }}
</head>
<body>
    {{ template "scripts" . }}
    {{ template "sidebar" . }}
    {{ template "content" . }}
<footer>
    ...
</footer>
</body>
</html>
{{ end }}
// We define empty blocks for optional content so we don't have to define a block in child templates that don't need them
{{ define "scripts" }}{{ end }}
{{ define "sidebar" }}{{ end }}
{% endraw %}
```

And `index.tmpl`, which effectively extends our base template.

```jinja

{% raw %}
{{ define "title"}}<title>Index Page</title>{{ end }}
// Notice the lack of the script block - we don't need it here.
{{ define "sidebar" }}
    // We have a two part sidebar that changes depending on the page
    {{ template "sidebar_index" }} 
    {{ template "sidebar_base" }}
{{ end }}
{{ define "content" }}
    {{ template "listings_table" . }}
{{ end }}
{% endraw %}

```

Note that we *don't* need to define all blocks in the base layout: we've "cheated" a little by defining them alongside our base template. The trick is ensure that the `{% raw %}{{ define }}{% endraw %}` blocks in the base template are empty. If you define two blocks and *both* have content, the application will panic when it attempts to parse the template files (on startup, most likely). There's no "default" content we can fall back on. It's not a a deal-breaker, but it's worth remembering when writing these out.

In our Go application, we create a map of templates by parsing the base template, any necessary snippets, and the template that extends our base template. This is best done at appication start-up (and panics are okay here) so we can fail early. A web application with broken templates is probably not much of a web application.

It's also critical that we ensure any look-ups on map keys (template names) that don't exist are caught (using the comma-ok idiom): otherwise it's a run-time panic.

```go

import (
    "fmt"
    "html/template"
    "net/http"
    "path/filepath"
)

var templates map[string]*template.Template

// Load templates on program initialisation
func init() {
	if templates == nil {
		templates = make(map[string]*template.Template)
	}

	templatesDir := config.Templates.Path

	layouts, err := filepath.Glob(templatesDir + "layouts/*.tmpl")
	if err != nil {
		log.Fatal(err)
	}

	includes, err := filepath.Glob(templatesDir + "includes/*.tmpl")
	if err != nil {
		log.Fatal(err)
	}

    // Generate our templates map from our layouts/ and includes/ directories
	for _, layout := range layouts {
		files := append(includes, layout)
		templates[filepath.Base(layout)] = template.Must(template.ParseFiles(files...))
	}

}

// renderTemplate is a wrapper around template.ExecuteTemplate.
func renderTemplate(w http.ResponseWriter, name string, data map[string]interface{}) error {
	// Ensure the template exists in the map.
	tmpl, ok := templates[name]
	if !ok {
		return fmt.Errorf("The template %s does not exist.", name)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.ExecuteTemplate(w, "base", data)

	return nil
}

```

We create our templates from a set of template snippets and the base layout (just the one, in our case). We can fill in our `{% raw %}{{ template "script" }}{% endraw %}` block as needed, and we can mix and match our sidebar content as well. If your pages are alike, you can generate this map with a range clause by using a slice of the template names as the keys.

Slightly tangential to this, there's the common problem of dealing with the error returned from `template.ExecuteTemplate`. If we pass the writer to an error handler, it's too late: we've already written (partially) to the response and we'll end up a mess in the user's browser. It'll be part of the page before it hit the error, and then the error page's content. The solution here is to write to a `bytes.Buffer` to catch any errors during the template rendering, and *then* write out the contents of the buffer to the `http.ResponseWriter`.

Although you can create your own buffer per-request, using a pool ([https://github.com/oxtoacart/bpool](https://github.com/oxtoacart/bpool)) reduces allocations and garbage. I benchmarked and profiled a bare approach (as above; write out directly), a 10K fixed buffer per-request (big enough for most of my responses), and a pool of buffers. The pooled approach was the fastest, at 32k req/s vs. the 26k req/s and 29k req/s of the bare and fixed approaches. Latency was no worse than the bare approach either, which is a huge plus.

```go

import (
    "fmt"
    "html/template"
    "net/http"

    "github.com/oxtoacart/bpool"
)

var bufpool *bpool.BufferPool

// renderTemplate is a wrapper around template.ExecuteTemplate.
// It writes into a bytes.Buffer before writing to the http.ResponseWriter to catch
// any errors resulting from populating the template.
func renderTemplate(w http.ResponseWriter, name string, data map[string]interface{}) error {
	// Ensure the template exists in the map.
	tmpl, ok := templates[name]
	if !ok {
		return fmt.Errorf("The template %s does not exist.", name)
	}

	// Create a buffer to temporarily write to and check if any errors were encounted.
	buf := bufpool.Get()
	err := tmpl.ExecuteTemplate(&buf, "base", data)
	if err != nil {
		return err
	}

	// Set the header and write the buffer to the http.ResponseWriter
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	buf.WriteTo(w)
	bufpool.Put(buf)
	return nil
}

func init() {
	...
	bufpool = bpool.NewBufferPool(64)
	...
}

```

We can catch that returned error in our handler and return a HTTP 500 instead.  The best part is that it also makes testing our handlers easier. If you try to take over the http.ResponseWriter with your error handler, you've already sent a HTTP 200 status header, making it much harder to test where things are broken. By writing to a temporary buffer first, we ensure that don't set headers until we're sure the template will render correctly; making testing much simpler.

And that's about it. We have composable templates, we deal with our errors before writing out, and it's still fast.

## Postscript 

* This post was triggered after I [asked the question](http://www.reddit.com/r/golang/comments/27ls5a/including_htmltemplate_snippets_is_there_a_better/) on the /r/golang sub-reddit, which is what prompted me to look at re-using buffers via a pool.
* Credit goes to [this answer on SO](http://stackoverflow.com/a/11468132/556573) for the clever `map[string]*template.Template` approach, and a thanks to [@jonathanbingram](https://twitter.com/jonathanbingram) for the great "optional blocks" trick. 
* I highly suggest reading [Jan Newmarch's html/template tutorial](http://jan.newmarch.name/golang/template/chapter-template.html), which covers `{% raw %}{{ with }}{% endraw %}`, `{% raw %}{{ range . }}{% endraw %}` and `template.Funcs` comprehensively.

