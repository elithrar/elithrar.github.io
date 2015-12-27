---
layout: post
title: "Combining Custom Domains, Go Packages and Jekyll"
categories: golang, versioning, jekyll
---

Here's a short demonstration on how to combine [GitHub
Pages](https://pages.github.com) (Jekyll) and Go's [remote import
paths](https://golang.org/cmd/go/#hdr-Remote_import_paths) to provide a simple
and reliable way to use your own domain ("vanity domain") as an import path for
your Go libraries and projects.

I wanted a way to host simple pages with the requisite go-imports `<meta>` tag
and a re-direct to the documentation site without requiring me to run a server
process somewhere. This was primarily driven by the desire to start versioning
some of my packages beyond just git tags, so that I can make breaking API changes
without causing current users significant headache. I also wanted to avoid having
to avoid running separate repositories, but the go-imports tag won't be able to
specify a branch/revision until [issue
10913](https://github.com/golang/go/issues/10913) is resolved. The approach also
had to be friendly for users of the `go get` tool and `/vendor` directory alike.

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

Create a new layout under `_layouts` in the root of your Jekyll project:

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

Once you've done this, you can create a directory/URL structure that meets your
requirements. In our case, we want it to be `example.com/v1/pkgname`, as it
allows us the increment the version number and retains the package name as the
last part of the import URL (a user-friendly idiom).

```sh
$ mkdir -p v1/pkgname
# By making this `index.html` the URL can be presented as
# 'example.com/v1/pkgname/' without needing to mention the filename explicitly. 
$ vim v1/pkgname/index.html
```

Now you can configure the template&mdash;this is the one you'll re-use for future
versions or other packages you create.

We've also added a 'go-source' `<meta>` tag so that
[GoDoc](https://github.com/golang/gddo/wiki/Source-Code-Links) knows where to
fetch our API documentation from, and a re-direct so that anyone hitting that
page in the browser can be re-directed to the root site. You could alternatively
have this re-direct to GoDoc, the GitHub repo or no-where at all.

```html
{% raw %}
---
layout: imports

go-import: "example.com/v1/pkgname git https://github.com/elithrar/some-repo"
go-source: 
    > 
      example.com/v1/pkgname
      https://github.com/elithrar/some-repo/
      https://github.com/elithrar/some-repo/tree/master{/dir}
      https://github.com/elithrar/some-repo/blob/master{/dir}/{file}#L{line}

redirect: "https://example.com/"
---
{% endraw %}
```

## Canonical Import Paths

Go 1.4 also introduced [canonical import
paths](https://golang.org/doc/go1.4#canonicalimports), which ensure that the
package is imported using the canonical path (read: our new custom domain)
instead of the underlying repository, which can cause headaches later due to
duplicate imports and/or a lack of updates (if you change the underlying repo).
Thankfully, this is easy enough to fix&mdash;add the canonical path alongside
your package declarations:

```go
package mypkg // import example.com/v1/mypkg
```

Users can't 'accidentally' import `github.com/you/mypkg` now (it won't compile).

## Notes

As a final note, doing all of this is much easier with a new project or library. You *can*
move an existing repository over to a custom domain, but existing users on the
old import path may run into issues. Make sure to document it well!


