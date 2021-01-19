interface ScheduledEvent {
  type: "scheduled";
  scheduledTime: number;
  waitUntil: (promise: Promise<any>) => void;
}

declare function addEventListener(
  type: "scheduled",
  handler: (event: ScheduledEvent) => void,
): void;

declare var window: any;

declare var process: any;
declare var REDDIT_CLIENT_SECRET: string;
declare var REDDIT_PASSWORD: string;

declare var TOKENS: {
  get(id: string): Promise<string | null>;
  put(id: string, val: string): Promise<void>;
};

declare module "querystring" {
  export function encode(data: any): string;
}

declare module "reddit" {
  export type RedditClientOpts = {
    username: string;
    password: string;
    appId: string;
    appSecret: string;
    userAgent: string;
  };

  export default class RedditClient {
    constructor(opts: RedditClientOpts);

    get(url: string, data?: object): Promise<object>;
    post(url: string, data?: object): Promise<object>;
    patch(url: string, data?: object): Promise<object>;
    put(url: string, data?: object): Promise<object>;
    delete(url: string, data?: object): Promise<object>;
  }
}
