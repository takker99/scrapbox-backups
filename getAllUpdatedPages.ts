import {
  BaseOptions,
  Fetch,
  getPage,
  listPages,
  NotFoundError,
  NotLoggedInError,
  NotMemberError,
  Page,
  Result,
  TooLongURIError,
} from "./deps/scrapbox.ts";
import { makeThrottle } from "./deps/throttle.ts";

export async function* getAllUpdatedPages(
  project: string,
  lastChecked: number,
  options?: BaseOptions,
): AsyncGenerator<
  [
    Promise<
      Result<
        Page,
        NotFoundError | NotLoggedInError | NotMemberError | TooLongURIError
      >
    >,
  ],
  void,
  unknown
> {
  const throttle = makeThrottle<Response>(5);
  const { fetch: fetch_ = globalThis.fetch, ...rest } = options ?? {};
  const fetch: Fetch = (args) => throttle(() => fetch_(args));

  let skip = 0;
  while (true) {
    const result = await listPages(project, { ...options, limit: 1000, skip });
    if (!result.ok) {
      yield [Promise.resolve(result)];
      return;
    }

    for (const page of result.value.pages) {
      if (page.updated <= lastChecked) continue;
      yield [getPage(project, page.title, { ...rest, fetch })];
    }
    if ((result.value.pages.pop()?.updated ?? 0) <= lastChecked) break;
    skip += 1000;
  }
}