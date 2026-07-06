---
layout: post
title: "ArtifactFS: async git clones for sandboxes and agents"
categories: golang, opensource, git, cloudflare
---

This was an idea that came out of left field as we were building [Cloudflare Artifacts](https://workers.cloudflare.com/product/artifacts).

[Artifacts](https://workers.cloudflare.com/product/artifacts) is a versioned filesystem that speaks git, and we built it for agent toolchains, sandboxes, and CI/CD systems that need fast access to code repositories. The obvious way to get a repo into a sandbox is `git clone`, and that works fine for small repos. It stops being fine when you're waiting on a 1GB+ monorepo with millions of objects to finish cloning before your agent can do anything useful. You eat wall time and CPU time, and in a short-lived environment that's a poor trade.

The idea we landed on was pretty simple: what if a clone could be async? Grab the file tree, mount it, and hydrate file contents in the background. [ArtifactFS](https://github.com/cloudflare/artifact-fs) is the FUSE driver we open-sourced to do exactly that.

### Where `git clone` falls down

When you spin up a sandbox (a container, a VM, an agent environment), you typically want code on disk before you can run tests, parse manifests, or let an LLM start reading the tree. A traditional clone is all-or-nothing: commits, trees, refs, and every blob, fetched and written before your startup script can hand off to the agent. That's fine for a developer laptop, but it's painful for short-lived environments where startup time is the bottleneck.

Worse, most of what an agent needs early isn't the entire object graph. It's `package.json`, `go.mod`, `Cargo.toml`, source files, READMEs: the stuff you reach for when orienting yourself in a codebase. Large binaries, assets, and vendored artifacts can wait.

### Trying it out

ArtifactFS is a CLI plus a long-running FUSE daemon. You register a repo, start the daemon, and use the mount like any other directory. The agent doesn't need to know it's backed by git at all.

```bash
export ARTIFACT_FS_ROOT="$HOME/.artifact-fs"

artifact-fs add-repo \
  --name workers-sdk \
  --remote https://github.com/cloudflare/workers-sdk.git \
  --branch main \
  --mount-root /tmp

artifact-fs daemon --root /tmp &

# The tree is visible almost immediately
ls /tmp/workers-sdk/
cat /tmp/workers-sdk/README.md
git -C /tmp/workers-sdk log --oneline -5
```

Reads block only until the specific blob you asked for has been fetched, and everything else continues hydrating in the background. Check progress with `artifact-fs status --name workers-sdk`, or tail the daemon logs if you want to watch hydration events go by.

If you're mounting multiple repos into the same sandbox and want the daemon to prepare them without blocking on ref fetches, pass `--async`:

```bash
artifact-fs add-repo \
  --name workers-sdk \
  --remote https://github.com/cloudflare/workers-sdk.git \
  --branch main \
  --mount-root /tmp \
  --async
```

By default, refs are fetched synchronously (so the file structure is there before you start poking at it) and blobs are async. With `--async`, ref preparation moves into the background too, and the cost to opportunistically mount several repos is near-zero.

### How it works

ArtifactFS is, under the hood, a custom FUSE filesystem with a writable overlay on top. I think that's the important bit: your agent doesn't need to know anything about the implementation. It just sees a normal directory.

When you run `artifact-fs add-repo`, it registers the repo and (unless you passed `--async`) runs a blobless clone via `git clone --filter=blob:none`. That fetches commits, trees, and refs without downloading file contents. The daemon indexes the tree with `git ls-tree`, stores the result in a SQLite snapshot, and mounts the working tree via FUSE. A synthesized `.git` gitfile points at the real gitdir, so normal git commands work inside the mount.

When you read a file, the resolver merges the snapshot with any local overlay writes. If the blob isn't on disk yet, the hydrator fetches it through a persistent `git cat-file --batch` process, caches it, and streams it to your read. Writes go through copy-on-write into the overlay (create, modify, delete, rename, truncate; the usual filesystem verbs). A background watcher polls HEAD and refs every 500ms, and when the remote moves (fetch, checkout, commit), the daemon re-indexes, publishes a new snapshot generation, and reconciles stale overlay entries. You get a live working tree, not a frozen export.

> Worth noting: this works with any git remote, whether an Artifacts repo, GitHub or GitLab. ArtifactFS is part of the Artifacts product story, but it isn't tied to it.

### What's actually new?

I'll be honest: partial clones and blobless checkouts aren't new, and neither are FUSE-backed git filesystems. We took inspiration from [TigrisFS](https://github.com/tigrisdata/tigrisfs/), [gitfs](https://github.com/presslabs/gitfs), and [SlothFS](https://gerrit.googlesource.com/gitfs/). What's different (for agent use-cases, at least) is putting a few things together that we cared about when building sandboxes.

The OS sees the full directory structure almost immediately, while blob contents hydrate on demand in the background. With some fairly straightforward heuristics (code and text first, binary formats last), you can even make the async part "agent first": package manifests and source land before assets you're unlikely to touch in the first few minutes. Your sandbox entrypoint runs `artifact-fs add-repo`, starts the daemon, and then executes whatever command the agent would have run against a normal checkout. No special SDK, and no hydration-aware read API.

The writable overlay matters more than it might seem. A read-only FUSE view of git would already be useful for exploration, but agents that fix bugs need to edit files, run formatters, and commit. The overlay makes the mount read/write without mutating the underlying git store directly.

### Building it

ArtifactFS was the first sizeable, from-scratch project I used AI for in full. What made that workable wasn't vibes: it was extensive end-to-end tests (git makes this much easier than you might expect), repeated simplification, dictating the API up front, and a benchmark harness so performance regressions were obvious. Shout-out to [@broady](https://twitter.com/broady) for cleanup PRs and for pushing on I/O perf.

We shipped [v1.0.0-rc](https://github.com/cloudflare/artifact-fs/releases) in June. The remaining 1.0 blockers are mostly mileage (real-world use on large repos), and we've since landed fully async ref clones alongside async blobs. The README still says beta, and your mileage may vary, but the core path is solid enough that I'm comfortable writing about it.

If you're building sandboxes or agent environments where `git clone` is on your critical path, give it a look: [github.com/cloudflare/artifact-fs](https://github.com/cloudflare/artifact-fs). Issues and PRs welcome. Read [AGENTS.md](https://github.com/cloudflare/artifact-fs/blob/main/AGENTS.md) first if you're sending code.

Pretty good, huh?
