import Snoowrap, { Listing } from "snoowrap";
import { Highlight } from "./readwise";

export async function mapListing<T, U>(
  fn: (item: T) => Promise<U>,
  listing: Listing<T>,
): Promise<U[]> {
  const results: U[] = [];
  let currentListing = listing;

  do {
    await Promise.all(
      currentListing.map(async (v) => {
        results.push(await fn(v));
      }),
    );

    if (!currentListing.isFinished) {
      currentListing = currentListing.fetchMore({ amount: 100 });
    }
  } while (!currentListing.isFinished);

  return results;
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
  snoowrap: Snoowrap,
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

  const comment = await snoowrap.getComment(commentId).fetch();
  const context = await snoowrap.getSubmission(submissionId).fetch();

  console.log("f u");

  console.log(JSON.stringify(comment, null, 2));

  url.hash = "";
  url.search = "";

  return {
    author: comment.author.name,
    text: comment.body,
    source_url: url.toString(),
    source_type: "article",
    title: context.title,
  };
}
