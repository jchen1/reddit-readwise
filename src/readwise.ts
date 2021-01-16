import secrets from "./secrets";

export type Client = {
  token: string;
};

export type Highlight = {
  text: string;
  title?: string;
  author?: string;
  image_url?: string;
  source_url?: string;
  sourceType?: "book" | "article" | "podcast";
  note?: string;
  location?: number;
  locationType?: string;
  highlightedAt?: Date;
  highlightURL?: string;
};

// @ts-ignore don't ask
const fetch = secrets.LOCAL ? require("node-fetch").default : fetch;

const baseURL = "https://readwise.io/api/v2/";

function api(
  client: Client,
  url: string,
  opts?: RequestInit,
): Promise<Response> {
  const requestOpts = opts || {};
  const headers: Record<string, string> = {};
  if (typeof requestOpts.headers === "object") {
    Object.keys(requestOpts.headers).forEach(
      // @ts-ignore type guards rip
      (k) => (headers[k] = requestOpts.headers[k]),
    );
  } else if (requestOpts.headers) {
    throw new Error(
      `only maps are supported for headers, got ${requestOpts.headers}`,
    );
  }

  headers["Authorization"] = `Token ${client.token}`;
  headers["Accept"] = "application/json";
  headers["Content-Type"] = "application/json";
  requestOpts.headers = headers;

  console.log(requestOpts);

  return fetch(`${baseURL}${url}`, requestOpts);
}

export async function addHighlights(client: Client, highlights: Highlight[]) {
  return api(client, "highlights", {
    method: "POST",
    body: JSON.stringify({
      highlights,
    }),
  });
}

export function client(token: string): Client {
  return { token };
}
