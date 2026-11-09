import { test, expect } from "@playwright/test";
import { createGameViaUI, hostOpenFirstQuestion, loginAsHost, openBuzzer, openTv } from "./helpers";

test("host runs a question and a phone buzz scores on host and TV", async ({ page: host, browser }) => {
  await loginAsHost(host);
  const code = await createGameViaUI(host, ["Team 1", "Team 2"]);

  const tv = await openTv(browser, code);
  await expect(tv.page.getByTestId("tv-score-Team 2")).toHaveText("0");

  const phone1 = await openBuzzer(browser, code, "Team 1");
  const phone2 = await openBuzzer(browser, code, "Team 2");
  await expect(phone1.page.getByRole("button", { name: "Locked" })).toBeVisible();

  await hostOpenFirstQuestion(host);
  await host.getByRole("button", { name: "Open buzzers" }).click();

  await expect(phone2.page.getByRole("button", { name: "Buzz" })).toBeEnabled();
  // The button pulses while open, so it is never "stable"; tap it anyway.
  await phone2.page.getByRole("button", { name: "Buzz" }).click({ force: true });

  // Team 2 shows first in the host's queue and on the TV.
  await expect(host.getByText("Buzz #1")).toBeVisible();
  await expect(tv.page.getByText("Team 2 buzzed in!")).toBeVisible();

  await host.getByRole("button", { name: "Correct: add points to Team 2" }).click();
  await expect(host.getByTestId("host-score-Team 2")).toHaveText("100");
  await expect(tv.page.getByTestId("tv-score-Team 2")).toHaveText("100");
  await expect(tv.page.getByTestId("tv-score-Team 1")).toHaveText("0");

  await Promise.all([tv.ctx.close(), phone1.ctx.close(), phone2.ctx.close()]);
});
