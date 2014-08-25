---
layout: post
title: Running Go Applications in the Background
---

A regular question on the go-nuts mailing list, in the #go-nuts IRC channel and on StackOverflow seems to be: how do I run my Go application in the background? Developers eventually reach the stage where they need to deploy something, keep it running, log it and manage crashes. So where to start?

There's a huge number of options here, but we'll look at a stable, popular and cross-distro approach called [Supervisor](http://supervisord.org). Supervisor is a process management tool that handles restarting, recovering and managing logs, without requiring anything from your application (i.e. no PID files!).

## Pre-Requisites

We're going to assume a *basic* understanding of the Linux command line, which in this case is understanding how to use a text-editor like vim, emacs or even nano, and the importance of not running your application as root&mdash;which I will re-emphasise throughout this article! We're also going to assume you're on an Ubuntu 14.04/Debian 7 system (or newer), but I've included a section for those on RHEL-based systems.

I should also head off any questions about daemonizing (i.e. the Unix meaning of daemonize) Go applications due to interactions with threaded applications and most systems (aka [Issue #227](https://code.google.com/p/go/issues/detail?id=227)). 

**Note**: I'm well aware of the "built in" options like Upstart (Debian/Ubuntu) and systemd (CentOS/RHEL/Fedora/Arch). I'd even originally wrote this article so that it provided examples for all three options, but it wasn't opinionated enough and was therefore confusing for newcomers (at whom this article is aimed at).

For what it's worth, Upstart leans on start-stop-daemon too much for my liking (if you want it to work across versions), and although I really like systemd's configuration language, my primary systems are running Debian/Ubuntu LTS so it's not a viable option (until next year!). Supervisor's cross-platform nature, well documented configuration options and extra features (log rotation, email notification) make it well suited to running production applications (or even just simple side-projects).

## Installing Supervisor

I've been using Supervisor for a long while now, and I'm a big fan of it's centralised approach: it will monitor your process, restart it when it crashes, redirect stout to a log file and rotate that all within a single configuration.

There's no need to write a separate logrotated config, and there's even a decent web-interface (that you should *only* expose over authenticated HTTPS!) included. The project itself has been around 2004 and [is well maintained](https://github.com/Supervisor/supervisor).

Anyway, let's install it. The below will assume Ubuntu 14.04, which has a recent (>= 3.0) version of Supervisor. If you're running an older version of Ubuntu, or an OS that doesn't package a recent version of Supervisor, it may be worth installing it via `pip` and writing your own Upstart/systemd service file.

```sh
$ sudo apt-get install supervisor
```

Now, we also want our application user to be able to invoke `supervisorctl` (the management interface) as necessary, so we'll need to create a `supervisor` group, make our user a member of that group and modify Supervisor's configuration file to give the supervisor group the correct permissions on the socket.

```sh
$ sudo addgroup --system supervisor
# i.e. 'sudo adduser deploy supervisor'
$ sudo adduser <yourappuser> supervisor
$ logout
# Log back in and confirm which should now list 'supervisor':
$ groups
```

That's the group taken care of. Let's modify the Supervisor configuration file to take this into account:

```sh
[unix_http_server]
file=/var/run/supervisor.sock   
chmod=0770                       # ensure our group has read/write privs
chown=root:supervisor            # add our group

[supervisord]
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
childlogdir=/var/log/supervisor

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///var/run/supervisor.sock

[include]
files = /etc/supervisor/conf.d/*.conf # default location on Ubuntu
```

And now we'll restart Supervisor:

```sh
$ sudo service supervisor restart
```

If it doesn't restart, check the log with the below:

```sh
$ sudo tail /var/log/supervisor/supervisord.log
```

Typos are the usual culprit here. Otherwise, with the core configuration out of the way, let's create a configuration for our Go app.

## Configuring It

Supervisor is [infinitely configurable](http://supervisord.org/configuration.html), but we'll aim to keep things simple. Note that you will need to modify the configuration below to suit your application: I've commented the lines you'll need to change.

Create a configuration file at the default (Ubuntu) includes directory:

```sh
# where 'mygoapp' is the name of your application
$ sudo vim /etc/supervisor/conf.d/mygoapp.conf 
```

... and pull in the below:

```sh
[program:yourapp]
command=/home/yourappuser/bin/yourapp # the location of your app
autostart=true
autorestart=true
startretries=10
user=yourappuser # the user your app should run as (i.e. *not* root!)
directory=/srv/www/yourapp.com/ # where your application runs from
environment=APP_SETTINGS="/srv/www/yourapp.com/prod.toml" # environmental variables
redirect_stderr=true
stdout_logfile=/var/log/supervisor/yourapp.log # the name of the log file.
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
```

Let's step through it:

* `user` is who we want the application to run as. I typically create a "deploy" user for this purpose. We should never run an Internet-facing application as root, so this is arguably the most important line of our configuration.
* `logfile_maxbytes` and `logfile_backups` handle log rotation for us. This saves us having to learn another configuration language and keeps our configuration in one place. If your application generates a lot of logs (say, HTTP request logs) then it may be worth pushing maxbytes up a little.
* `autostart` runs our program when supervisord starts (on system boot)
* `autorestart=true` will restart our application regardless of the exit code.
* `startretries` will attempt to restart our application if it crashes.
* `environment` defines the environmetal variables to pass to the application. In this case, we tell it where the settings file is (a TOML config file, in my case).
* `redirect_stderr` will re-direct error output to our log file. You can keep a separate error log if your application generates significant amounts of log data (i.e. HTTP requests) via stdout. 

Now, let's reload Supervisor so it picks up our app's config file, and check that it's running as expected:

```sh
$ supervisorctl reload
$ supervisorctl status yourapp
```

We should see a "running/started" message and our application should be ready to go. If not, check the logs in `/var/log/supervisor/supervisord.log` or run `supervisorctl tail yourapp` to show our application logs. A quick Google for the error message will go a long way if you get stuck.

## Fedora/CentOS/RHEL

If you're running CentOS 7 or Fedora 20, the directory layout is a little different than Ubuntu's (rather, Ubuntu has a non-standard location), so keep that in mind. Specifically:

* The default configuration file lives at `/etc/supervisord.conf`
* The includes directory lives at `/etc/supervisord.d/`

Otherwise, Supervisor is much the same: you'll need to install it, create a system group, add your user to the group, and then update the config file and restart the service using `sudo systemctl restart supervisord`.

## Summary

Pretty easy, huh? If you're using a configuration management tool (i.e. Ansible, Salt, et. al) for your production machines, then it's easy to automate this completely, and I definitely recommend doing so. Being able to recreate your production environment like-for-like after a failure (or moving hosts, or just for testing) is a Big Deal and worth the time investment.

It's also easy to see from this guide how easy it is to add more Go applications to Supervisor's stable: add a new configuration file, reload Supervisor, and off you go. You can choose how aggressive restarts need to be, log rotations and environmental variables on a per-application basis, which is always useful. 
