import { test, expect } from "@playwright/test";
import { HOST_EMAIL, HOST_PASSWORD, TEAMS, createGameViaApi, expectRejected, guestPb, loginAsHost, openBuzzer, openTv, userPb } from "./helpers";

async function setup(page: import("@playwright/test").Page, teams = TEAMS.slice(0, 2)) {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, teams);
  await loginAsHost(page);
  await page.goto(`/game/${game.uniqueID}/host`);
  await expect(page.getByText("Host Dashboard")).toBeVisible();
  return { api, game };
}

test("undo and manual score adjust", async ({ page: host }) => {
  await setup(host);
  const score = host.getByTestId("host-score-Team 1");
  const undo = host.getByRole("button", { name: "Undo last score change" });
  await expect(undo).toBeDisabled();

  await host.getByRole("button", { name: "Correct: add points to Team 1" }).click();
  await expect(score).toHaveText("100");
  await host.getByLabel("Adjust Team 1's score by").fill("-250");
  await host.getByRole("button", { name: "Apply adjustment to Team 1" }).click();
  await expect(score).toHaveText("-150");

  await undo.click();
  await expect(score).toHaveText("100");
  // History survives a reload.
  await host.reload();
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("0");
  await expect(host.getByRole("button", { name: "Undo last score change" })).toBeDisabled();
});

