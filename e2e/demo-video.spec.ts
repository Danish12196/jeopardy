import { test, expect, devices, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseBoardCsv } from "../src/lib/boardFile";
import { HOST_EMAIL, HOST_PASSWORD, loginAsHost, seedPortfolioGame, userPb } from "./helpers";

// Records the two portfolio demo videos from one scripted game:
//   portfolio/demo.mp4       TV (1440x900) and a phone (320x900) side by side
//   portfolio/demo-host.mp4  the host dashboard (1440x900)
// plus their poster frames. Needs ffmpeg. Skipped unless DEMO_VIDEO=1:
//   DEMO_VIDEO=1 npm run e2e -- e2e/demo-video.spec.ts
test.skip(!process.env.DEMO_VIDEO, "set DEMO_VIDEO=1 to re-record the demo videos");

const FPS = 25;
type Frame = { t: number; file: string };

/** Records a page with the DevTools screencast; frames arrive only when the page repaints. */
async function record(page: Page, dir: string, name: string) {
  const cdp = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  const vp = page.viewportSize()!;
  cdp.on("Page.screencastFrame", async (f) => {
    const file = path.join(dir, `${name}-${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ t: f.metadata.timestamp ?? Date.now() / 1000, file });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  return {
    frames,
    stop: () => cdp.send("Page.stopScreencast").catch(() => {}),
  };
}

/** Writes an ffmpeg concat list covering [t0, t1] from irregularly timed frames. */
function concatList(frames: Frame[], t0: number, t1: number, out: string) {
  const usable = frames.filter((f, i) => i === 0 || f.t >= t0 || (frames[i + 1]?.t ?? Infinity) > t0);
  const lines: string[] = [];
  for (let i = 0; i < usable.length; i++) {
    const start = Math.max(usable[i].t, t0);
    const end = Math.min(usable[i + 1]?.t ?? t1, t1);
    if (end <= start) continue;
    lines.push(`file '${usable[i].file}'`, `duration ${(end - start).toFixed(4)}`);
  }
  lines.push(`file '${usable[usable.length - 1].file}'`);
  writeFileSync(out, lines.join("\n"));
}

test("demo videos", async ({ browser }) => {
  test.setTimeout(240_000);
  const dir = mkdtempSync(path.join(tmpdir(), "lockout-demo-"));
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const board = parseBoardCsv(readFileSync("samples/board.csv", "utf8"), "Friday Quiz").board!;
  const game = await seedPortfolioGame(api, "TRKT9N", board);
  const code = game.uniqueID;

  const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await hostCtx.newPage();
  await loginAsHost(host);
  await host.goto(`/game/${code}/host`);
  await expect(host.getByText("Host Dashboard")).toBeVisible();
  await host.getByLabel("Auto-open on select").uncheck();
  // Mark the Wildcard before recording starts so the TV never gives it away.
  await host.getByRole("button", { name: "Mark Wildcards" }).click();
  await host.getByRole("button", { name: "400", exact: true }).nth(2).click();
  await host.getByRole("button", { name: "Done marking Wildcards" }).click();

  const tvCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tv = await tvCtx.newPage();
  await tv.goto(`/game/${code}/board`);
  await expect(tv.getByTestId("tv-score-Team Pixel")).toBeVisible();

  const phoneCtx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 320, height: 900 }, deviceScaleFactor: 1 });
  const phone = await phoneCtx.newPage();
  await phone.goto(`/game/${code}`);
  await phone.getByRole("button", { name: "Team Pixel", exact: true }).click();
  await expect(phone.getByText("Locked. Waiting for the host.")).toBeVisible();

  // Team Byte's phone plays along off camera.
  const byteCtx = await browser.newContext({ ...devices["Pixel 7"] });
  const byte = await byteCtx.newPage();
  await byte.goto(`/game/${code}`);
  await byte.getByRole("button", { name: "Team Byte", exact: true }).click();
  await host.waitForTimeout(1000);

  const recs = {
    tv: await record(tv, dir, "tv"),
    phone: await record(phone, dir, "phone"),
    host: await record(host, dir, "host"),
  };
  // Nudge a repaint so every recording has a first frame.
  for (const p of [tv, phone, host]) await p.mouse.move(1, 1);
  const pause = (ms: number) => host.waitForTimeout(ms);
  await pause(400);
  const t0 = Date.now() / 1000;
  await pause(1800);

  // 1. A normal question: host picks a tile, opens buzzers, Team Pixel buzzes first.
  await host.getByRole("button", { name: "300", exact: true }).first().click();
  await expect(tv.getByText("What do we call a rock from space")).toBeVisible();
  await pause(2200);
  await host.getByRole("button", { name: "Open buzzers" }).click();
  await expect(phone.getByRole("button", { name: "Buzz" })).toBeEnabled();
  await pause(1500);
  await phone.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByText("Buzz #1")).toBeVisible();
  await pause(1800);
  await host.getByRole("button", { name: "Lock buzzers" }).click();
  await pause(1000);
  await host.getByRole("button", { name: "Correct: add points to Team Pixel" }).click();
  await pause(800);
  await host.getByRole("button", { name: "Reveal Answer on Board" }).click();
  await expect(tv.getByText("A meteorite")).toBeVisible();
  await pause(2200);
  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await expect(tv.getByTestId("tv-score-Team Pixel")).toHaveText("300");
  await pause(2000);

  // 2. Wildcard: Team Byte picks the hidden tile and wagers.
  await host.getByRole("button", { name: "400 Wildcard" }).click();
  await expect(tv.getByTestId("tv-wildcard")).toBeVisible();
  await pause(1800);
  await host.getByRole("group", { name: "Team playing the Wildcard" }).getByRole("button", { name: "Team Byte" }).click();
  await pause(700);
  await host.getByLabel("Wildcard wager").pressSequentially("500", { delay: 120 });
  await pause(500);
  await host.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.getByText("Team Byte wagers 500")).toBeVisible();
  await pause(2200);
  await host.getByRole("button", { name: "Right (+500)" }).click();
  await pause(1500);
  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await expect(tv.getByTestId("tv-score-Team Byte")).toHaveText("500");
  await pause(1800);

  // 3. All In: hidden wagers on phones, reveal lowest score first, final standings.
  await host.getByRole("button", { name: "All In", exact: true }).click();
  await pause(500);
  await host.getByLabel("All In category").pressSequentially("Famous Firsts", { delay: 40 });
  await host.getByLabel("All In question").fill("This was the first video ever uploaded to YouTube, in 2005.");
  await host.getByLabel("All In answer").fill("Me at the zoo");
  await pause(600);
  await host.getByRole("button", { name: "Open wagers" }).click();
  await expect(tv.getByTestId("tv-allin")).toContainText("Famous Firsts");
  await pause(1500);
  await phone.getByLabel("Your wager (0 to 300)").pressSequentially("300", { delay: 150 });
  await pause(600);
  await phone.getByRole("button", { name: "Lock in wager" }).click();
  await byte.getByLabel("Your wager (0 to 500)").fill("200");
  await byte.getByRole("button", { name: "Lock in wager" }).click();
  await expect(host.getByTestId("allin-wager-count")).toHaveText("Wagers in: 2 of 2");
  await pause(1500);
  await host.getByRole("button", { name: "Close wagers and show the question" }).click();
  await pause(2500);
  await host.getByRole("button", { name: "Team Pixel right" }).click();
  await pause(500);
  await host.getByRole("button", { name: "Team Byte wrong" }).click();
  await pause(700);
  await host.getByRole("button", { name: "Start the reveal on the TV" }).click();
  await pause(1200);
  await host.getByRole("button", { name: "Reveal Team Pixel" }).click();
  await pause(1800);
  await host.getByRole("button", { name: "Reveal Team Byte" }).click();
  await expect(tv.getByTestId("allin-reveal-Team Byte")).toContainText("−200 → 300");
  await pause(2200);
  await host.getByRole("button", { name: "Show final standings" }).click();
  await expect(tv.getByTestId("tv-game-over")).toContainText("Team Pixel wins!");
  await expect(phone.getByTestId("phone-game-over")).toBeVisible();
  await pause(3500);
  const t1 = Date.now() / 1000;

  await Promise.all(Object.values(recs).map((r) => r.stop()));
  for (const [name, r] of Object.entries(recs)) concatList(r.frames, t0, t1, path.join(dir, `${name}.txt`));

  const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
  const ff = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
  const input = (n: string) => ["-f", "concat", "-safe", "0", "-i", path.join(dir, `${n}.txt`)];
  ff([...input("tv"), ...input("phone"),
    "-filter_complex", `[0:v]fps=${FPS},scale=1440:900,setsar=1[a];[1:v]fps=${FPS},scale=320:900,setsar=1[b];[a][b]hstack=inputs=2[v]`,
    "-map", "[v]", ...enc, "portfolio/demo.mp4"]);
  ff([...input("host"), "-vf", `fps=${FPS},scale=1440:900,setsar=1`, ...enc, "portfolio/demo-host.mp4"]);
  // Posters: the All In reveal for the TV video, the first buzz for the host one.
  const poster = (video: string, at: number, out: string) => ff(["-ss", at.toFixed(2), "-i", video, "-frames:v", "1", "-q:v", "3", out]);
  writeFileSync(path.join(dir, "marks.json"), JSON.stringify({ t0, t1 }));
  poster("portfolio/demo.mp4", (t1 - t0) - 5.5, "portfolio/demo-poster.jpg");
  poster("portfolio/demo-host.mp4", 7, "portfolio/demo-host-poster.jpg");

  await Promise.all([hostCtx.close(), tvCtx.close(), phoneCtx.close(), byteCtx.close()]);
  rmSync(dir, { recursive: true, force: true });
});
