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
  source_type?: "book" | "article" | "podcast";
  note?: string;
  location?: number;
  location_type?: string;
  highlighted_at?: Date;
  highlight_url?: string;
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

  return fetch(`${baseURL}${url}`, requestOpts);
}

export async function addHighlights(client: Client, highlights: Highlight[]) {
  console.log(
    `Adding ${highlights.length} highlights for token ${client.token}...`,
  );
  return api(client, "highlights", {
    method: "POST",
    body: JSON.stringify({
      highlights,
    }),
  }).then((res) => {
    console.log(
      `Added ${highlights.length} highlights for token ${client.token}!`,
    );
    return res;
  });
}

export function client(token: string): Client {
  return { token };
}

export async function verifyToken(client: Client) {
  return api(client, "auth").then((res) => res.status === 204);
}
