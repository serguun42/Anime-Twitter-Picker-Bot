const
	URL = require("url"),
	fs = require("fs"),
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	L = function(arg) {
		if (DEV) {
			console.log(...arguments);
			if (typeof arg == "object") fs.writeFileSync("./out/errors.json", JSON.stringify(arg, false, "\t"));
		};
	},
	NodeFetch = require("node-fetch"),
	TwitterModule = require("twitter-lite"),
	Telegraf = require("telegraf"),
	Sessions = require("telegraf/session"),
	Telegram = require("telegraf/telegram"),
	Markup = require("telegraf/markup"),
	KhaleesiModule = require("./animetwitterpickerbot.khaleesi.js");

/**
 * @typedef {Object} ConfigFile
 * @property {String} TELEGRAM_BOT_TOKEN
 * @property {String} TWITTER_CONSUMER_KEY
 * @property {String} TWITTER_CONSUMER_SECRET
 * @property {String} CUSTOM_IMG_VIEWER_SERVICE
 * @property {{id: number, username: string}} ADMIN_TELEGRAM_DATA
 * @property {Array.<{id: number, name?: string, enabled: boolean}>} CHATS_LIST
 * @property {String[]} COMMANDS_WHITELIST
 * @property {String} PROXY_URL
 */
/** @type {ConfigFile} */
const
	CONFIG = JSON.parse(fs.readFileSync("./animetwitterpickerbot.config.json")),
	TELEGRAM_BOT_TOKEN = CONFIG.TELEGRAM_BOT_TOKEN,
	ADMIN_TELEGRAM_DATA = CONFIG.ADMIN_TELEGRAM_DATA,
	CHATS_LIST = CONFIG.CHATS_LIST,
	COMMANDS_WHITELIST = CONFIG.COMMANDS_WHITELIST,
	COMMANDS_USAGE = new Object(),
	COMMANDS = {
		"about": `Вот как я работаю:

Если твоё сообщение состоит только из одной ссылки на пост в одном из поддерживаемых ресурсов, то вместо твоего сообщения я напишу своё, в котором будут
• <i>все фото в лучшем (оригинальном) качестве</i>
• <i>описание/название поста</i>
• <i>ссылка на него</i>
• <i>автор и ссылка на него</i>
• <i>ссылки на все файлы в лучшем, непережатом качестве</i>

Бот работает с постами из картинок и/или гифок и/или видео. Также вместо картинок из Твиттера, которые Телеграм подгрузил из прямой ссылки на изображение самостоятельно в среднем размере, я отвечу картинкой в наилучшем качестве и с прямой ссылкой на оригинальный файл.

<b>Чтобы я не обрабатывал твоё сообщения, состоящее только из одной ссылки, поставь перед ссылкой/после неё какой-либо знак или напиши что угодно.</b>

Все вопросы – <a href="https://t.me/${ADMIN_TELEGRAM_DATA.username}">${ADMIN_TELEGRAM_DATA.username}</a>`,
		"list": `
• Твит (изображения, гифки и видео)
• Иллюстрация или манга в Pixiv (изображения)
• Пост в Instagram (изображения и видео)
• Пост на Reddit (изображения и гифки)
• Пост на Danbooru (изображения)
• Пост на Gelbooru (изображения)
• Пост на Konachan (изображения)
• Пост на Yande.re (изображения)
• Пост на Sankaku Channel (изображения)
• Пост на Zerochan (изображения)
• Пост на Anime-Pictures.net (изображения)
• Пост на Joy, <i>прости Господи</i>, реактор (изображения)
• Прямая ссылка на изображение в Твиттере`,
		"khaleesi": (ctx) => Khaleesi(ctx),
		"testcommand": `<pre>Ну и што ты здесь зобылб?</pre>`
	};


let telegramConnectionData = {},
	fetchConnectionAdditionalOptions = {};


if (DEV) {
	const ProxyAgent = require("proxy-agent");

	telegramConnectionData["agent"] = new ProxyAgent(CONFIG.PROXY_URL);
	fetchConnectionAdditionalOptions = new ProxyAgent(CONFIG.PROXY_URL);
};


const
	telegram = new Telegram(TELEGRAM_BOT_TOKEN, telegramConnectionData),
	TOB = new Telegraf(TELEGRAM_BOT_TOKEN, { telegram: telegramConnectionData });



/**
 * @param {String} iQuery
 * @returns {Object.<string, (string|true)>}
 */