test("Wildcard: only the choosing team plays, wager capped", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { teamScores: [{ id: game.teams[0], score: 200 }, { id: game.teams[1], score: 0 }] });
  const tv = await openTv(browser, game.uniqueID);
  const phone = await openBuzzer(browser, game.uniqueID, "Team 2");

  await host.getByRole("button", { name: "Mark Wildcards" }).click();
  await host.getByRole("button", { name: "200", exact: true }).first().click();
  await expect(host.getByRole("button", { name: "200 Wildcard" })).toBeVisible();
  await host.getByRole("button", { name: "Done marking Wildcards" }).click();
  // The TV doesn't give it away.
  await expect(tv.page.getByText("Wildcard")).toHaveCount(0);

  await host.getByRole("button", { name: "200 Wildcard" }).click();
  await expect(tv.page.getByTestId("tv-wildcard")).toBeVisible();
  await expect(phone.page.getByRole("button", { name: "Locked" })).toBeVisible();

  const group = host.getByRole("group", { name: "Team playing the Wildcard" });
  await group.getByRole("button", { name: "Team 1" }).click();
  // Team 1 has 200, the board's top value is 300, so the cap is 300.
  await host.getByLabel("Wildcard wager").fill("5000");
  await host.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.page.getByText("Team 1 wagers 300")).toBeVisible();
  await host.getByRole("button", { name: "Right (+300)" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("500");
  await expect(tv.page.getByTestId("tv-score-Team 1")).toHaveText("500");

  // Undo puts the score back and reopens Right/Wrong, so the host can correct it.
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("200");
  await host.getByRole("button", { name: "Wrong (−300)" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("-100");

  await Promise.all([tv.ctx.close(), phone.ctx.close()]);
});

test("All In: hidden wagers, right/wrong, one-by-one reveal, game over", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { teamScores: [{ id: game.teams[0], score: 400 }, { id: game.teams[1], score: 600 }] });
  const tv = await openTv(browser, game.uniqueID);
  const p1 = await openBuzzer(browser, game.uniqueID, "Team 1");
  const p2 = await openBuzzer(browser, game.uniqueID, "Team 2");

  await host.getByRole("button", { name: "All In", exact: true }).click();
  await host.getByLabel("All In category").fill("Capitals");
  await host.getByLabel("All In question").fill("What is the capital of Australia?");
  await host.getByLabel("All In answer").fill("Canberra");
  await host.getByRole("button", { name: "Open wagers" }).click();
  await expect(tv.page.getByTestId("tv-allin")).toContainText("Capitals");
  await expect(tv.page.getByTestId("tv-allin")).not.toContainText("Australia");

  await p1.page.getByLabel("Your wager (0 to 400)").fill("9999");
  await p1.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(p1.page.getByTestId("phone-wager-locked")).toHaveText("Wager locked in: 400");
  await p2.page.getByLabel("Your wager (0 to 600)").fill("250");
  await p2.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(host.getByTestId("allin-wager-count")).toHaveText("Wagers in: 2 of 2");

  // Wagers are hidden from guests until the reveal.
  expect(await guestPb().collection("wagers").getFullList({ filter: `game = "${game.id}"` })).toHaveLength(0);
  await expectRejected(guestPb().collection("wagers").create({ game: game.id, team: game.teams[0], amount: 1 }));

  await host.getByRole("button", { name: "Close wagers and show the question" }).click();
  await expect(tv.page.getByText("What is the capital of Australia?")).toBeVisible();
  // Wagers are closed now.
  await expectRejected(guestPb().collection("wagers").create({ game: game.id, team: game.teams[1], amount: 1 }));

  await host.getByRole("button", { name: "Team 1 right" }).click();
  await expect(host.getByRole("button", { name: "Team 1 right" })).toHaveAttribute("aria-pressed", "true");
  await host.getByRole("button", { name: "Team 2 wrong" }).click();
  await host.getByRole("button", { name: "Start the reveal on the TV" }).click();

  // Lowest score first.
  await host.getByRole("button", { name: "Reveal Team 1" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 1")).toContainText("+400 → 800");
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toHaveCount(0);
  await host.getByRole("button", { name: "Reveal Team 2" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toContainText("−250 → 350");

  // Undo takes the last reveal back off the TV as well as the score.
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toHaveCount(0);
  await host.getByRole("button", { name: "Reveal Team 2" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toContainText("−250 → 350");

  await host.getByRole("button", { name: "Show final standings" }).click();
  const over = tv.page.getByTestId("tv-game-over");
  await expect(over).toContainText("Team 1 wins!");
  await expect(over.locator("li").first()).toContainText("Team 1");
  await expect(p2.page.getByTestId("phone-game-over")).toContainText("You finished #2 with 350");

  await Promise.all([tv.ctx.close(), p1.ctx.close(), p2.ctx.close()]);
});

test("Game rules settings: 2x multiplier, half wrong penalty, and steal/pass", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("button", { name: "Team 2" }).click();

  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();

  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByLabel("Wrong Answer Penalty").click();
  await host.getByRole("option", { name: "Half value (−50%)" }).click();
  await host.getByLabel("Point Multiplier").click();
  await host.getByRole("option", { name: "2× (Double)" }).click();
  await host.getByRole("switch", { name: "Steal / Pass on Wrong" }).click();

  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  // 100-point row is now 200 because of 2x multiplier.
  await expect(host.getByRole("button", { name: "200", exact: true }).first()).toBeVisible();

  const tv = await openTv(browser, uniqueID);
  const p1 = await openBuzzer(browser, uniqueID, "Team 1");
  const p2 = await openBuzzer(browser, uniqueID, "Team 2");

  await host.getByRole("button", { name: "200", exact: true }).first().click();
  await p1.page.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByTestId("host-buzz-queue")).toContainText("Team 1");
  await p2.page.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByTestId("host-buzz-queue")).toContainText("Team 2");

  // Team 1 answers wrong -> half penalty (-100) and passed to Team 2 (#1 in queue).
  await host.getByRole("button", { name: /Wrong: take points from Team 1/ }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("-100");
  await expect(host.getByTestId("host-buzz-queue").locator("li").first()).toContainText("Team 2");

  // Team 2 answers right -> +200.
  await host.getByRole("button", { name: "Correct: add points to Team 2" }).click();
  await expect(host.getByTestId("host-score-Team 2")).toHaveText("200");
  await expect(tv.page.getByTestId("tv-score-Team 2")).toHaveText("200");

  await Promise.all([tv.ctx.close(), p1.ctx.close(), p2.ctx.close()]);
});

test("Question timers: buzz timer auto-starts on TV and phone, host can pause, resume, and clear", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();

  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByLabel("Buzz Window Timer (seconds, 0 = off)").fill("15");

  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  const tv = await openTv(browser, uniqueID);
  const phone = await openBuzzer(browser, uniqueID, "Team 1");

  await host.getByRole("button", { name: "100", exact: true }).first().click();

  // Timer is visible on host, TV, and phone.
  await expect(host.getByTestId("game-timer")).toContainText("Buzz");
  await expect(tv.page.getByTestId("game-timer")).toContainText("Buzz");
  await expect(phone.page.getByTestId("game-timer")).toContainText("Buzz");

  // Host can pause and resume.
  await host.getByRole("button", { name: "Pause Timer" }).click();
  await expect(host.getByTestId("game-timer")).toContainText("(Paused)");
  await expect(tv.page.getByTestId("game-timer")).toContainText("(Paused)");

  await host.getByRole("button", { name: "Resume Timer" }).click();
  await expect(host.getByTestId("game-timer")).not.toContainText("(Paused)");

  await host.getByRole("button", { name: "Clear Timer" }).click();
  await expect(host.getByTestId("game-timer")).toHaveCount(0);
  await expect(tv.page.getByTestId("game-timer")).toHaveCount(0);

  await Promise.all([tv.ctx.close(), phone.ctx.close()]);
});

test("Media questions: image and audio render on host and TV", async ({ page: host, browser }) => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const userId = api.authStore.record!.id;
  const cat = await api.collection("question_categories").create({ name: "MediaCat", user: userId, isPublic: true });
  const imgUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='orange'/%3E%3C/svg%3E";
  const q1 = await api.collection("questions").create({
    question: "What color is this?",
    answer: "Orange",
    value: 100,
    difficulty: 1,
    category: cat.id,
    mediaUrl: imgUrl,
    mediaType: "image",
    user: userId,
    isPublic: true,
  });
  const q2 = await api.collection("questions").create({
    question: "Name this song",
    answer: "Test Song",
    value: 200,
    difficulty: 2,
    category: cat.id,
    mediaUrl: "https://example.com/test.mp3",
    mediaType: "audio",
    user: userId,
    isPublic: true,
  });
  const tpl = await api.collection("game_templates").create({
    title: "Media Board",
    categories: [cat.id],
    questions: [q1.id, q2.id],
    user: userId,
    isPublic: true,
  });
  const game = await api.collection("games").create({
    title: "Media Game",
    uniqueID: `M${Date.now().toString(36).slice(-5).toUpperCase()}`,
    template: tpl.id,
    host: userId,
    teams: [],
    categories: ["MediaCat"],
    values: [100, 200],
    teamScores: [],
    answeredQuestions: [],
    buzzRound: 0,
    showAnswer: false,
    buzzerUnlocked: false,
    hostForceShowQuestion: false,
  });

  await loginAsHost(host);
  await host.goto(`/game/${game.uniqueID}/host`);
  const tv = await openTv(browser, game.uniqueID);
  await expect(tv.page.getByText("MediaCat")).toBeVisible();

  await host.getByRole("button", { name: "100", exact: true }).click();
  await expect(host.getByTestId("question-media-image")).toBeVisible();
  await expect(tv.page.getByTestId("question-media-image")).toBeVisible();

  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await host.getByRole("button", { name: "200", exact: true }).click();
  await expect(host.getByTestId("question-media-audio")).toContainText("Music Round");
  await expect(tv.page.getByTestId("question-media-audio")).toContainText("Music Round");

  await tv.ctx.close();
});

test("Themes & branding: custom title, accent color, and light TV theme render on TV", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("button", { name: "Team 2" }).click();
  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();
  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByLabel("Game Title").fill("Friday Trivia Night");
  await host.getByLabel("Accent Color Hex").fill("#22c55e");
  await host.getByLabel("TV Theme").click();
  await host.getByRole("option", { name: "Light" }).click();
  await host.getByRole("button", { name: "Start Game" }).click();

  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  const tv = await openTv(browser, uniqueID);
  await expect(tv.page.getByTestId("tv-branding-header")).toContainText("Friday Trivia Night");
  await expect(tv.page.locator("[data-theme='light']")).toBeVisible();
  const accent = await tv.page.locator("[data-theme='light']").evaluate((el) => el.style.getPropertyValue("--accent"));
  expect(accent).toBe("#22c55e");

  await tv.ctx.close();
});

test("Sound & effects: mute setting and host toggle sync to TV", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("button", { name: "Team 2" }).click();
  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();
  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByRole("switch", { name: "Mute All Game Sounds" }).click();
  await host.getByRole("button", { name: "Start Game" }).click();

  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  await expect(host.getByTestId("host-sound-toggle")).toHaveText("Sound: Muted");
  const tv = await openTv(browser, uniqueID);
  await expect(tv.page.getByTestId("tv-sound-toggle")).toHaveText("TV Sound: Muted");

  await host.getByTestId("host-sound-toggle").click();
  await expect(host.getByTestId("host-sound-toggle")).toHaveText("Sound: On");
  await expect(tv.page.getByTestId("tv-sound-toggle")).toHaveText("TV Sound: On");

  await tv.ctx.close();
});

