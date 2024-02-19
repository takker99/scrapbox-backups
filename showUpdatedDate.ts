import { Page } from "./deps/scrapbox.ts";

const text = await Deno.readTextFile(Deno.args[0]);
const json = (JSON.parse(text)) as { pages: Page[] };
const dates = json.pages.map((page) => page.updated * 1000);
console.log(new Date(Math.max(...dates)).toString());
