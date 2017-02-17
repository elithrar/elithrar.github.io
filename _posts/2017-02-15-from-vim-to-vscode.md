---
layout: post
title: From vim to Visual Studio Code
categories: programming, tools, golang
---

I've been using vim for a while now, but the recent noise around [Visual Studio Code](https://code.visualstudio.com/) had me curious, especially given some long-running frustrations with vim. I have a fairly comprehensive [vim config](https://github.com/elithrar/dotfiles), but it often feels fragile. vim-go, YouCompleteMe & ctags sit on top of vim to provide autocompletion: but re-compiling libraries, dealing with RPC issues and keeping it working when you just want to write code can be Not Fun. Adding proper autocompletion for additional languages—like Python and Ruby—is an exercise in patience (and spare time).

VS Code, on the other hand, is pretty polished out of the box: autocompletion is significantly more robust (and tooltips are richer), adding additional languages is *extremely* straightforward. If you write a lot of JavaScript/Babel or TypeScript, then it has some serious advantages (JS-family support is first-class). And despite the name, Visual Studio Code ("VS Code") doesn't bear much resemblance to Visual Studio proper. Instead, it's most similar to GitHub's [Atom](https://atom.io/) editor: more text editor than full-blown IDE, but with a rich extensions interface that allows you to turn it into an IDE depending on what language(s) you hack on.

Thus, I decided to run with VS Code for a month to see whether I could live with it. I've read articles by those switching from editors like Atom, but nothing on a hard-swap from vim. To do this properly, I went all in:

* I aliased `vim` to `code` in my shell (bad habits and all that)
* Changed my shell's `$EDITOR` to `code`
* Set `git difftool` to use `code --wait --diff $LOCAL $REMOTE`.

Note that I still used vim keybindings via [VSCodeVim](https://github.com/VSCodeVim/Vim). I can't imagine programming another way.

# Notes

Worth noting before you read on:

* When I say "vim" I specifically mean [neovim](https://neovim.io/): I hard-switched sometime late in 2015 (it was easy) and haven't looked back.
* I write a lot of Go, some Python, Bash & and 'enough' JavaScript (primarily [Vue.js](https://vuejs.org/)), so my thoughts are going to be colored by the workflows around these languages.
* [vim-go](https://github.com/fatih/vim-go) single-handedly gives vim a productivity advantage, but [vscode-go](https://github.com/Microsoft/vscode-go) isn't too far behind. The open-godoc-in-a-vim-split (and generally better split usage) of vim-go is probably what wins out

Saying that, the autocompletion in vscode-go is richer and clearer, thanks to VS Code's better autocompletion as-a-whole, and will get better.

![vscode-autocompletion](public/files/vscode-autocompletion.png)

## Workflow

Throughout this period, I realised I had two distinct ways of using an editor, each prioritizing different things:

* Short, quick edits. Has to launch fast. This is typically anything that uses `$EDITOR` (git commit/rebase), short scripts, and quickly manipulating data (visual block mode + regex work well for this).
* Whole projects. Must manage editing/creating multiple files, provide Git integration, debugging across library boundaries, and running tests.

Lots of overlap, but it should be obvious where I care about launch speed vs. file management vs. deeper language support.

### Short Edits

Observations:

* VS Code's startup speed isn't icicle-like (think: early Atom), but it's still slow, especially from a cold-start. ~5 seconds from `code $filename` to a text-rendered-and-extensions-loaded usable, which is about twice that of a plugin-laden neovim.
* Actual in-editor performance is good: command responsiveness, changing tabs, and jumping to declarations never feels slow.
* If you've started in the shell, switching to another application to edit a file or modify a multi-line shell command can feel a little clunky. I'd typically handle this by opening a new tmux split (retaining a prompt where I needed it) and then using vim to edit what I needed.

Despite these things, it's still capable of these tasks. vim just had a huge head-start, and is most at home in a terminal-based environment.

![vscode-native-terminal](public/files/vscode-native-terminal.png)

### Whole Projects

VS Code is really good here, and I think whole-project workflows are its strength, but it's not perfect.

* The built-in Git support rivals vim-fugitive, moving between splits/buffers is fast, and it's easy enough to hide. The default side-by-side diffs look good, although you don't have as many tools to do a 3-way merge (via `:bufget`, etc) as you do with vim-fugitive.
* Find-in-files is quick, although I miss some of the power of `ag.vim`, which hooks into my favorite grep replacement, [the-silver-searcher](https://github.com/ggreer/the_silver_searcher).
* What I miss from NERDTree is the ability to search it just like a buffer: `/filename` is incredibly useful on larger projects with more complex directory structures (looking at you, JS frameworks!). You're also not able to navigate the filesystem *up* from the directory you opened, although I did see an issue for this and a plan for improvement.

I should note that opening a directory in VS Code triggers a full reload, which can be a little disruptive.

![vscode-git-diff-ui](public/files/vscode-git-diff.png)
![vscode-git-commands](public/files/vscode-git-commands.png)

## Other Things

There's a bunch of smaller things that, whilst unimportant in the scope of getting things done, are still noticeable:

* Font rendering. If you're on macOS (nee OS X), then you'll notice that VS Code's font rendering (*Chromium's* font rendering) is a little different from your regular terminal or other applications. Not worse; just different.
* Tab switching: good! Fast, and there's support for vim commands like `:vsp` to open files in splits.
* You can use most of vim's substitution syntax: `:s/before/after/(g)` works as expected. `gc` (for confirmation) doesn't appear to work.
* EasyMotion support is included in the VSCodeVim plugin: although I'm a [vim-sneak]() user, EasyMotion is arguably more popular among vim users and serves the same overall goals (navigating short to medium distances quickly). `<leader><leader>f<char>` (in my config) allows me to easily search forwards by character.
* The native terminal needs a bunch of work to make me happy. It's based on [xterm.js](github.com/sourcelair/xterm.js/), which could do with a lot more love if VS Code is going to tie itself to it. It just landed support for hyperlinks (in VS Code 1.9), but solid tmux support is still lacking and makes spending time in the terminal feel like a chore vs. iTerm.
* VS Code 1.9 has a built-in Markdown preview.

You might also be asking: what about connecting to other machines remotely, where you only have an unadorned vim on the remote machine? That wasn't a problem with vim thanks to the netrw plugin—you would connect to/browse the remote filesystem with your local, customized vim install—but is a shortcoming with VS Code. I wasn't able to find a robust extension that would let me do this, although (in my case) it's increasingly rare to SSH into a box given how software is deployed now. Still, worth keeping in mind if `vim scp://user@host:/path/to/script.sh` is part of your regular workflow.

## So, Which Editor?

I like VS Code a *lot*. Many of the things that frustate me are things that can be fixed, although I suspect improving startup speed will be tough (loading a browser engine underneath and all). Had I tried it 6+ months ago it's likely I would have stuck with vim. Now, the decision is much harder.

I'm going to stick it out, because for the language I write the most (Go), the excellent autocompletion and toolchain integration beat out the other parts. If you *are* seeking a modern editor with 1:1 feature parity with vim, then look elsewhere: each editor brings its own things to the table, and you'll never be pleased if you're seeking that.