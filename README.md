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
- **Загрузка ассетов** (`loadAssets`) — загружайте скрипты, стили и изображения с контролем порядка и кешированием. Можно задать таймаут и принудительную перезагрузку.
- **Управление событиями** (`on`, `off`, `trigger`) — подписка на события с делегированием, поддержкой коллекций элементов и возможностью собирать ответы от обработчиков.
- **Отслеживание появления переменных** (`def`) — реагируйте на момент, когда глобальная переменная или её вложенное свойство становится определённым.
- **Модульная архитектура** — основная библиотека служит ядром, а дополнительные модули (например, Lazy для ленивой загрузки) подключаются как плагины через `Qu.lib()`.
- и некоторые утилиты для работы с DOM и прокруткой.

# Философия

Это просто коллекция инструментов, изначально спроектированных для использования с `async`/`defer`, чтобы скрипты не блокировали загрузку страницы — в моих проектах такой подход оказался удобным. Часть кода сгенерирована нейросетями и затем вручную доработана, утилиты ориентированы на современные браузеры.

Если вам близок такой подход, можете смело юзать.

# Быстрый старт

## Загрузчик (обязательный, самый первый скрипт) loader.js
```javascript
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
```
Этот код должен выполниться до любых вызовов `Que(...)`. Поэтому он подключается самым первым, синхронно, в `<head>` до любых других скриптов, если хотите отслеживать появление переменных и событий. P.s. можно не подключать, в qu.js есть фалбек, но если не подключить его первым — вы не сможете корректно отслеживать переменные/события.

## Библиотеки/прикладные модули
```html
<link rel="stylesheet" href="/qu/core/css/qu.min.css"
    media="print" onload="this.media='all'">

<script src="/qu/lazy/lazy.min.js" async></script>
<script src="/qu/core/qu.min.js" defer></script>
```
или с cdn, кешированние на год.
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/qujs-dev/core@1.0.0/css/qu.min.css"
    media="print" onload="this.media='all'">

<script src="https://cdn.jsdelivr.net/gh/qujs-dev/lazy@1.0.0/lazy.js" async></script>
<script src="https://cdn.jsdelivr.net/gh/qujs-dev/core@1.0.0/qu.min.js" defer></script>
```
или последние версии через @main (кеш 7 дней)
- https://cdn.jsdelivr.net/gh/qujs-dev/lazy@main/lazy.min.js
- https://cdn.jsdelivr.net/gh/qujs-dev/core@main/qu.min.js

Дополнительные библиотеки рекомендуется загружать с `async` в любом порядке. Сам qu.js — `defer`, чтобы не блокировать рендер.


# Рекомендации
Использование async/defer‑скриптов в большом количестве требует HTTP/2 (или HTTP/3).

У CDN-серверов HTTP/2-3 включён по умолчанию, но бесплатные CDN не всегда стабильны — поэтому fallback на локальный файл — разумная страховка.

```html
<link
  rel="preload"
  as="style"
  href="https://cdn.jsdelivr.net/gh/qujs-dev/core@1.0.0/css/qu.min.css"
  onload="this.rel='stylesheet'"
  onerror="this.onerror=null;this.href='/qu/core/css/qu.min.css';this.rel='stylesheet'"
>

<script
  src="https://cdn.jsdelivr.net/gh/qujs-dev/core@1.0.0/qu.min.js"
  onerror="this.onerror=null;this.src='/qu/core/qu.min.js'" async>
</script>
```

На HTTP/1.1 браузеры ограничивают число одновременных соединений к одному домену, и async/defer‑скрипты будут вставать в очередь. На HTTP/2-3 мультиплексирование позволяет загружать все ресурсы параллельно без задержек.

Если сервер работает на HTTP/1.1 и файлы бибилиотеки qu.js расположены физически на нем, использование async/defer не уменьшает количество параллельных загрузок, тогда лучше собирать скрипты в один бандл (устаревший, но надежный способ).

# Примеры кода
`Que` — по умолчанию реагирует на готовность DOM.
```javascript
Que(function() {
    console.log('DOM ready');

    Qu.def(['fancybox', 'jQuery'], function(vars) {
        console.log('Все библиотеки загружены!');
        Qu.trigger(window, 'app:ready', { detail: { fancybox, jQuery } });
    });
});
```
Укажите своё событие — `Que` сработает, когда оно будет вызвано.

При условии, что мини-загрузчик уже подключён, вы можете размещать `Que` в любом месте страницы или в любом файле — он будет работать, потому что загрузчик перехватывает вызовы и буферизирует их до загрузки основного ядра Qu.js.
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
В данном примере после каждого успешного выполнения порядок сбрасывается и начинается ожидание новой серии событий в том же порядке. Параметр false означает, что колбэк будет выполняться каждый раз, когда последовательность событий повторяется, а не только один раз.

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
Que(function() {
    console.log('1️⃣ DOM готов');

    const user = { name: 'Player' };

    setTimeout(() => {
        Qu.trigger(window, 'step1:done', { detail: user });
    }, 300);

    Que(function(Qu, data) {
        console.log('2️⃣ Получили:', data);
        data.age = 13;

        setTimeout(() => {
            Qu.trigger(window, 'step2:done', { detail: data });
        }, 300);

        Que(function(Qu, data) {
            console.log('3️⃣ Получили:', data);
            data.city = 'Suncity';

            setTimeout(() => {
                Qu.trigger(window, 'step3:done', { detail: data });
            }, 300);

            Que(function(Qu, data) { 
                console.log('4️⃣ Финальный объект:', data);
                console.log('Имя:', data.name);
                console.log('Возраст:', data.age);
                console.log('Город:', data.city);
            }, 'step3:done');

        }, 'step2:done');

    }, 'step1:done');

}, 'qu:dom'); // можно без 'qu:dom' (тк оно по умолчанию) или другое событие
```

> 1️⃣ DOM готов  
> 2️⃣ Получили: { name: 'Player' }  
> 3️⃣ Получили: { name: 'Player', age: 13 }  
> 4️⃣ Финальный объект: { name: 'Player', age: 13, city: 'Suncity' }  
> Имя: Player  
> Возраст: 13  
> Город: Suncity

и т.д. подробности на сайте [https://qujs.ru/](https://qujs.ru/)