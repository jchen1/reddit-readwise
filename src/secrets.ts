type Secrets = {
  REDDIT_CLIENT_SECRET: string;
  REDDIT_PASSWORD: string;
  LOCAL: boolean;
};

const inLocal = process && process.env && process.env.NODE_ENV !== "production";

if (inLocal) {
  const dotenv = require("dotenv");
  dotenv.config();
  process.env.LOCAL = true;
}

const secrets: Secrets = inLocal
  ? process.env
  : {
      REDDIT_CLIENT_SECRET,
      REDDIT_PASSWORD,
      LOCAL: false,
    };

export default secrets;
