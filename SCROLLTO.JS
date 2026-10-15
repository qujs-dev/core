
// TODO
// mb like void el.offsetHeight; on start check el?


_lockScrollEvents: function (options) {
    options = options || {};
    if (this._scrollEventsLocked) return;
    this._scrollEventsLocked = true;

    const el = options.element;

    let target = window;
    if (el) {
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll)/.test(s.overflow + s.overflowY + s.overflowX)) {
                const hasScroll = p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth;
                if (hasScroll) { target = p; break; }
            }
            p = p.parentElement;
        }
    }

    const preventScroll = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    this._scrollEventHandlers = {
        wheel: preventScroll,
        touchmove: preventScroll,
        keydown: preventScroll
    };
    this._scrollEventTarget = target;

    // вешаем ТОЛЬКО на найденный target. Никакого document
    target.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    target.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    target.addEventListener('keydown', preventScroll, { passive: false, capture: true });

    
},

_unlockScrollEvents: function () {
    if (!this._scrollEventsLocked) return;
    this._scrollEventsLocked = false;

    const h = this._scrollEventHandlers;
    const t = this._scrollEventTarget;

    if (h && t) {
        t.removeEventListener('wheel', h.wheel, { capture: true });
        t.removeEventListener('touchmove', h.touchmove, { capture: true });
        t.removeEventListener('keydown', h.keydown, { capture: true });
    }

    this._scrollEventHandlers = null;
    this._scrollEventTarget = null;
},


scrollTo: function (element, options) {
    options = options || {};
    const lockEvents = options.lockEvents !== false;
    const waitAssets = options.waitAssets === true;
    const self = this;

    const myGen = ++this._scrollToGen;
    const isCurrent = () => this._scrollToGen === myGen;

    const body = document.body;

    function setState(name) {
        if (!isCurrent()) return;
        if (body) body.setAttribute('data-qu-scrollto', name);
        self.trigger(self.bus, 'qu:scrollto:state', { detail: { state: name } });
    }
    function clearState() {
        if (!isCurrent()) return;
        if (body) body.removeAttribute('data-qu-scrollto');
        self.trigger(self.bus, 'qu:scrollto:state', { detail: { state: null } });
    }

    function idle() {
        return new Promise(function (resolve) {
            function empty() {
                return (self._loadingAssets ? self._loadingAssets.size : 0) === 0;
            }
            function loop() {
                if (!isCurrent()) { resolve(); return; }
                if (empty()) {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(resolve);
                    });
                    return;
                }
                requestAnimationFrame(loop);
            }
            loop();
        });
    }

    let settled = false;
    let resolveOuter;
    const outerPromise = new Promise(res => { resolveOuter = res; });

    const finish = () => {
        if (settled) return;
        settled = true;

        if (!isCurrent()) {
            resolveOuter(false);
            return;
        }

        if (lockEvents) this._unlockScrollEvents();
        clearState();

        //this.debug('QU SCROLLTO finish qu:scrollto:after');
        this.trigger(element, 'qu:scrollto:after', {
            detail: { element: element, options: options }
        });

        resolveOuter(true);
    };

    const doScroll = (el, opts) => {
        return new Promise((resolveIter) => {
            if (!el || !el.scrollIntoView) {
                resolveIter(false);
                return;
            }

            const settings = {
                hash: '',
                block: 'center',
                behavior: 'smooth',
                autoAdjust: true,
                autoAdjustThreshold: 0.8,
                autoAdjustFrom: 'center',
                autoAdjustTo: 'start',
                ...opts
            };

            this.trigger(el, 'qu:scrollto:before', {
                detail: { element: el, options: settings }
            });

            if (settings.hash) {
                try {
                    const newUrl = window.location.pathname + window.location.search + settings.hash;
                    history.pushState(null, null, newUrl);
                } catch (e) {
                    window.location.hash = settings.hash;
                }
            }

            void el.offsetHeight;

            let block = settings.block;
            if (settings.autoAdjust && block === settings.autoAdjustFrom) {
                const elHeight = el.offsetHeight;
                const vh = window.innerHeight;
                if (elHeight > vh * settings.autoAdjustThreshold) {
                    block = settings.autoAdjustTo;
                }
            }

            el.scrollIntoView({
                behavior: settings.behavior,
                block: block,
                inline: settings.inline
            });

            if (settings.behavior !== 'smooth') {
                setTimeout(() => resolveIter(true), 0);
                return;
            }

            let iterDone = false;
            const iterListeners = [];

            const cleanupIter = () => {
                iterListeners.forEach(([t, h]) => t.removeEventListener('scrollend', h));
                iterListeners.length = 0;
            };

            const finishIter = () => {
                if (iterDone) return;
                iterDone = true;
                cleanupIter();
                resolveIter(true);
            };

            const scrollTargets = [window];
            {
                let p = el.parentElement;
                while (p && p !== document.body && p !== document.documentElement) {
                    const s = getComputedStyle(p);
                    if (/(auto|scroll)/.test(s.overflow + s.overflowY + s.overflowX)) {
                        scrollTargets.push(p);
                    }
                    p = p.parentElement;
                }
                if (document.scrollingElement && !scrollTargets.includes(document.scrollingElement)) {
                    scrollTargets.push(document.scrollingElement);
                }
            }

            scrollTargets.forEach(t => {
                const h = () => finishIter();
                t.addEventListener('scrollend', h, { once: true, passive: true });
                iterListeners.push([t, h]);
            });

            if (!('onscrollend' in window)) {
                setTimeout(finishIter, 2000);
            }
        });
    };

    // ── блок СРАЗУ, до цикла waitAssets ──
    if (lockEvents) {
        this._lockScrollEvents({ element: element });
    }

    const runOnce = () => {
        if (!isCurrent()) return Promise.resolve(false);
        setState('scroll');
        return doScroll(element, options);
    };

    if (!waitAssets) {
        runOnce()
            .then(() => finish())
            .catch((err) => { finish(); throw err; });

        return outerPromise;
    }

    let started = false;
    const onBefore = () => { started = true; };
    this.bus.addEventListener('qu:assets:before', onBefore);

    const cycle = () => {
        if (!isCurrent()) return Promise.resolve(false);

        return runOnce().then(() => {
            if (!isCurrent()) return false;

            const size = self._loadingAssets ? self._loadingAssets.size : 0;
            if (size === 0 && !started) return false;

            setState('wait');
            return idle().then(() => {
                if (!isCurrent()) return false;
                started = false;
                return cycle();
            });
        });
    };

    cycle()
        .then(() => {
            this.bus.removeEventListener('qu:assets:before', onBefore);
            finish();
        })
        .catch((err) => {
            this.bus.removeEventListener('qu:assets:before', onBefore);
            finish();
            throw err;
        });

    return outerPromise;
},




