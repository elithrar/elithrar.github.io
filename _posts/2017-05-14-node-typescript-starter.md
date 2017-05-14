---
layout: post
title: A Node + TypeScript Starter
categories: programming, tools, typescript, javascript
---

> TL;DR: If you want a simple template/boilerplate to get you started with TypeScript + Node.js, [clone this repo](https://github.com/elithrar/node-typescript-starter).

As I started spending more time writing JavaScript, the more I missed a stricter type-system to lean on. [TypeScript](https://www.typescriptlang.org/) seemed like a great fit, but coming from Go, JavaScript/TypeScript projects require a ton of configuration to get started. Knowing what dependencies you need (`typescript`, `tslint`, `node-ts`), linter configuration (`tslint.json`), and putting together the right `tsconfig.json` for a Node app (vs. a browser app) wasn't well documented. I wanted to compile to [ES6](https://ponyfoo.com/articles/tagged/es6-in-depth), use CommonJS modules (what Node.js consumes), and generate [type definitions](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) alongside the .js files so that editors like VS Code (or other TypeScript authors) can benefit.

After doing this for a couple of small projects, I figured I'd had enough, and put together [node-typescript-starter](https://github.com/elithrar/node-typescript-starter), a minimal-but-opinionated configuration for TypeScript + Node.js. It's easy enough to change things, but it should provide a basis for writing code rather than configuration.

To get started, just clone the repo and write some TypeScript:

```sh
git clone https://github.com/elithrar/node-typescript-starter.git
# Then: replace what you need to in package.json, update the LICENSE file
yarn install # or npm install
# Start writing TypeScript!
open src/App.ts
```

... and then build it: 

```sh
yarn build
# Outputs:
# yarn build v0.22.0
# $ tsc
# ✨  Done in 2.89s.
```

And that's it. PR's are welcome, keeping in mind the intentionally minimal approach.