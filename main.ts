import { getAllUpdatedPages } from "./getAllUpdatedPages.ts";
import { Spinner } from "./deps/cli.ts";
import { getProject, Page } from "./deps/scrapbox.ts";
import { getExistTitles } from "./getExistTitles.ts";
import { updateFromFile } from "./updateFromFile.ts";
import { resolve } from "./deps/path.ts";

export const backup = async (project: string, dir: string, sid?: string) => {
  const spinner = new Spinner({ message: `Loading pages in /${project}...` });
  spinner.start();

  const backuped = await getBackuped(project, dir);
  const now = Math.floor(Date.now() / 1000);
  const promises: Promise<Page | undefined>[] = [];
  {
    let total = 0;
    let count = 0;
    let title = "";
    for await (
      const [promise] of getAllUpdatedPages(project, backuped, { sid })
    ) {
      total++;
      promises.push(promise.then((result) => {
        if (!result.ok) {
          console.error(result.value);
          return;
        }
        title = result.value.title;
        spinner.message =
          `Loading pages in /${project}... (${++count}/${total}) ${title}`;

        return result.value;
      }));
      spinner.message =
        `Loading pages in /${project}... (${count}/${total}) ${title}`;
    }
  }
  const pages =
    ((await Promise.all(promises)).filter((page) =>
      page !== undefined
    ) as Page[]).sort((a, b) => b.updated - a.updated);

  spinner.message = `Count the number of pages in /${project}`;
  const result = await getExistTitles(project, { sid });
  if (!result.ok) return result;

  spinner.message = `Get information of /${project}`;
  const result2 = await getProject(project, { sid });
  if (!result2.ok) return result2;

  spinner.message = `Sync pages in /${project} to local files`;
  await updateFromFile(
    project,
    result2.value.displayName,
    pages,
    result.value,
    now,
    dir,
  );
  spinner.stop();
};

const getBackuped = async (project: string, dir: string) => {
  try {
    const text = await Deno.readTextFile(
      resolve(dir, `./${project}/project.json`),
    );
    const json = JSON.parse(text);
    return parseInt(json.backuped ?? "0");
  } catch (e: unknown) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
    return 0;
  }
};

if (import.meta.main) {
  const project = Deno.args[0];
  await backup(project, Deno.cwd(), Deno.env.get("CONNECT_SID"));
}
