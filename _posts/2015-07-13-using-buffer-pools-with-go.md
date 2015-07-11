---
layout: post
title: Using Buffer Pools with Go
categories: golang, performance, web
---

Buffers are extremely useful in Go and I've written [a little about them](http://elithrar.github.io/article/approximating-html-template-inheritance/#error-handling) before.

Part of that has been around rendering HTML templates: ExecuteTemplate returns an error, but if you've passed it your `http.ResponseWriter` it's too late to do anything about the error. The response is gone and you end up with a malformed page. You might also use a buffer when creating a `json.NewEncoder` for encoding (marshalling) into before writing out bytes to the wire—another case where you want to catch the error before writing to the response.

Here's a quick refresher:

```go
buf := new(bytes.Buffer)
// Write to the buffer first so we can catch the error
err := template.ExecuteTemplate(buf, "forms/create.html", user)
// or err := json.NewEncoder(buf).Encode(value)
if err != nil {
    return err
}

buf.WriteTo(w)
```

In this case (and the JSON case) however, we're creating and then implicitly throwing away a temporary buffer when the function exits. This is wasteful, and because we need a buffer on every request, we're just adding an increasing amount of garbage collector (GC) pressure by generating garbage that we might be able to avoid.

So we use a buffer pool—otherwise known as a free list or leaky buffer—that maintains a pool of buffers that we get and put from as needed. The pool will attempt to issue an existing buffer (if one exists) else it will create one for us, and it will optionally discard any buffers after the pool reaches a certain size to keep it from growing unbounded. This has some clear benefits, including:
 
* Trading some additional static memory usage (pre-allocation) in exchange for reduced pressure on the garbage collector (GC)
* Reducing ad-hoc `makeSlice` calls (and some CPU hits as a result) from re-sizing fresh buffers on a regular basis—the buffers going back into the pool have already been grown

