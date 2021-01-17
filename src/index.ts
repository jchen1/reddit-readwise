import Snoowrap from "snoowrap";

import { getToken, setToken } from "./kv";
import * as Readwise from "./readwise";
import { mapListing, parseCommentFromURL, tokenOrURL } from "./reddit";
import secrets from "./secrets";

type SnoowrapRequestOptions = {
  json?: boolean;
  baseUrl: string;
  uri: string;
  method?: "get" | "post" | "put" | "delete";
  headers: Record<string, string>;
  qs?: Record<string, string>;
  form?: Record<string, any>;
  formData?: any;
  body?: any;
  transform?: (body: any, response: any) => any;
  resolveWithFullResponse?: boolean;
  auth: {
    user?: string;
    pass?: string;
    bearer?: string;
  };
};

function btoa(val: string) {
  if (typeof window !== "undefined" && window.btoa) {
    return window.btoa(val);
  }

  return Buffer.from(val).toString("base64");
}

class BetterSnoowrap extends Snoowrap {
  rawRequest(options: SnoowrapRequestOptions): Promise<any> {
    // @ts-ignore don't ask
    const fetch = secrets.LOCAL ? require("node-fetch").default : self.fetch;

    options.method = options.method || "get";

    const url = new URL(options.uri, options.baseUrl);
    const qs = new URLSearchParams(options.qs).toString();
    const urlWithQs = `${url}${qs ? "?" : ""}${qs}`;

    const fetchOpts: RequestInit = {
      headers: { ...options.headers } || {},
      method: options.method,
    };

    if (options.json) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }

    if (options.auth) {
      if (options.auth.user) {
        const authString = btoa(`${options.auth.user}:${options.auth.pass}`);

        (fetchOpts.headers as Record<string, string>)[
          "Authorization"
        ] = `Basic ${authString}`;
      } else if (options.auth.bearer) {
        (fetchOpts.headers as Record<string, string>)[
          "Authorization"
        ] = `Bearer ${options.auth.bearer}`;
      }
    }

    if (options.form) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "application/x-www-form-urlencoded";
      const fd = new URLSearchParams();
      Object.keys(options.form).forEach((k) => fd.append(k, options.form?.[k]));
      fetchOpts.body = fd;
    } else if (options.formData) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "multipart/form-data";
      const fd = new FormData();
      Object.keys(options.formData).forEach((k) =>
        fd.append(k, options.formData?.[k]),
      );
      fetchOpts.body = fd;
    } else if (options.body) {
      (fetchOpts.headers as Record<string, string>)["Content-Type"] =
        "application/json";
      fetchOpts.body = JSON.stringify(options.body);
    }

    return fetch(urlWithQs, fetchOpts)
      .then((res: Response) => {
        if (options.transform) {
          const ret = options.transform(res.body, {
            ...res,
            headers: res.headers || {},
            request: { ...fetchOpts, uri: url },
          });

          // yolo...
          return Promise.resolve({
            body: res.body,
            json: res.json,
            status: res.status,
            statusText: res.statusText,
            ...ret,
          });
        }
        return res;
      })
      .then((res: Response) => {
        if (res.status >= 200 && res.status <= 299) {
          return res;
        }

        throw res;
      })
      .then(async (res: Response) => {
        if (options.json && !options.resolveWithFullResponse) {
          return res.json();
        } else if (options.resolveWithFullResponse) {
          const body = await res.json();
          return { ...res, body };
        }

        return res.text();
      })
      .then((t: any) => {
        return t;
      });
  }
}

async function handleCron(event: ScheduledEvent): Promise<void> {
  const snoowrap = new BetterSnoowrap({
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
  console.log(`Processing ${unreads.length} messages...`);

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
    if ((message as Snoowrap.PrivateMessage).markAsRead !== undefined) {
      (message as Snoowrap.PrivateMessage).markAsRead();
    }
  }, unreads);

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
} else {
  handleCron({
    waitUntil: (p) => {},
    scheduledTime: 0,
    type: "scheduled",
  });
}