const GlobalParseQuery = iQuery => {
	if (!iQuery) return {};

	let cList = new Object();
		iQuery = iQuery.toString().split("&");

	iQuery.forEach((item)=>{ cList[item.split("=")[0]] = (item.split("=")[1] || true); });

	return cList;
};

const GetForm = (iNumber, iForms) => {
	iNumber = iNumber.toString();

	if (iNumber.slice(-2)[0] == "1" & iNumber.length > 1) return iForms[2];
	if (iNumber.slice(-1) == "1") return iForms[0];
	else if (/2|3|4/g.test(iNumber.slice(-1))) return iForms[1];
	else if (/5|6|7|8|9|0/g.test(iNumber.slice(-1))) return iForms[2];
};

const TGE = iStr => {
	if (!iStr) return "";
	
	if (typeof iStr === "string")
		return iStr
			.replace(/\&/g, "&amp;")
			.replace(/\</g, "&lt;")
			.replace(/\>/g, "&gt;");
	else
		return TGE(iStr.toString());
};

/**
 * @param {TelegramContext} ctx
 */
const GetUsername = (ctx) => {
	if (ctx.from.username)
		return `<a href="https://t.me/${ctx.from.username}">${TGE(ctx.from.first_name)}${ctx.from.last_name ? " " + TGE(ctx.from.last_name) : ""}</a>`;
	else if (ctx.from.last_name)
		return TGE(ctx.from.first_name + " " + ctx.from.last_name);
	else
		return TGE(ctx.from.first_name);
};

/**
 * @param {String} message
 */
const TelegramSendToAdmin = (message) => {
	if (!message) return;

	telegram.sendMessage(ADMIN_TELEGRAM_DATA.id, message, {
		parse_mode: "HTML",
		disable_notification: true
	}).then(() => {}, (e) => console.error(e));
};

TelegramSendToAdmin(`Anime-Twitter-Picker Bot have been spawned at ${new Date().toISOString()} <i>(ISO 8601, UTC)</i>`);

const TwitterUser = new TwitterModule({
	consumer_key: CONFIG.TWITTER_CONSUMER_KEY, // from Twitter
	consumer_secret: CONFIG.TWITTER_CONSUMER_SECRET, // from Twitter
});

let TwitterApp = new TwitterModule({
	bearer_token: "SOME BAD TOKEN (IT DOES NOT WORK)"
});

TwitterUser.getBearerToken().then((response) => {
	TwitterApp = new TwitterModule({
		bearer_token: response.access_token
	});
});



/**
 * @typedef {Object} TelegramFromObject
 * @property {Number} id
 * @property {String} first_name
 * @property {String} username
 * @property {Boolean} is_bot
 * @property {String} language_code
 * 
 * @typedef {Object} TelegramChatObject
 * @property {Number} id
 * @property {String} title
 * @property {String} type
 * 
 * @typedef {Object} TelegramPhotoObj
 * @property {String} file_id
 * @property {String} file_unique_id
 * @property {Number} file_size
 * @property {Number} width
 * @property {Number} height
 * 
 * @typedef {Object} TelegramMessageObject
 * @property {Number} message_id
 * @property {String} text
 * @property {TelegramFromObject} from
 * @property {TelegramChatObject} chat
 * @property {Number} date
 * @property {TelegramPhotoObj[]} [photo]
 * @property {TelegramMessageObject} [reply_to_message]
 * @property {{inline_keyboard: Array.<Array.<{text: string, callback_data: string, url: string}>>}} [reply_markup]
 * @property {String} [caption]
 * 
 * @typedef {Object} TelegramContext
 * @property {Object} telegram 
 * @property {String} updateType 
 * @property {Object} [updateSubTypes] 
 * @property {TelegramMessageObject} [message] 
 * @property {Object} [editedMessage] 
 * @property {Object} [inlineQuery] 
 * @property {Object} [chosenInlineResult] 
 * @property {Object} [callbackQuery] 
 * @property {Object} [shippingQuery] 
 * @property {Object} [preCheckoutQuery] 
 * @property {Object} [channelPost] 
 * @property {Object} [editedChannelPost] 
 * @property {Object} [poll] 
 * @property {Object} [pollAnswer] 
 * @property {TelegramChatObject} [chat] 
 * @property {TelegramFromObject} [from] 
 * @property {Object} [match] 
 * @property {Boolean} webhookReply
 */
/**
 * @param {TelegramContext} ctx 
 */
