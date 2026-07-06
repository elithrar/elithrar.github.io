---
layout: post
title: "ArtifactFS: async git clones for sandboxes and agents"
categories: golang, opensource, git, cloudflare
---

This was an idea that came out of left field as we were building [Cloudflare Artifacts](https://workers.cloudflare.com/product/artifacts).

Artifacts is a versioned filesystem that speaks git — built for agent toolchains, sandboxes, and CI/CD systems that need fast access to code. The obvious way to get a repo into a sandbox is `git clone`. That works fine for small repos. It does not work fine when your agent is blocked for minutes (or longer) while a 1GB+ monorepo with millions of objects finishes cloning. You eat wall time and CPU time before the agent can do anything useful.

We wanted the file tree _now_, and the blobs later. [ArtifactFS](https://github.com/cloudflare/artifact-fs) is the FUSE driver we open-sourced to make that happen.

### The blocking clone problem

When you spin up a sandbox — a container, a VM, an agent environment — you typically want code on disk before you can run tests, parse manifests, or let an LLM start reading the tree. A traditional clone is all-or-nothing: commits, trees, refs, _and_ every blob, fetched and written before your startup script can hand off to the agent.

That is fine for a developer laptop. It is painful for short-lived environments where startup time is the bottleneck. Worse, most of what an agent needs early is not the entire object graph. It is `package.json`, `go.mod`, `Cargo.toml`, source files, READMEs — the stuff you reach for when orienting yourself in a codebase. Large binaries, assets, and vendored artifacts can wait.

What if a clone could be async? Grab the file tree, mount it, and hydrate contents in the background.

### A quick example

ArtifactFS is a CLI plus a long-running FUSE daemon. You register a repo, start the daemon, and use the mount like any other directory. The agent does not need to know it is backed by git at all.

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

Reads block only until the specific blob you asked for has been fetched. Everything else continues hydrating in the background. Check progress with `artifact-fs status --name workers-sdk`, or tail the daemon logs if you want to watch hydration events go by.

If you are mounting multiple repos into the same sandbox and want the daemon to prepare them without blocking on ref fetches, pass `--async`:

```bash
artifact-fs add-repo \
  --name workers-sdk \
  --remote https://github.com/cloudflare/workers-sdk.git \
  --branch main \
  --mount-root /tmp \
  --async
```

By default, refs are fetched synchronously (so the file structure is there before you start poking at it) and blobs are async. With `--async`, ref preparation moves into the background too — the cost to opportunistically mount several repos is near-zero.

### How it works

Under the hood, ArtifactFS is a custom FUSE filesystem with a writable overlay.

Setup (`add-repo`) registers the repo and, unless you passed `--async`, runs a blobless clone: `git clone --filter=blob:none`. That fetches commits, trees, and refs without downloading file contents. The daemon indexes the tree with `git ls-tree`, stores the result in a SQLite snapshot, and mounts the working tree via FUSE. A synthesized `.git` gitfile points at the real gitdir, so normal git commands work inside the mount.

When you read a file, the resolver merges the snapshot with any local overlay writes. If the blob is not on disk yet, the hydrator fetches it through a persistent `git cat-file --batch` process, caches it, and streams it to your read. Writes go through copy-on-write into the overlay — create, modify, delete, rename, truncate; the usual filesystem verbs.

A background watcher polls HEAD and refs every 500ms. When the remote moves — fetch, checkout, commit — the daemon re-indexes, publishes a new snapshot generation, and reconciles stale overlay entries. You get a live working tree, not a frozen export.

Importantly, this works with any git remote: an Artifacts repo, GitHub, GitLab, a bare repo you prepared yourself. ArtifactFS is part of the Artifacts product story, but it is not tied to it.

### What is actually novel here?

Partial clones and blobless checkouts are not new. FUSE-backed git filesystems are not new either — we took inspiration from [TigrisFS](https://github.com/tigrisdata/tigrisfs/), [gitfs](https://github.com/presslabs/gitfs), and [SlothFS](https://gerrit.googlesource.com/gitfs/).

The bit that matters for agents is the combination:

- **Tree-first, blob-second.** The OS sees the full directory structure almost immediately. Startup scripts and agents can `ls`, parse manifests, and run `git log` without waiting for a full clone to finish.
- **Agent-first hydration.** The hydrator prioritizes package manifests, dependency files, and text/source ahead of large binary blobs. With some fairly straightforward heuristics, the async part becomes "agent first" — code and text land before assets you probably will not touch in the first few minutes.
- **Transparent to the consumer.** Your sandbox entrypoint runs `artifact-fs add-repo`, starts the daemon, and then executes whatever command the agent would have run against a normal checkout. No special SDK. No "hydration-aware" read API.
- **Writable overlay.** Agents need to edit files, run formatters, and commit. The overlay makes the mount read/write without mutating the underlying git store directly.

That last point is easy to overlook. A read-only FUSE view of git would already be useful for exploration. Agents that fix bugs need to write.

### Building it (and where it is now)

ArtifactFS was the first sizeable, from-scratch project I used AI for in full. What made that workable was not vibes — it was extensive end-to-end tests (git makes this much easier than you might expect), repeated simplification, dictating the API up front, and a benchmark harness so performance regressions were obvious. Shout-out to [@broady](https://twitter.com/broady) for cleanup PRs and for pushing on I/O perf.

We shipped [v1.0.0-rc](https://github.com/cloudflare/artifact-fs/releases) in June. The remaining 1.0 blockers are mostly mileage — real-world use on large repos — and we have since landed fully async ref clones alongside async blobs. The README still says beta; your mileage may vary, but the core path is solid enough that I am comfortable writing about it.

If you are building sandboxes or agent environments where `git clone` is on your critical path, give it a look: [github.com/cloudflare/artifact-fs](https://github.com/cloudflare/artifact-fs). Issues and PRs welcome — read [AGENTS.md](https://github.com/cloudflare/artifact-fs/blob/main/AGENTS.md) first if you are sending code.

Pretty good timing for a filesystem that lets your agents start working near immediately, huh?
