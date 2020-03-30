# Anime-Twitter-Picker Bot
Here is a single file for Node.JS (use whatever you want version).
Use `ATPB` in `config.json` for setting up Telegram and Twitter tokens, specifying admin's and chats' data.
In addition, you can use your own service for viewing pixiv images. (Pixiv requires "Referer" header so you can build your own service which will do all the work)

Here are modules that `animetwitterpickerbot.js` uses (you can install them with `npm`, `yarn`, etc.):
* Telegraf
* Twitter-lite
* request

#### Some useful links
* [Telegraf Module for Node.jS](https://telegraf.js.org/)
* [Telegram Bots API](https://core.telegram.org/bots/api)
* [Twitter API page for getting tweet](https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-show-id)