const DefaultHandler = (ctx) => {
	const {chat, from} = ctx;


	if (
		(chat && chat["type"] === "private") &&
		(from && from["id"] === ADMIN_TELEGRAM_DATA.id && from["username"] === ADMIN_TELEGRAM_DATA.username)
	) {
		return ctx.reply(`<pre><code class="language-json">${JSON.stringify({
			status: "Everything is OK",
			message: "You're ADMIN, writing in private",
			from, chat
		}, false, "    ")}</code></pre>`, {
			parse_mode: "HTML"
		});
	};


	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat["id"]) return false;

		const message = ctx["message"];
		if (!message) return false;

		const text = message["text"];
		if (!text) return false;



		let commandMatch = text.match(/^\/([\w]+)(\@animetwitterpickerbot)?$/i);

		if (commandMatch && commandMatch[1]) {
			telegram.deleteMessage(chat.id, message.message_id).then(L).catch(L);
			if (!CheckForCommandAvailability(from)) {
				return false;
			};


			L({commandMatch});

			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).then(L).catch(L);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		};



		if (/жаль([\.\?\!…]*)$/i.test(text.trim())) {
			if (CheckForCommandAvailability(from)) {
				if (Math.random() < 0.5)
					return ctx.reply("<i>…как Орлов, порхай как бабочка!</i>", {
						parse_mode: "HTML",
						reply_to_message_id: message.message_id
					}).then(L).catch(L);
				else
					return ctx.replyWithSticker("CAACAgIAAx0CU5r_5QACCFlejL-ACp0b5UFZppv4rFVWZ9lZGwAChQYAAiMhBQABqCwuoKvunScYBA", {
						reply_to_message_id: message.message_id
					}).then(L).catch(L);
			};
		};



		GlobalCheckMessageForLink(message)
			.then((res) => {
				if (res.status & (typeof res.platform == "function")) {
					res.platform(message["text"], ctx, res.url);
				} else if (DEV) {
					L("Not our format");
				};
			})
			.catch(L);
	});
};

TOB.use(Sessions());
TOB.on("text", DefaultHandler);
TOB.launch();







/**
 * @param {TelegramContext} ctx
 */
const Khaleesi = (ctx) => {
	const {message} = ctx;
	if (!message) return;

	const replyingMessage = message.reply_to_message;
	if (!replyingMessage) return;


	let text = replyingMessage.text || replyingMessage.caption;
	if (!text) return;

	let khaleesiedText = KhaleesiModule(text);

	L({replyingMessage, khaleesiedText});
	if (!khaleesiedText) return;

	ctx.reply(khaleesiedText, {
		reply_to_message_id: replyingMessage.message_id
	}).then(L).catch(L);
};

/**
 * @param {TelegramFromObject} from
 * @returns {Boolean}
 */
const CheckForCommandAvailability = (from) => {
	let pass = false;
	if (from.username && COMMANDS_WHITELIST.includes(from.username))
		pass = true;
	else {
		let lastTimeCalled = COMMANDS_USAGE[from.id];
			COMMANDS_USAGE[from.id] = Date.now();

		if (!lastTimeCalled || typeof lastTimeCalled == "undefined")
			pass = true;
		else if ((Date.now() - lastTimeCalled) > 15 * 60 * 1e3)
			pass = true;
	};

	return pass;
};

let currentSessionStamp = new Number();

/**
 * @returns {{[x: string]: string|number|boolean}}
 */
const GlobalSetLikeButton = () => {
	return Markup.callbackButton("👍", `LIKE_${++currentSessionStamp}_${Date.now()}`);
};

TOB.action(/^LIKE_(\d+_\d+)/, /** @param {TelegramContext} ctx */ (ctx) => {
	const {update} = ctx;
	if (!update) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (1)");

	const {callback_query} = update;
	if (!callback_query) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (2)");

	/** @type {TelegramMessageObject} */
	const message = callback_query["message"];

	const {chat} = message;
	if (!chat) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (3)");


	if (message["reply_markup"]) {
		let initMarkup = message["reply_markup"],
			likeButtonCount = parseInt(initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text);

		if (isNaN(likeButtonCount)) likeButtonCount = 0;

		++likeButtonCount;
		L(message);

		initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text = likeButtonCount + " 👍";

		telegram.editMessageReplyMarkup(chat.id, message.message_id, null, initMarkup)
			.then((editedMarkup) => {
				L(editedMarkup);
				ctx.answerCbQuery("Cпасибо за лайк!");
			})
			.catch((e) => {
				L(e);
				ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (4)");
			});
	} else
		return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (5)");
});