test("Question types: multiple choice and estimation submit from phone and auto-score on host", async ({ page: host, browser }) => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const userId = api.authStore.record!.id;
  const t1 = await api.collection("teams").create({ name: "QTeam1", user: userId, isPublic: true });
  const t2 = await api.collection("teams").create({ name: "QTeam2", user: userId, isPublic: true });
  const cat = await api.collection("question_categories").create({ name: "QTypes", user: userId, isPublic: true });
  const qMc = await api.collection("questions").create({
    question: "Pick the prime number",
    answer: "7",
    questionType: "multiple_choice",
    options: ["4", "7", "9", "12"],
    value: 100,
    difficulty: 1,
    category: cat.id,
    user: userId,
    isPublic: true,
  });
  const qEst = await api.collection("questions").create({
    question: "How many minutes in a day?",
    answer: "1440",
    questionType: "estimation",
    value: 200,
    difficulty: 2,
    category: cat.id,
    user: userId,
    isPublic: true,
  });
  const tpl = await api.collection("game_templates").create({
    title: "QTypes Board",
    categories: [cat.id],
    questions: [qMc.id, qEst.id],
    user: userId,
    isPublic: true,
  });
  const game = await api.collection("games").create({
    title: "QTypes Game",
    uniqueID: `Q${Date.now().toString(36).slice(-5).toUpperCase()}`,
    template: tpl.id,
    host: userId,
    teams: [t1.id, t2.id],
    categories: ["QTypes"],
    values: [100, 200],
    teamScores: [{ id: t1.id, score: 0 }, { id: t2.id, score: 0 }],
    answeredQuestions: [],
    buzzRound: 0,
    showAnswer: false,
    buzzerUnlocked: false,
    hostForceShowQuestion: false,
  });

  await loginAsHost(host);
  await host.goto(`/game/${game.uniqueID}/host`);
  const tv = await openTv(browser, game.uniqueID);
  await expect(tv.page.getByText("QTypes")).toBeVisible();
  const p1 = await openBuzzer(browser, game.uniqueID, "QTeam1");
  const p2 = await openBuzzer(browser, game.uniqueID, "QTeam2");

  // Multiple choice
  await host.getByRole("button", { name: "100", exact: true }).click();
  await expect(tv.page.getByTestId("tv-mc-options")).toContainText("7");
  await p1.page.getByTestId("phone-mc-option").filter({ hasText: "7" }).click();
  await expect(p1.page.getByTestId("phone-answer-submitted")).toContainText("7");
  await p2.page.getByTestId("phone-mc-option").filter({ hasText: "4" }).click();
  await expect(host.getByTestId("host-submitted-answers")).toContainText("Submitted Answers (2)");

  await host.getByRole("button", { name: "Auto-Score Answers" }).click();
  await expect(host.getByTestId("host-score-QTeam1")).toHaveText("100");
  await expect(host.getByTestId("host-score-QTeam2")).toHaveText("-100");

  // Estimation
  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await host.getByRole("button", { name: "200", exact: true }).click();
  await p1.page.getByLabel("Your estimate").fill("1000");
  await p1.page.getByRole("button", { name: "Submit Estimate" }).click();
  await p2.page.getByLabel("Your estimate").fill("1400");
  await p2.page.getByRole("button", { name: "Submit Estimate" }).click();
  await expect(host.getByTestId("host-submitted-answers")).toContainText("Submitted Answers (2)");

  await host.getByRole("button", { name: "Award Closest" }).click();
  await expect(host.getByTestId("host-score-QTeam2")).toHaveText("100");

  await Promise.all([tv.ctx.close(), p1.ctx.close(), p2.ctx.close()]);
});

