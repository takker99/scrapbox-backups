/// <reference lib="deno.ns" />

import { BackupedPage } from "./deps/scrapbox.ts";
import { pooledMap } from "./deps/async.ts";
import { ensureDir } from "./deps/fs.ts";
import { resolve } from "./deps/path.ts";

/**
 * Updates the pages and project information from a backup.
 *
 * @param {string} project - The name of the project.
 * @param {string} displayName - The display name of the project.
 * @param {Page[]} pages - The array of pages to update.
 * @param {string[]} existTitles - 存在するすべてのページタイトルを渡す
 * @param {number} backuped - The number of backups.
 * @param {URL} root - The root URL.
 * @returns {Promise<void>} - A promise that resolves when the update is complete.
 */
/**
 * Updates the pages and project information from a backup.
 *
 * @param project - The name of the project.
 * @param displayName - The display name of the project.
 * @param pages - The array of pages to update.
 * @param existTitles - The array of existing page titles.
 * @param backuped - The number of backups.
 * @param root - The root URL.
 */
export const updateFromFile = async <
  Page extends Omit<BackupedPage, "linksLc">,
>(
  project: string,
  displayName: string,
  pages: Page[],
  existTitles: string[],
  backuped: number,
  root: string,
) => {
  // directoryを掘る
  const dir = resolve(root, `./${project}/pages/`);
  ensureDir(dir);

  // ページデータを更新する
  {
    let total = pages.length;
    let count = 0;
    for await (
      const { title, type } of pooledMap(
        10,
        pages,
        (page) => mergePage(page, dir),
      )
    ) {
      if (type === "skipped") {
        total--;
        continue;
      }
      count++;
      console.log(
        `[${count}/${total}]${type === "added" ? "Add" : "Update"} "${title}"`,
      );
    }
  }

  // なくなったページを削除する
  {
    const titles = existTitles.map((title) => toFileName(title));
    const removedTitles = [] as string[];
    for await (const { name, isFile } of Deno.readDir(dir)) {
      if (!isFile) continue;
      if (!name.endsWith(".json")) continue;
      const title = name.slice(0, -5);
      if (titles.includes(title)) continue;
      removedTitles.push(title);
    }
    let count = 0;
    for (const title of removedTitles) {
      console.log(`[${++count}/${removedTitles.length}]Delete "${title}"`);
      await Deno.remove(resolve(dir, `${title}.json`));
    }
  }

  // project情報を更新する
  await Deno.writeTextFile(
    resolve(dir,`../project.json`),
    JSON.stringify(
      { name: project, displayName, count: existTitles.length, backuped },
      null,
      2,
    ),
  );
};

const toFileName = (title: string) =>
  // サロゲートペアなどを壊さないように分割する
  [...title].slice(0, 50).join("").replaceAll("/", "%2F");

const toPageURL = (encodedTitle: string, dir: string) =>
  resolve(dir, `./${encodedTitle}.json`);

interface MergePageResult {
  title: string;
  type: "added" | "updated" | "skipped";
}

const mergePage = async <Page extends Omit<BackupedPage, "linksLc">>(
  page: Page,
  dir: string,
): Promise<MergePageResult> => {
  // directoryを掘る
  ensureDir(dir);

  // PATHに使えない文字をencodeする
  const url = toPageURL(toFileName(page.title), dir);

  let newJSON: Record<string, unknown> = {};
  let type: "added" | "updated" = "updated";
  try {
    const text = await Deno.readTextFile(url);
    const json = JSON.parse(text);
    // 更新されたファイルのみ書き込む
    if (page.updated <= json.updated) {
      return { title: page.title, type: "skipped" };
    }
    delete json["linksLc"];
    newJSON = json;
  } catch (e: unknown) {
    // 古いページデータが存在しない場合は新規作成として扱う
    if (!(e instanceof Deno.errors.NotFound)) throw e;
    type = "added";
  }

  // linksLc以外のデータをマージする
  for (const key in page) {
    if (key === "linksLc") continue;
    newJSON[key] = page[key];
  }
  await Deno.writeTextFile(url, JSON.stringify(newJSON, null, 2));

  return { title: page.title, type };
};
