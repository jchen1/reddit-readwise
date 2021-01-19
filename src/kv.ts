export async function getToken(id: string) {
  return TOKENS.get(id);
}

export async function setToken(id: string, val: string) {
  return TOKENS.put(id, val);
}
