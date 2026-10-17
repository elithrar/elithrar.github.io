---
layout: post
title: "A separate APFS volume for development on macOS"
date: 2026-10-17 00:00:00 +0000
categories: macos, apfs, tools
---

Repositories, worktrees, dependency trees and build outputs generate a lot of filesystem activity. Run several coding agents against them and there’s more of it: more checkouts, more tests, more temporary files. Much of that doesn’t need to show up in Spotlight.

I was inspired by [fforres’ post about fseventsd under parallel agent workloads](https://x.com/fforres/status/2110806374544523559), and [his follow-up using a dedicated volume](https://x.com/fforres/status/2110883187920617472). I wanted something similarly scoped that would fit into my existing directory layout.

As [I shared here](https://x.com/elithrar/status/2111461035152662911), I put together a [small Bash script](https://github.com/elithrar/dotfiles/blob/main/repos-volume.sh) that creates an APFS volume mounted at `~/repos`, disables Spotlight indexing for it, and opts it out of persistent FSEvents logging.

The useful part is that APFS volumes [share free space within their container](https://support.apple.com/en-tj/guide/disk-utility/dskua9e6a110/mac). There’s no fixed partition size to guess upfront. The volume grows as needed, subject to the space available on the disk. Apps still see `~/repos` as a directory; they don’t need special configuration to work with it.

## The relevant bits

These are selected lines from the script, with discovery, validation and persistence handling omitted. Use the full script for setup; this excerpt isn’t standalone.

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

The script discovers the startup Data volume’s APFS container rather than assuming a particular disk number. The `-nomount` flag defers mounting until we’ve recorded the new volume’s UUID and prepared its destination.

The mount options are straightforward: `nobrowse` keeps the volume out of normal Finder browsing, while `owners` preserves ownership enforcement. You can still open `~/repos` directly, including through Finder’s Go to Folder. The script writes a UUID-based `/etc/fstab` entry with `rw,nobrowse,owners` so later mounts use the same path and options.

Importantly, `no_log` isn’t a mount flag. It’s an empty file at the volume’s root, inside `.fseventsd`. [Apple documents this](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/FileSystemEventSecurity/FileSystemEventSecurity.html) as disabling persistent event logging for that volume. It doesn’t stop fseventsd system-wide, or promise to eliminate live filesystem notifications.

The final command disables Spotlight indexing for this volume specifically.

A few boundaries are worth keeping visible. The script refuses to mount over a populated `~/repos`, so existing repositories need a deliberate migration. The volume is currently unencrypted; enabling FileVault on your startup volume doesn’t automatically encrypt this one. Check your backup tooling too, particularly anything relying on persisted event history.

## Keeping it scoped

This is a better fit for my development directories than turning off fseventsd or Spotlight across the machine. I still want their normal behavior for everything else.

You can use the same approach for additional top-level directories, each with its own volume and settings. My helper targets `~/repos`, but the underlying mechanism isn’t specific to repositories. All those volumes share the same available storage, so there’s no partition-sizing exercise, and no extra capacity magically appearing either.