test("Team customization: emoji, color, members, and phone self-registration with host approval", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");

  await host.getByLabel("Team Emoji").fill("🦊");
  await host.getByPlaceholder("New Team Name").fill("Foxes");
  await host.getByLabel("Team Members").fill("Alice, Bob");
  await host.getByRole("button", { name: "Add Team" }).click();

  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();
  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByRole("switch", { name: "Allow Phone Team Registration" }).click();
  await host.getByRole("button", { name: "Start Game" }).click();

  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  const tv = await openTv(browser, uniqueID);
  await expect(tv.page.getByText("🦊 Foxes")).toBeVisible();
  await expect(tv.page.getByText("Alice, Bob")).toBeVisible();

  const phoneCtx = await browser.newContext();
  const phone = await phoneCtx.newPage();
  await phone.goto(`/game/${uniqueID}`);
  await phone.getByLabel("New Team Emoji").fill("🦉");
  await phone.getByLabel("New Team Name").fill("Owls");
  await phone.getByLabel("New Team Members").fill("Cara");
  await phone.getByRole("button", { name: "Request to Join" }).click();
  await expect(phone.getByTestId("phone-reg-pending")).toContainText("Owls");

  await expect(host.getByTestId("host-team-requests")).toContainText("🦉 Owls");
  await host.getByRole("button", { name: "Approve" }).click();

  await expect(tv.page.getByText("🦉 Owls")).toBeVisible();
  await expect(phone.getByText("Team: Owls")).toBeVisible();

  await Promise.all([tv.ctx.close(), phoneCtx.close()]);
});

