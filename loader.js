if (!window.Que) {
    (function () {
        var bus = (window.Qu && window.Qu.bus) || document;
        var originalDispatch = bus.dispatchEvent;
        var fired = window._QueFired || (window._QueFired = {});
        var queue = window._QueQ || (window._QueQ = []);
        var details = window._QueDetails || (window._QueDetails = Object.create(null));

        bus.dispatchEvent = function (event) {
            if (event && event.type) {
                fired[event.type] = (fired[event.type] || 0) + 1;

                if (event.detail !== undefined) {
                    details[event.type] = event.detail;

                    if (window.Qu && typeof window.Qu._touchEventCache === 'function') {
                        window.Qu._touchEventCache(event.type, event.detail);
                    }
                }
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
}