---
layout: post
title: "An APFS volume for development on macOS"
date: 2026-10-17 00:00:00 +0000
categories: macos, apfs, tools
---

macOS logs filesystem changes through `fseventsd` and indexes files for Spotlight. Git checkouts can rewrite thousands of files, and each new [worktree](https://git-scm.com/docs/git-worktree) has its own working copy. For example, three full worktrees of a 10,000-file repository contain 30,000 checked-out files, even though they share Git’s object database. Dependencies, build output and agent-generated logs & test artifacts add more files. Running agents in parallel gives macOS more changes to process, using CPU and disk I/O on directories you might delete an hour later.

[fforres ran into this with parallel coding agents](https://x.com/fforres/status/2110806374544523559). Excluding his projects from Spotlight hadn’t been enough. His [follow-up](https://x.com/fforres/status/2110883187920617472) described moving them to a separate volume and disabling indexing and event logging there.

I wanted the same setup without reserving a fixed amount of disk space or changing how my tools access my repositories. I put together [repos-volume.sh](https://github.com/elithrar/dotfiles/blob/main/repos-volume.sh), which creates an APFS volume at `~/repos`. I keep my Codex worktrees & generated artifacts there too, as [I described here](https://x.com/elithrar/status/2111461035152662911).

APFS volumes [share free space within their container](https://support.apple.com/en-tj/guide/disk-utility/dskua9e6a110/mac). The new volume uses space as needed alongside existing volumes, so there’s no partition size to guess upfront.

Here are the relevant commands from the script. Container lookup, UUID discovery and validation are omitted:

```bash
repos=$HOME/repos

sudo diskutil apfs addVolume "$container" APFS "$label" -nomount

# After discovering the UUID and preparing the mountpoint:
sudo diskutil mount nobrowse -mountOptions owners -mountPoint "$repos" "$volume_uuid"

sudo mkdir -p "$repos/.fseventsd"
log=$repos/.fseventsd/no_log
if ! sudo test -e "$log"; then sudo touch "$log"; fi

sudo mdutil -i off "$repos"
```

We create the volume inside the existing APFS container. The `-nomount` option lets the script record its UUID and prepare `~/repos` before mounting it. A UUID-based `/etc/fstab` entry makes subsequent mounts use the same directory.

The `nobrowse` option keeps the volume out of Finder’s normal volume listing. You can still open `~/repos` directly, including with `Cmd+Shift+G`. The `owners` option keeps filesystem ownership enforcement enabled.

The empty `.fseventsd/no_log` file [disables persistent event logging for the volume](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/FileSystemEventSecurity/FileSystemEventSecurity.html). It doesn’t stop `fseventsd` or all live file notifications. `mdutil -i off` separately disables Spotlight indexing.

Use the full script for setup. It checks the volume’s identity and refuses to mount over a populated `~/repos`. It currently creates an unencrypted volume. Check your backup tooling before relying on a volume without persistent event history.

This leaves `fseventsd` and Spotlight running normally for the rest of the machine. You can apply the same approach to other top-level directories by creating additional APFS volumes. Each can have its own indexing and logging settings.
