import { ensureDir } from "https://deno.land/std@0.122.0/fs/mod.ts";
import { fromFileUrl } from "https://deno.land/std@0.122.0/path/mod.ts";
import { pooledMap } from "https://deno.land/std@0.122.0/async/mod.ts";
import type {
  ExportedData,
  ExportedPage,
} from "https://raw.githubusercontent.com/scrapbox-jp/types/0.0.8/api/response.ts";

const url = new URL(Deno.args[0], import.meta.url);
const res = await fetch(url);
const json = (await res.json()) as ExportedData<true>;
const { pages, name, displayName } = json;

function toPageURL(encodedTitle: string) {
  return new URL(`./${encodeURIComponent(encodedTitle)}.json`, dir);
}

// directoryがなければ作る
const dir = new URL(`./${name}/pages/`, import.meta.url);
ensureDir(fromFileUrl(dir));

// 今direcotoryにあるjsonファイルのうち、削除するものを列挙する
const titles = pages.map((page) => page.title.replaceAll("/", "%2F"));
const oldTitles = [] as string[];
for await (const { name, isFile } of Deno.readDir(dir)) {
  if (!isFile) continue;
  if (!name.endsWith(".json")) continue;
  const title = name.slice(0, -5);
  if (titles.includes(title)) continue;
  oldTitles.push(title);
}

let added = 0;
let updated = 0;
const results = pooledMap(
  10,
  pages,
  async (page) => {
    // PATHに使えない文字をencodeする
    const title = page.title.replaceAll("/", "%2F");
    const url = toPageURL(title);
    try {
      try {
        const text = await Deno.readTextFile(url);
        const json = JSON.parse(text) as ExportedPage<true>;
        if (page.updated === json.updated) return;
        updated++;
      } catch (e: unknown) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
        added++;
      }
      await Deno.writeTextFile(
        toPageURL(title),
        JSON.stringify(page, null, 2),
      );
    } catch (e: unknown) {
      console.error(e);
    }
    return title;
  },
);
let count = 0;
for await (const title of results) {
  if (title === undefined) continue;
  console.log(`[${++count}/${pages.length}]Expand "${title}"`);
}
let count2 = 0;
for (const title of oldTitles) {
  console.log(`[${++count2}/${oldTitles.length}]Delete "${title}"`);
  await Deno.remove(toPageURL(title));
}
await Deno.writeTextFile(
  new URL(`../project.json`, dir),
  JSON.stringify({ name, displayName, count: pages.length }, null, 2),
);
console.log(
  `Finish updating: ${added} Created, ${updated} Updated, ${count2} Removed`,
);
