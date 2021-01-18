/*! reddit. See LICENSE.md License. Feross Aboukhadijeh <https://feross.org/opensource> */
import querystring from "querystring";

const TOKEN_BASE_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE_URL = "https://oauth.reddit.com";

export type RedditClientOpts = {
  username: string;
  password: string;
  appId: string;
  appSecret: string;
  userAgent: string;
};

type HTTPMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

class Reddit {
  username: string;
  password: string;
  appId: string;
  appSecret: string;
  userAgent: string;
  token: string | null;
  tokenExpireDate: number;

  constructor(opts: RedditClientOpts) {
    this.username = opts.username;
    this.password = opts.password;
    this.appId = opts.appId;
    this.appSecret = opts.appSecret;
    this.userAgent = opts.userAgent ||
      "reddit (https://github.com/feross/reddit)";

    this.token = null;
    this.tokenExpireDate = 0;
  }

  async get(url: string, data = {}) {
    return this._sendRequest("GET", API_BASE_URL + url, data);
  }

  async post(url: string, data = {}) {
    return this._sendRequest("POST", API_BASE_URL + url, data);
  }

  async patch(url: string, data = {}) {
    return this._sendRequest("PATCH", API_BASE_URL + url, data);
  }

  async put(url: string, data = {}) {
    return this._sendRequest("PUT", API_BASE_URL + url, data);
  }

  async delete(url: string, data = {}) {
    return this._sendRequest("DELETE", API_BASE_URL + url, data);
  }

  async _sendRequest(
    method: HTTPMethod,
    url: string,
    data: Record<string, string>,
  ) {
    const token = await this._getToken();
    if (!token) {
      throw new Error(`couldn't get token!`);
    }
    const body: any = await this._makeRequest(method, url, data, token);

    const errors = body && body.json && body.json.errors;
    if (errors && errors.length > 0) {
      const err = new Error(
        errors
          .map((error: any) => `${error[0]}: ${error[1]} (${error[2]})`)
          .join(". "),
      );
      (err as any).code = errors[0][0];
      (err as any).codes = errors.map((error: any) => error[0]);
      throw err;
    }

    return body;
  }

  async _getToken() {
    if (Date.now() / 1000 <= this.tokenExpireDate) {
      return this.token;
    }

    try {
      const res = await fetch(TOKEN_BASE_URL, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "password",
          username: this.username,
          password: this.password,
        }),
        headers: {
          authorization: `Basic ${
            btoa(
              `${this.appId}:${this.appSecret}`,
            )
          }`,
          "user-agent": this.userAgent,
          accept: "application/json",
        },
      });
      const statusType = Math.floor(res.status / 100);
      const body = await res.json();
      if (statusType === 2) {
        const {
          access_token: accessToken,
          expires_in: expiresIn,
          token_type: tokenType,
        } = body;

        if (tokenType == null || accessToken == null) {
          throw new Error(
            `Cannot obtain token for username ${this.username}. ${body.error}. ${body.error_description}.`,
          );
        }

        this.token = `${tokenType} ${accessToken}`;
        // Shorten token expiration time by half to avoid race condition where
        // token is valid at request time, but server will reject it
        this.tokenExpireDate = (Date.now() / 1000 + expiresIn) / 2;

        return this.token;
      } else if (statusType === 4) {
        throw new Error(
          `Cannot obtain token for username ${this.username}. Did you give ${this.username} access in your Reddit App Preferences? ${body.error}. ${body.error_description}. Status code: ${res.status}`,
        );
      } else {
        throw new Error(
          `Cannot obtain token for username ${this.username}. ${body.error}. ${body.error_description}. Status code: ${res.status}`,
        );
      }
    } catch (err) {
      err.message = `Error getting token: ${err.message}`;
      throw err;
    }
  }

  async _makeRequest(
    method: HTTPMethod,
    url: string,
    data: Record<string, string>,
    token: string,
  ) {
    const opts: RequestInit = {
      method,
      headers: {
        authorization: token,
        "user-agent": this.userAgent,
        "accept": "application/json",
      },
    };

    // Request JSON API response type
    data.api_type = "json";

    if (method === "GET") {
      url += "?" + querystring.encode(data);
    } else if (method === "POST") {
      opts.body = new URLSearchParams(data);
    } else if (
      method === "PATCH" ||
      method === "PUT" ||
      method === "DELETE"
    ) {
      const fd = new FormData();
      Object.keys(data).forEach((k) => fd.set(k, (data as any)[k]));
      opts.body = fd;
    }

    // debug(`Making ${method} request to ${url}`);

    try {
      const res = await fetch(url, opts);
      const body = await res.json();

      // debug("Got a response with statusCode: " + res.statusCode);

      const statusType = Math.floor(res.status / 100);

      if (statusType === 2) {
        return body;
      } else {
        throw new Error(
          `API error: ${body.message}. Status code: ${res.status}`,
        );
      }
    } catch (e) {
      e.message = `API error: ${e.message}`;
      throw e;
    }
  }
}

export default Reddit;
