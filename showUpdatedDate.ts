interface Page {
  title: string;
  id: string;
  updated: number;
  created: number;
  lines: {
    id: string;
    userId: string;
    updated: number;
    created: number;
    text: string;
  }[];
}

const text = await Deno.readTextFile(Deno.args[0]);
const json = (JSON.parse(text)) as { pages: Page[] };
const dates = json.pages.map((page) => page.updated * 1000);
console.log(new Date(Math.max(...dates)).toString());
