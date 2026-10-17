---
layout: post
title: "A separate APFS volume for development on macOS"
date: 2026-10-17 00:00:00 +0000
categories: macos, apfs, tools
---

Disabling Spotlight indexing for your repositories doesn’t stop macOS from logging filesystem changes. [fforres had already excluded his development folders from Spotlight](https://x.com/fforres/status/2110806374544523559), but `fseventsd` was still busy after days of running coding agents.

There are two separate sources of overhead here. `fseventsd` collects filesystem changes and maintains an on-disk history. Spotlight’s metadata services read eligible files, extract metadata and update their search indexes. Both use CPU and disk I/O beyond the work your build or test runner is doing. The logs and indexes also occupy disk space.

One [diagnostic report from an M3 Pro running coding agents](https://github.com/talkstream/fseventsd-runaway) recorded `fseventsd` growing to 24 GB of process memory and consuming 97–98% of one CPU core for roughly two days. That was a runaway daemon, with an unproven trigger. It isn’t a benchmark for this setup, but it’s a good reason to check what’s consuming resources before blaming the compiler.

Inspired by [fforres’ dedicated-volume follow-up](https://x.com/fforres/status/2110883187920617472), I put together a [Bash script](https://github.com/elithrar/dotfiles/blob/main/repos-volume.sh) to mount a separate APFS volume at `~/repos`. As [I described here](https://x.com/elithrar/status/2111461035152662911), it holds my repositories, Codex worktrees & generated artifacts, with Spotlight indexing and persistent FSEvents logging disabled for that volume.

## Creating the volume

APFS volumes [share available space within their container](https://support.apple.com/en-tj/guide/disk-utility/dskua9e6a110/mac). We don’t need to reserve 100 GB upfront or resize a partition later. Applications still access `~/repos` through the same path.

These are the relevant lines from the script. Container discovery, UUID lookup and safety checks are omitted, so use the full script for setup.

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

The script discovers the startup Data volume’s APFS container rather than assuming a disk number. `-nomount` prevents an immediate mount while we record the new volume’s UUID and prepare its destination.

`nobrowse` keeps the volume out of normal Finder browsing. You can still open it with Go to Folder. `owners` enables ownership enforcement. A UUID-based `/etc/fstab` entry preserves the mountpoint and `rw,nobrowse,owners` options across later mounts.

The empty `.fseventsd/no_log` file is [Apple’s documented per-volume opt-out](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/FileSystemEventSecurity/FileSystemEventSecurity.html) for persistent event logging. It doesn’t stop the daemon or disable all live notifications. `mdutil -i off` separately disables Spotlight indexing on the mounted volume.

## What to keep in mind

I don’t have a controlled before/after benchmark for this script. CPU utilization, bytes written and retained disk space measure different things. I wouldn’t assign a percentage speedup or storage saving without measuring the same workload on both configurations.

The helper refuses to mount over a populated `~/repos`. Existing repositories need an explicit migration. It also currently creates an unencrypted volume, which doesn’t inherit FileVault protection from the startup volume. Check your backup tooling’s behavior without persistent event history.

For my development directories, this is preferable to disabling `fseventsd` or Spotlight system-wide. My other files keep their normal search and event-history behavior. You can create additional volumes for other top-level directories with different settings. They’ll share the same free space, so remember that filling one can still fill the disk.