// если блок виден сразу то лочит все 
scrollTo: function (element, options) {
    options = options || {};
    const lockEvents = options.lockEvents !== false;
    const waitAssets = options.waitAssets === true;
    const self = this;

    const myGen = ++this._scrollToGen;
    const isCurrent = () => this._scrollToGen === myGen;

    const body = document.body;

    function setState(name) {
        if (!isCurrent()) return;
        if (body) body.setAttribute('data-qu-scrollto', name);
        self.trigger(self.bus, 'qu:scrollto:state', { detail: { state: name } });
    }
    function clearState() {
        if (!isCurrent()) return;
        if (body) body.removeAttribute('data-qu-scrollto');
        self.trigger(self.bus, 'qu:scrollto:state', { detail: { state: null } });
    }

    function idle() {
        return new Promise(function (resolve) {
            function empty() {
                return (self._loadingAssets ? self._loadingAssets.size : 0) === 0;
            }
            function loop() {
                if (!isCurrent()) { resolve(); return; }
                if (empty()) {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(resolve);
                    });
                    return;
                }
                requestAnimationFrame(loop);
            }
            loop();
        });
    }

    let settled = false;
    let resolveOuter;
    const outerPromise = new Promise(res => { resolveOuter = res; });

    const finish = () => {
        if (settled) return;
        settled = true;

        if (!isCurrent()) {
            resolveOuter(false);
            return;
        }

        if (lockEvents) this._unlockScrollEvents();
        clearState();

        this.trigger(element, 'qu:scrollto:after', {
            detail: { element: element, options: options }
        });

        resolveOuter(true);
    };

    const doScroll = (el, opts) => {
        return new Promise((resolveIter) => {
            if (!el || !el.scrollIntoView) {
                resolveIter(false);
                return;
            }

            const settings = {
                hash: '',
                block: 'center',
                behavior: 'smooth',
                autoAdjust: true,
                autoAdjustThreshold: 0.8,
                autoAdjustFrom: 'center',
                autoAdjustTo: 'start',
                ...opts
            };

            this.trigger(el, 'qu:scrollto:before', {
                detail: { element: el, options: settings }
            });

            if (settings.hash) {
                try {
                    const newUrl = window.location.pathname + window.location.search + settings.hash;
                    history.pushState(null, null, newUrl);
                } catch (e) {
                    window.location.hash = settings.hash;
                }
            }

            void el.offsetHeight;

            let block = settings.block;
            if (settings.autoAdjust && block === settings.autoAdjustFrom) {
                const elHeight = el.offsetHeight;
                const vh = window.innerHeight;
                if (elHeight > vh * settings.autoAdjustThreshold) {
                    block = settings.autoAdjustTo;
                }
            }

            el.scrollIntoView({
                behavior: settings.behavior,
                block: block,
                inline: settings.inline
            });

            if (settings.behavior !== 'smooth') {
                setTimeout(() => {
                    if (!isCurrent()) {
                        this.debug('scrollTO; мгновенный перебит');
                        resolveIter(false);
                        return;
                    }
                    resolveIter(true);
                }, 0);
                return;
            }

            let iterDone = false;
            let scrollStarted = false;
            let fallbackTimeout;
            let hardTimeout;
            const iterListeners = [];

            const cleanupIter = () => {
                iterListeners.forEach(([t, h, type]) => t.removeEventListener(type, h));
                iterListeners.length = 0;
                clearTimeout(fallbackTimeout);
                clearTimeout(hardTimeout);
            };

            const finishIter = () => {
                if (iterDone) return;
                iterDone = true;
                cleanupIter();

                if (!isCurrent()) {
                    this.debug('scrollTO; итерация перебита');
                    resolveIter(false);
                    return;
                }

                resolveIter(true);
            };

            const scrollTargets = [window];
            {
                let p = el.parentElement;
                while (p && p !== document.body && p !== document.documentElement) {
                    const s = getComputedStyle(p);
                    if (/(auto|scroll)/.test(s.overflow + s.overflowY + s.overflowX)) {
                        scrollTargets.push(p);
                    }
                    p = p.parentElement;
                }
                if (document.scrollingElement && !scrollTargets.includes(document.scrollingElement)) {
                    scrollTargets.push(document.scrollingElement);
                }
            }

            const onScrollCheck = () => { scrollStarted = true; };

            scrollTargets.forEach(t => {
                const h = () => {
                    this.debug('scrollTO; scrollend');
                    finishIter();
                };
                t.addEventListener('scrollend', h, { once: true, passive: true });
                t.addEventListener('scroll', onScrollCheck, { passive: true });
                iterListeners.push([t, h, 'scrollend']);
                iterListeners.push([t, onScrollCheck, 'scroll']);
            });

            // если скролл не начался за 100 мс — сразу выходим
            fallbackTimeout = setTimeout(() => {
                if (!scrollStarted) {
                    this.debug('scrollTO; !scrollStarted нечего скролить');
                    finishIter();
                }
            }, 100);

            // жёсткий потолок — если scrollend не пришёл вообще
            hardTimeout = setTimeout(() => {
                this.debug('scrollTO; hard timeout 2000');
                finishIter();
            }, 2000);
        });
    };

    // ── блок СРАЗУ, до цикла waitAssets ──
    if (lockEvents) {
        this._lockScrollEvents({ element: element });
    }

    const runOnce = () => {
        if (!isCurrent()) return Promise.resolve(false);
        setState('scroll');
        return doScroll(element, options);
    };

    if (!waitAssets) {
        runOnce()
            .then(() => finish())
            .catch((err) => { finish(); throw err; });

        return outerPromise;
    }

    let started = false;
    const onBefore = () => { started = true; };
    this.bus.addEventListener('qu:assets:before', onBefore);

    const cycle = () => {
        if (!isCurrent()) return Promise.resolve(false);

        return runOnce().then(() => {
            if (!isCurrent()) return false;

            const size = self._loadingAssets ? self._loadingAssets.size : 0;
            if (size === 0 && !started) return false;

            setState('wait');
            return idle().then(() => {
                if (!isCurrent()) return false;
                started = false;
                return cycle();
            });
        });
    };

    cycle()
        .then(() => {
            this.bus.removeEventListener('qu:assets:before', onBefore);
            finish();
        })
        .catch((err) => {
            this.bus.removeEventListener('qu:assets:before', onBefore);
            finish();
            throw err;
        });

    return outerPromise;
},