So a buffer pool definitely has its uses. We could implement this by creating a `chan` of `bytes.Buffers` that we `Get()` and `Put()` from/to. We also set the size on the channel, allowing us to discard excess buffers when our channel is full, avoiding repeated busy-periods from blowing up our memory usage. We're also still free to issue additional buffers beyond the size of the pool (when business is good), knowing that they'll be dropped when the pool is full. This is [simple to implement](https://godoc.org/github.com/oxtoacart/bpool#BufferPool) and already nets us some clear benefits over throwing away a buffer on every request.

## Enter SizedBufferPool

But there's a slight quirk: if we do have the odd "large" response, that (now large) buffer returns to the pool and the extra memory we allocated for it isn't released until that particular buffer is dropped. That would only occur if we had to give out more buffers than our pool was initially sized for. This may not always be true if our concurrent requests for buffers don't exceed the total number of buffers in the pool. Over enough requests, we're likely to end up with a number of buffers in the pool sized for our largest responses and consuming (wasting) additional memory as a result.

Further, all of our initial ("cold") buffers might require a few rounds of makeSlice to resize (via copying) into a final buffer large enough to hold our content. It'd be nice if we could avoid this as well by setting the capacity of our buffers on creation, making the memory usage of our application over time more consistent. The typical response size across requests within a web service is unlikely to vary wildly in size either, so "pre-warming" our buffers is a useful trick.

Let's see how we can address these concerns—which is thankfully pretty straightforward:

```go
package bpool

type SizedBufferPool struct {
    c chan *bytes.Buffer
    a int
}

// SizedBufferPool creates a new BufferPool bounded to the given size.
// size defines the number of buffers to be retained in the pool and alloc sets
// the initial capacity of new buffers to minimize calls to make().
func NewSizedBufferPool(size int, alloc int) (bp *SizedBufferPool) {
    return &SizedBufferPool{
        c: make(chan *bytes.Buffer, size),
        a: alloc,
    }
}

// Get gets a Buffer from the SizedBufferPool, or creates a new one if none are
// available in the pool. Buffers have a pre-allocated capacity.
func (bp *SizedBufferPool) Get() (b *bytes.Buffer) {
    select {
    case b = <-bp.c:
        // reuse existing buffer
    default:
        // create new buffer
        b = bytes.NewBuffer(make([]byte, 0, bp.a))
    }
    return
}

// Put returns the given Buffer to the SizedBufferPool.
func (bp *SizedBufferPool) Put(b *bytes.Buffer) {
    b.Reset()

    // Release buffers over our maximum capacity and re-create a pre-sized
    // buffer to replace it.
    if cap(b.Bytes()) > bp.a {
        b = bytes.NewBuffer(make([]byte, 0, bp.a))
    }

    select {
    case bp.c <- b:
    default: // Discard the buffer if the pool is full.
    }
}
```

This isn't a significant deviation from the simple implementation and is the code I pushed to the (ever-useful) [oxtoacart/bpool package](https://github.com/oxtoacart/bpool) on GitHub.

* We create buffers as needed (providing one from the pool first), except we now pre-allocate buffer capacity based on the `alloc` param we provided when we created the pool.
* When a buffer is returned via `Put` we reset it (discard the contents) and then check the capacity.
* If the buffer capacity has grown beyond our defined maximum, we discard the buffer itself and re-create a new buffer in its place before returning that to the pool. If not, the reset buffer is recycled into the pool.

**Note**: [dominikh](http://dominik.honnef.co/) pointed out a new [buffer.Cap()](http://tip.golang.org/pkg/bytes/#Buffer.Cap) method coming in Go 1.5 which is a different from calling `cap(b.Bytes())`. The latter returns the capacity of the unread ([see this CL](https://go-review.googlesource.com/#/c/8342/)) portion of the buffer’s underlying slice, which may not be the total capacity if you’ve read from it during its lifetime. This doesn't affect our implementation however as we call `b.Reset()` (which resets the read offset) before we check the capacity, which means we get the "correct" (full) capacity of the underlying slice.

## Setting the Right Buffer Size

What would be especially nice is if we could pre-set the size of our buffers to represent our real-world usage so we're not just estimating it.

So: how do we determine what our usage is? If you have test data that's representative of your production data, a simple approach might be to collect the buffer sizes used throughout our application (i.e. your typical HTTP response body) and calculate an appropriate size.

Approaches to this would include:

* Measuring the (e.g.) 80th percentile `Content-Length` header across your application. This solution can be automated by hitting your routes with a `http.Client` and analysing the results from `resp.Header.Get("Content-Length")`.
* Instrumenting your application and measure the capacity of your buffers *before* returning them to the pool. Set your starting capacity to a low value, and then call `buf.Reset()` and `cap(buf.Bytes())` as we did in the example above. Write the output to a log file (simple) or aggregate them into a structure safe for concurrent writes that can be analysed later.

Determining whether to set the value as the average (influenced by outliers), median or an upper percentile will depend on the architecture of your application and the memory characteristics you're after. Too low and you'll increase GC pressure by discarding a greater number of buffers, but too high and you'll increase static memory usage.

## Postscript

We now have an approach to more consistent memory use that we can take home with us and use across our applications.

* You can import and use the `SizedBufferPool` from the [oxtoacart/bpool](https://github.com/oxtoacart/bpool) package (mentioned previously). Just `go get -u github.com/oxtoacart/bpool` and then call `bufPool := bpool.NewSizedBufferPool(x, y)` to create a new pool. Make sure to measure the size of the objects you're storing into the pool to help guide the per-buffer capacity.
* Worth reading is CloudFlare's "[Recycling Memory Buffers in Go](https://blog.cloudflare.com/recycling-memory-buffers-in-go/)" article that talks about an alternative approach to re-usable buffer pools.

It's worth also mentioning Go's own [sync.Pool](http://golang.org/pkg/sync/#Pool) type that landed in Go 1.3, which is a building block for creating your own pool. The difference is that it handles dynamic resizing of the pool (rather than having you define a size) and discards objects between GC runs. 

In contrast, the buffer pool in this article retains objects and functions as a [free list](http://golang.org/doc/effective_go.html#leaky_buffer) and explicitly zeroes (resets) the contents of each buffer (meaning they are safe to use upon issue), as well as discarding those that have grown too large. There's [a solid discussion on the go-nuts list](https://groups.google.com/d/topic/golang-nuts/n_By5xPzDho/discussion) about sync.Pool that covers some of the implementation quirks.
