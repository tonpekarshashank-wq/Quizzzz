import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { accessible } from "./accessibility";

test("host and mobile player complete a game with reload and lost acknowledgement recovery", async ({
  page,
  browser,
}) => {
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Live host");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`live-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("quizzzz-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  const quizId = await page.evaluate(async () => {
    const options = ["Mercury", "Venus"].map((label) => ({
      id: crypto.randomUUID(),
      label,
    }));
    const response = await fetch("/api/v1/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draft: {
          title: "Space race",
          description: "",
          language: "en",
          coverImageUrl: "",
          questions: [
            {
              id: crypto.randomUUID(),
              type: "mc",
              prompt: "Closest planet to the Sun?",
              revealFact:
                "Mercury is the innermost planet in our solar system.",
              timeLimit: 10,
              basePoints: 1000,
              options,
              correctOptionId: options[0].id,
            },
          ],
        },
      }),
    });
    return (await response.json()).data.id;
  });
  await page.goto(`/quizzes/${quizId}`);
  await page.getByRole("button", { name: "Go live", exact: false }).click();
  await expect(page).toHaveURL(/\/host\//);
  await accessible(page);
  const sessionId = page.url().split("/").at(-1)!;
  const pin = await page.evaluate(
    async (id) =>
      (await (await fetch(`/api/v1/sessions/${id}/snapshot`)).json()).data.pin,
    sessionId,
  );
  const guest = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const player = await guest.newPage();
  await player.goto(`/join?pin=${pin}`);
  await player.getByLabel("Nickname", { exact: false }).fill("Luna");
  await player.getByRole("button", { name: "Let's go" }).click();
  await expect(
    player.getByRole("heading", { name: "Hey, Luna!" }),
  ).toBeVisible();
  await accessible(player);
  await player.reload();
  await expect(
    player.getByRole("heading", { name: "Hey, Luna!" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(
    page.getByRole("heading", {
      name: "ONE QUESTION. MAKE IT COUNT.",
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    player.getByRole("button", { name: "Mercury", exact: false }),
  ).toBeVisible();
  const liveSnapshot = await page.evaluate(
    async (id) =>
      (await (await fetch(`/api/v1/sessions/${id}/snapshot`)).json()).data,
    sessionId,
  );
  expect(liveSnapshot.reveal).toBeUndefined();
  expect(liveSnapshot.question.revealFact).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  let lost = false;
  await player.route("**/answers", async (route) => {
    const response = await route.fetch();
    if (!lost) {
      lost = true;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await expect(page.locator(".lock-badge")).toHaveText(/Lock it in! [123]/, {
    timeout: 12000,
  });
  await expect(player.locator(".lock-badge")).toHaveText(/Lock it in! [123]/);
  await player.getByRole("button", { name: "Mercury", exact: false }).click();
  await expect(player.locator(".lock-badge")).toHaveText("Answer locked ✓");
  await expect(player.getByRole("status")).toContainText("Locked in");
  await player.reload();
  await expect(player.getByRole("status")).toContainText("Locked in");
  await expect(player.getByRole("heading", { name: "Nailed it!" })).toBeVisible(
    { timeout: 15000 },
  );
  expect(
    await player.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    player.getByText("Mercury is the innermost planet in our solar system.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Mercury is the innermost planet in our solar system.", {
      exact: true,
    }),
  ).toBeVisible();
  await accessible(player);
  await player.screenshot({
    path: "test-results/player-result.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "See the leaderboard" }).click();
  let scene = "summit";
  await page.route("**/snapshot", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (payload.data?.state === "LEADERBOARD") payload.data.theme = scene;
    await route.fulfill({ response, json: payload });
  });
  for (const [theme, headline] of [
    ["summit", "The summit push."],
    ["gp", "Grand Prix finale."],
    ["tour", "The final climb."],
    ["moon", "Mission to the Moon."],
    ["map", "Hunt for the X."],
  ]) {
    scene = theme;
    await expect(
      page.getByRole("heading", { name: headline, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/theme-${theme}.png`,
      fullPage: true,
    });
  }
  await page.unroute("**/snapshot");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/host-summit.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Final results" }).click();
  await expect(player.getByRole("heading", { name: "You won!" })).toBeVisible();
  await accessible(player);
  await expect(player.getByText("Speed Demon", { exact: true })).toBeVisible();
  const pngPromise = player.waitForEvent("download");
  await player.getByRole("button", { name: "Save my card" }).click();
  const png = await pngPromise;
  await png.saveAs("test-results/player-card.png");
  expect(
    (await readFile("test-results/player-card.png"))
      .subarray(0, 8)
      .toString("hex"),
  ).toBe("89504e470d0a1a0a");
  await player
    .getByRole("group", { name: "Quiz ease rating" })
    .getByRole("button", { name: "4", exact: true })
    .click();
  await expect(player.getByRole("status")).toContainText("Your rating: 4/5");
  await player.reload();
  await expect(player.getByRole("status")).toContainText("Your rating: 4/5");
  expect(
    await player.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await player.screenshot({
    path: "test-results/player-final.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "View report / CSV" }).click();
  await expect(page.getByRole("heading", { name: "Space race" })).toBeVisible();
  await accessible(page);
  await expect(page.getByText("4.0 / 5", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/report-mobile.png",
    fullPage: true,
  });
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const csv = await csvPromise;
  const csvFile = await csv.path();
  expect(await readFile(csvFile!, "utf8")).toContain('"Luna"');
  expect(await readFile(csvFile!, "utf8")).toContain(
    '"Mercury","correct","true"',
  );
  expect(
    (await player.request.get(`/api/reports/${sessionId}/csv`)).status(),
  ).toBe(401);
  await guest.close();
});

test("final question intro precedes the timer, supports reduced motion and remains accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Final host");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`final-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("quizzzz-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  const id = await page.evaluate(async () => {
    const questions = ["First question", "Last question"].map((prompt) => {
      const options = ["True", "False"].map((label) => ({
        id: crypto.randomUUID(),
        label,
      }));
      return {
        id: crypto.randomUUID(),
        type: "tf",
        prompt,
        revealFact: "A fact for the reveal.",
        timeLimit: 10,
        basePoints: 1000,
        options,
        correctOptionId: options[0].id,
      };
    });
    const response = await fetch("/api/v1/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draft: {
          title: "Final intro",
          description: "",
          language: "en",
          coverImageUrl: "",
          questions,
        },
      }),
    });
    return (await response.json()).data.id;
  });
  await page.goto(`/quizzes/${id}`);
  await page.getByRole("button", { name: "Go live", exact: false }).click();
  await expect(page).toHaveURL(/\/host\//);
  const sessionId = page.url().split("/").at(-1)!;
  await page.evaluate(async (id) => {
    const snap = (await (await fetch(`/api/v1/sessions/${id}/snapshot`)).json())
      .data;
    await fetch("/api/v1/sessions/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: snap.pin,
        nickname: "Test player",
        avatar: { body: 0, mood: "smile" },
        joinRequestId: crypto.randomUUID(),
      }),
    });
  }, sessionId);
  await expect(page.getByRole("button", { name: "Start game" })).toBeEnabled();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(
    page.getByRole("heading", { name: "First question", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "See the leaderboard" }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "See the leaderboard" }).click();
  await page
    .getByRole("button", { name: "Next question", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "FINAL QUESTION", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Last question", exact: true }),
  ).not.toBeVisible();
  expect(
    await page
      .locator(".final-question-banner")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.screenshot({
    path: "test-results/final-question-intro.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Last question", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
