import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createGameViaUI, loginAsHost, openTv } from "./helpers";
import { parseBoardCsv } from "../src/lib/boardFile";

test("import the sample CSV and play a question from it", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.getByRole("tab", { name: "Import / Export" }).click();
  await host.getByLabel("Board file").setInputFiles("samples/board.csv");

  const preview = host.getByTestId("import-preview");
  await expect(preview.locator("th")).toHaveCount(6);
  await expect(preview).toContainText("What is the closest star to Earth?");

  const title = `Imported ${Date.now()}`;
  await host.getByLabel("Template title").fill(title);
  // A logged-out TV can only load public boards (see NOTES.md, open questions).
  await host.getByLabel("Make Public").check();
  await host.getByRole("button", { name: "Save as template" }).click();
  await expect(host.getByText(`Saved "${title}"`)).toBeVisible();

  // Export it again and check the CSV matches the sample.
  await host.getByRole("combobox", { name: "Template to export" }).click();
  await host.getByRole("option", { name: title }).click();
  const [download] = await Promise.all([host.waitForEvent("download"), host.getByRole("button", { name: "Download CSV" }).click()]);
  const exported = readFileSync(await download.path(), "utf8");
  expect(exported.split("\n")[0]).toBe("category,value,question,answer,hint");
  expect(parseBoardCsv(exported).board!.categories).toEqual(parseBoardCsv(readFileSync("samples/board.csv", "utf8")).board!.categories);

  await host.getByRole("tab", { name: "Use a Template" }).click();
  const code = await createGameViaUI(host, ["Team 1", "Team 2"], title);
  const tv = await openTv(browser, code);

  await host.getByRole("button", { name: "100", exact: true }).first().click();
  await expect(host.getByText("What is the closest star to Earth?")).toBeVisible();
  await expect(tv.page.getByText("What is the closest star to Earth?")).toBeVisible();
  await host.getByRole("button", { name: "Reveal Answer on Board" }).click();
  await expect(tv.page.getByText("The Sun")).toBeVisible();
  await tv.ctx.close();
});

test("a broken CSV shows errors and can't be saved", async ({ page: host }) => {
  await loginAsHost(host);
  await host.getByRole("tab", { name: "Import / Export" }).click();
  await host.getByLabel("Board file").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("category,value,question,answer,hint\nSci,100,Q1,,\nSci,100,Q2,A2,\nSci,300,Q3\n"),
  });
  const alert = host.getByRole("alert");
  await expect(alert).toContainText("Row 2: missing answer.");
  await expect(alert).toContainText('Row 3: duplicate value 100 in "Sci"');
  await expect(alert).toContainText("Row 4: expected 5 columns, found 3.");
  await expect(host.getByRole("button", { name: "Save as template" })).toBeDisabled();
});
