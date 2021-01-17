import secrets from "./secrets";

const localTokenCache: Record<string, string> = {};

export async function getToken(id: string) {
  if (secrets.LOCAL) {
    return localTokenCache[id] || null;
  } else {
    return TOKENS.get(id);
  }
}

export async function setToken(id: string, val: string) {
  if (secrets.LOCAL) {
    localTokenCache[id] = val;
  } else {
    return TOKENS.set(id);
  }
}