test("Host tools: pause/resume, lock team, reopen tile, edit Q/A, and keyboard shortcuts", async ({ page: host, browser }) => {
  const { game } = await setup(host);
  const uniqueID = game.uniqueID;

  const tv = await openTv(browser, uniqueID);
  const p1 = await openBuzzer(browser, uniqueID, "Team 1");

  // Keyboard shortcuts modal via ? button
  await host.getByRole("button", { name: "Keyboard Shortcuts" }).click();
  await expect(host.getByTestId("shortcuts-modal")).toBeVisible();
  await host.getByRole("button", { name: "Close" }).click();
  await expect(host.getByTestId("shortcuts-modal")).toBeHidden();

  // Pause & Resume
  await host.getByTestId("host-pause-toggle").click();
  await expect(tv.page.getByTestId("game-paused-overlay")).toBeVisible();
  await expect(p1.page.getByTestId("game-paused-overlay")).toBeVisible();
  await host.getByTestId("host-pause-toggle").click();
  await expect(tv.page.getByTestId("game-paused-overlay")).toBeHidden();

  // Lock & Unlock Team 1
  await host.getByRole("button", { name: "Lock" }).first().click();
  await expect(p1.page.getByTestId("phone-team-locked")).toBeVisible();
  await host.getByRole("button", { name: "Unlock" }).first().click();
  await expect(p1.page.getByTestId("phone-team-locked")).toBeHidden();

  // Open tile, Edit Q/A mid-game, Done, then Reopen used tile
  await host.getByRole("button", { name: "100", exact: true }).first().click();
  await host.getByRole("button", { name: "Edit Q/A" }).click();
  await host.getByLabel("Edit Question").fill("Edited question text?");
  await host.getByRole("button", { name: "Save Q/A" }).click();
  await expect(tv.page.getByRole("heading", { name: "Edited question text?" })).toBeVisible();

  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  const reopenBtn = host.getByRole("button", { name: "Reopen 100" }).first();
  await expect(reopenBtn).toBeVisible();
  await reopenBtn.click();
  await expect(host.getByRole("button", { name: "100", exact: true })).toHaveCount(4);

  await Promise.all([tv.ctx.close(), p1.ctx.close()]);
});

