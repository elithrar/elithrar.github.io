---
layout: post
title: "Combining Custom Domains, Go Packages and Jekyll"
categories: golang, versioning, jekyll
---

> **Update:** With Jekyll & GitHub Pages' ability to serve [extensionless
> permalinks](http://jekyllrb.com/docs/permalinks/#extensionless-permalinks), I've updated the article
> to show you how to use your own domain of top of the (ever reliable) [gopkg.in](https://gopkg.in) -
> turning `example.com/repo.v1` into the canonical import URL, but with gopkg.in serving the latest
> tag for you.

Here's a short tutorial on how to combine [GitHub Pages]() and [gopkg.in]() to both *version* and
serve your Go libraries and projects from a vanity import. Think `yourdomain.com/pkgname.v1` instead
of gopkg directly, or `github.com/you/yourproject`. This allows you to vendor your libraries without
having to create multiple repositories, and therefore multiple sets of documentation, issues, and
distinct/confusing import URLs.

Importantly, it works today, is maintainable, and is compatible with those vendoring your library
downstream.

Note: the go-imports tag will be able to specify a branch/revision when [issue
10913](https://github.com/golang/go/issues/10913) is resolved, but users on older versions of Go
won't be able to pull your package down.

## Domain Setup

I'll assume you have your own domain and know enough to point a CNAME or A record
for your domain to a host or IP. If not, [GitHub's
documentation](https://help.github.com/articles/setting-up-a-custom-domain-with-github-pages/)
on this is pretty good, so reach for that if you get stuck.

Once you've set up the [CNAME
file](https://help.github.com/articles/adding-a-cname-file-to-your-repository/)
for your GitHub Pages branch&mdash;usually `gh-pages` or the master branch if you
have a `user.github.io` repository&mdash;you can get started with the rest.

## Creating the Import URL

Assuming a new or existing [Jekyll
installation](http://jekyllrb.com/docs/installation/), create a new layout under
`_layouts` in the root of your Jekyll project:

```sh
$ vim _layouts/imports.html
```

Put the following template into the layout you've just created:

```html
{% raw %}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en-us">
<head>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">

  <!-- Go Imports -->
  <meta name="go-import" content="{{ page.go-import }}">
  <meta name="go-source" content="{{ page.go-source }}">
  <meta http-equiv="refresh" content="0; {{ page.redirect }}">

</head>
<body>
</body>
</html>
{% endraw %}    
```

We've also added a 'go-source' `<meta>` tag so that
[GoDoc](https://github.com/golang/gddo/wiki/Source-Code-Links) knows where to
fetch our API documentation from, and a re-direct so that anyone hitting that
page in the browser is re-directed to GoDoc. You could alternatively
have this re-direct to the domain itself, the GitHub repo or no-where at all.

We'll also need to configure our Jekyll installation to use [extensionless
permalinks](http://jekyllrb.com/docs/permalinks/#extensionless-permalinks) in `_config.yml`:

```sh
vim _config.yml

# Site settings
title: 'your project'
tagline: 'Useful X for solving Y'
baseurl: "/" 
permalink:  "/:title"
```

Once you've done this, create a `pkgname.vN.html` file at (e.g.) root of your Jekyll project: e.g.
`pkgname.v1.html`. Future versions 


```sh
# GitHub Pages + Jekyll 3.x can serve this as example.com/pkgame.v1 without the extension.
$ vim pkgname.v1.html
```

Now you can configure the template&mdash;this is the one you'll re-use for future
versions or other packages you create.

```html
{% raw %}
---
layout: imports

go-import: "example.com/pkgname.v1 git https://gopkg.in/someuser/pkgname.v1"
go-source: 
    > 
      example.com/pkgname.v1
      _
      https://github.com/someuser/pkgname/tree/v1{/dir}
      https://github.com/someuser/pkgname/blob/v1{/dir}/{file}#L{line}

redirect: "https://godoc.org/example.com/pkgname.v1"
---
{% endraw %}
```

Commit that and push it to your GitHub Pages repository, and users can now import
your package via `go get -u example.com/pkgname.v1` (and eventually, a v2!).

## Canonical Import Paths

Go 1.4 also introduced [canonical import
paths](https://golang.org/doc/go1.4#canonicalimports), which ensure that the
package is imported using the canonical path (read: our new custom domain)
instead of the underlying repository, which can cause headaches later due to
duplicate imports and/or a lack of updates (if you change the underlying repo).
Thankfully, this is easy enough to fix&mdash;add the canonical path alongside
your package declarations:

```go
package mypkg // import example.com/pkgname.v1
```

Users can't 'accidentally' import `github.com/you/mypkg` now (it won't compile).

## Notes

As a final note, doing all of this is much easier with a new project or library. You *can*
move an existing repository over to a custom domain, but existing users on the
old import path may run into issues. Make sure to document it well!


