interface ScheduledEvent {
  type: "scheduled";
  scheduledTime: number;
  waitUntil: (promise: Promise<any>) => void;
}

declare function addEventListener(
  type: "scheduled",
  handler: (event: ScheduledEvent) => void,
): void;

declare var process: any;
declare var REDDIT_CLIENT_SECRET: string;
declare var REDDIT_PASSWORD: string;