test("Game history & stats: ending a game records standings and updates leaderboard", async ({ page: host }) => {
  const { game } = await setup(host);

  await host.getByRole("button", { name: "Correct: add points to Team 1" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("100");

  await host.getByRole("button", { name: "End game" }).click();
  await host.getByRole("dialog").getByRole("button", { name: "End game" }).click();
  await expect(host.getByRole("dialog")).toBeHidden();

  await host.goto("/history");
  await expect(host.getByTestId("history-leaderboard")).toContainText("Team 1");
  await expect(host.getByTestId("history-games-list")).toContainText(game.uniqueID);
  await expect(host.getByTestId("history-games-list")).toContainText("Team 1: 100");
});

test("Content library: duplicate template and search/filter question library", async ({ page: host }) => {
  await loginAsHost(host);
  await host.goto("/");

  // Duplicate template
  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();
  await host.getByRole("button", { name: "Duplicate Template" }).click();
  await expect(host.getByText("Test Board (Copy)", { exact: true })).toBeVisible();

  // Search & filter in Questions tab
  await host.getByRole("tab", { name: "Questions" }).click();
  await expect(host.getByTestId("question-library")).toBeVisible();
  await host.getByLabel("Search Question Library").fill("Linux kernel");
  await expect(host.getByTestId("question-library")).toContainText("Linux kernel");
  await expect(host.getByTestId("question-library")).not.toContainText("capital of Japan");
});


test("Game modes: rounds doubles values, tiebreaker shows on TV", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { settings: { gameMode: "rounds" }, round: 1 });
  await host.reload();
  const tv = await openTv(browser, game.uniqueID);

  await expect(host.getByTestId("host-mode-panel")).toContainText("Round 1");
  await expect(host.getByRole("button", { name: "100", exact: true })).toHaveCount(4);
  await host.getByRole("button", { name: "Start Round 2 (2× values)" }).click();
  await expect(host.getByRole("button", { name: "200", exact: true })).toHaveCount(4);
  await expect(host.getByRole("button", { name: "100", exact: true })).toHaveCount(0);
  await expect(tv.page.getByTestId("tv-round")).toContainText("Round 2");

  // Both teams are at 0, so the top is tied.
  await host.getByLabel("Tiebreaker Question").fill("Closest to the year Linux began?");
  await host.getByLabel("Tiebreaker Answer").fill("1991");
  await host.getByRole("button", { name: "Start Tiebreaker" }).click();
  await expect(host.getByTestId("host-tiebreaker-active")).toBeVisible();
  await expect(tv.page.getByTestId("tv-tiebreaker")).toContainText("Closest to the year Linux began?");
  await expect(tv.page.getByTestId("tv-tiebreaker-answer")).toHaveCount(0);
  await host.getByRole("button", { name: "Reveal Tiebreaker Answer" }).click();
  await expect(tv.page.getByTestId("tv-tiebreaker-answer")).toHaveText("1991");
  await host.getByRole("button", { name: "End Tiebreaker" }).click();
  await expect(tv.page.getByTestId("tv-tiebreaker")).toHaveCount(0);
});

test("Game modes: elimination removes lowest team", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { settings: { gameMode: "elimination" }, round: 1 });
  await host.reload();
  const tv = await openTv(browser, game.uniqueID);

  await host.getByRole("button", { name: "Correct: add points to Team 1" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("100");
  await host.getByRole("button", { name: "Eliminate Lowest Team" }).click();
  await expect(host.getByTestId("host-eliminated")).toContainText("Team 2");
  await expect(tv.page.getByTestId("tv-eliminated")).toContainText("Team 2");
  await host.getByRole("button", { name: "Next Round" }).click();
  await expect(host.getByTestId("host-mode-panel")).toContainText("Round 2");
});

test("Game modes: solo route shows the solo banner", async ({ page: host }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { settings: { gameMode: "solo" } });
  await host.goto(`/game/${game.uniqueID}/solo`);
  await expect(host.getByTestId("solo-banner")).toBeVisible();
});

