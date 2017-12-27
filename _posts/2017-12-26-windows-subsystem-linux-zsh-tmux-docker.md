I recently put together a Windows machine for gaming, and although I still do most of my development on macOS due to a great third-party ecosystem, BSD underpinnings & better programming language support, I decided to see what development life was like on Windows in 2018.

As a spoiler: it's not perfect, but it's definitely usable day-to-day. If you're developing applications that don't rely on OS-level differences (e.g. not systems programming), you can certainly use a Windows + Windows Subsystem for Linux (WSL) as your only setup. If you're working with container-based applications, then it becomes even more usable.

I'm going to walk through a setup that gets you up & running with a few staples, namely:

* Ubuntu 16.04 LTS via [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10)
* [VSCode](https://code.visualstudio.com/) as your editor
* [Hyper](https://hyper.is/) as the terminal
* zsh as your shell w/ [Oh My Zsh](https://github.com/robbyrussell/oh-my-zsh)

## First Things First

You'll need to enable and install the [Windows for Linux Subsystem](https://docs.microsoft.com/en-us/windows/wsl/install-win10). Basic familarity with the Linux CLI is also useful here: although this is a step-by-step guide, knowing how to edit text files with `vim` or `nano` is going to be helpful.

## Hyper (your terminal)

Hyper is a fairly new terminal application, and although it's not as polished as the venerable iTerm on macOS, it gets the job done. It uses the same underpinnings as the integrated terminal in VSCode (xterm.js), which means it sees regular releases and bug-fixes.

Out of the box, Hyper will use the Windows command prompt (cmd.exe) or Powershell (powershell.exe). In order to have it use your WSL shell, you'll need to make a quick adjustment.

In Hyper, head to Edit > Preferences and modify the following keys:

```sh
    shell: 'wsl.exe',

    // for setting shell arguments (i.e. for using interactive shellArgs: ['-i'])
    // by default ['--login'] will be used
    shellArgs: [],
```

Note that if you have multiple Linux distributions installed via WSL, and you don't want Hyper to use your default, you can set the value for `shell` to (e.g.) `'ubuntu.exe'`.

Hyp

## zsh + ohmyzsh (your shell)

We're also going to set up zsh as our default shell, alongside Oh My Zsh for it's built-ins, themes and plugins.

First, confirm that `zsh` is available and installed (it should be, by default):

```sh
~ which zsh
/usr/bin/zsh
```

And then change your default shell to zsh:

```sh
~ chsh -s /usr/bin/zsh
# Enter your password, and hit enter
# Confirm the change
~ echo $SHELL
/usr/bin/zsh
```
We can now install oh-my-zsh -

```sh
# As per the instructions here: https://github.com/robbyrussell/oh-my-zsh#basic-installation
# NOTE: Don't just install any old program by piping a file into sh. Anything your user can do, the script can do. Make sure you at least trust the source of the script.
~ sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"
```

Once complete, you can begin tweaking things as per the README https://github.com/robbyrussell/oh-my-zsh#using-oh-my-zsh

## tmux

[tmux](https://tmux.github.io), if you're not familiar, is a terminal multiplexer. Think of it as a way to run multiple shells quickly-and-easily, either in a grid-like fashion, or via a "tab" paradigm (or both). It's extremely useful for multi-tasking: edit code or configs in one pane, watch results in another, and `tail -f` a log in a third.

The tmux version (2.1) available under Ubuntu 16.04 is getting on, and thus we'll be building our version (2.6, at the time of writing) from source.

```sh
# Fetch the latest version of tmux from this page - e.g.
curl -so tmux-2.6.tar.gz https://github.com/tmux/tmux/releases/download/2.6/tmux-2.6.tar.gz
# Unpack it
~ tar xvf tmux-2.6.tar.gz
~ cd tmux-2.6.tar.gz
# Install the dependencies we need
~ sudo apt-get install build-essential libevent-dev libncurses-dev
# Configure, make & install tmux itself
~ ./configure && make
~ sudo make install
# Confirm it works
~ tmux
```

We'll also want zsh to create (or use an existing) tmux session if available, so that we're always in tmux. Let's modify `.zshrc` to achieve that:

```sh
# open .zshrc in your preferred editor - e.g. vim
alias tmux="tmux -2 -u" │
if which tmux 2>&1 >/dev/null; then │
    test -z "$TMUX" && (tmux attach || tmux new-session) │
fi
```

We'll now make sure zsh uses this updated config:

```sh
~ source .zshrc
```

## Visual Studio Code

We have a standalone terminal w/ zsh + Oh My Zsh installed. Let's make sure VSCode uses it for those times we're using its integrated terminal. We'll also want it to launch Hyper as our external terminal application, rather than cmd.exe or Powershell.

Open up VSCode's preferences via File > Preferences > Settings (Ctrl+,) and update the following keys:

```json
    "terminal.external.windowsExec": "%userprofile%\\AppData\\Local\\hyper\\Hyper.exe",
    "terminal.integrated.shell.windows": "wsl.exe"
```

> Note: VSCode extensions that rely on background daemons or language servers to provide static analysis, formatting and other features will still use (require) the Windows-based version of these tools by default. There's an [open issue](https://github.com/Microsoft/vscode-go/issues/926) tracking this for Go, but it's not a solved problem yet.

## Docker

We're also going to install Docker, via [Docker for Windows](https://store.docker.com/editions/community/docker-ce-desktop-windows) (the daemon) and the Docker CLI (the client, effectively) within our WSL environment. This allows us to make use of Hyper-V and maintain good performance from our containerized applications, and avoid the minefield that is VirtualBox.

Once you've installed Docker for Windows—which may require rebooting to install Hyper-V, if not already enabled—you'll also need to allow connections from legacy clients in the Docker settings. Check "Expose daemon on tcp://localhost:2375 without TLS".

Note that this reduces the security of your setup slightly: other services already running on your machine could MitM connections between the Docker daemon. This does not expose the daemon to the local network, but there does not appear to be a way to retain TLS authentication between WSL and Docker for Windows yet.

```sh
# Install our dependencies
~ sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
# Add the Docker repository
~ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) edge"

~ sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) edge"
~ sudo apt-get update
# Install Docker Community Edition
~ sudo apt-get install -y docker-ce
# Add your user to the Docker group
~ sudo usermod -aG docker $USER
```
We'll also need to tell our Docker client (inside WSL) how to connect to our Docker daemon (Docker on Windows).

```
# Persist this to shell config
~ echo "export DOCKER_HOST=tcp://0.0.0.0:2375" >> $HOME/.zshrc
~ source ~/.zshrc
# Check that Docker can connect to the daemon (should not get an error)
~ docker images
```

If you see any errors about not being able to find the Docker host, make sure that Docker for Windows is running, that you've allowed legacy connections in settings, and that `echo $DOCKER_HOST` correctly returns `tcp://0.0.0.0:2375` in the same shell as you're running the above commands in.

Now, let's verify that you can run a container and connect to an exposed port:

```sh
~ docker run -d -p 8080:80 openresty/openresty:latest
4e0714050e8cc7feac0183a687840bdab67bbcc2dce21ae7170b52683a548de3
~ curl localhost:8080
<!DOCTYPE html>
<html>
<head>
<title>Welcome to OpenResty!</title>
...
```

Perfect!

> Note: The [guide by Nick Janetakis](https://nickjanetakis.com/blog/setting-up-docker-for-windows-and-wsl-to-work-flawlessly) covers more of the details, including getting working mount points up-and-running.

## What Else?

It's worth noting that with Ubuntu 16.04.3 being an LTS release, software versions in the official repositories can be fairly out of date. If you're relying on later versions of tools, you'll need to either add their official package repositories (preferred; easier to track updates), install a binary build (good, but rarely self-updating), or build from source (slower, no automatic updates).

As additional tips:

* [Yarn](https://yarnpkg.com/en/docs/install#linux-tab) (the JS package manager) provides an official package repository, making it easy to keep it up-to-date.
* Ubuntu 16.04's repositories only have Go 1.6 (3 versions behind as of Dec 2017), and thus you'll need to [download the binaries](https://golang.org/dl/) - keeping in mind you'll need to manually manage updates to newer Go patch releases and major versions yourself.
* Similarly with Redis, 3.0.6 is available in the official repository. Redis 4.0 included some big changes (inc. the module system, eviction changes, etc) and thus you'll [need to build from source](https://redis.io/download)

> This is reflective of my experience setting up WSL on Windows 10, and I'll aim to keep it up-to-date as WSL improves over time—esp. around running later versions of Ubuntu. If you have questions or feedback, ping me on Twitter [@elithrar] https://twitter.com/elithrar/
