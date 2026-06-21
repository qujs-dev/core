/*!
 * Qu v1.0.6
 * Custom utilities
 *  
 * @author Serge Galich <gaserge@mail.ru>
 * @copyright 2025
 * @license MIT
 * @website https://qujs.ru/
 */
(function(global) {
    'use strict';
    
    if (global.Qu) {
        global.Qu.debug(`⚠️ [Qu] Already registered, skipping duplicate`);
        return;
    }

    const scriptConfig = {};

    if (typeof location !== 'undefined' && location.search) {
        const params = new URLSearchParams(location.search);
        
        const urlSettings = [
            ['_qudebug', '_debug'],
            ['_qudebugType', '_debugType'],
            ['_qudebugEvents', '_debugEvents']
        ];
    
        for (const [urlParam, configKey] of urlSettings) {
            if (params.has(urlParam)) {
                const val = params.get(urlParam);
                if (val === '0' || val === 'false') {
                    scriptConfig[configKey] = false;
                } else if (val === '1' || val === 'true') {
                    scriptConfig[configKey] = true;
                }
            }
        }
    }

    const config = {
        ...scriptConfig
    };
    const Qu = {
        name: 'Qu',
        version: '1.0',

        _debug: false,
        _debugType: true,
        _debugEvents: false,

        _initOnce: false,

        status: {
            domReady: false,
            pageReady: false,
        },

        _firedEvents: {},

        _assetChain: Promise.resolve(),
        _loadingAssets: null,
        _loadedAssets: null,

        _breakpointQueries: {
            xs: 0,
            sm: 576,
            md: 768,
            lg: 992,
            xl: 1200,
            xxl: 1400
        },
        _breakpointMQLs: {},
        _currentBreakpoint: 'xs',

        breakpoint: {
            get current() { return Qu._currentBreakpoint; },
        
            up: function(name) {
                var min = Qu._breakpointQueries[name];
                if (min === undefined) return false;
                if (min === 0) return true;
                return window.matchMedia('(min-width: ' + min + 'px)').matches;
            },
        
            down: function(name) {
                var keys = Object.keys(Qu._breakpointQueries).sort(function(a, b) {
                    return Qu._breakpointQueries[a] - Qu._breakpointQueries[b];
                });
                var idx = keys.indexOf(name);
                if (idx === -1) return false;
                for (var i = idx + 1; i < keys.length; i++) {
                    var nextMin = Qu._breakpointQueries[keys[i]];
                    if (nextMin > 0) {
                        return window.matchMedia('(max-width: ' + (nextMin - 0.02) + 'px)').matches;
                    }
                }
                return true;
            },
        
            only: function(name) {
                return this.up(name) && this.down(name);
            },
        
            between: function(start, end) {
                return this.up(start) && this.down(end);
            },
        
            onChange: function(callback) {
                return Qu.when(callback, 'qu:breakpoint:change');
            }
        },

        _setupBreakpoints: function(custom) {
            var self = this;
            if (custom) Object.assign(self._breakpointQueries, custom);

            Object.values(self._breakpointMQLs).forEach(function(mql) {
                if (mql._listener) mql.removeEventListener('change', mql._listener);
            });
            self._breakpointMQLs = {};

            Object.entries(self._breakpointQueries).forEach(function(entry) {
                var name = entry[0];
                var minWidth = entry[1];
                if (minWidth === 0) return;
                var query = '(min-width: ' + minWidth + 'px)';
                var mql = window.matchMedia(query);
                self._breakpointMQLs[name] = mql;

                var listener = function() {
                    self._updateActiveBreakpoint();
                };
                mql.addEventListener('change', listener);
                mql._listener = listener;
            });

            self._updateActiveBreakpoint();
        },

        _updateActiveBreakpoint: function() {
            var self = this;
            var old = self._currentBreakpoint;
            var sorted = Object.entries(self._breakpointQueries).sort(function(a, b) {
                return b[1] - a[1];
            });
            var active = 'xs';
            for (var i = 0; i < sorted.length; i++) {
                var name = sorted[i][0];
                var minWidth = sorted[i][1];
                if (minWidth === 0) { active = name; break; }
                var mql = self._breakpointMQLs[name];
                if (mql && mql.matches) { active = name; break; }
            }
            self._currentBreakpoint = active;

            if (old !== active) {
                self.trigger(window, 'qu:breakpoint:change', {
                    detail: { previous: old, current: active }
                });
            }
        },

        isTouch:
            'ontouchstart' in global ||
            (global.DocumentTouch && document instanceof global.DocumentTouch) ||
            navigator.maxTouchPoints > 0 ||
            global.navigator.msMaxTouchPoints > 0,

        test: function(message = '🔎 Qu test') {
            console.log(message);
        },
        
        use: function(fn) {
            if (typeof fn === 'function') {
              fn(this);
            }
        },

        extend: function() {
            if (Array.isArray(global.QuExtend)) {
                global.QuExtend.forEach((fn) => {
                  this.use(fn);
                });
                global.QuExtend = [];
            }
        },

        loaded: function() {
            this.debug(`📗 [Qu] loaded`);
        },

        initOnce: function(finalConfig) {
            if(this._initOnce === true) { return; }
            this._initOnce = true;

            for (const [key, value] of Object.entries(finalConfig)) {
                this[key] = value;
            }
            if (finalConfig._debug !== undefined) {
                this._debug = finalConfig._debug;
            }
            if (finalConfig._debugType !== undefined) {
                this._debugType = finalConfig._debugType;
            }
            this.debug('⚙️ [Qu] Init', finalConfig);

            this._setupBreakpoints(finalConfig.breakpoints);

        },

        init: function(params = {}) {
            const finalConfig = {
                ...config,
                ...params
            };
            this.initOnce(finalConfig);
        },

        parents: function(el, selector) {
            const parents = [];
            while ((el = el.parentNode) && el !== document) {
                if (!selector || el.matches(selector)) parents.push(el);
            }
            return parents;
        },
        
        getElementStyles: function(element) {
            return element.currentStyle || global.getComputedStyle(element);
        },
		

        _getNested: function(path) {
            const parts = path.split('.');
            let obj = window;
        
            for (const p of parts) {
                if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function')) {
                    return undefined;
                }
                obj = obj[p];
            }
        
            return obj;
        },

        _defId: 0,
        _defRefs: new Map(),
        
        defOff: function(ids) {
            if (ids == null) return false;
        
            const list = Array.isArray(ids) ? ids : [ids];
            let removed = false;
        
            list.forEach(id => {
                const ref = this._defRefs.get(id);
                if (!ref) return;
        
                ref.listener.active = false;
        
                if (ref.list && Array.isArray(ref.list)) {
                    const i = ref.list.indexOf(ref.listener);
                    if (i !== -1) {
                        ref.list.splice(i, 1);
                    }
                }
        
                this._defRefs.delete(id);
                removed = true;
            });
        
            return removed;
        },
        def: function(paths, callback, once = true, mode = true) {
            const every = !once;
            const self = this;
        
            const isTrackable = (value) => {
                return value != null && (typeof value === 'object' || typeof value === 'function');
            };
        
            const makeListener = (callback, every, list) => {
                const id = ++self._defId;
                const listener = {
                    id,
                    callback,
                    every,
                    active: true
                };
        
                self._defRefs.set(id, {
                    listener,
                    list
                });
        
                return listener;
            };
        
            const cleanupListener = (listener, list) => {
                if (!listener) return;
        
                listener.active = false;
        
                if (listener.id) {
                    self._defRefs.delete(listener.id);
                }
        
                if (list && Array.isArray(list)) {
                    const i = list.indexOf(listener);
                    if (i !== -1) {
                        list.splice(i, 1);
                    }
                }
            };
        
            const fireListener = (listener, value, path) => {
                if (!listener || !listener.active) return false;
        
                listener.callback(value);
                self.trigger(global, 'qu:def:resolve', {
                    detail: { path, value }
                });
        
                return listener.every;
            };
        
            // ============================================================
            // Режим 1: массив путей
            // ============================================================
            if (Array.isArray(paths)) {
                const list = paths;
                let firedOnce = false;
                const triggered = new Set();
                const childIds = [];
        
                const tryFinish = () => {
                    let ready = false;
        
                    if (mode) {
                        ready = list.every(p =>
                            window[p] !== undefined ||
                            (p.includes('.') ? self._getNested(p) !== undefined : false)
                        );
                    } else {
                        ready = list.every(p => triggered.has(p));
                    }
        
                    if (ready && !firedOnce) {
                        if (!every) firedOnce = true;
        
                        const current = {};
                        list.forEach(p => {
                            current[p] = p.includes('.') ? self._getNested(p) : window[p];
                        });
        
                        callback(current);
        
                        if (every && !mode) {
                            triggered.clear();
                        }
        
                        if (!every) {
                            self.defOff(childIds);
                        }
                    }
                };
        
                const updateVar = (path) => {
                    if (!triggered.has(path)) {
                        triggered.add(path);
                    }
                    tryFinish();
                };
        
                list.forEach((path) => {
                    const id = self.def(path, () => {
                        updateVar(path);
                    }, false);
        
                    if (id != null) {
                        childIds.push(id);
                    }
                });
        
                tryFinish();
                return childIds;
            }
        
            // ============================================================
            // Режим 2: одиночный путь
            // ============================================================
            const varName = paths;
            const parts = varName.split('.');
            const rootVar = parts[0];
            const restPath = parts.slice(1);
        
            // --- Случай 1: простая переменная ---
            if (restPath.length === 0) {
                if (!self._defStore) self._defStore = {};
        
                if (!self._defStore[rootVar]) {
                    const data = {
                        value: window[rootVar],
                        listeners: []
                    };
        
                    self._defStore[rootVar] = data;
        
                    Object.defineProperty(window, rootVar, {
                        get() {
                            return data.value;
                        },
                        set(value) {
                            data.value = value;
        
                            for (let i = data.listeners.length - 1; i >= 0; i--) {
                                const listener = data.listeners[i];
        
                                if (!listener.active) {
                                    data.listeners.splice(i, 1);
                                    continue;
                                }
        
                                const keep = fireListener(listener, value, varName);
        
                                if (!keep) {
                                    cleanupListener(listener, data.listeners);
                                }
                            }
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
        
                const store = self._defStore[rootVar];
                const listener = makeListener(callback, every, store.listeners);
        
                if (store.value !== undefined) {
                    const keep = fireListener(listener, store.value, varName);
        
                    if (keep) {
                        store.listeners.push(listener);
                    } else {
                        cleanupListener(listener);
                    }
                } else {
                    store.listeners.push(listener);
                }
        
                return listener.id;
            }
        
            // --- Случай 2: вложенный путь ---
            if (!self._nestedDefStore) self._nestedDefStore = {};
        
            if (!self._nestedDefStore[varName]) {
                self._nestedDefStore[varName] = {
                    listeners: [],
                    ready: false,
                    rootWatchId: null
                };
            }
        
            const entry = self._nestedDefStore[varName];
            const listener = makeListener(callback, every, entry.listeners);
        
            const trySetup = () => {
                if (entry.ready) return;
        
                let target = window[rootVar];
                if (!isTrackable(target)) return;
        
                for (let i = 0; i < restPath.length - 1; i++) {
                    if (!isTrackable(target)) return;
                    target = target[restPath[i]];
                }
        
                const lastKey = restPath[restPath.length - 1];
                if (!isTrackable(target)) return;
        
                let _val = target[lastKey];
        
                Object.defineProperty(target, lastKey, {
                    get() {
                        return _val;
                    },
                    set(value) {
                        _val = value;
        
                        entry.listeners = entry.listeners.filter(listener => {
                            if (!listener.active) return false;
                            return fireListener(listener, value, varName);
                        });
                    },
                    configurable: true,
                    enumerable: true
                });
        
                entry.ready = true;
        
                if (entry.rootWatchId != null) {
                    self.defOff(entry.rootWatchId);
                    entry.rootWatchId = null;
                }
        
                if (_val !== undefined) {
                    entry.listeners = entry.listeners.filter(listener => {
                        if (!listener.active) return false;
                        return fireListener(listener, _val, varName);
                    });
                }
            };
        
            entry.listeners.push(listener);
            trySetup();
        
            if (!entry.ready && entry.rootWatchId == null) {
                entry.rootWatchId = self.def(rootVar, () => {
                    trySetup();
                }, false);
            }
        
            return listener.id;
        },

		_whenId: 0,
		_whenStore: Object.create(null),
		_whenMap: new Map(),
		_whenNative: Object.create(null),

		when: function(
			callback,
			ev = 'qu:dom',
			onceOrOptions = true,
			mode = true,
			useCache = true
		) {
			const events = Array.isArray(ev) ? ev.slice() : [ev];
			const id = ++this._whenId;

			let options;

			if (
				onceOrOptions &&
				typeof onceOrOptions === 'object' &&
				!Array.isArray(onceOrOptions)
			) {
				options = {
					once: onceOrOptions.once !== undefined ? !!onceOrOptions.once : true,
					mode: onceOrOptions.mode !== undefined ? onceOrOptions.mode : true,
					useCache: onceOrOptions.useCache !== undefined ? !!onceOrOptions.useCache : true
				};
			} else {
				options = {
					once: !!onceOrOptions,
					mode: mode,
					useCache: !!useCache
				};
			}

			let modeName = 'multi';

			if (options.mode === true) {
				modeName = 'multi';
			} else if (options.mode === false) {
				modeName = 'series';
			} else if (typeof options.mode === 'string') {
				const normalized = options.mode.toLowerCase().trim();

				if (
					normalized === 'multi' ||
					normalized === 'series' ||
					normalized === 'ordered'
				) {
					modeName = normalized;
				} else {
					this.debug(`⚠️ [Qu.when] Unknown mode "${options.mode}", fallback to "multi"`);
				}
			}

			const sub = {
				id: id,
				callback: callback,
				events: events,
				once: options.once,
				mode: modeName,
				useCache: (modeName === 'multi' || modeName === 'series') ? options.useCache : false,
				active: true,
				triggered: new Set(),
				step: 0
			};

			this._whenMap.set(id, sub);

			if (sub.useCache) {
				for (let i = 0; i < events.length; i++) {
					const eventName = events[i];

					if (this._firedEvents && this._firedEvents[eventName]) {
						sub.triggered.add(eventName);
					}
				}
			}

			if (this._whenIsReady(sub)) {
				callback(this, {});

				if (sub.once) {
					this._whenMap.delete(id);
					return id;
				}

				if (sub.mode !== 'multi') {
					sub.triggered.clear();
					sub.step = 0;
				}
			}

			for (let i = 0; i < events.length; i++) {
				const eventName = events[i];

				if (!this._whenStore[eventName]) {
					this._whenStore[eventName] = [];
				}

				this._whenStore[eventName].push(sub);
				this._whenEnsureNative(eventName);
			}

			return id;
		},
		
		_whenEnsureNative: function(eventName) {
			if (this._whenNative[eventName]) return;

			const self = this;

			this._whenNative[eventName] = function(e) {
				self._whenDispatch(eventName, e);
			};

			window.addEventListener(eventName, this._whenNative[eventName]);
		},
		_whenIsReady: function(sub) {
			if (sub.mode === 'ordered') {
				return sub.step >= sub.events.length;
			}

			if (sub.mode === 'multi') {
				for (let i = 0; i < sub.events.length; i++) {
					const eventName = sub.events[i];
					const inTriggered = sub.triggered.has(eventName);
					const inCache =
						sub.useCache &&
						this._firedEvents &&
						this._firedEvents[eventName];

					if (!inTriggered && !inCache) {
						return false;
					}
				}

				return true;
			}

			// series
			for (let i = 0; i < sub.events.length; i++) {
				if (!sub.triggered.has(sub.events[i])) {
					return false;
				}
			}

			return true;
		},
		
		_whenDispatch: function(eventName, e) {
			const list = this._whenStore[eventName];
			if (!list || !list.length) return;

			const removeIds = [];
			//const detail = e && e.detail ? e.detail : {};
            const detail = e && ('detail' in e) ? e.detail : {};

			for (let i = 0; i < list.length; i++) {
				const sub = list[i];
				if (!sub || !sub.active) continue;

				if (sub.mode === 'ordered') {
					const expected = sub.events[sub.step];

					if (eventName === expected) {
						sub.step++;
					} else {
						sub.step = eventName === sub.events[0] ? 1 : 0;
					}
				} else {
					sub.triggered.add(eventName);
				}

				if (!this._whenIsReady(sub)) continue;

				sub.callback(this, detail);

                this.trigger(global, 'qu:when:resolve', { 
                    detail: { 
                        id: sub.id, 
                        events: sub.events, 
                        mode: sub.mode, 
                        originalEvent: e?.type, 
                        detail 
                    } 
                });

				if (sub.once) {
					sub.active = false;
					removeIds.push(sub.id);
				} else if (sub.mode !== 'multi') {
					sub.triggered.clear();
					sub.step = 0;
				}
			}

			if (removeIds.length) {
				this.whenOff(removeIds);
			}
		},
		
		whenOff: function(ids) {
			if (ids == null) return;

			const idList = Array.isArray(ids) ? ids : [ids];
			if (!idList.length) return;

			const idSet = new Set(idList);

			idList.forEach(id => {
				const sub = this._whenMap.get(id);
				if (sub) {
					sub.active = false;
					this._whenMap.delete(id);
				}
			});

			for (const eventName in this._whenStore) {
				const list = this._whenStore[eventName];
				if (!list || !list.length) continue;

				this._whenStore[eventName] = list.filter(sub => sub && sub.active && !idSet.has(sub.id));

				if (!this._whenStore[eventName].length) {
					if (this._whenNative[eventName]) {
						window.removeEventListener(eventName, this._whenNative[eventName]);
						delete this._whenNative[eventName];
					}
					delete this._whenStore[eventName];
				}
			}
		},

        _handlers: new Map(),

        on: function(eventTypes, selector, callback, options) {
            if (typeof selector === 'function') {
                options = callback || {};
                callback = selector;
                selector = window;
            }
            options = options || {};

            if (selector && 
                (selector instanceof NodeList || 
                    selector instanceof HTMLCollection ||
                Array.isArray(selector))) {
                
                const elements = selector;
                if (this._debugEvents) {
                    this.debug('🟡 [Qu] on (collection mode)', { elements, eventTypes, callback, options });
                }
                
                elements.forEach(element => {
                    this.on(eventTypes, element, callback, options);
                });
                return;
            }

            if (selector && typeof selector !== 'string' && selector.addEventListener) {
                const element = selector;
                
                if (this._debugEvents) {
                    this.debug('🟡 [Qu] on (element mode)', { element, eventTypes, callback, options });
                }
                
                if (typeof eventTypes === 'string') {
                    eventTypes = eventTypes.split(' ').filter(e => e.trim());
                }
                
                eventTypes.forEach(eventType => {
                    const eventHandler = function(event) {
                        event._target = element;
                        callback(event);
                    };
                    
                    const handlerKey = `${element._quId || (element._quId = Math.random())}:${eventType}:${callback.toString()}`;
                    if (!this._handlers.has(element)) this._handlers.set(element, new Map());
                    this._handlers.get(element).set(handlerKey, { wrapper: eventHandler, options });
                    
                    element.addEventListener(eventType.trim(), eventHandler, options);
                });
                
                return;
            }

            if (this._debugEvents) {
                this.debug('🟡 [Qu] on (selector mode)', { selector, eventTypes, callback, options });
            }
            
            if (typeof eventTypes === 'string') {
                eventTypes = eventTypes.split(' ').filter(e => e.trim());
            }
            
            eventTypes.forEach(eventType => {
                const eventHandler = function(event) {
                    if (typeof event.target.closest !== 'function') {
                        event._target = event.detail;
                        event.detail.dispatchEvent(new Event(event.type));
                        callback(event);
                    } else {
                        if (event.target.closest(selector)) {
                            event._target = event.target.closest(selector);
                            callback(event);
                        }
                    }
                };
                
                const delKey = `del:${eventType}:${selector}:${callback.toString()}`;
                if (!this._handlers.has('document')) this._handlers.set('document', new Map());
                this._handlers.get('document').set(delKey, { wrapper: eventHandler, options, selector });
                
                if (this._debugEvents) {
                    this.debug('🟡 [Qu] on listener', { selector, eventType, callback, options });
                }
                document.addEventListener(eventType.trim(), eventHandler, options);
            });
        },

        off: function(eventTypes, selector, callback, options) {
            options = options || {};

            if (selector && 
                (selector instanceof NodeList || 
                    selector instanceof HTMLCollection ||
                Array.isArray(selector))) {
                
                const elements = selector;
                if (this._debugEvents) {
                    this.debug('🔴 [Qu] off (collection mode)', { elements, eventTypes, callback, options });
                }
                
                elements.forEach(element => {
                    this.off(eventTypes, element, callback, options);
                });
                return;
            }
            
            if (selector && typeof selector !== 'string' && selector.removeEventListener) {
                const element = selector;
                
                if (typeof eventTypes === 'string') {
                    eventTypes = eventTypes.split(' ').filter(e => e.trim());
                }
                
                eventTypes.forEach(eventType => {
                    if (!callback) {
                        element.replaceWith(element.cloneNode(true));
                        this._handlers.delete(element);
                        if (this._debugEvents) {
                            this.debug('🔴 [Qu] Element cloned - all listeners removed');
                        }
                    } else {
                        const handlers = this._handlers.get(element);
                        if (handlers) {
                            const keysToDelete = [];
                            for (const [key, data] of handlers.entries()) {
                                if (key.includes(eventType + ':' + callback.toString())) {
                                    element.removeEventListener(eventType.trim(), data.wrapper, data.options);
                                    keysToDelete.push(key);
                                    
                                    if (this._debugEvents) {
                                        this.debug('🔴 [Qu] Removed element listener', { element, eventType, callback });
                                    }
                                }
                            }
                            keysToDelete.forEach(key => handlers.delete(key));
                            if (handlers.size === 0) this._handlers.delete(element);
                        }
                    }
                });
                
                return;
            }
            
            if (typeof eventTypes === 'string') {
                eventTypes = eventTypes.split(' ').filter(e => e.trim());
            }
            
            eventTypes.forEach(eventType => {
                const docHandlers = this._handlers.get('document');
                if (docHandlers) {
                    const keysToDelete = [];
                    for (const [key, data] of docHandlers.entries()) {
                        if (key.startsWith(`del:${eventType}:`) && 
                            key.includes(callback.toString()) &&
                            (!selector || data.selector === selector)) {
                            document.removeEventListener(eventType.trim(), data.wrapper, data.options);
                            keysToDelete.push(key);
                            if (this._debugEvents) {
                                this.debug('🔴 [Qu] Removed delegated listener', { eventType, selector, callback });
                            }
                        }
                    }
                    keysToDelete.forEach(key => docHandlers.delete(key));
                    if (docHandlers.size === 0) this._handlers.delete('document');
                }
            });
        },

        debounce: function(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },
        
        throttle: function(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        trigger: function(element, type, options = {}) {
            if (!element || !element.dispatchEvent) {
                return options.returnEvent ? null : false;
            }

            const {
                detail = {},
                bubbles = true,
                cancelable = true,
                composed = false,
                returnEvent = false,
                collect = false,
                timeout = 0
            } = options;

            if (this._debugEvents) {
                this.debug('📌 [Qu] trigger', { type, element, options });
            }

/*             if (element === window || element === document) {
				if (!this._firedEvents[type]) {
					this._firedEvents[type] = 0;
				}
			} */

            const event = new CustomEvent(type, { bubbles, cancelable, composed, detail: detail });

            if (!collect) {
                const dispatched = element.dispatchEvent(event);
                if (returnEvent) {
                    event.Qu = this;
                    event.stopPropagationCustom = () => event.stopPropagation();
                    event.stopImmediatePropagationCustom = () => event.stopImmediatePropagation();
                    return event;
                }
                return dispatched;
            }

            // Режим сбора ответов
            const syncResponses = [];
            const asyncPromises = [];

            const handler = (e) => {
                if (e.type !== type) return;
                const orig = e.respondWith;
                e.respondWith = (value) => {
                    if (value && typeof value.then === 'function') {
                        asyncPromises.push(value);
                    } else {
                        syncResponses.push(value);
                    }
                    if (orig) orig(value);
                };
                if (e.waitUntil) {
                    const origWait = e.waitUntil;
                    e.waitUntil = (promise) => {
                        asyncPromises.push(promise);
                        if (origWait) origWait(promise);
                    };
                }
            };

            element.addEventListener(type, handler);
            const dispatched = element.dispatchEvent(event);
            element.removeEventListener(type, handler);

            if (!dispatched && cancelable) {
                return Promise.reject(new Error('Event cancelled'));
            }

            if (asyncPromises.length === 0) {
                return Promise.resolve(syncResponses);
            }

            const allResults = Promise.allSettled(asyncPromises).then(results =>
                results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
            );

            if (timeout > 0) {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
                );
                return Promise.race([allResults, timeoutPromise])
                    .then(asyncValues => [...syncResponses, ...asyncValues]);
            }
            return allResults.then(asyncValues => [...syncResponses, ...asyncValues]);
        },

        loading: function(status, element, options = {}) {
            const eventData = { status, element, ...options };
            this.trigger(element, 'qu:loading:before', { detail: eventData });
            const handleEvent = this.trigger(element, 'qu:loading:handle', { detail: eventData, returnEvent: true });
            element.dispatchEvent(handleEvent);
            if (handleEvent.detail.handler && typeof handleEvent.detail.handler === 'function') {
                handleEvent.detail.handler(element, status, options);
            } else {
                element.setAttribute('data-qu-loading', status);
            }
            this.trigger(element, 'qu:loading:after', { detail: eventData });
        },

        scrollTo: function(element, options = {}) {
            return new Promise((resolve) => {
                if (!element || !element.scrollIntoView) {
                    resolve(false);
                    return;
                }
                
                const settings = {
                    hash: '',
                    block: 'center',
                    behavior: 'smooth',
                    scrollEndDelay: 150,
                    autoAdjust: true, 
                    autoAdjustThreshold: 0.8,
                    autoAdjustFrom: 'center',
                    autoAdjustTo: 'start', 
                    ...options
                };

                this.trigger(element, 'qu:scrollto:before', { detail: { element, options: settings } });

                if (settings.hash) {
                    try {
                        const newUrl = window.location.pathname + window.location.search + settings.hash;
                        history.pushState(null, null, newUrl);
                    } catch (e) {
                        window.location.hash = settings.hash;
                    }
                }
                
                void element.offsetHeight;

                let block = settings.block;
                if (settings.autoAdjust && block === settings.autoAdjustFrom) {
                    const elementHeight = element.offsetHeight;
                    const viewportHeight = window.innerHeight;
                    if (elementHeight > viewportHeight * settings.autoAdjustThreshold) {
                        block = settings.autoAdjustTo;
                    }
                }

                element.scrollIntoView({
                    behavior: settings.behavior,
                    block: block,
                    inline: settings.inline
                });
                
                if (settings.behavior !== 'smooth') {
                    setTimeout(() => {
                        this.trigger(element, 'qu:scrollto:after', { detail: { element, options: settings } });
                        resolve(true);
                    }, 0);
                    return;
                }
                
                let scrollStarted = false;
                let scrollEndTimeout;
                
                const onScrollCheck = () => { scrollStarted = true; };
                const handleScrollEnd = () => {
                    clearTimeout(scrollEndTimeout);
                    scrollEndTimeout = setTimeout(() => {
                        window.removeEventListener('scroll', handleScrollEnd);
                        this.trigger(element, 'qu:scrollto:after', { detail: { element, options: settings } });
                        resolve(true);
                    }, settings.scrollEndDelay);
                };
                
                window.addEventListener('scroll', onScrollCheck, { passive: true });
                window.addEventListener('scroll', handleScrollEnd, { passive: true });
                
                setTimeout(() => {
                    window.removeEventListener('scroll', onScrollCheck);
                    if (!scrollStarted) {
                        clearTimeout(scrollEndTimeout);
                        this.trigger(element, 'qu:scrollto:after', { detail: { element, options: settings } });
                        resolve(true);
                        return;
                    }
                    window.addEventListener('scroll', handleScrollEnd, { passive: true });
                }, 100);
            });
        },

        scrollToAccurate: function(element, options = {}) {
            const settings = { hash: '', block: 'center', behavior: 'smooth', ...options };
            if (settings.behavior !== 'smooth') {
                return this.scrollTo(element, settings);
            }
            return this.scrollTo(element, settings)
                .then(() => this.scrollTo(element, { block: settings.block, behavior: settings.behavior }));
        },

        dragScroll: function(container, options = {}) {
            if (!container || !container.addEventListener) return;
            if (container._dragScrollEnabled) return;
            container._dragScrollEnabled = true;
        
            container.setAttribute('data-qu-drag-scroll', '');
            
            if (container.scrollWidth > container.clientWidth + 1) {
                container.setAttribute('data-qu-draggable', 'true');
            } else {
                container.removeAttribute('data-qu-draggable');
            }
        
            const {
                exclude = null,
                speed = 1.5,
                threshold = 3,
                enableTouch = false
            } = options;
        
            let isDown = false;
            let startX = 0, startY = 0;
            let startScrollLeft = 0, startScrollTop = 0;
            let moved = false;
            let dragActive = false;
            let animationFrame = null;
        
            const onStart = (e) => {
                if (e.type === 'mousedown' && exclude && typeof exclude === 'string' && e.target.closest(exclude)) {
                    return;
                }
        
                const point = e.touches ? e.touches[0] : e;
                container.setAttribute('data-qu-dragging', '');
                dragActive = true;
                isDown = true;
                moved = false;
                startX = point.pageX;
                startY = point.pageY;
                startScrollLeft = container.scrollLeft;
                startScrollTop = container.scrollTop;
                e.preventDefault();
            };
        
            const stopDrag = () => {
                if (isDown || dragActive) {
                    container.removeAttribute('data-qu-dragging');
                    isDown = false;
                    dragActive = false;
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                        animationFrame = null;
                    }
                }
            };
        
            const onMove = (e) => {
                if (!isDown) return;
        
                const point = e.touches ? e.touches[0] : e;
                const deltaX = Math.abs(point.pageX - startX);
                const deltaY = Math.abs(point.pageY - startY);
        
                if (deltaX > threshold || deltaY > threshold) {
                    moved = true;
                    e.preventDefault();
        
                    if (animationFrame) return;
        
                    animationFrame = requestAnimationFrame(() => {
                        container.scrollLeft = startScrollLeft - (point.pageX - startX) * speed;
                        container.scrollTop  = startScrollTop  - (point.pageY - startY) * speed;
                        animationFrame = null;
                    });
                }
            };
        
            const onClickPrevent = (e) => {
                if (moved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                moved = false;
            };
        
            this.on('mousedown', container, onStart);
            this.on('mouseup', container, stopDrag);
            this.on('mouseleave', container, stopDrag);
            this.on('mousemove', container, onMove);
            container.addEventListener('click', onClickPrevent);
        
            if (enableTouch) {
                container.addEventListener('touchstart', onStart, { passive: false });
                container.addEventListener('touchend', stopDrag);
                container.addEventListener('touchcancel', stopDrag);
                container.addEventListener('touchmove', onMove, { passive: false });
            }
        
            if (!container._dragScrollHandlers) {
                container._dragScrollHandlers = {};
            }
            container._dragScrollHandlers = {
                onStart,
                stopDrag,
                onMove,
                onClickPrevent
            };
        },
  
        scrollFollowCursor: function(container, options = {}) {
            if (!container || !container.addEventListener) return;
          
            const {
              speed = 0.1,
              direction = 'both',
              margin = 0,
              enableTouch = false, 
              lockTouch = false      // блокировать ли скролл страницы (только если enableTouch = true)
            } = options;
          
            let rafId = null;
            let targetLeft = container.scrollLeft;
            let targetTop  = container.scrollTop;
          
            const animate = () => {
              const diffX = targetLeft - container.scrollLeft;
              const diffY = targetTop  - container.scrollTop;
              if (Math.abs(diffX) > 0.5 || Math.abs(diffY) > 0.5) {
                if (direction !== 'vertical') container.scrollLeft += diffX * speed;
                if (direction !== 'horizontal') container.scrollTop  += diffY * speed;
                rafId = requestAnimationFrame(animate);
              } else {
                if (direction !== 'vertical') container.scrollLeft = targetLeft;
                if (direction !== 'horizontal') container.scrollTop  = targetTop;
                rafId = null;
              }
            };
          
            const getCoords = (e) => {
              const rect = container.getBoundingClientRect();
              let clientX, clientY;
              if (e.touches) {
                if (e.touches.length === 0) return null;
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
              } else {
                clientX = e.clientX;
                clientY = e.clientY;
              }
              return { rect, clientX, clientY };
            };
          
            const onMove = (e) => {
              if (enableTouch && lockTouch && e.cancelable) {
                e.preventDefault();
              }
          
              const coords = getCoords(e);
              if (!coords) return;
              const { rect, clientX, clientY } = coords;
              const maxScrollX = container.scrollWidth  - container.clientWidth;
              const maxScrollY = container.scrollHeight - container.clientHeight;
          
              if (direction !== 'vertical' && maxScrollX > 0) {
                const mouseX = clientX - rect.left;
                const relX = Math.max(0, Math.min(1, (mouseX - margin) / (rect.width - 2 * margin)));
                targetLeft = relX * maxScrollX;
              }
              if (direction !== 'horizontal' && maxScrollY > 0) {
                const mouseY = clientY - rect.top;
                const relY = Math.max(0, Math.min(1, (mouseY - margin) / (rect.height - 2 * margin)));
                targetTop = relY * maxScrollY;
              }
          
              if (!rafId) {
                rafId = requestAnimationFrame(animate);
              }
            };
          
            
            const activate = () => container.setAttribute('data-qu-following', '');
            const deactivate = () => {
              container.removeAttribute('data-qu-following');
              if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
              }
            };
          
            
            const onMouseEnter = () => activate();
            const onMouseLeave = () => deactivate();
          
            this.on('mouseenter', container, onMouseEnter);
            this.on('mouseleave', container, onMouseLeave);
            this.on('mousemove', container, onMove);
          
            
            if (enableTouch) {
              const onTouchStart = (e) => {
                activate();
              };
              const onTouchEnd = () => deactivate();
              const onTouchCancel = () => deactivate();
          
              const touchMoveOpts = lockTouch ? { passive: false } : { passive: true };
              container.addEventListener('touchstart', onTouchStart);
              container.addEventListener('touchend', onTouchEnd);
              container.addEventListener('touchcancel', onTouchCancel);
              container.addEventListener('touchmove', onMove, touchMoveOpts);
          
              
              container._scrollFollowHandlers = {
                mouseEnter: onMouseEnter,
                mouseLeave: onMouseLeave,
                mouseMove: onMove,
                touchStart: onTouchStart,
                touchEnd: onTouchEnd,
                touchCancel: onTouchCancel,
                touchMove: onMove,
                touchMoveOpts
              };
            } else {
              container._scrollFollowHandlers = {
                mouseEnter: onMouseEnter,
                mouseLeave: onMouseLeave,
                mouseMove: onMove
              };
            }
        },
          
        scrollFollowCursorOff: function(container) {
            if (!container || !container._scrollFollowHandlers) return;
            const h = container._scrollFollowHandlers;
          
            this.off('mouseenter', container, h.mouseEnter);
            this.off('mouseleave', container, h.mouseLeave);
            this.off('mousemove', container, h.mouseMove);
          
            if (h.touchStart) {
              container.removeEventListener('touchstart', h.touchStart);
              container.removeEventListener('touchend', h.touchEnd);
              container.removeEventListener('touchcancel', h.touchCancel);
              container.removeEventListener('touchmove', h.touchMove, h.touchMoveOpts);
            }
          
            container.removeAttribute('data-qu-following');
            delete container._scrollFollowHandlers;
        },
          
		loadAssetsSafe: function(items, options = {}, timeoutMs = 5000) {
			return Promise.race([
				this.loadAssets(items, options),
				new Promise((_, reject) => 
					setTimeout(() => reject(new Error(`Timeout loading: ${items.join(', ')}`)), timeoutMs)
				)
			]);
		},

        loadAssets: function(items, options = {}) {
            if (typeof items === 'string') items = [items];
        
            const { 
                waitForLoad = true,
                preserveOrder = false, 
                stopOnError = false,
                ...assetOptions 
            } = options;
            
            this.trigger(global, 'qu:assets:before', { detail: { items, options } });

            if (!this._loadingAssets) {
                this._loadingAssets = new Map();
                this._loadedAssets = new Set();
                this._assetQueues = new Map();
            }
            
            const results = { list: items, loaded: 0, errors: 0, total: items.length };

            if (preserveOrder) {
                this.debug(`⏳ [Qu] Loading assets (ordered):`, items);
                const currentChain = this._assetChain;
                this._assetChain = currentChain.then(() => this._loadAssetsGroup(items, assetOptions, results, stopOnError))
                    .then(() => results)
                    .catch((error) => {
                        if (stopOnError) throw error;
                        return results;
                    });
                return this._assetChain;
            }
            
            if (!waitForLoad) {
                this.debug(`⏩ [Qu] Assets started (no wait):`, items);
                items.forEach(item => {
                    this._loadAssetInternal(item, assetOptions)
                        .then(() => { results.loaded++; this.debug(`✅ [Qu] Asset loaded in background:`, item); })
                        .catch((error) => { results.errors++; this.debug(`❌ [Qu] Asset failed in background:`, item, error); });
                });
                return Promise.resolve(results);
            }
            
            this.debug(`⏳ [Qu] Loading assets (waiting):`, items);
            const promises = items.map(item => this._loadAssetWithQueue(item, assetOptions, results));
            return Promise.allSettled(promises).then(() => {
                this.debug(`✅ [Qu] All assets loaded:`, results);
                this.trigger(global, 'qu:assets:after', { detail: results });
                return results;
            });
        },
        
        _loadAssetsGroup: function(items, options, results, stopOnError = false) {
            let promise = Promise.resolve();
            items.forEach(item => {
                promise = promise.then(() => this._loadAssetInternal(item, options)
                    .then(result => { results.loaded++; return result; })
                    .catch(error => { results.errors++; if (stopOnError) throw error; return null; })
                );
            });
            return promise;
        },

        _loadAssetWithQueue: function(item, options, results) {
            const cacheKey = typeof item === 'string' ? item : JSON.stringify(item);
            if (!this._assetQueues.has(cacheKey)) this._assetQueues.set(cacheKey, []);
            const queue = this._assetQueues.get(cacheKey);
            
            return new Promise((resolve, reject) => {
                const loadTask = () => {
                    return this._loadAssetInternal(item, options)
                        .then(result => { results.loaded++; resolve(result); return result; })
                        .catch(error => { results.errors++; reject(error); throw error; })
                        .finally(() => {
                            queue.shift();
                            if (queue.length > 0) queue[0]();
                        });
                };
                queue.push(loadTask);
                if (queue.length === 1) loadTask();
            });
        },

        _loadAssetInternal: function(item, options) {
            const {
                force = false, type = 'auto', id = null, media = 'all',
                insertBefore = null, customHandler = null, ...customOptions
            } = options;
            
            return new Promise((resolve, reject) => {
                const cacheKey = typeof item === 'string' ? item : JSON.stringify(item);
                
                if (this._loadedAssets.has(cacheKey)) {
                    this.debug(`📦 [Qu] Asset from cache:`, item);
                    resolve(item);
                    return;
                }
                
                if (this._loadingAssets.has(cacheKey)) {
                    this.debug(`⏳ [Qu] Asset already loading:`, item);
                    this._loadingAssets.get(cacheKey).then(resolve).catch(reject);
                    return;
                }
                
                let assetType = type;
                if (assetType === 'auto' && typeof item === 'string') {
                    if (item.match(/\.(js|mjs)$/i)) assetType = 'script';
                    else if (item.match(/\.(css)$/i)) assetType = 'style';
                    else if (item.match(/\.(png|jpe?g|gif|svg|webp|ico)$/i)) assetType = 'image';
                    else assetType = 'unknown';
                }
                
                if (assetType === 'custom' && customHandler) {
                    customHandler(item, { resolve, reject, debug: this.debug.bind(this) });
                    return;
                }
                
                if (!force) {
                    if (assetType === 'script' && document.querySelector(`script[src="${item}"]`)) {
                        this._loadedAssets.add(cacheKey);
                        this.debug(`📦 [Qu] Asset already in DOM:`, item);
                        resolve(item);
                        return;
                    }
                    if (assetType === 'style' && document.querySelector(`link[href="${item}"]`)) {
                        this._loadedAssets.add(cacheKey);
                        this.debug(`📦 [Qu] Asset already in DOM:`, item);
                        resolve(item);
                        return;
                    }
                    if (assetType === 'image') {
                        const testImg = new Image();
                        testImg.src = item;
                        if (testImg.complete) {
                            this._loadedAssets.add(cacheKey);
                            resolve(item);
                            return;
                        }
                    }
                }
                
                let element;
                
                switch(assetType) {
                    case 'script':
                        element = document.createElement('script');
                        element.src = item;
                        element.async = true;
                        element.onload = () => {
                            this._loadedAssets.add(cacheKey);
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`✅ [Qu] JS loaded: ${item}`);
                            this.trigger(global, 'qu:asset:loaded', { detail: { item, type: 'script', id } });
                            resolve(item);
                        };
                        element.onerror = (error) => {
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`❌ [Qu] JS failed: ${item}`);
                            this.trigger(global, 'qu:asset:error', { detail: { item, type: 'script', error, id } });
                            reject(error);
                        };
                        break;

                    case 'style':
                        const link = document.createElement('link');
                        element = link; 
                        link.rel = 'preload';
                        link.as = 'style';
                        link.href = item;
                    
                        let resolved = false;
                    
                        link.onload = () => {
                            if (resolved) return;
                            resolved = true;
                            link.rel = 'stylesheet';
                            this._loadedAssets.add(cacheKey);
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`✅ [Qu] CSS loaded: ${item}`);
                            this.trigger(global, 'qu:asset:loaded', { detail: { item, type: 'style', id } });
                            resolve(item);
                        };
                    
                        link.onerror = (error) => {
                            if (resolved) return;
                            resolved = true;
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`❌ [Qu] CSS failed: ${item}`);
                            this.trigger(global, 'qu:asset:error', { detail: { item, type: 'style', error, id } });
                            reject(error);
                        };
                    
                        document.head.appendChild(link);
                        break;
                        
                    case 'image':
                        element = new Image();
                        element.src = item;
                        element.onload = () => {
                            this._loadedAssets.add(cacheKey);
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`✅ [Qu] Image loaded: ${item}`);
                            this.trigger(global, 'qu:asset:loaded', { detail: { item, type: 'image', id } });
                            resolve(item);
                        };
                        element.onerror = (error) => {
                            this._loadingAssets.delete(cacheKey);
                            this.debug(`❌ [Qu] Image failed: ${item}`, error);
                            this.trigger(global, 'qu:asset:error', { detail: { item, type: 'image', error, id } });
                            reject(new Error(`Failed to load image: ${item}`));
                        };
                        return;
                        
                    case 'inline':
                        if (item.css) {
                            element = document.createElement('style');
                            if (id) element.id = id;
                            element.textContent = item.css;
                        } else if (item.js) {
                            element = document.createElement('script');
                            if (id) element.id = id;
                            element.textContent = item.js;
                        }
                        break;
                        
                    default:
                        reject(new Error(`Unknown asset type: ${assetType}`));
                        return;
                }
                
                if (!element) {
                    reject(new Error(`Failed to create element for: ${item}`));
                    return;
                }
        
                if (assetType === 'script' || assetType === 'style') {
                    Object.entries(customOptions).forEach(([key, value]) => element.setAttribute(key, value));
                }
        
                if (typeof item === 'string' && id && assetType !== 'image') {
                    element.id = id;
                }
                
                if (assetType !== 'image' && assetType !== 'script' && assetType !== 'style') {
                    const loadHandler = () => {
                        this._loadedAssets.add(cacheKey);
                        this._loadingAssets.delete(cacheKey);
                        this.debug(`✅ [Qu] Asset loaded: ${item}`);
                        this.trigger(global, 'qu:asset:loaded', { detail: { item, type: 'inline', id } });
                        resolve(item);
                    };
                    const errorHandler = (error) => {
                        this._loadingAssets.delete(cacheKey);
                        this.debug(`❌ [Qu] Asset failed: ${item}`, error);
                        this.trigger(global, 'qu:asset:error', { detail: { item, type: 'inline', error, id } });
                        reject(new Error(`Failed to load asset: ${item}`));
                    };
                    if (assetType === 'inline') loadHandler();
                    else {
                        element.onload = loadHandler;
                        element.onerror = errorHandler;
                    }
                }
                
                if (assetType !== 'image') {
                    if (insertBefore) {
                        const beforeElement = document.querySelector(insertBefore);
                        if (beforeElement) {
                            beforeElement.parentNode.insertBefore(element, beforeElement);
                        } else {
                            document.head.appendChild(element);
                        }
                    } else {
                        document.head.appendChild(element);
                    }
                }
            });
        },

        deepSortObject: function(obj) {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(item => this.deepSortObject(item)).sort();
            return Object.keys(obj).sort().reduce((acc, key) => {
                acc[key] = this.deepSortObject(obj[key]);
                return acc;
            }, {});
        },

        debug: function(message, ...args) {
            if (!this._debug) return;
            if (this._debugType) {
                console.groupCollapsed(message, ...args);
                console.trace();
                try {
                    const targetLine = new Error().stack.split('\n')[2]?.trim().replace(/^at /, '');
                    //const targetLine = new Error().stack.split('\n')[3]?.trim().replace(/^at /, '');

                    console.log(`%c📍 ${targetLine}`, 'color: #000; font-weight: bold;');
                } catch (e) {}
                console.groupEnd();
            } else {
                console.debug(message, ...args);
            }
        }, 

        _setupLibraryDebug: function(instance, initParams = {}) {
            if (instance._urlDebug !== undefined) {
                instance._debug = instance._urlDebug;
                return;
            }
            if (initParams._debug !== undefined) {
                instance._debug = initParams._debug;
                return;
            }
            if (instance._debug === undefined) {
                instance._debug = true;
            }
        },

        lib: function(name, instance) {
            if (this[name]) {
                this.debug(`⚠️ [Qu] Library ${name} already registered`);
                return;
            }

            this.debug('📚 [Qu] Library registered:', name);

            if (typeof location !== 'undefined' && location.search) {
                const params = new URLSearchParams(location.search);
                const debugParam = `_qu-${name.toLowerCase()}-debug`;
                if (params.has(debugParam)) {
                    const val = params.get(debugParam);
                    if (val == '0') instance._urlDebug = false;
                    else if (val == '1') instance._urlDebug = true;
                }
            }

            if (instance) this[name] = instance;

            if (instance && typeof instance.loaded === 'function') {
                instance.loaded(this);
            }

            this.trigger(global, 'qu:lib:loaded', { detail: { Qu: this, name, instance } });
            this.trigger(global, `qu:${name}:loaded`, { detail: { Qu: this, name, instance } });
        },

        libs: function(libNames, options = {}) {
            const _this = this;
            const cacheKey = JSON.stringify(this.deepSortObject({
                libs: libNames.sort(),
                autoInit: options.autoInit === true ? true : false,
                excludeInit: (options.excludeInit || []).sort(),
                initParams: options.initParams || {}
            }));
            
            const fireAlwaysEvent = (instances, cached = false) => {
                this.trigger(global, 'qu:libs:always', { 
                    detail: { Qu: this, libNames, instances, options: { ...options }, cached }
                });
            };
            
            if (this._libPromises && this._libPromises.has(cacheKey)) {
                const cachedPromise = this._libPromises.get(cacheKey);
                cachedPromise.then(instances => fireAlwaysEvent(instances, true));
                return cachedPromise;
            }
            
            if (!this._libPromises) this._libPromises = new Map();

            const promise = new Promise((resolve) => {
                const { autoInit = false, initParams = {}, excludeInit = [] } = options;
                const loadedLibs = new Set();

                const completeLoading = (instances, loadType) => {
                    if (autoInit) {
                        instances.forEach(instance => {
                            if (instance && typeof instance.init === 'function') {
                                const libIdentifier = instance.libName || instance.name;
                                const initConfig = initParams[libIdentifier] || {};
                                this._setupLibraryDebug(instance, initConfig);
                                if (!excludeInit.includes(libIdentifier)) {
                                    instance.init(this, initConfig);
                                }
                            }
                        });
                    }
                    this.trigger(global, 'qu:libs:ready', { 
                        detail: { Qu: this, libNames, instances, options, loadType, cached: false }
                    });
                    fireAlwaysEvent(instances, false);
                    resolve(instances);
                };
                
                const handler = (event) => {
                    const libName = event.detail.name;
                    if (libNames.includes(libName)) {
                        loadedLibs.add(libName);
                        if (libNames.every(lib => loadedLibs.has(lib))) {
                            global.removeEventListener('qu:lib:loaded', handler);
                            const instances = libNames.map(lib => _this[lib]);
                            completeLoading(instances, 'lazy-loaded');
                        }
                    }
                };
                
                global.addEventListener('qu:lib:loaded', handler);
                
                libNames.forEach(libName => {
                    if (_this[libName]) loadedLibs.add(libName);
                });
                
                if (libNames.every(lib => loadedLibs.has(lib))) {
                    global.removeEventListener('qu:lib:loaded', handler);
                    const instances = libNames.map(lib => _this[lib]);
                    completeLoading(instances, 'pre-loaded');
                }
            });

            this._libPromises.set(cacheKey, promise);
            return promise;
        },

        dom: function() {
            return new Promise((resolve) => {
                if (document.readyState !== 'loading') resolve();
                else document.addEventListener('DOMContentLoaded', resolve);
            });
        },

        page: function() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') resolve();
                else global.addEventListener('load', resolve);
            });
        },
    };

	if (!window.Que) {
	  (function () {
		var originalDispatch = window.dispatchEvent;
		var fired = window._QueFired || (window._QueFired = {});
		var queue = window._QueQ || (window._QueQ = []);

		window.dispatchEvent = function (event) {
		  if (event && event.type) {
			fired[event.type] = (fired[event.type] || 0) + 1;
		  }
		  return originalDispatch.call(window, event);
		};

		window.Que = function (callback, ev, onceOrOptions, mode, useCache) {
			if (window.Qu && typeof window.Qu.when === 'function') {
				return window.Qu.when(callback, ev, onceOrOptions, mode, useCache);
			}
			queue.push([callback, ev, onceOrOptions, mode, useCache]);
		};
	  })();
	};

    global.Qu = Qu;
    Qu.debug('📚 [Qu] Registered');
    Qu.extend();
    Qu.loaded();

	Qu._firedEvents = window._QueFired || {};
	window._QueFired = Qu._firedEvents;
	
	if (Array.isArray(window._QueQ)) {
		window._QueQ.forEach(function(args) {
			Qu.when(args[0], args[1], args[2], args[3], args[4]);
		});
        Qu.trigger(global, 'qu:que:resolved', { detail: { count: window._QueQ } });
		window._QueQ = [];
	}

    Qu.trigger(global, 'qu:loaded', { detail: { Qu } });
    Qu.init();

    global._QuLibs = global._QuLibs || [];
    if (global._QuLibs.length) {
        global._QuLibs.forEach(lib => Qu.lib(lib.name, lib.instance));
        global._QuLibs = [];
    }
    
    Qu.dom().then(() => {
        Qu.status.domReady = true;
        Qu.debug('✅ [Qu] qu:dom');
        Qu.trigger(global, 'qu:dom', { detail: { Qu } });
    });
    
    Qu.page().then(() => {
        Qu.status.pageReady = true;
        Qu.debug('✅ [Qu] qu:ready');
        Qu.trigger(global, 'qu:ready', { detail: { Qu } });
    });

})(typeof window !== 'undefined' ? window : global);