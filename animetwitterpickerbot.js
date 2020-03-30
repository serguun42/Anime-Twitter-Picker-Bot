const
	URL = require("url"),
	fs = require("fs"),
	request = require("request"),
	TwitterModule = require("twitter-lite"),
	Telegraf = require("telegraf"),
	Sessions = require("telegraf/session"),
	Telegram = require("telegraf/telegram"),
	CONFIG = JSON.parse(fs.readFileSync("./config.json"))["ATPB"],
	TELEGRAM_BOT_TOKEN = CONFIG.TELEGRAM_BOT_TOKEN,
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	ADMIN_TELEGRAM_DATA = CONFIG.ADMIN_TELEGRAM_DATA,
	CHATS_LIST = CONFIG.CHATS_LIST,
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
• Прямая ссылка на изображение в Твиттере`,
		"testcommand": `<pre>Ну и што ты здесь зобылб?</pre>`
	};

const
	telegram = new Telegram(TELEGRAM_BOT_TOKEN),
	TOB = new Telegraf(TELEGRAM_BOT_TOKEN);

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
 * @typedef {Object} TelegramContext
 * @property {Object} telegram 
 * @property {String} updateType 
 * @property {Object} [updateSubTypes] 
 * @property {{message_id: Number, text?: String, from: TelegramFromObject, chat: TelegramChatObject, date: Number, photo?: TelegramPhotoObj[]}} [message] 
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
		return ctx.reply("```\n" + JSON.stringify({
			status: "Everything is OK",
			message: "You're ADMIN, writing in private",
			from, chat
		}, false, "    ") + "\n```", {
			parse_mode: "MarkdownV2"
		});
	};


	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat["id"]) return false;

		const message = ctx["message"];
		if (!message) return false;

		const text = message["text"];
		if (!text) return false;



		let commandMatch = text.match(/^\/([\w]+)\@animetwitterpickerbot$/i);

		if (commandMatch && commandMatch[1]) {
			L({commandMatch});

			if (COMMANDS[commandMatch[1]])
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).then(L).catch(L);
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

const L = function(arg) {
	if (DEV) {
		console.log(...arguments);
		if (typeof arg == "object") fs.writeFileSync("./out/errors.json", JSON.stringify(arg, false, "\t"));
	};
};

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

/**
 * @param {TelegramContext} ctx
 */
