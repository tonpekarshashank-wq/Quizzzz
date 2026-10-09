import { test, expect, type Page } from "@playwright/test";
async function room(page: Page) {
  return page.evaluate(async () => {
    const options = ["Yes", "No"].map((label) => ({
      id: crypto.randomUUID(),
      label,
    }));
    const post = async (path: string, body: unknown, key?: string) => {
      const response = await fetch(`/api/v1/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()).data;
    };
    const quiz = await post("quizzes", {
      draft: {
        title: "Host recovery",
        description: "",
        language: "en",
        coverImageUrl: "",
        questions: [
          {
            id: crypto.randomUUID(),
            type: "mc",
            prompt: "Ready to play?",
            timeLimit: 10,
            basePoints: 1000,
            options,
            correctOptionId: options[0].id,
          },
        ],
      },
    });
    return post(
      "sessions",
      { quizId: quiz.id, expectedQuizRevision: 1 },
      crypto.randomUUID(),
    );
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("mobile host resumes, moderates, fences another tab and cancels", async ({
  page,
  context,
  browser,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Mobile host");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`host-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("quizzzz-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  const game = await room(page);
  await page.reload();
  await page.getByRole("link", { name: "Resume game" }).click();
  await expect(page.getByRole("button", { name: "Cancel game" })).toBeEnabled();
  await noOverflow(page);
  const guest = await browser.newContext();
  const player = await guest.newPage();
  await player.goto(`/join?pin=${game.pin}`);
  await player.getByLabel("Nickname", { exact: false }).fill("Guest");
  await player.getByRole("button", { name: "Let's go" }).click();
  await expect(
    player.getByRole("heading", { name: "Hey, Guest!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Guest" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep playing" })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Guest" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Guest" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm" })
    .click();
  await expect(
    player.getByRole("heading", { name: "Your game connection ended." }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.setViewportSize({ width: 320, height: 844 });
  await second.goto(page.url());
  await expect(
    second.getByRole("button", { name: "Cancel game" }),
  ).toBeDisabled();
  await second
    .getByRole("button", { name: "Take over / restore control" })
    .click();
  await expect(
    second.getByRole("button", { name: "Cancel game" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Cancel game" }),
  ).toBeDisabled();
  await second.reload();
  await second
    .getByRole("button", { name: "Take over / restore control" })
    .click();
  await expect(
    second.getByRole("button", { name: "Cancel game" }),
  ).toBeEnabled();
  await second.screenshot({
    path: "test-results/host-mobile-lobby.png",
    fullPage: true,
  });
  await noOverflow(second);
  let lost = false;
  await second.route("**/commands", async (route) => {
    const response = await route.fetch();
    if (!lost) {
      lost = true;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await second.getByRole("button", { name: "Cancel game" }).click();
  await second
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm" })
    .click();
  await expect(
    second.getByRole("button", { name: "Retry action" }),
  ).toBeVisible();
  await second.reload();
  await second.getByRole("button", { name: "Retry action" }).click();
  await expect(
    second.getByRole("button", { name: "Retry action" }),
  ).not.toBeVisible();
  await expect(
    second.getByRole("heading", { name: "This lobby is closed." }),
  ).toBeVisible();
  await second.getByRole("link", { name: "Back to my quizzes" }).click();
  await expect(
    second.getByRole("link", { name: "Resume game" }),
  ).not.toBeVisible();
  await guest.close();
});
