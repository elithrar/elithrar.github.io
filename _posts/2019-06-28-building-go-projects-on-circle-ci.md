---
layout: post
title: Building Go Projects on CircleCI
categories: golang, ci, testing, opensource
---

If you follow me on [Twitter](https://twitter.com/elithrar), you would have noticed I was looking to migrate the [Gorilla Toolkit](http://github.com/gorilla) from TravisCI to [CircleCI](http://circleci.com) as our build-system-of-choice after they were bought out & [fired a bunch of senior engineers](https://twitter.com/ReinH/status/1098663375985229825). We'd been using TravisCI for a while, appreciated the simple config, but realized it was time to move on.

I also spent some time validating [a few options](https://twitter.com/elithrar/status/1098940527527878657) (Semaphore, BuildKite, Cirrus) but landed on CircleCI for its popularity across open-source projects, relatively sane (if a little large) config API, and deep GitHub integration.

### Requirements

I had two core requirements I needed to check off:

1. The build system should make it easy to build multiple Go versions from the same config: our packages are widely used by a range of different Go programmers, and have been around since the early Go releases. As a result, we work hard to support older Go versions (where possible) and use build tags to prevent newer Go APIs from getting in the way of that.

2. Figuring out what went wrong should be easy: a sane UI, clear build/error logs, and deep GitHub PR integration so that a contributor can be empowered to debug their own failing builds. Overall build performance falls into this too: faster builds make for a faster feedback loop, so a contributor is more inclined to fix it _now_.

### The Config

Without further ado, here's what the current (June, 2019) `.circleci/config.yml` looks like for [gorilla/mux](https://github.com/gorilla/mux) - with a ton of comments to step you through it.

```yaml
version: 2.0

jobs:
  # Base test configuration for Go library tests Each distinct version should
  # inherit this base, and override (at least) the container image used.
  "test": &test
    docker:
      - image: circleci/golang:latest
    working_directory: /go/src/github.com/gorilla/mux
    steps: &steps
      # Our build steps: we checkout the repo, fetch our deps, lint, and finally
      # run "go test" on the package.
      - checkout
      # Logs the version in our build logs, for posterity
      - run: go version
      - run:
          name: "Fetch dependencies"
          command: >
            go get -t -v ./...
      # Only run gofmt, vet & lint against the latest Go version
      - run:
          name: "Run golint"
          command: >
            if [[ "${LATEST}" = true ] && [ -z "${SKIP_GOLINT}" ]]; then
              go get -u golang.org/x/lint/golint
              golint ./...
            fi
      - run:
          name: "Run gofmt"
          command: >
            if [[ "${LATEST}" = true ]]; then
              diff -u <(echo -n) <(gofmt -d -e .)
            fi
      - run:
          name: "Run go vet"
          command:  >
            if [[ "${LATEST}" = true ]]; then
              go vet -v ./...
            fi
      - run: go test -v -race ./...

  "latest":
    <<: *test
    environment:
      LATEST: true

  "1.12":
    # This is the neat trick: the <<: *test references the, well, &test reference
    # we created above. If we want to override any sub-object, we just need to supply
    # that object, and not copy+paste the entire object (at risk of typo, or misconfig)
    <<: *test
    docker:
      - image: circleci/golang:1.12

  "1.11":
    <<: *test
    docker:
      # Version tags here fetch the latest Go patch release by default
      # e.g. "golang:1.11" fetches 1.11.11 automatically.
      - image: circleci/golang:1.11

  "1.10":
    <<: *test
    docker:
      - image: circleci/golang:1.10

  "1.9":
    <<: *test
    docker:
      - image: circleci/golang:1.9

  "1.8":
    <<: *test
    docker:
      - image: circleci/golang:1.8

  "1.7":
    <<: *test
    docker:
      - image: circleci/golang:1.7

workflows:
  version: 2
  build:
    jobs:
      # Self-explanatory: we run all of our builds. We could potentially
      # add a "requires: latest" to the specific version tags, if we wanted to
      # attempt to build latest first (only).
      - "latest"
      - "1.12"
      - "1.11"
      - "1.10"
      - "1.9"
      - "1.8"
      - "1.7"
 ```
 
Pretty straightforward, huh? We define a base job configuration, create a reference for it at `&test`, and then refer to that reference with `<<: *test` and just override the bits we need to (Docker image URL, env vars) without having to repeat ourselves.

By default, the `jobs` in our `workflows.build` list run in parallel, so we don't need to do anything special there. A workflow with sequential build steps can set a `requires` value to indicate the jobs that must run before it ([docs](https://circleci.com/docs/2.0/workflows/#sequential-job-execution-example)).

> Note: If you're interested in what the previous TravisCI config looked like vs. the new CircleCI config, [see here](https://gist.github.com/elithrar/4fa799c66b2c9932ac33f450f0787a58).

### Go Modules?

If you have a project defined as a Go [Module](https://github.com/golang/go/wiki/Modules) - that is, there's a `go.mod` present - then you can make a couple of minor adjustments to the Job definition:

```yaml
    # Setting the env var will allow the rest of the Go toolchain to
    # correctly enable Module support
    environment:
      GO111MODULE: "on"
    steps: &steps
      - checkout
      - run: go version
      - run:
          name: "Fetch dependencies"
          command: >
            go mod download
      - run: # Rest of the steps here...

  "latest":
    <<: *test-and-build
    environment:
      LATEST: "true"
      # Since we re-define the "environment" here, we need to add "GO111MODULE=on" back
      GO111MODULE: "on"

  "1.12":
    <<: *test-and-build
    docker:
      - image: circleci/golang:1.12
```

If you're also vendoring dependencies with `go mod vendor`, then you'll want to make sure you pass the `-mod=vendor` flag to `go test` or `go build` [as per the Module docs](https://github.com/golang/go/wiki/Modules#how-do-i-use-vendoring-with-modules-is-vendoring-going-away).

### Other Tips

A few things I discovered along the way:

* Building from forks is _not enabled_ by default - e.g. when a contributor (normally) submits a PR from their fork. You'll need to [turn it on explicitly](https://circleci.com/docs/2.0/oss/#build-pull-requests-from-forked-repositories).
* Enable [GitHub Checks](https://circleci.com/docs/2.0/enable-checks/) to get deeper GitHub integration and make it easier to see build status from within the Pull Request UI itself ([example](https://github.com/gorilla/mux/pull/491/checks)).
* Updating the CI config on 10+ projects is not fun, and so I [wrote a quick Go program](https://gist.github.com/elithrar/3bf2e3bd60292e71d3b735cdab06cc78) that templates the `config.yml` and generates it for the given list of repos.

In the end, it took a couple of days to craft a decent CircleCI config (see: large API surface), but thankfully the CircleCI folks were pretty helpful on that front. I'm definitely happy with the move away from Travis, and hopefully our contributors are too!
