import { pooledMap } from "./deps/async.ts";
import {
  BaseOptions,
  listPages,
  NotFoundError,
  NotLoggedInError,
  NotMemberError,
  Result,
} from "./deps/scrapbox.ts";

export const getExistTitles = async (
  project: string,
  options?: BaseOptions,
): Promise<
  Result<string[], NotFoundError | NotLoggedInError | NotMemberError>
> => {
  // projectの全ページ数を取得する
  const result = await listPages(project, { ...options, limit: 1 });
  if (!result.ok) return result;

  const maxIndex = Math.floor(result.value.count / 1000) + 1;

  const titles: string[] = [];
  for await (
    const result of pooledMap(5, [...Array(maxIndex).keys()], async (i) => {
      const result = await listPages(project, {
        ...options,
        limit: 1000,
        skip: i * 1000,
      });
      if (!result.ok) {
        return result;
      }
      return {
        ok: true as const,
        value: result.value.pages.map((page) => page.title),
      };
    })
  ) {
    if (!result.ok) {
      return result;
    }
    titles.push(...result.value);
  }

  return { ok: true as const, value: titles };
};