/**
 * @typedef {Object} TelegramTextMessage
 * @property {String} text
 * @property {Array.<{offset: Number, length: Number, type: String}>} entities
 */
/**
 * @param {TelegramTextMessage} message
 * @returns {Promise.<{platform?: function, url: URL, status: boolean}, null>}
 */
const GlobalCheckMessageForLink = (message) => new Promise((resolve, reject) => {
	if (!(message.entities && message.entities.length == 1)) return resolve({ status: false });
	if (message.entities[0].type !== "url") return resolve({ status: false });
	if (message.entities[0].offset) return resolve({ status: false });
	if (message.entities[0].length !== message["text"].length) return resolve({ status: false });


	let url = URL.parse(message["text"]);

	if (
		url.host == "twitter.com" |
		url.host == "www.twitter.com"
	)
		return resolve({ status: true, platform: Twitter, url });
	else if (
		url.host == "pbs.twimg.com" |
		url.origin == "https://pbs.twimg.com"
	)
		return resolve({ status: true, platform: TwitterImg, url });
	else if (
		url.host == "instagram.com" |
		url.host == "www.instagram.com"
	)
		return resolve({ status: true, platform: Instagram, url });
	else if (
		url.host == "reddit.com" |
		url.host == "www.reddit.com"
	)
		return resolve({ status: true, platform: Reddit, url });
	else if (
		url.host == "pixiv.net" |
		url.host == "www.pixiv.net"
	)
		return resolve({ status: true, platform: Pixiv, url });
	else if (
		url.host == "danbooru.donmai.us" |
		url.origin == "https://danbooru.donmai.us"
	)
		return resolve({ status: true, platform: Danbooru, url });
	else if (
		url.host == "gelbooru.com" |
		url.host == "www.gelbooru.com"
	)
		return resolve({ status: true, platform: Gelbooru, url });
	else if (
		url.host == "konachan.com" |
		url.host == "www.konachan.com"
	)
		return resolve({ status: true, platform: Konachan, url });
	else if (
		url.host == "yande.re" |
		url.host == "www.yande.re"
	)
		return resolve({ status: true, platform: Yandere, url });
	else if (
		url.host == "e-shuushuu.net" |
		url.host == "www.e-shuushuu.net"
	)
		return resolve({ status: true, platform: Eshuushuu, url });
	else if (
		url.host == "chan.sankakucomplex.com" |
		url.origin == "https://chan.sankakucomplex.com"
	)
		return resolve({ status: true, platform: Sankaku, url });
	else if (
		url.host == "zerochan.net" |
		url.host == "www.zerochan.net"
	)
		return resolve({ status: true, platform: Zerochan, url });
	else if (
		url.host == "anime-pictures.net" |
		url.host == "www.anime-pictures.net"
	)
		return resolve({ status: true, platform: AnimePictures, url });
	else if (
		url.host == "anime.reactor.cc" |
		url.origin == "http://anime.reactor.cc"
	)
		return resolve({ status: true, platform: Joyreactor, url });
	else
		return resolve({ status: false });
});

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Twitter = (text, ctx, url) => {
	let statusIDMatch = text.match(/^(http(s)?\:\/\/)?twitter.com\/[\w\d\_]+\/status(es)?\/(\d+)/),
		statusID;

	if (!statusIDMatch || !statusIDMatch[4]) {
		statusIDMatch = text.match(/^(http(s)?\:\/\/)?twitter.com\/statuses\/(\d+)/);

		if (!statusIDMatch || !statusIDMatch[3])
			return L("No Twitter statusID");
		else
			statusID = statusIDMatch[3];
	} else
		statusID = statusIDMatch[4];


	TwitterApp.get("statuses/show", {
		id: statusID,
		tweet_mode: "extended"
	})
	.then((tweet) => {
		if (DEV) fs.writeFileSync("./out/twitter.json", JSON.stringify(tweet, false, "\t"));

		const MEDIA = tweet["extended_entities"]["media"];

		if (!MEDIA) return;
		if (!MEDIA.length) return;

		let sendingMessageText = tweet["full_text"];

		tweet["entities"]["urls"].forEach((link) =>
			sendingMessageText = sendingMessageText.replace(new RegExp(link.url, "gi"), link.expanded_url)
		);

		sendingMessageText = sendingMessageText
												.replace(/\b(http(s)?\:\/\/)?t.co\/[\w\d_]+\b$/gi, "")
												.replace(/(\s)+/gi, "$1")
												.trim();

		let caption = `<i>${TGE(sendingMessageText)}</i>\n\nОтправил – ${GetUsername(ctx)}`;



		if (MEDIA[0]["type"] === "animated_gif") {
			const variants = MEDIA[0]["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

			if (!variants || !variants.length) return false;

			let best = variants[0];

			variants.forEach((variant) => {
				if (variant.bitrate > best.bitrate)
					best = variant;
			});

			ctx.replyWithAnimation(best["url"], {
				caption: `${caption}\n<a href="${encodeURI(best["url"])}">Исходник гифки</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Твит", text),
					Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
					GlobalSetLikeButton(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else {
			let sourcesArr = MEDIA.map((media, index) => {
				if (media["type"] === "photo")
					return { type: "photo", media: media["media_url_https"] + ":orig" };
				else if (media["type"] === "video") {
					const variants = media["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

					if (!variants || !variants.length) return false;

					let best = variants[0];

					variants.forEach((variant) => {
						if (variant.bitrate > best.bitrate)
							best = variant;
					});

					return { type: "video", media: best["url"] };
				} else
					return false;
			}).filter(i => !!i);

			if (sourcesArr.length === 1)
				caption += `\n<a href="${encodeURI(sourcesArr[0].media)}">Исходник файла</a>`;
			else
				caption += "\nФайлы: " + sourcesArr.map((s, i) => `<a href="${encodeURI(s.media)}">${i + 1}</a>`).join(", ");

			ctx.replyWithMediaGroup(sourcesArr)
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);

					ctx.reply(caption, {
						disable_web_page_preview: true,
						parse_mode: "HTML",
						reply_to_message_id: sentMessage.message_id,
						reply_markup: Markup.inlineKeyboard([
							Markup.urlButton("Твит", text),
							Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
							GlobalSetLikeButton(ctx)
						])
					}).then(L).catch(L);

					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		};
	})
	.catch((e) => L("Error while getting info from Twitter", e));
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const TwitterImg = (text, ctx, url) => {
	let format = GlobalParseQuery(url.query)["format"] || "jpg";

	ctx.replyWithPhoto(`https://pbs.twimg.com${url.pathname}.${format}:orig`, {
		caption: `Отправил – ${GetUsername(ctx)}`,
		disable_web_page_preview: true,
		parse_mode: "HTML",
		reply_markup: Markup.inlineKeyboard([
			Markup.urlButton("Оригинал", `https://pbs.twimg.com${url.pathname}.${format}:orig`),
			GlobalSetLikeButton(ctx)
		])
	})
		.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
			L(sentMessage);
			return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
		})
		.then(L)
		.catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Pixiv = (text, ctx, url) => {
	const CHECK_REGEXP = /http(s)?\:\/\/(www\.)?pixiv\.net\/([\w]{2}\/)?artworks\/(\d+)/i;

	let pixivID = "";

	if (CHECK_REGEXP.test(text)) {
		pixivID = text.match(CHECK_REGEXP)[4];
	} else if (GlobalParseQuery(url.query)["illust_id"])
		pixivID = GlobalParseQuery(url.query)["illust_id"];

	if (!pixivID) return;


	NodeFetch(`https://www.pixiv.net/en/artworks/${pixivID}`).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((rawPixivHTML) => {
		let data;

		try {
			rawPixivHTML = rawPixivHTML
										.split(/id\=\"meta\-preload\-data\"/i)[1]
										.split("</head")[0]
										.trim()
										.replace(/^content\=('|")/i, "")
										.replace(/('|")>$/i, "");

			data = JSON.parse(rawPixivHTML);
		} catch (e) {
			return L("Cannot parse data from Pixiv", e);
		};

		if (DEV) fs.writeFileSync("./out/pixiv.json", JSON.stringify(data, false, "\t"));



		const post = data["illust"][Object.keys(data["illust"])[0]];

		let sourcesAmount = post["pageCount"],
			sourcesOrig = new Array(),
			sourcesForTG = new Array();


		for (let i = 0; i < sourcesAmount; i++) {
			let origFilename = post["urls"]["original"],
				origBasename = origFilename.replace(/\d+\.([\w\d]+)$/i, ""),
				origFiletype = origFilename.match(/\.([\w\d]+)$/i);

			if (origFiletype && origFiletype[1])
				origFiletype = origFiletype[1];
			else
				origFiletype = "png";

			sourcesOrig.push({
				type: "photo",
				media: encodeURI(origBasename + i + "." + origFiletype)
			});



			let masterFilename = post["urls"]["regular"];

			sourcesForTG.push({
				type: "photo",
				media: encodeURI(masterFilename.replace(/\d+(_master\d+\.[\w\d+]$)/i), i + "$1")
			});
		};





		let title = post["title"] || post["illustTitle"] || post["description"] || post["illustComment"],
			caption = `<i>${TGE(title)}</i>\n\nОтправил – ${GetUsername(ctx)}`;

		if (sourcesAmount > 10)
			caption += ` ⬅️ Перейди по ссылке: ${sourcesAmount} ${GetForm(sourcesAmount, ["иллюстрация", "иллюстрации", "иллюстраций"])} не влезли в сообщение`;


		if (sourcesAmount === 1)
			caption += `\n<a href="${CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(sourcesOrig[0].media)).replace(/__HEADERS__/, encodeURIComponent(JSON.stringify({Referer: "http://www.pixiv.net/"})))}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + sourcesOrig.map((s, i) => `<a href="${CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(s.media)).replace(/__HEADERS__/, encodeURIComponent(JSON.stringify({Referer: "http://www.pixiv.net/"})))}">${i + 1}</a>`).join(", ");


		ctx.replyWithMediaGroup(sourcesForTG.slice(0, 10))
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);

				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Пост", `https://www.pixiv.net/en/artworks/${pixivID}`),
						Markup.urlButton("Автор", "https://www.pixiv.net/en/users/" + post["userId"]),
						GlobalSetLikeButton(ctx)
					])
				}).then(L).catch(L);

				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Reddit = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((redditPage) => {
		let data;

		try {
			redditPage = redditPage
					.split("<body")[1]
					.split(/<(script id\=\"data\")>window\.___r\s\=\s/)
					.pop().split("</script>")[0].replace(/\;/g, "");

			if (DEV) fs.writeFileSync("./out/reddit.json", redditPage);

			data = JSON.parse(redditPage);
		} catch (e) {
			return L("Cannot parse data from Reddit", e);
		};


		const models = data["posts"]["models"]
		const post = models[Object.keys(models)[0]];


		let source = {
			media: "",
			type: ""
		};


		if (post["media"]) {
			media = post["media"];

			if (media["type"] === "image") {
				if (media["content"])
					source = { media: media["content"], type: "photo" };
			} else if (media["type"] === "gifvideo") {
				if (media["content"])
					source = { media: media["content"], type: "animation" };
			} else if (media["type"] === "video") {
				let videoFileURL = media["scrubberThumbSource"].replace(/\d+$/, media["height"]);

				if (media["isGif"] && media["scrubberThumbSource"] && media["height"])
					source = { media: videoFileURL, type: "animation" };
				else if (media["scrubberThumbSource"] && media["height"])
					source = { media: videoFileURL, type: "video" };
			};
		};


		if (!!source.media & !!source.type) {
			let caption = `<i>${TGE((media["title"] || "").trim())}</i>\n\nОтправил – ${GetUsername(ctx)}\nReddit | <a href="${encodeURI(text)}">Пост</a> | <a href="${encodeURI("https://www.reddit.com/user/" + post["author"] + "/")}">/u/${post["author"]}</a>`,
				callingMethod = (source.type === "photo" ? "replyWithPhoto" : "replyWithAnimation");

			ctx[callingMethod](source.media, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Исходник", source.media),
					GlobalSetLikeButton(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else
			L("No media in Reddit post");
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Instagram = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((instagramPage) => {
		let actualInstaPost;

		try {
			instagramPage = instagramPage
							.split("<body")[1]
							.split(/<(script type="text\/javascript"|script)>window._sharedData\s+=\s+/)
							.pop().split("</script>")[0].replace(/\;/g, "");

			if (DEV) fs.writeFileSync("./out/instagram.json", instagramPage);

			actualInstaPost = JSON.parse(instagramPage);
			actualInstaPost = actualInstaPost.entry_data.PostPage[0].graphql.shortcode_media;
		} catch (e) {
			return L("Cannot parse Instagram data", e);
		};


		let title = ((actualInstaPost.edge_media_to_caption.edges[0] || {}).node || {text: ""}).text || "";
			title = title.replace(/(\s)+/gi, "$1").trim();


		let sourcesArr = new Array();

		if (actualInstaPost["edge_sidecar_to_children"])
			sourcesArr = actualInstaPost["edge_sidecar_to_children"]["edges"].map((media) => {
				if (!media["node"]["is_video"])
					return { media: media["node"]["display_resources"].pop().src, type: "photo" };
				else
					return false;
			}).filter(i => !!i);
		else {
			if (!actualInstaPost["is_video"])
				sourcesArr = [{
					media: actualInstaPost["display_resources"].pop().src, type: "photo"
				}];
			else
				sourcesArr = [{
					media: actualInstaPost["video_url"], type: "video"
				}];
		};


		if (!sourcesArr.length) return L("No sources in Instagram post");


		let caption = `<i>${TGE(title)}</i>\n\nОтправил – ${GetUsername(ctx)}`;

		if (sourcesArr.length === 1)
			caption += `\n<a href="${encodeURI(sourcesArr[0].media)}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + sourcesArr.map((s, i) => `<a href="${encodeURI(s.media)}">${i + 1}</a>`).join(", ");


		ctx.replyWithMediaGroup(sourcesArr)
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);

				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Пост", text),
						Markup.urlButton("Автор", "https://instagram.com/" + actualInstaPost["owner"]["username"] + "/"),
						GlobalSetLikeButton(ctx)
					])
				}).then(L).catch(L);

				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Danbooru = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((danbooruPage) => {
		let source = "";

		try {
			source = danbooruPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];

			if (!source) {
				source = danbooruPage
									.split("</head")[0]
									.match(/<meta\s+(name|property)="twitter\:image"\s+content="([^"]+)"/i);

				if (source) source = source[2];
			};
		} catch (e) {
			return L("Error on parsing Danbooru", e);
		};


		if (!source) return L("No Danbooru source");


		let sourceUUID = source.match(/([\d\w]{10,})/i)[0],
			extension = source.match(/\.([\d\w]+)$/i)[0];


		if (!sourceUUID || !extension) return L;

		source = "https://danbooru.donmai.us/data/" + sourceUUID + extension;


		let caption = `Отправил – ${GetUsername(ctx)}\nDanbooru | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = danbooruPage
								.split(`<section id="tag-list">`)[1]
								.match(/<a\s+class=\"search\-tag\"\s+itemprop=\"author\"\s+href="([^"]+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://danbooru.donmai.us" + decodeURIComponent(author[1]))}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};



		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Gelbooru = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((gelbooruPage) => {
		let source = "";

		try {
			source = gelbooruPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];
		} catch (e) {
			return L("Error on parsing Gelbooru", e);
		};

		if (!source) return L("No Gelbooru source");

		let caption = `Отправил – ${GetUsername(ctx)}\nGelbooru | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = gelbooruPage
								.split(/<h3>\s*Statistics\s*<\/h3>/i)[1]
								.match(/<a\s+href="(index.php\?page\=account&amp\;s\=profile&amp;uname=[^"]+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://gelbooru.com/" + author[1].replace(/&amp;/g, "&"))}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Konachan = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((konachanPage) => {
		let source = "";

		try {
			source = konachanPage
								.split("<body")[1]
								.match(/<a(\s+[\w\d\-]+\="([^"]+)")*\s+href="([^"]+)"(\s+[\w\d\-]+\="([^"]+)")*\s+id="highres"(\s+[\w\d\-]+\="([^"]+)")*/i);

			if (source) source = source[3];
		} catch (e) {
			return L("Error on parsing Konachan", e);
		};

		if (!source) return L("No Konachan source");

		let caption = `Отправил – ${GetUsername(ctx)}\nKonachan | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = konachanPage
								.split('<div id="stats"')[1]
								.match(/<a href="\/user\/show\/(\d+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://konachan.com/user/show/" + author[1])}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Yandere = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((yanderePage) => {
		let source = "";

		try {
			source = yanderePage
								.split("<body")[1]
								.match(/<a\s+class="[^"]+"\s+id="highres"\s+href="([^"]+)"/i);

			if (source) source = source[1];
		} catch (e) {
			return L("Error on parsing Yandere", e);
		};

		if (!source) return L("No Yandere source");

		let caption = `Отправил – ${GetUsername(ctx)}`;
			author = "";

		try {
			author = yanderePage
								.split('<div id="stats"')[1]
								.match(/<a href="\/user\/show\/(\d+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += `\nАвтор – <a href="${encodeURI("https://yande.re/user/show/" + author[1])}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Eshuushuu = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((eshuushuuPage) => {
		let source = "";

		try {
			source = eshuushuuPage
								.split("<body")[1]
								.match(/<a\s+class="thumb_image"\s+href="([^"]+)"/i);

			if (source && source[1]) source = "https://e-shuushuu.net/" + source[1].replace(/\/\//g, "/").replace(/^\//g, "");
		} catch (e) {
			return L("Error on parsing Eshuushuu", e);
		};

		if (!source) return L("No Eshuushuu source");

		let caption = `Отправил – ${GetUsername(ctx)}`;


		NodeFetch(source)
			.then((image) => image.buffer())
			.then((buffer) => {
				ctx.replyWithPhoto({
					source: buffer
				}, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Исходник", encodeURI(source)),
						Markup.urlButton("Пост", encodeURI(text)),
						GlobalSetLikeButton(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			})
			.catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Sankaku = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((sankakuPage) => {
		let source = "";

		try {
			source = sankakuPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+id=(")?highres/i);

			if (source && source[1]) source = source[1].replace(/&amp;/g, "&");
		} catch (e) {
			return L("Error on parsing Sankaku", e);
		};

		if (!source) return L("No Sankaku source");
		if (source.slice(0, 6) !== "https:") source = "https:" + source

		let caption = `Отправил – ${GetUsername(ctx)}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Zerochan = (text, ctx, url) => {
	NodeFetch(text, {
		agent: fetchConnectionAdditionalOptions
	}).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((zerochanPage) => {
		let source = "";

		try {
			source = zerochanPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];

			if (!source) {
				source = danbooruPage
									.split("</head")[0]
									.match(/<meta\s+(name|property)="twitter\:image"\s+content="([^"]+)"/i);

				if (source) source = source[2];
			};
		} catch (e) {
			return L("Error on parsing Zerochan", e);
		};

		if (!source) return L("No Zerochan source");


		let sourceBasename = source.replace(/\.[\w\d]+$/, ""),
			basenameMatch = zerochanPage.match(new RegExp(sourceBasename + ".[\\w\\d]+", "gi"));

		if (basenameMatch && basenameMatch.pop) source = basenameMatch.pop();

		let caption = `Отправил – ${GetUsername(ctx)}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				GlobalSetLikeButton(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const AnimePictures = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((animePicturesPage) => {
		let source = "";

		try {
			source = animePicturesPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+title="[^"]+"\s+itemprop="contentURL"/i);

			if (source && source[1]) source = source[1];
		} catch (e) {
			return L("Error on parsing AnimePictures", e);
		};

		if (!source) return L("No AnimePictures source");

		try {
			let imglink = URL.parse(source);

			if (!imglink.host) source = "https://anime-pictures.net" + source;
		} catch (e) {
			if (!imglink.host) source = "https://anime-pictures.net" + source;
			L(e);
		};

		let caption = `Отправил – ${GetUsername(ctx)}`;



		NodeFetch(source)
			.then((image) => image.buffer())
			.then((buffer) => {
				ctx.replyWithPhoto({
					source: buffer
				}, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Исходник", encodeURI(source)),
						Markup.urlButton("Пост", encodeURI(text)),
						GlobalSetLikeButton(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			})
			.catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Joyreactor = (text, ctx, url) => {
	if (!(/^\/post\/\d+/.test(url.pathname))) return;
	
	
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${response.statusCode}`);
	}).then((joyreactorPage) => {
		let source = "";

		try {
			source = joyreactorPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+class="prettyPhotoLink/i);

			if (source && source[1]) source = source[1];
		} catch (e) {
			return L("Error on parsing Joyreactor", e);
		};

		if (!source) return L("No Joyreactor source");



		let caption = `Отправил – ${GetUsername(ctx)}`;


		NodeFetch(source, {
			headers: {
				"Referer": text
			}
		}).then((image) => image.buffer())
		.then((buffer) => {
			ctx.replyWithPhoto({
				source: buffer
			}, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Исходник", encodeURI(CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, source).replace(/__HEADERS__/, JSON.stringify({"Referer": text})))),
					Markup.urlButton("Пост", encodeURI(text)),
					GlobalSetLikeButton(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		})
		.catch(L);
	}).catch(L);
};