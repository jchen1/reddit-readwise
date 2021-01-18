import { getToken, setToken } from "./kv";
import * as Readwise from "./readwise";
import Reddit, { mapListing, parseCommentFromURL, tokenOrURL } from "./reddit";
import secrets from "./secrets";

async function handleCron(event: ScheduledEvent | FetchEvent): Promise<void> {
  const reddit = new Reddit({
    userAgent: "Reddit-Readwise/0.0.1 (https://jeffchen.dev)",
    appId: "9DT7XPaFovw-2Q",
    appSecret: secrets.REDDIT_CLIENT_SECRET,
    username: "reddit-readwise",
    password: secrets.REDDIT_PASSWORD,
  });

  /*
    for each message in inbox:
      see if the user has a token (or this message is the token)
        save the token if it's new
      for each comment link in message thread:
        push to readwise
  */
  const unreads = await reddit.getInbox("unread");
  console.log(`Processing messages...`);

  // parse all tokens first
  await mapListing(async (message) => {
    if (tokenOrURL(message.data.body) !== "token") {
      return;
    }
    const token = message.data.body;
    console.log(`Got possible token ${token} for user ${message.data.author}`);
    if ((await getToken(message.data.author)) !== null) {
      return;
    }
    if (await Readwise.verifyToken(Readwise.client(token))) {
      console.log(`Verified token ${token} for user ${message.data.author}!`);
      await setToken(message.data.author, token);
    }
  }, unreads);

  // parse all URLs second
  const highlightsByName: Record<string, Readwise.Highlight[]> = {};

  await mapListing(async (message) => {
    if (tokenOrURL(message.data.body) === "url") {
      const token = await getToken(message.data.author);
      if (token) {
        const highlight = await parseCommentFromURL(
          reddit,
          message.data.body,
        );
        highlightsByName[token] = highlightsByName[token] || [];
        highlightsByName[token].push(highlight);
      } else {
        console.log(`No token available for ${message.data.author}!`);
      }
    }
  }, unreads);

  await mapListing((message) => reddit.readMessage(message.data.name), unreads);

  await Promise.all(
    Object.keys(highlightsByName).map(async (token) => {
      const readwise = Readwise.client(token);
      return Readwise.addHighlights(readwise, highlightsByName[token]);
    }),
  );

  console.log("Done!");
}

if (secrets.LOCAL === false) {
  addEventListener("scheduled", (event) => {
    event.waitUntil(handleCron(event));
  });

  addEventListener("fetch", (event) => {
    event.waitUntil(
      handleCron(event).catch((e) => {
        console.error(e);
        throw e;
      }),
    );
    event.respondWith(new Response("ok"));
  });
} else {
  handleCron({
    waitUntil: (_: any) => {},
    scheduledTime: 0,
    type: "scheduled",
  });
}
