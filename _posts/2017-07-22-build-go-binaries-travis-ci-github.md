---
layout: post
title: Automatically Build Go Binaries via TravisCI & GitHub
categories: programming, tools, go
---

GitHub has a great [Releases](https://help.github.com/articles/about-releases/) feature that allows you surface—and users to download—tagged releases of your projects.

By default, Releases will provide links to a ZIP and a tarball of the source code for that tag. But for projects with binary releases, manually building and then uploading binaries (perhaps for multiple platforms!) is time-consuming and fragile. Making binary releases available automatically is great for the users of a project too: they can use it without having to deal with toolchains (e.g. installing Go) and environments. Making software usable by non-developer is an important goal for many projects.

We can use [TravisCI](https://travis-ci.org/) + GitHub Releases to do all of the work for us with a fairly straightforward configuration, so let's take a look at how to release Go binaries automatically.

## Configuration

Here's the full .travis.yml from a small utility library I wrote at my day job. This will:

- Always build on the latest Go version - "go: 1.x" and sets an env variable. We'll use this to only build binaries using the latest Go version.
- Build as far back as 1.5
- Builds, but doesn't fail the entire run, on "tip" (e.g. Go's master branch, which breaks from time-to-time)

It then runs a fairly straightforward build script using Go's existing tooling: gofmt (style), go vet (correctness), and then any tests with the race detector enabled.

The final step—and the reason why you're probably reading this post!—is invoking [gox](https://github.com/mitchellh/gox) to build binaries for Linux, Darwin (macOS) & Windows, and setting the "Rev" variable to the git commit it was built from. The latter is super useful for debugging or supporting users when combined with a --version command-line flag. We also only release on tagged commits via tags: true  so that we're only releasing binaries with intent. Tests are otherwise automatically run on every branch (inc. Pull Requests).

```
language: go
sudo: false
matrix:
  include:
    - go: 1.x
      env: LATEST=true
    - go: 1.5
    - go: 1.6
    - go: 1.7
    - go: tip
  allow_failures:
    - go: tip

before_install:
  - go get github.com/mitchellh/gox

install:
  - # skip

script:
  - go get -t -v ./...
  - diff -u <(echo -n) <(gofmt -d .)
  - go vet $(go list ./... | grep -v /vendor/)
  - go test -v -race ./...
  # Only build binaries from the latest Go release.
  - if [ "${LATEST}" = "true" ]; then gox -os="linux darwin windows" -arch="amd64" -output="logshare.{{.OS}}.{{.Arch}}" -ldflags "-X main.Rev=`git rev-parse --short HEAD`" -verbose ./...; fi

deploy:
  provider: releases
  skip_cleanup: true
  api_key:
    secure: wHqq6Em56Dhkq4GHqdTXfNWB1NU2ixD0/z88Hu31MFXc+Huz5p6np0PUNBOvO9jSFpSzrSGFpsD5lkExAU9rBOI9owSRiEHpR1krIFbMmCboNqNr1uXxzxam9NWLgH8ltL2LNX3hp5teYnNpE4EhIDsGqORR4BrgXfH4eK7mvj/93kDRF2Wxt1slRh9VlxPSQEUxJ1iQNy3lbZ6U2+wouD8TaaJFgzPtueMyyIj2ASQdSlWMRyCVXJPKKgbRd5jLo2XHAWmmDb9mC8u8RS5QlB1klJjGCOl7gNC0KHYknHk6sUVpgIdnmszQBdVMlrZ6yToFDSFI28pj0PDmpb3KFfLauatyQ/bOfDoJFQQWgxyy30du89PawLmqeMoIXUQoA8IWF3nl/YhD+xsLCL1UH3kZdVZStwS/EhMcKqXBPn/AFi1Vbh7m+OMJAVvZp3xnFDe/H8tymczOWy4vDnyfXZQagLMsTouS/SosCFjjeL/Rdz6AEcQRq5bYAiQBhjVwlobNxZSMXWatNSaGz3z78dPEx9qfHnKixmBTacrJd6NlBhWH1kvg1c7TT2zlPxt6XTtsq7Ts/oKNF2iXXhw8HuzZv1idCiWfxobdajZE3EY+8akR060ktT4KEgRmCC/0h6ncPVT0Vaba1XZvbjlraol/p3tswXgGodPsKL87AgM=
  file:
  - logshare.windows.amd64.exe
  - logshare.darwin.amd64
  - logshare.linux.amd64
  on:
    repo: cloudflare/logshare
    tags: true
    condition: $LATEST = true
```

> Note: It's critical that you [follow TravisCI's documentation](https://docs.travis-ci.com/user/deployment/releases/#Authenticating-with-an-OAuth-token) on how to securely encrypt your API key—e.g. don't paste your raw key into this file, ever. TravisCI's documentation and CLI tool make this straightforward.

## Wrap

Pretty easy, right? If you're already using Travis CI to test your Go projects, extending your configuration to release binaries on tagged versions is only a few minutes of work.

## Further Reading

- In the wild: [https://github.com/cloudflare/logshare]
- Go on Travis: [https://docs.travis-ci.com/user/languages/go/]
- GitHub Releases Uploading: [https://docs.travis-ci.com/user/deployment/releases/]
