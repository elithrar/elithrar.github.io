---
layout: post
title: Accidentally From macOS to Windows and WSL
categories: windows, wsl, macos, tools
---

> **Update (June 2019)**: Much of this post remains true, and is still relevant ~six months later (slow IO perf, WSL feeling like a shim), but there are some *major* improvements just around the corner.
>
> Specifically, with [WSL2](https://docs.microsoft.com/en-us/windows/wsl/wsl2-install) moving to a VM-based architecture, a lot of the perf woes are scheduled to disappear. With [VS Code's Remote extension](https://code.visualstudio.com/docs/remote/remote-overview), the "two halves of the same system" problem - where you have to duplicate your toolchain - is effectively gone (this has been my favorite improvement so far, by a long shot). On the terminal front, we're almost there: Alacritty still (unfortunately) struggles with Unicode glyph rendering on Windows, but Microsoft has [open-sourced their own Windows Terminal](https://github.com/microsoft/terminal), and it's _actually really good_, even in this preview state.
>
> I'd say that, six months after writing this post, that WSL (as it exists in June 2019) is not a replacement for every dev environment  just yet. But there's been meaningful steps to make it better, and I'm fighting the "shim" less and less now with WSL2 & the remote extension. macOS is still likely the best 'default' choice for many, but it's good to have options.

It's been ~5 months since I've used macOS proper, after 13+ years of personal use and a handful of work-use. This began when I started using my Windows "gaming" desktop & WSL (Windows Subsystem for Linux) for maintaining OSS projects & other dev-work—in-between dungeons or rounds of Overwatch—purely out of the convenience of being on the same machine.

It came to a head when I realized my 12" MacBook was collecting dust, that I wasn't using it at work (ChromeOS + Crostini), and when I saw the Surface Pro 6 on sale. I decidd to see if I could live with WSL closer to full-time, and critically, go without macOS. And so I put it up on Craigslist, sold it that weekend, and unpacked the Surface Pro a week later.

I did it partially as an experiment: Windows has been seen some significant improvements as an OSS development over the last couple of years. Could I use it for writing Go, [an increasing amount of] data science / SQL / ML explorations, and testing new cloud infrastructure? Could it really compete with the macOS developer experience, which although not perfect, is pretty darned good? I figured it wouldn't hurt to try out, seeing as I was most of the way there already: and I figured it'd be a worthwhile process to document for other developers curious about WSL.

If you're considering the switch, or are just curious as to what it's like—including how WSL integrates with Windows, what tool choices you have, and importantly, what you're going to miss from macOS—then read on.

> Side-note: I wrote [a short guide](https://blog.questionable.services/article/windows-subsystem-linux-zsh-tmux-docker/) around my original WSL-based setup a while ago. Some of this article revises the tool choices I made at the time; the rest of it talks around the general Windows + WSL-experience and how it compares to macOS.

## "The Shim"

In short: you effectively have "1.5" computers to deal with, and it feels like it at times.

Linux & Windows co-exist via the WSL layer, and although it's generally pretty great (if not technically impressive), there are parts where the facade peels back to reveal some less-than-great interactions.

> Jessie Frazelle wrote [a great post](https://blog.jessfraz.com/post/windows-for-linux-nerds/) on how WSL internals work (Windows <-> Linux syscall translation), and touches on some of the challenges I speak to below.

The first, and most obvious, is the way the filesystems interact. You can write to Windows from WSL - e.g. `/mnt/c/Users/Matt/Dropbox/` writes to my Dropbox and works as expected, but you can't read/write files from Windows -> WSL. Thus, accessing Windows from WSL is the "happy" path: anything you download via Chrome, in your Dropbox, on an external drive, etc - is accessible via `/mnt/<driveletter>`. It's when you've cloned a git repo, use `wget/curl -O` to pull something down, or are iterating on a \$language package in WSL and want to use a Windows-native tool that you're destined to shuffle things around. I've symlinked my core working folders back into the Windows filesystem to make this part a little more livable - e.g. `ln -s $USERPROFILE/repos $HOME/repos`.

You notice this filesystem gap the most when dealing with Windows-native editors but WSL-based toolchains: in my case, that's VS Code on Windows and the Go toolchain inside WSL. VS Code doesn't know how to look for your toolchain & packages inside WSL, and so you either need to live inside of Windows (losing your Linux tooling), install VS Code inside of WSL, which means losing the ability to open files outside of WSL + native Windows integration. The 'partial' solution is to use a shared `$GOPATH` within the Windows filesystem, which at least means your packages only need to be fetched once, but you'll need to be wary of potential differences should a package change implementation across OS' (inc. the standard lib!). This is far less of a solution for systems programmers. There's [an open issue](https://github.com/Microsoft/vscode-go/issues/926) for this as it relates to vscode-go, but it still speaks to the "1.5 computers" problem I mentioned earlier.

Overall? It's usable, you learn to live with it, but it adds friction to my day-to-day.

## Terminal Emulators

I've bounced between a few terminal emulators here. None are perfect, and all of them make me yearn for iTerm2 on macOS. I wish it was better.

The situation is improving though, and with the [ConPTY](https://blogs.msdn.microsoft.com/commandline/2018/08/02/windows-command-line-introducing-the-windows-pseudo-console-conpty/) API in the October 2018 Windows 10 build (1809) making it _much_ easier to integrate existing terminal emulators, it can only improve.

What I've tried so far:

- [Cmder](https://www.notion.so/24151593113a497db0648b3425ac26b9?v=eea781640d164fd5ac0da80859860052&p=81440f26eaa34f1c8bdfe51d52ed05d2) (ConEmu): fast & configurable, but poor Unicode support, tmux glitches & some emulation/escaping issues. Some improvements [coming](https://github.com/Maximus5/ConEmu/issues/1114) via ConPTY.
- [Hyper.js](https://www.notion.so/24151593113a497db0648b3425ac26b9?v=eea781640d164fd5ac0da80859860052&p=81440f26eaa34f1c8bdfe51d52ed05d2): Cross-platform due to Electron underpinnings, lots of third-party plugins. Same underlying emulator as VS Code ([xterm.js](https://github.com/xtermjs/xterm.js)), but tends to be very slow launch, spawn new shells, and doesn't keep up with lots of terminal output. I used Hyper for most of this year because despite the perf issues, it was the least buggy.
- [wsltty](https://github.com/mintty/wsltty) (Mintty): Fast. Moderately configurable, but config DSL is a pain & docs are lacking. Not a bad option for most, and is the only one with mouse support for tmux out-of-the-box.
- [Terminus](https://github.com/Eugeny/terminus): Similar to Hyper.js in that's it's Electron-based, but faster, and easier to configure. Good font rendering, doesn't break under tmux, and has a solid tab UI. It's still innately limited to its Electron roots in that it can be slow to launch, but handles high velocity output _much_ better than Hyper.
- [Alacritty](https://github.com/jwilm/alacritty): A (very) fast, minimalist cross-OS emulator with a well-documented configuration. Windows support relies on winpty-agent, and font rendering (esp. Unicode fallback) is far from perfect. There is [upcoming support](https://github.com/jwilm/alacritty/pull/1762) for the aforementioned ConPTY API is in the works, and font changes coming.

I'm using Terminus for now, but I'm hopeful about Alacritty becoming my default terminal by end of year. Terminus is "good enough despite the bugs", which has been a good way to sum up how most tools work under WSL.

## Automation & Package Management

There were (are) myriad ways to bootstrap a new Mac: usually some combination of Homebrew, a shell script calling `defaults write` to set preferences, and installation of your dotfiles. Certainly, there are ways to do this on Windows—but something lightweight that doesn’t involve directly hacking at registry keys via PowerShell and has a solid community to crib from has been historically lacking.

Thankfully, there are ways to do this on Windows now: both the OS-level configuration as well as desktop package management (via [Chocolatey](#)). The answer is [Boxstarter](https://boxstarter.org/), which is a wrapper around Chocolatey itself, as well as a number of convenience functions for modifying Windows Explorer settings, enabling WSL, and removing the (honestly pretty horrible amount of) bundled applications that Windows comes with. Why does my first-party Microsoft hardware comes with a FitBit app and Candy Crush? (rhetorical; it’s \$\$\$).

Here’s a snippet of what [my Boxstarter script](https://github.com/elithrar/dotfiles/blob/master/windows-boxstarter.ps1) looks like:

    # Pre
    Disable-UAC

    # Set PC name
    $computername = "junior"
    if ($env:computername -ne $computername) {
        Rename-Computer -NewName $computername
    }

    # Set DNS upstreams
    Set-DNSClientServerAddress -InterfaceIndex $(Get-NetAdapter | Where-object {$_.Name -like "*Wi-Fi*" } | Select-Object -ExpandProperty InterfaceIndex) -ServerAddresses "8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "2001:4860:4860::8844"

    # Set environment variables
    setx GOPATH "$env:USERPROFILE\go"
    setx WSLENV "$env:WSLENV`:GOPATH/p:USERPROFILE/p"

    # Install applications
    choco install -y sysinternals
    choco install -y vscode
    choco install -y googlechrome.dev
    choco install -y 1password
    choco install -y docker-for-windows
    choco install -y cmdermini
    choco install -y discord
    choco install -y spotify
    choco install -y dropbox
    choco install -y adobereader
    choco install -y 7zip.install
    choco install -y firacode

    # WSL
    choco install -y Microsoft-Hyper-V-All -source windowsFeatures
    choco install -y Microsoft-Windows-Subsystem-Linux -source windowsfeatures
    Invoke-WebRequest -Uri https://aka.ms/wsl-ubuntu-1804 -OutFile ~/Ubuntu.appx -UseBasicParsing
    Add-AppxPackage -Path ~/Ubuntu.appx

    RefreshEnv
    Ubuntu1804 install --root
    Ubuntu1804 run apt update
    Ubuntu1804 run apt upgrade

    # System-level configuration
    Disable-BingSearch
    Disable-GameBarTips

    Set-WindowsExplorerOptions -EnableShowHiddenFilesFoldersDrives -EnableShowProtectedOSFiles -EnableShowFileExtensions
    Set-TaskbarOptions -Size Small -Dock Bottom -Combine Full -Lock
    Set-TaskbarOptions -Size Small -Dock Bottom -Combine Full -AlwaysShowIconsOn

You'll still going to need to write some PowerShell for more advanced things (i.e. setting DNS servers), but you might also consider that a blessing, given it's power.

Within WSL I’m using Linuxbrew, a fork of Homebrew (and which is on-track [to merge with it](https://github.com/Linuxbrew/brew/issues/612)) in cases where I need more cutting-edge packages beyond the Ubuntu repositories. Using the same `brew install` workflow as I'm used to on macOS is pretty nice, and makes it a friendlier development environment without having to add package-specific repositories or build from source.

## Docker

Not much has changed [from last time](https://blog.questionable.services/article/windows-subsystem-linux-zsh-tmux-docker/#docker): it works, with a few minor problems.

The `docker` CLI inside WSL can talk to Docker for Windows (the daemon), so you get Hyper-V benefits there. The catch is that the CLI doesn't know how to validate the certificates used by the daemon, and thus you either need to disable TLS for connections over localhost (bad), or do a [cert-generation dance](https://docs.docker.com/engine/security/https/#create-a-ca-server-and-client-keys-with-openssl) and edit the Docker for Window config file by hand to use these new certs. It'd be great if the Docker daemon did this for you, so you could just set `DOCKER_CERT_PATH=/mnt/c/ProgramData/Docker/pki` and have things work securely.

As a reminder, you don't get Hyper-V support without Windows Pro, which impacts both Linux Containers on Windows _and_ Windows Containers on Windows (unless you want to use VirtualBox).

## What I Miss

I miss FileVault and Apple's push towards securing the device, especially with their recent Secure Enclave-based improvements: a benefit of verticalizing, really. Windows' BitLocker [continues](https://www.theregister.co.uk/2018/09/25/bitlocker_suspension_patching_mystery/) to be [untrustworthy](https://www.engadget.com/2018/11/06/microsofts-bitlocker-compromised-by-bad-ssd-encryption/), and I'd be far more worried about a lost Windows machine vs. a lost macOS machine. BitLocker is also awkwardly positioned as a Windows 10 Pro only feature, which in 2018, is _very much_ the wrong thing to nickle-and-dime users over. It’s frustrating to buy a Surface _Pro_ and then have to dole out \$99 for the Windows Pro upgrade.

macOS' community of power-user tooling is also unsurpassed: the aforementioned Alfred App as a powerful search tool, great screen-capture tools, Preview.app (the Windows PDF editor landscape is _not good_), Quick Look, some fantastic design tools, Automator (still good!), easy keyboard shortcut customization (no RegEdit or third-party tools), _consistent_ keyboard shortcuts, upper quartile battery life due to tight software-hardware integration, and a single filesystem no matter whether you're in a Cocoa app on macOS or a cross-compiled GNU tool inside iTerm2. There's room for improvement here in both Windows-itself & WSL-land, but much of it is around developer community, and that's a hard win.

I also want to say that I don't share the "macOS" is dead sentiment that others do, and that hasn't been the driver for the change. It's just that some alternatives have finally started to close the gap, both in terms of software experience & hardware quality/support, and I was in the position to experiment with them.

## Why Not All-In on Linux?

I'll keep this short: I still depend on Lightroom, writing tools (Notion, Evernote prior), a solid default desktop environment, first-party hardware support (be it a MacBook or Surface) & battery life, and most of all, my time. I respect those who've invested the time into maintaining & automating a full Linux environment they can use daily, but I just don't have the time for that investment nor am I ready to make the trade-offs required for it. To each their own.

## So, Are You Going to Stick with WSL?

Before I answer: I'd love to see a few things improve, and although I think they will, some improvements will be challenging given that the WSL and Windows environments are distinct. Specificallly:

- Better interaction between filesystems; if I could access my WSL root partition via a (default, NFS) mount in Windows, then I'd have access both ways. Something like `//wsl/` or `//linux` would be fantastic. For contrast, the Linux container environment within ChromeOS ("Crostini") exposes your files into the native ChromeOS environment, and thus makes working on data across both OS' a less disruptive process.
- Improved VS Code interactions with WSL-based tools: pointing at language servers and file paths within the WSL environment would be key to this
- A continued march towards a solid terminal emulator or two; I'm hopeful here thanks to the ConPTY changes. Microsoft contributing resources here would likely benefit the viability of WSL.

_So, am I going to continue to use WSL as a dev environment?_

The answer is a (reserved) yes, because most of the dev-work I do in it is OSS, exploratory or web-based, with tools that I mostly control. If I'd been dealing with the heavily Dockerized environment at my old job, and writing/debugging lots of Lua, the answer might be closer to "no".

WSL needs another six months of tools development (ConPTY being core to that), and although I'd thought that 6+ months ago, and had hoped the experience would be a little more polished now, at least Microsoft has continued to invest resources into it. I’m not quite convinced that a Linux toolchain makes my life easier than the Darwin-based one in macOS, but here I am.

Still, try asking me again in another 6 months?
