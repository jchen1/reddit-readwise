import Snoowrap from "snoowrap";
import * as Readwise from "./readwise";

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
  // console.log(await snoowrap.getInbox());
  const client = Readwise.client("");
  console.log(
    await Readwise.addHighlights(client, [
      { text: "test", source_url: "https://jeffchen.dev" },
    ]),
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
