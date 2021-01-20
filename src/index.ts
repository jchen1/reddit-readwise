import { getToken, setToken } from "./kv";
import * as Readwise from "./readwise";
import Reddit, { mapListing, parseCommentFromURL, tokenOrURL } from "./reddit";
import secrets from "./secrets";

const reddit = new Reddit({
  userAgent: "Reddit-Readwise/0.0.1 (https://jeffchen.dev)",
  appId: "9DT7XPaFovw-2Q",
  appSecret: secrets.REDDIT_CLIENT_SECRET,
  username: "reddit-readwise",
  password: secrets.REDDIT_PASSWORD,
});

async function handleCron(event: ScheduledEvent | FetchEvent): Promise<void> {
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

async function handlePost(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response("no header provided!", { status: 401 });
    }
    const [token, readwiseToken] = authHeader.split(" ");
    if (token !== "Token" || !readwiseToken) {
      return new Response("bad auth header!", { status: 401 });
    }

    const client = Readwise.client(readwiseToken);

    if (!(await Readwise.verifyToken(client))) {
      return new Response("bad token!", { status: 403 });
    }

    let link;
    if (
      request.headers.get("content-type")?.toLowerCase() === "application/json"
    ) {
      link = (await request.json()).url;
    } else {
      link = await request.text();
    }

    if (link.length === 0 || tokenOrURL(link) !== "url") {
      return new Response("body is not a url", { status: 400 });
    }

    const reddit = new Reddit({
      userAgent: "Reddit-Readwise/0.0.1 (https://jeffchen.dev)",
      appId: "9DT7XPaFovw-2Q",
      appSecret: secrets.REDDIT_CLIENT_SECRET,
      username: "reddit-readwise",
      password: secrets.REDDIT_PASSWORD,
    });

    const highlight = await parseCommentFromURL(reddit, link);
    await Readwise.addHighlights(client, [highlight]);

    return new Response("ok");
  } catch (e) {
    return new Response("internal server error", { status: 500 });
  }
}

addEventListener("scheduled", (event) => {
  event.waitUntil(handleCron(event));
});

addEventListener("fetch", (event) => {
  const request = event.request;
  const method = request.method.toUpperCase();
  if (method === "GET") {
    return event.respondWith(new Response("ok"));
  } else if (method === "POST") {
    return event.respondWith(handlePost(request));
  } else {
    return event.respondWith(new Response("not implemented", { status: 405 }));
  }
});
