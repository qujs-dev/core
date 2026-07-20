+ [[EN] README English](/README.en.md)
+ **[[RU] README Русский](/README.md)**

# Qu.js

- Сайт проекта: [https://qujs.ru/](https://qujs.ru/)
- Документация: [https://qujs.ru/api/](https://qujs.ru/api/)
- Лицензия: MIT (см. файл `LICENSE`)

Qu.js — это утилитарная JavaScript-библиотека, которая предоставляет независимые инструменты для решения типовых задач веб‑разработки: асинхронная загрузка скриптов и стилей, управление событиями, ожидание готовности DOM, подключение внешних библиотек и связь модулей.

Она не навязывает архитектуру, а просто даёт удобные инструменты, которые можно использовать по отдельности или вместе. Благодаря Promise‑based API и системе очередей (`Que`), вы можете выстраивать цепочки зависимостей и гарантировать, что код выполнится в нужный момент — будь то загрузка страницы, появление элемента в окне браузера или разрешение определённой переменной.

# Основные возможности
- **Очередь задач** (`Que`) — откладывайте выполнение функций до момента, когда произойдут одно или несколько событий (DOMReady, загрузка библиотеки, кастомный сигнал). Поддерживаются режимы «multi» (все события), «series» (последовательные события) и «ordered» (строгий порядок).
- **Управление событиями** (`on`, `off`, `trigger`) — подписка на события с делегированием, поддержкой коллекций элементов и возможностью собирать ответы от обработчиков.
- **Отслеживание появления переменных** (`def`) — реагируйте на момент, когда глобальная переменная или её вложенное свойство становится определённым.
- **Загрузка ассетов** (`loadAssets`) — загружайте скрипты, стили и изображения с контролем порядка и промисами.
- **Модульная архитектура** — основная библиотека служит ядром, а дополнительные модули (например, Lazy для ленивой загрузки) подключаются как плагины через `Qu.lib()`.
- и некоторые утилиты для работы с DOM и прокруткой.

# Философия

> **Que — от queue, Qu — от query. Ключевая идея проста: задачи попадают в очередь и выполняются по запросу.**

Это просто коллекция инструментов, изначально спроектированных для использования с `async`/`defer`, чтобы скрипты не блокировали загрузку страницы — в моих проектах такой подход оказался удобным. Часть кода сгенерирована нейросетями и затем вручную доработана, утилиты ориентированы на современные браузеры.

Это не набор ES-модулей. Qu.js подключается целиком и работает через глобальный объект `Qu`. Импорт отдельных функций не предусмотрен и пока что не планируется.

Если вам близок такой подход, можете смело юзать.

# Быстрый старт

## Загрузчик (обязательный, самый первый скрипт) loader.js
```javascript
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
```
Этот код должен выполниться до любых вызовов `Que(...)`. Поэтому он подключается самым первым, синхронно, в `<head>` до любых других скриптов. Так все вызовы `Que` и события, произошедшие до загрузки основного ядра, будут сохранены и обработаны позже. По умолчанию bus = document. Если вы меняете ваш Qu.bus при инициализации, поменяйте в загрузчике тоже.

```javascript
window.QuExtend = window.QuExtend || [];
window.QuExtend.push(function(Qu) {
    Qu.bus = window;
});

// загрузчик так же
var bus = (window.Qu && window.Qu.bus) || window;
```

P.S. Можно не подключать — в `qu.js` есть механизм восстановления из `window._QueQ`, но в этом случае события, произошедшие до загрузки ядра, не будут закешированы, и `Que` не сможет на них среагировать, если они уже прошли.

## Библиотеки/прикладные модули
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/css/qu.min.css"
    media="print" onload="this.media='all'">

<script src="https://cdn.jsdelivr.net/gh/qujs-dev/lazy@main/lazy.min.js" async></script>
<script src="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/qu.min.js" defer></script>
```

Дополнительные библиотеки рекомендуется загружать с `async` в любом порядке. Сам qu.js — `defer`, чтобы не блокировать рендер.


# Рекомендации
Использование async/defer‑скриптов в большом количестве требует HTTP/2 (или HTTP/3).

У CDN-серверов HTTP/2-3 включён по умолчанию, но бесплатные CDN не всегда стабильны — поэтому fallback на локальный файл — разумная страховка.

```html
<link
  rel="preload"
  as="style"
  href="https://cdn.jsdelivr.net/gh/qujs-dev/core@main/css/qu.min.css"
  onload="this.rel='stylesheet'"
  onerror="this.onerror=null;this.href='/qu/core/css/qu.min.css';this.rel='stylesheet'"
>

<!-- предпочтительней для рендера, но без фалбека -->
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

На HTTP/1.1 браузеры ограничивают число одновременных соединений к одному домену, и async/defer‑скрипты будут вставать в очередь. На HTTP/2-3 мультиплексирование позволяет загружать все ресурсы параллельно без задержек.

Если сервер работает на HTTP/1.1 и файлы бибилиотеки qu.js расположены физически на нем, использование async/defer не уменьшает количество параллельных загрузок, тогда лучше собирать скрипты в один бандл (олд‑скульный и надежный способ).

# Примеры кода
`Que` — по умолчанию реагирует на готовность DOM.
```javascript
Que(function() {
    console.log('DOM ready');

    Qu.def(['fancybox', 'jQuery'], function(vars) {
        console.log('Все библиотеки загружены!');
        Qu.trigger(Qu.bus, 'app:ready', { detail: { fancybox, jQuery } });
    });
});
```
Укажите своё событие — `Que` сработает, когда оно будет вызвано.

При условии, что мини-загрузчик уже подключён, вы можете размещать `Que` в любом месте страницы или в любом файле — он будет выполнен корректно, потому что загрузчик перехватывает вызовы и буферизирует их до загрузки основного ядра Qu.js.

```javascript
Que(function() {
    console.log('✅ App ready!');
    // todo
}, 'app:ready');
```
Можно дождаться готовности нескольких событий одновременно, по очереди, или в строгой очереди. (см. api)
```javascript
Que(function() {
    console.log('✅ Все шаги пройдены с начала');
    // todo
}, ['step1:complete', 'step2:complete', 'step3:complete'], false, 'ordered');
```
В данном примере после каждого успешного выполнения порядок сбрасывается и начинается ожидание новой серии событий в том же порядке.

### Инициализация библитеки написанной в стиле Qu
```javascript
Que(function() {
    Qu.libs(['Lazy'], { autoInit: true, initParams: {} }).then(function(loadedLibs) {
        console.log('Lazy alredy');
    });
});
```
или
```javascript
Que(function() {
    // Если Lazy уже загружен — callback выполнится мгновенно
    console.log('Lazy alredy!');
    Qu.Lazy.init();
}, 'qu:lazy:loaded');
```

## Пример расширения объекта на каждом уровне вложенности
```javascript
Que(() => {
    const user = { name: 'Player' };
    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step1:done', { detail: user });
    }, 300);

    Que((Qu, payload) => {
        const data = payload.detail;
        console.log('2️⃣ Получили:', data);
        data.age = 13;
        setTimeout(() => {
            Qu.trigger(Qu.bus, 'step2:done', { detail: data });
        }, 300);

        Que((Qu, payload) => {
            const data = payload.detail;
            console.log('3️⃣ Получили:', data);
            data.city = 'Suncity';
            setTimeout(() => {
                Qu.trigger(Qu.bus, 'step3:done', { detail: data });
            }, 300);

            Que((Qu, payload) => {
                const data = payload.detail;
                console.log('4️⃣ Финальный объект:', data);
            }, 'step3:done');
        }, 'step2:done');
    }, 'step1:done');
});
```
## или независимо
Вложенность `Que` неограничена. Вы можете строить цепочки любой глубины - как вложенные, так и независимые.

```javascript
Que(() => {
    const user = { name: 'Player' };
    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step1:done', { detail: user });
    }, 300);
});

Que((Qu, payload) => {
    const data = payload.detail;
    console.log('2️⃣ Получили:', data);
    data.age = 13;
    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step2:done', { detail: data });
    }, 300);
}, 'step1:done');

Que((Qu, payload) => {
    const data = payload.detail;
    console.log('3️⃣ Получили:', data);
    data.city = 'Suncity';
    setTimeout(() => {
        Qu.trigger(Qu.bus, 'step3:done', { detail: data });
    }, 300);
}, 'step2:done');

Que((Qu, payload) => {
    const data = payload.detail;
    console.log('4️⃣ Финальный объект:', data);
}, 'step3:done');
```

> 1️⃣ DOM готов  
> 2️⃣ Получили: { name: 'Player' }  
> 3️⃣ Получили: { name: 'Player', age: 13 }  
> 4️⃣ Финальный объект: { name: 'Player', age: 13, city: 'Suncity' }  
> Имя: Player  
> Возраст: 13  
> Город: Suncity

и т.д. подробности на сайте [https://qujs.ru/](https://qujs.ru/)