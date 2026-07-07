+ **[[EN] README English](/README.en.md)**
+ [[RU] README Русский](/README.md)

# Qu.js

- Project website: [https://qujs.ru/](https://qujs.ru/)
- Documentation: [https://qujs.ru/api/](https://qujs.ru/api/)
- License: MIT (see `LICENSE`)

Qu.js is a utility JavaScript library that provides independent tools for solving common web development tasks: asynchronous loading of scripts and styles, event management, waiting for DOM readiness, loading external libraries, and wiring modules together.

It does not impose any specific architecture. Instead, it gives you convenient tools that can be used separately or together. Thanks to its promise-based API and the `Que` queue system, you can build dependency chains and ensure that code runs at the right moment — whether it is page load, an element appearing in the viewport, or a specific variable becoming available.

# Key features

- **Task queue** (`Que`) — delay function execution until one or more events occur (DOMReady, library load, custom signal). Supports `multi` (all events), `series` (sequential events), and `ordered` (strict order) modes.
- **Event management** (`on`, `off`, `trigger`) — subscribe to events with delegation, support collections of elements, and optionally collect responses from handlers.
- **Variable appearance tracking** (`def`) — react when a global variable or one of its nested properties becomes defined.
- **Asset loading** (`loadAssets`) — load scripts, styles, and images with order control and promise support.
- **Modular architecture** — the core library acts as the kernel, while additional modules (for example, Lazy for lazy loading) are connected as plugins via `Qu.lib()`.
- Plus a few utility helpers for working with the DOM and scrolling.

# Philosophy

> **Que comes from "queue", Qu comes from "query". The core idea is simple: tasks go into a queue and run on demand.**

This is a collection of tools originally designed to work well with `async`/`defer`, so scripts do not block page loading — this approach proved convenient in real projects. Some parts of the code were generated with AI and then manually refined. The utilities are aimed at modern browsers.

This is not a set of ES modules. Qu.js is included as a whole and works through the global `Qu` object. Importing individual functions is not supported and is not planned for now.

If this approach fits your workflow, feel free to use it.

# Quick start

## Loader (required, must be the very first script) `loader.js`

```javascript
if (!window.Que) {
    (function () {
        var bus = (window.Qu && window.Qu.bus) || document;
        var originalDispatch = bus.dispatchEvent;
        var fired = window._QueFired || (window._QueFired = {});
        var queue = window._QueQ || (window._QueQ = []);

        bus.dispatchEvent = function (event) {
            if (event && event.type) {
                fired[event.type] = (fired[event.type] || 0) + 1;
            }
            return originalDispatch.call(bus, event);
        };

        window.Que = function (callback, ev, onceOrOptions, mode, useCache) {
            if (window.Qu && typeof window.Qu.when === 'function') {
                return window.Qu.when(callback, ev, onceOrOptions, mode, useCache);
            }
            queue.push([callback, ev, onceOrOptions, mode, useCache]);
        };
    })();
};
```

This code must run before any calls to `Que(...)`. That is why it should be loaded first, synchronously, in `<head>` before any other scripts. This way, all `Que` calls and events that happen before the core is loaded will be captured and processed later. By default, `bus = document`. If you change `Qu.bus` during initialization, update the loader as well.

```javascript
window.QuExtend = window.QuExtend || [];
window.QuExtend.push(function(Qu) {
    Qu.bus = window;
});

// update the loader too
var bus = (window.Qu && window.Qu.bus) || window;
```

P.S. You can skip the loader — `qu.js` already contains a recovery mechanism for `window._QueQ`. However, in that case, events that happened before the core was loaded will not be cached, and `Que` will not be able to react to them if they have already fired.

## Libraries / application modules

```html
<link rel="stylesheet" href="/qu/core/css/qu.min.css"
    media="print" onload="this.media='all'">

<script src="/qu/lazy/lazy.min.js" async></script>
<script src="/qu/core/qu.min.js" defer></script>
```

or via CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/css/qu.min.css"
    media="print" onload="this.media='all'">

<script src="https://cdn.jsdelivr.net/gh/qujs-dev/lazy@main/lazy.min.js" async></script>
<script src="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/qu.min.js" defer></script>
```

Additional libraries are recommended to be loaded with `async` in any order. The core `qu.js` should use `defer` so it does not block rendering.

# Recommendations

Using many `async`/`defer` scripts works best with HTTP/2 (or HTTP/3).

CDN servers usually have HTTP/2-3 enabled by default, but free CDNs are not always stable, so having a fallback to a local file is a reasonable safety measure.

```html
<link
  rel="preload"
  as="style"
  href="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/css/qu.min.css"
  onload="this.rel='stylesheet'"
  onerror="this.onerror=null;this.href='/qu/core/css/qu.min.css';this.rel='stylesheet'"
>

<!-- better for rendering, but without fallback -->
<link
    href="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/css/qu.min.css"
    rel="stylesheet"
    media="print"
    onload="this.media='all'; this.onload=null;"
>

<script
  src="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/qu.min.js"
  onerror="this.onerror=null;this.src='/qu/core/qu.min.js'" defer>
</script>
```

With HTTP/1.1, browsers limit the number of simultaneous connections to the same domain, so `async`/`defer` scripts will still end up queued. With HTTP/2-3, multiplexing allows all resources to be loaded in parallel without extra delay.

If the server runs on HTTP/1.1 and the Qu.js files are physically hosted on that same server, using `async`/`defer` does not reduce loading bottlenecks much. In that case, bundling scripts into a single file may be the better option — old-school, but reliable.

# Code examples

By default, `Que` reacts to DOM readiness.

```javascript
Que(function() {
    console.log('DOM ready');

    Qu.def(['fancybox', 'jQuery'], function(vars) {
        console.log('All libraries loaded!');
        Qu.trigger(Qu.bus, 'app:ready', { detail: { fancybox, jQuery } });
    });
});
```

You can specify your own event — `Que` will run when that event is triggered.

If the mini-loader is already included, you can place `Que` anywhere on the page or in any file — it will still work correctly, because the loader intercepts calls and buffers them until the Qu.js core is loaded.

```javascript
Que(function() {
    console.log('✅ App ready!');
    // todo
}, 'app:ready');
```

You can wait for multiple events at once, in sequence, or in strict order (see the API).

```javascript
Que(function() {
    console.log('✅ All steps completed from the beginning');
    // todo
}, ['step1:complete', 'step2:complete', 'step3:complete'], false, 'ordered');
```

In this example, after each successful run, the order resets and Qu starts waiting for a new series of events in the same order.

### Initializing a library written in Qu style

```javascript
Que(function() {
    Qu.libs(['Lazy'], { autoInit: true, initParams: {} }).then(function(loadedLibs) {
        console.log('Lazy already');
    });
});
```

or

```javascript
Que(function() {
    // If Lazy is already loaded, the callback runs immediately
    console.log('Lazy already!');
    Qu.Lazy.init();
}, 'qu:lazy:loaded');
```

## Example of extending an object at each nested step

```javascript
Que(function() {
    console.log('1️⃣ DOM ready');

    const user = { name: 'Player' };

    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step1:done', { detail: user });
    }, 300);

    Que(function(Qu, data) {
        console.log('2️⃣ Received:', data);
        data.age = 13;

        setTimeout(() => {
            Qu.trigger(Qu.bus, 'step2:done', { detail: data });
        }, 300);

        Que(function(Qu, data) {
            console.log('3️⃣ Received:', data);
            data.city = 'Suncity';

            setTimeout(() => {
                Qu.trigger(Qu.bus, 'step3:done', { detail: data });
            }, 300);

            Que(function(Qu, data) { 
                console.log('4️⃣ Final object:', data);
                console.log('Name:', data.name);
                console.log('Age:', data.age);
                console.log('City:', data.city);
            }, 'step3:done');

        }, 'step2:done');

    }, 'step1:done');

}, 'qu:dom'); // can be omitted because 'qu:dom' is the default, or replaced with another event
```

## Or independently

`Que` nesting depth is unlimited. You can build chains of any depth — either nested or fully independent.

```javascript
Que(() => {
    console.log('1️⃣ DOM ready');

    const user = { name: 'Player' };

    // Step 1: trigger the event and pass the object
    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step1:done', { detail: user });
    }, 300);

}); // 'qu:dom' by default

// Step 2: wait for step1, get the object, add age
Que(function(Qu, data) {
    console.log('2️⃣ Received:', data);
    data.age = 13;

    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step2:done', { detail: data });
    }, 300);
}, 'step1:done');

// Step 3: wait for step2, get the object, add city
Que(function(Qu, data) {
    console.log('3️⃣ Received:', data);
    data.city = 'Suncity';

    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step3:done', { detail: data });
    }, 300);
}, 'step2:done');

// Step 4: wait for step3, final output
Que(function(Qu, data) {
    console.log('4️⃣ Final object:', data);
    console.log('Name:', data.name);
    console.log('Age:', data.age);
    console.log('City:', data.city);
}, 'step3:done');
```

> 1️⃣ DOM ready  
> 2️⃣ Received: { name: 'Player' }  
> 3️⃣ Received: { name: 'Player', age: 13 }  
> 4️⃣ Final object: { name: 'Player', age: 13, city: 'Suncity' }  
> Name: Player  
> Age: 13  
> City: Suncity

And so on. More details are available on the website: [https://qujs.ru/](https://qujs.ru/)