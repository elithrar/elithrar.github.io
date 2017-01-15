---
layout: post
title: A Custom Two-Way v-model Component in Vue.js
categories: web, programming, javascript, vue
---

In a migration of an internal admin dashboard from Vue 1 to [Vue 2](https://vuejs.org/) (my JS framework of choice), [two-way filters were deprecated](https://vuejs.org/v2/guide/migration.html#Two-Way-Filters-replaced). I'd been using two-way filters to format JSON data (stringifying it) and parsing user-input (strings) back to the original data type so that the dashboard wouldn't need to know about the (often changing) schema of the API at the time.

In the process of re-writing the filter as a [custom form input component](https://vuejs.org/v2/guide/components.html#Form-Input-Components-using-Custom-Events), it needed to:

* Be able to check the type of the data it was handling, and validate input against that type (if it was a Number, then Strings are invalid)
* Be unaware the type of the data ahead-of-time (the API was in-flux, and I wanted it to adaptive)
* Format more complex types (Objects/Arrays) appropriately for a form field.

Custom input components accept a value prop and emit an input event via the familiar `v-model` directive in Vue. Customising what happens in-between is where the value of writing your own input implementation comes in:

```html
<tr v-for="(val, key) in item">
  <td class="label">{{ key }}</td>
  <td>
    <json-input :label=key v-model="item[key]"></json-input>
  </td>
</tr>
```

The parent component otherwise passes values to this component in `v-model` just like any other.

## The Code

Although this is written as a [single-file component](https://vuejs.org/v2/guide/single-file-components.html), I've broken it down into two pieces.

The `template` section of the component is fairly straightforward:

```html
<template>
  <input
    ref="input"
    v-bind:class="{ dirty: isDirty }"
    v-bind:value="format(value)"
    v-on:input="parse($event.target.value)"
  >
</template>
```
The key parts are `v-bind:value` (what we emit) and `v-on:input` (the input). The `ref="input"` attribute allows us to emit events via the `this.$emit(ref, data)` API.

[Lodash](https://lodash.com/docs) includes well-tested type-checking functions: I use these for the initial checks instead of reinventing the wheel. Notably, `isPlainObject` should be preferred over [`isObject`](https://lodash.com/docs/4.17.4#isObject), as the latter has a broader meaning. I also use `debounce` to add a short delay to the input -> parse function call, so that we're not overly aggressive about saying 'invalid' before the user has a chance to correct typos.

```js
<script>
import debounce from "lodash.debounce"
import { isBoolean, isString, isPlainObject, isArrayLikeObject, isNumber, isFinite, toNumber } from "lodash"
export default {
  name: "json-input",
  props: {
    // The form label/key
    label: {
      type: String,
      required: true
    },
    // The form value
    value: {
      required: true
    }
  },
  data () {
    return {
      // dirty is true if the type of the field doesn't match the original
      // value passed.
      dirty: false,
      // typeChecked is true when the type of the original value has been
      // checked. This allows us to validate user-input against the original
      // (expected) type.
      typeChecked: false,
      isObject: false,
      isBoolean: false,
      isNumber: false,
      isString: false
    }
  },
  computed: {
    isDirty: function () {
      return this.dirty
    }
  },
  methods: {
    // init determines the JS type of the field (once) during initialization.
    init: function () {
      this.typeChecked = false
      this.isObject = false
      this.isBoolean = false
      this.isNumber = false
      this.isString = false
      if (isPlainObject(this.value) || isArrayLikeObject(this.value)) {
        this.isObject = true
      } else if (isNumber(this.value)) {
        this.isNumber = true
      } else if (isBoolean(this.value)) {
        this.isBoolean = true
      } else if (isString(this.value)) {
        this.isString = true
      }
      this.typeChecked = true
    },
    // format returns a formatted value based on its type; Objects are
    // JSON.stringify'ed, and Boolean & Number values are noted to prevent
    // reading them back as strings.
    format: function () {
      // Check the types of our fields on the initial format.
      if (!this.typeChecked) {
        this.init()
      }
      var res
      if (this.isObject) {
        res = JSON.stringify(this.value)
      } else if (this.isNumber) {
        res = this.value
      } else if (this.isBoolean) {
        res = this.value
      } else if (this.isString) {
        res = this.value
      } else {
        res = JSON.stringify(this.value)
      }
      return res
    },
    // Based on custom component events from
    // https://vuejs.org/v2/guide/components.html#Form-Input-Components-using-Custom-Events
    parse: debounce(function (value) {
      this.dirty = false
      if (this.isObject) {
        var res
        try {
          res = JSON.parse(value)
          this.$emit("input", this.format(res))
        } catch (e) {
          // Mark the field as dirty.
          this.dirty = true
          res = value
        }
        this.$emit("input", res)
        return
      }
      // Check the original type of the value; if the user-input does not conform
      // flag the field as dirty.
      if (this.isBoolean) {
        if (value === "true" || value === "false") {
          this.dirty = false
          // Convert back to a Boolean.
          this.$emit("input", (value === "true"))
          return
        }
        this.dirty = true
        this.$emit("input", value)
        return
      } else if (this.isNumber) {
        // Convert numbers back to numbers.
        let num = toNumber(value)
        if (isNumber(num) && isFinite(num)) {
          this.$emit("input", num)
          return
        }
        this.dirty = true
        this.$emit("input", value)
        return
      } else {
        // Write other types as-is.
        this.$emit("input", value)
        return
      }
    }, 1000)
  }
}
</script>
```

There's a reasonable amount to digest here, but it makes sense if you think of it in three steps:

1. `init()` - called on the initial format *only*. It type-checks the initial data, and sets `typeChecked = true` so we don't run this again for the life of the component. The Lodash functions we import simplify this for us.
2. `format()` - this method is responsible for emitting the value (e.g. to the DOM): it stringifies objects, converts any number back to a `Number` proper, etc.
3. `parse()` - validates all user input against that initial type we asserted in the `init` method. If the user input is invalid, we set `this.dirty = true` (and add a CSS class of 'dirty') and emit the invalid value as-is, for the user to correct. TODO: return "input should be a Number" as a helpful error.

Steps #2 and #3 are universal to any custom form input component: how the data comes in, and how it goes out. This doesn't just apply to `<input>` either: you could easily write your own `<select>` or `<textarea>` component by adapting this approach.

## Wrap

Here's a working demo: enter a non-Number value into the input and it'll flag it appropriately. Change the value/type of the data in the parent Vue instance, re-run it, and you'll see the component validate the new type automatically.

<iframe width="100%" height="900" src="//jsfiddle.net/elithrar/86nb5dmj/1/embedded/?bodyColor=F6F6F6&fontColor=111&menuColor=aaa" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