test("Spectator & accessibility: watch route, large text, colorblind palette, language, live region", async ({ page: host, browser }) => {
  const { game } = await setup(host);
  await expect(host.getByRole("link", { name: "Spectator Link" })).toHaveAttribute("href", `/game/${game.uniqueID}/watch`);

  const ctx = await browser.newContext();
  const watch = await ctx.newPage();
  await watch.goto(`/game/${game.uniqueID}/watch`);
  await expect(watch.getByTestId("watch-badge")).toContainText(game.uniqueID);
  await expect(watch.getByTestId("tv-score-Team 1")).toBeVisible();

  // Large text scales the root font size and persists across reloads.
  await watch.getByTestId("tv-large-text-toggle").click();
  await expect(watch.getByTestId("tv-large-text-toggle")).toHaveAttribute("aria-pressed", "true");
  expect(await watch.evaluate(() => document.documentElement.style.fontSize)).toBe("125%");
  await watch.reload();
  await expect(watch.getByTestId("tv-large-text-toggle")).toHaveAttribute("aria-pressed", "true");

  // Colorblind palette swaps the accent color on the TV root.
  await watch.getByTestId("tv-colorblind-toggle").click();
  await expect(watch.getByTestId("tv-colorblind-toggle")).toHaveAttribute("aria-pressed", "true");
  const accent = await watch.locator("[data-theme]").first().evaluate((el) => (el as HTMLElement).style.getPropertyValue("--accent"));
  expect(accent).toBe("#56B4E9");

  // Language switcher translates TV chrome.
  await watch.getByTestId("tv-language-select").selectOption("es");
  await expect(watch.getByTestId("watch-badge")).toContainText("Vista de espectador");
  await expect(watch.getByTestId("tv-sound-toggle")).toContainText("Sonido de TV");

  // Live region announces a score change for screen readers.
  await host.getByRole("button", { name: "Correct: add points to Team 1" }).click();
  await expect(watch.getByTestId("tv-live-region")).toContainText("Team 1 lidera con 100 puntos");
  await ctx.close();
});

test("Admin & ops: password reset, join QR on host and TV, PWA manifest and install prompt", async ({ page: host, browser }) => {
  // Password reset UI (request is mocked so no mail server is needed).
  const ctx = await browser.newContext();
  const login = await ctx.newPage();
  let resetBody: { email?: string } | null = null;
  await login.route("**/request-password-reset", async (route) => {
    resetBody = route.request().postDataJSON();
    await route.fulfill({ status: 204, body: "" });
  });
  await login.goto("/login");
  await login.getByRole("button", { name: "Forgot password?" }).click();
  await expect(login.getByPlaceholder("Password")).toHaveCount(0);
  await login.getByPlaceholder("Email").fill("someone@example.com");
  await login.getByRole("button", { name: "Send reset link" }).click();
  await expect(login.getByTestId("reset-sent")).toBeVisible();
  expect(resetBody).toEqual({ email: "someone@example.com" });
  await ctx.close();

  // Join QR on host and TV.
  const { game } = await setup(host);
  await host.getByTestId("qr-join-button").click();
  await expect(host.getByTestId("qr-join-svg")).toBeVisible();
  await expect(host.getByTestId("qr-join-modal")).toContainText(`/game/${game.uniqueID}`);
  await host.keyboard.press("Escape");
  await expect(host.getByTestId("qr-join-modal")).toHaveCount(0);

  const tv = await openTv(browser, game.uniqueID);
  await tv.page.getByTestId("qr-join-button").click();
  await expect(tv.page.getByTestId("qr-join-svg")).toBeVisible();

  // PWA: manifest is served and linked; the phone offers an install button once the browser fires the prompt.
  const manifest = await host.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).short_name).toBe("Lockout");
  expect((await host.request.get("/sw.js")).ok()).toBe(true);
  await expect(host.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const phone = await openBuzzer(browser, game.uniqueID, "Team 1");
  await expect(phone.page.getByTestId("pwa-install-button")).toHaveCount(0);
  await phone.page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    (e as unknown as { prompt: () => Promise<void> }).prompt = async () => {};
    window.dispatchEvent(e);
  });
  await expect(phone.page.getByTestId("pwa-install-button")).toBeVisible();
  await phone.page.getByTestId("pwa-install-button").click();
  await expect(phone.page.getByTestId("pwa-install-button")).toHaveCount(0);
});
