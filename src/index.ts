import Snoowrap from "snoowrap";

import secrets from "./secrets";

async function handleCron(event: ScheduledEvent): Promise<void> {
  const snoowrap = new Snoowrap({
    userAgent: "Reddit-Readwise/0.0.1 (https://jeffchen.dev)",
    clientId: "9DT7XPaFovw-2Q",
    clientSecret: secrets.REDDIT_CLIENT_SECRET,
    username: "reddit-readwise",
    password: secrets.REDDIT_PASSWORD,
  });

  console.log(await snoowrap.getInbox());
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
