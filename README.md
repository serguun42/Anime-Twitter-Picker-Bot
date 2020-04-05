# Anime-Twitter-Picker Bot
Корневой модуль – `animetwitterpickerbot.js`. Он подключает файл-конфигурацию `animetwitterpickerbot.config.json` и модуль [Кхалиси](https://github.com/serguun42/Khaleesi-JS) – `animetwitterpickerbot.khaleesi.json`.<br>
В `animetwitterpickerbot.config.json` закладываются токены для Telegram, ключи для API Твиттера, данные админа в Telegram и чаты (id чата (число), его название (нигде не используется, идёт как комментарий) и параметр `enabled`, равный `true` или `false`)<br>
В файле конфигурации поле `CUSTOM_IMG_VIEWER_SERVICE` отвечает за URL сервиса для показа картинок из Pixiv и anime.reactor (см. файл)

Модули, которые использует `animetwitterpickerbot.js` (можете установить их через `npm`, `yarn`, etc.):
* Telegraf
* Twitter-lite
* node-fetch
* proxy-agent – используется на локалке (винде) для обхода ограничений Рыбнадзора. Указать параметр `PROXY_URL` в конфигурации.

Версия Node.JS – рекомендую 10+

#### Полезные ссылки
* [Telegraf Module for Node.jS](https://telegraf.js.org/)
* [Telegram Bots API](https://core.telegram.org/bots/api)
* [Twitter API page for getting status](https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-show-id)
