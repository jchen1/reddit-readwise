import Snoowrap, { PrivateMessage } from "snoowrap";

import { getToken, setToken } from "./kv";
import * as Readwise from "./readwise";
import { mapListing, parseCommentFromURL, tokenOrURL } from "./reddit";
import secrets from "./secrets";

async function handleCron(event: ScheduledEvent): Promise<void> {
  const snoowrap = new Snoowrap({
    userAgent: "Reddit-Readwise/0.0.1 (https://jeffchen.dev)",
    clientId: "9DT7XPaFovw-2Q",
    clientSecret: secrets.REDDIT_CLIENT_SECRET,
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
  const unreads = await snoowrap.getInbox({ filter: "unread" });
  // parse all tokens first
  await mapListing(async (message) => {
    if (tokenOrURL(message.body) !== "token") {
      return;
    }
    const token = message.body;
    console.log(`Got possible token ${token} for user ${message.author.name}`);
    if ((await getToken(message.author.name)) !== null) {
      return;
    }
    if (await Readwise.verifyToken(Readwise.client(token))) {
      console.log(`Verified token ${token} for user ${message.author.name}!`);
      await setToken(message.author.name, token);
    }
  }, unreads);

  // parse all URLs second
  const highlightsByName: Record<string, Readwise.Highlight[]> = {};

  await mapListing(async (message) => {
    if (tokenOrURL(message.body) === "url") {
      const token = await getToken(message.author.name);
      if (token) {
        const highlight = await parseCommentFromURL(snoowrap, message.body);
        highlightsByName[token] = highlightsByName[token] || [];
        highlightsByName[token].push(highlight);
      } else {
        console.log(`No token available for ${message.author.name}!`);
      }
    }
  }, unreads);

  await mapListing(async (message) => {
    if ((message as PrivateMessage).markAsRead !== undefined) {
      (message as PrivateMessage).markAsRead();
    }
  }, unreads);

  await Promise.all(
    Object.keys(highlightsByName).map(async (token) => {
      const readwise = Readwise.client(token);
      return Readwise.addHighlights(readwise, highlightsByName[token]);
    }),
  );
}

if (secrets.LOCAL === false) {
  addEventListener("scheduled", (event) => {
    event.waitUntil(handleCron(event));
  });
} else {
  handleCron({
    waitUntil: (p) => {},
    scheduledTime: 0,
    type: "scheduled",
  });
}
