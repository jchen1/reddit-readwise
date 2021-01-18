import RedditClient, { RedditClientOpts } from "./reddit-internal";

import { Highlight } from "./readwise";

type ListingOpts = {
  before?: string;
  after?: string;
  limit?: number;
  count?: number;
  show?: "all";
};

type RawListing = {
  kind: "Listing";
  data: {
    modhash: string;
    dist: number;
    before?: string;
    after?: string;
    children: object[];
  };
};

type Message = {
  kind: "t4";
  data: {
    body: string;
    body_html: string;
    author: string;
    author_fullname: string;
    subject: string;
    dest: string;
    new: boolean;
    created: number;
    created_utc: number;
    name: string;
  };
};

export async function mapListing<T extends object, U>(
  fn: (item: T) => Promise<U>,
  listing: Listing<T>,
): Promise<U[]> {
  const results: Promise<U>[] = [];

  listing.children.forEach((v) => results.push(fn(v)));

  while (listing.hasMore()) {
    const next = await listing.next();
    next.forEach((v) => results.push(fn(v)));
  }

  return Promise.all(results);
}

export function tokenOrURL(body: string): "token" | "url" {
  try {
    new URL(body);
    return "url";
  } catch (e) {
    return "token";
  }
}

export async function parseCommentFromURL(
  reddit: Reddit,
  urlString: string,
): Promise<Highlight> {
  const url = new URL(urlString);
  const [
    empty,
    r,
    subreddit,
    comments,
    submissionId,
    name,
    commentId,
  ] = url.pathname.split("/");

  const comment = await reddit.getComment(commentId);
  const context = await reddit.getSubmission(submissionId);

  url.hash = "";
  url.search = "";

  return {
    author: comment.data.author,
    text: comment.data.body,
    source_url: url.toString(),
    source_type: "article",
    title: context.data.title,
  };
}

export class Listing<T extends object> {
  client: RedditClient;
  children: T[];
  uri: string;
  done: boolean;
  listingOpts: ListingOpts;

  constructor(client: RedditClient, uri: string, listingOpts: ListingOpts) {
    this.client = client;
    this.children = [];
    this.uri = uri;
    this.done = false;
    this.listingOpts = listingOpts;
  }

  hasMore() {
    return this.done === false;
  }

  async next() {
    if (this.done) {
      return [];
    }

    const next = await this.client.get(
      this.uri,
      this.listingOpts,
    ) as RawListing;

    this.children = this.children.concat(next.data.children as T[]);
    this.listingOpts.after = next.data.after;
    this.done = !this.listingOpts.after;

    // todo: support reverse pagination
    // this.listingOpts.before = next.data.before;

    return next.data.children as T[];
  }

  async realizeAll() {
    while (!this.hasMore()) {
      await this.next();
    }
    return this.children;
  }
}

function fullname(prefix: string, id: string) {
  if (id.startsWith(prefix)) {
    return id;
  }
  return `${prefix}_${id}`;
}

export default class Reddit {
  client: RedditClient;

  constructor(opts: RedditClientOpts) {
    this.client = new RedditClient(opts);
  }

  async getInbox(
    type?: "inbox" | "unread" | "sent",
  ): Promise<Listing<Message>> {
    const uri = `/message/${type || "inbox"}`;
    return new Listing(this.client, uri, {});
  }

  async readMessage(id: string) {
    return this.client.post("/api/read_message", { id: fullname("t4", id) });
  }

  private async getThing(id: string): Promise<any> {
    return (await this.client.get(`/api/info`, { id })).data.children[0];
  }

  async getComment(id: string) {
    return this.getThing(fullname("t1", id));
  }

  async getSubmission(id: string) {
    return this.getThing(fullname("t3", id));
  }
}
