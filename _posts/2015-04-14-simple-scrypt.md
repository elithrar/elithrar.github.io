---
layout: post
title: "simple-scrypt"
categories: "go, security"
published: true
---

[simple-scrypt](https://github.com/elithrar/simple-scrypt) is a convenience wrapper around Go's existing scrypt library. The existing library has a limited API and doesn't facilitate generating salts, comparing keys or retrieving the parameters used to generate a key. The last point is a limitation of the scrypt specification, which doesn't enforce this by default. Using Go's [bcrypt](https://golang.org/x/crypto/bcrypt) library as inspiration, I pulled together a more complete scrypt package with some "sane defaults" to make it easier to get started. The library provides functionality to provide your own parameters via the `scrypt.Params` type, and the public API should be rock solid (I'm planning to tag a v1.0 very soon).

scrypt itself, for those that don't know, is a memory-hard key derivation function (KDF) entirely suitable for deriving strong keys from 'weak' input (i.e. user passwords). It's often described as a way to 'hash' passwords, but unlike traditional hashes (SHA-1, the SHA-2 family, etc.) that are designed to be fast, it's [designed](http://www.tarsnap.com/scrypt/scrypt.pdf) to be "configurably" slow. This makes it ideal for storing user passwords in a way that makes it *very* hard to brute force or generate rainbow tables against. 

Here's an example of how to get started with it for deriving strong keys from user passwords (e.g. via a web form):

{% highlight go %}
package main

import(
    "fmt"
    "log"

    "github.com/elithrar/simple-scrypt"
)

func main() {
    // e.g. r.PostFormValue("password")
    passwordFromForm := "prew8fid9hick6c"

    // Generates a derived key of the form "N$r$p$salt$dk" where N, r and p are defined as per
    // Colin Percival's scrypt paper: http://www.tarsnap.com/scrypt/scrypt.pdf
    // scrypt.Defaults (N=16384, r=8, p=1) makes it easy to provide these parameters, and
    // (should you wish) provide your own values via the scrypt.Params type.
    hash, err := scrypt.GenerateFromPassword([]byte(passwordFromForm), scrypt.DefaultParams)
    if err != nil {
        log.Fatal(err)
    }

    // Print the derived key with its parameters prepended.
    fmt.Printf("%s\n", hash)

    // Uses the parameters from the existing derived key. Return an error if they don't match.
    err := scrypt.CompareHashAndPassword(hash, []byte(passwordFromForm))
    if err != nil {
        log.Fatal(err)
    }
}
{% endhighlight %}

The package also provides functions to compare a password with an existing key using `scrypt.CompareHashAndPassword` and to retrieve the parameters used in a previously generated key via `scrypt.Cost`. The latter is designed to make it easy to upgrade parameters as hardware improves.

Pull requests are welcome, and I have a few things [on the to-do list](https://github.com/elithrar/simple-scrypt#to-do) to make it configurable based on hardware performance.