const GetUsername = (ctx) => {
	if (ctx.from.username)
		return `<a href="https://t.me/${ctx.from.username}">${TGE(ctx.from.first_name)}${ctx.from.last_name ? " " + TGE(ctx.from.last_name) : ""}</a>`;
	else if (ctx.from.first_name)
		return TGE(ctx.from.first_name + " " + ctx.from.last_name);
	else
		return TGE(ctx.from.first_name);
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
 * @param {String} message
 */
const TelegramSendToAdmin = (message) => {
	if (!message) return;

	telegram.sendMessage(ADMIN_TELEGRAM_DATA.id, message, {
		parse_mode: "HTML",
		disable_notification: false
	}).then(() => {}, (e) => console.error(e));
};

TelegramSendToAdmin(`Anime-Twitter-Picker Bot have been spawned at ${new Date().toISOString()} <i>(ISO 8601, UTC)</i>`);








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
	else
		return resolve({ status: false });
});





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

		let caption = `<i>${TGE(sendingMessageText)}</i>\n\nОтправил – ${GetUsername(ctx)}\n<a href="${encodeURI(text)}">Ссылка на твит</a> | <a href="${encodeURI("https://twitter.com/" + tweet["user"]["screen_name"])}">@${tweet["user"]["screen_name"]}</a>`;



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
				parse_mode: "HTML"
			})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
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

			sourcesArr[0]["parse_mode"] = "HTML";
			sourcesArr[0]["caption"] = caption;


			ctx.replyWithMediaGroup(sourcesArr, {
				disable_web_page_preview: true,
				parse_mode: "HTML"
			})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
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
		caption: `Отправил – ${GetUsername(ctx)}\n<a href="${encodeURI(`https://pbs.twimg.com${url.pathname}.${format}:orig`)}">Оригинал</a>`,
		disable_web_page_preview: true,
		parse_mode: "HTML"
	})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
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
	if (CHECK_REGEXP.test(text)) {
		let pixivID = text.match(CHECK_REGEXP)[4];

		request(`https://www.pixiv.net/en/artworks/${pixivID}`, (e, response, rawPixivHTML) => {
			if (e) return L(e);
			if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

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

			if (DEV) fs.writeFileSync("./pixiv.json", JSON.stringify(data, false, "\t"));


			const post = data["illust"][Object.keys(data["illust"])[0]];

			let sourcesArr = new Array(post["pageCount"]).fill(true).map((v, i) => {
				let initFilename = post["urls"]["original"],
					initBasename = initFilename.replace(/\d+\.([\w\d]+)$/i, ""),
					initFiletype = initFilename.match(/\.([\w\d]+)$/i);

				if (initFiletype && initFiletype[1])
					initFiletype = initFiletype[1];
				else
					initFiletype = "png";

				return {
					type: "photo",
					media: encodeURI(initBasename + i + "." + initFiletype)
				};
			});


			let title = post["title"] || post["illustTitle"] || post["description"] || post["illustComment"],
				caption = `<i>${TGE(title)}</i>\n\nОтправил – ${GetUsername(ctx)}\nPixiv | <a href="${encodeURI(`https://www.pixiv.net/en/artworks/${pixivID}`)}">Ссылка на пост</a> | <a href="${encodeURI("https://www.pixiv.net/en/users/" + post["userId"])}">@${post["userName"]}</a>`;

			if (sourcesArr.length > 10)
				caption += ` ⬅️ Перейди по ссылке: ${sourcesArr.length} ${GetForm(sourcesArr.length, ["иллюстрация", "иллюстрации", "иллюстраций"])} не влезли в сообщение`;


			if (sourcesArr.length === 1)
				caption += `\n<a href="${CONFIG.PIXIV_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(sourcesArr[0].media))}">Исходник файла</a>`;
			else
				caption += "\nФайлы: " + sourcesArr.map((s, i) => `<a href="${CONFIG.PIXIV_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(s.media))}">${i + 1}</a>`).join(", ");

			sourcesArr[0]["parse_mode"] = "HTML";
			sourcesArr[0]["caption"] = caption;


			ctx.replyWithMediaGroup(sourcesArr.slice(0, 10), {
				disable_web_page_preview: true,
				parse_mode: "HTML"
			})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.then(L).catch(L);
		});
	};
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Reddit = (text, ctx, url) => {
	request(text, (e, response, redditPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

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
			let caption = `<i>${TGE((media["title"] || "").trim())}</i>\n\nОтправил – ${GetUsername(ctx)}\nReddit | <a href="${encodeURI(text)}">Ссылка на пост</a> | <a href="${encodeURI("https://www.reddit.com/user/" + post["author"] + "/")}">/u/${post["author"]}</a>\n<a href="${encodeURI(source.media)}">Исходник файла</a>`,
				callingMethod = (source.type === "photo" ? "replyWithPhoto" : "replyWithAnimation");

			ctx[callingMethod](source.media, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML"
			})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.then(L).catch(L);
		} else
			L("No media in Reddit post");
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Instagram = (text, ctx, url) => {
	request(text, (e, response, instagramPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

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


		let caption = `<i>${TGE(title)}</i>\n\nОтправил – ${GetUsername(ctx)}\nInstagram | <a href="${encodeURI(text)}">Ссылка на пост</a> | <a href="${encodeURI("https://instagram.com/" + actualInstaPost["owner"]["username"] + "/")}">@${actualInstaPost["owner"]["username"]}</a>`;

		if (sourcesArr.length === 1)
			caption += `\n<a href="${encodeURI(sourcesArr[0].media)}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + sourcesArr.map((s, i) => `<a href="${encodeURI(s.media)}">${i + 1}</a>`).join(", ");

		sourcesArr[0]["parse_mode"] = "HTML";
		sourcesArr[0]["caption"] = caption;


		ctx.replyWithMediaGroup(sourcesArr, {
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Danbooru = (text, ctx, url) => {
	request(text, (e, response, danbooruPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

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

		caption += `\n<a href="${encodeURI(source)}">Исходник файла</a>`;



		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Gelbooru = (text, ctx, url) => {
	request(text, (e, response, gelbooruPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

		
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

		caption += `\n<a href="${encodeURI(source)}">Исходник файла</a>`;

		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Konachan = (text, ctx, url) => {
	request(text, (e, response, konachanPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

		
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

		caption += `\n<a href="${encodeURI(source)}">Исходник файла</a>`;

		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Yandere = (text, ctx, url) => {
	request(text, (e, response, yanderePage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);
		
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

		let caption = `Отправил – ${GetUsername(ctx)}\nYandere | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";



		try {
			author = yanderePage
								.split('<div id="stats"')[1]
								.match(/<a href="\/user\/show\/(\d+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://yande.re/user/show/" + author[1])}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};

		caption += `\n<a href="${encodeURI(source)}">Исходник файла</a>`;

		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Eshuushuu = (text, ctx, url) => {
	request(text, (e, response, eshuushuuPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);

		
		let source = "";

		try {
			source = eshuushuuPage
								.split("<body")[1]
								.match(/<a\s+class="thumb_image"\s+href="([^"]+)"/i);

			if (source && source[1]) source = "https://e-shuushuu.net/" + source[1];
		} catch (e) {
			return L("Error on parsing Eshuushuu", e);
		};

		if (!source) return L("No Eshuushuu source");

		let caption = `Отправил – ${GetUsername(ctx)}\nEshuushuu | <a href="${encodeURI(text)}">Ссылка на пост</a>\n<a href="${encodeURI(source)}">Исходник файла</a>`;

		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Sankaku = (text, ctx, url) => {
	request(text, (e, response, sankakuPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);
		
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

		let caption = `Отправил – ${GetUsername(ctx)}\nSankaku | <a href="${encodeURI(text)}">Ссылка на пост</a>\n<a href="${encodeURI(source)}">Исходник файла</a>`;

		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Zerochan = (text, ctx, url) => {
	request(text, (e, response, zerochanPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);


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

		let caption = `Отправил – ${GetUsername(ctx)}\nZerochan | <a href="${encodeURI(text)}">Ссылка на пост</a>\n<a href="${encodeURI(source)}">Исходник файла</a>`;





		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const AnimePictures = (text, ctx, url) => {
	request(text, (e, response, animePicturesPage) => {
		if (e) return L(e);
		if (response.statusCode !== 200) return L(`Status code = ${response.statusCode}`);


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

		let caption = `Отправил – ${GetUsername(ctx)}\nAnime-Pictures | <a href="${encodeURI(text)}">Ссылка на пост</a>\n<a href="${encodeURI(source)}">Исходник файла</a>`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML"
		})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.then(L).catch(L);
	});
};