import { test, expect, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { accessible } from "./accessibility";
const password = "quizzzz-test-password";
async function register(page: Page) {
  const email = `host-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Maya");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  return email;
}
async function makeQuiz(page: Page) {
  await page
    .getByRole("button", { name: "Create a quiz", exact: false })
    .click();
  await expect(page).toHaveURL(/\/quizzes\//);
  return page.url().split("/").at(-1)!;
}
test("mobile authoring persists, true/false, reorder, delete and archive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await register(page);
  await makeQuiz(page);
  await page.getByLabel("Quiz name").fill("Friday science");
  await page
    .getByRole("button", { name: "+ Multiple choice", exact: true })
    .click();
  await page
    .getByLabel("Question 1 prompt")
    .fill("Which planet is closest to the Sun?");
  for (const [i, label] of ["Mercury", "Venus", "Earth", "Mars"].entries())
    await page
      .getByLabel(`Question 1 answer ${i + 1}`, { exact: true })
      .fill(label);
  await page
    .getByRole("button", { name: "Mark answer 1 correct for question 1" })
    .click();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page
    .getByRole("button", { name: "+ True / False", exact: true })
    .click();
  await page.getByLabel("Question 2 prompt").fill("The Sun is a star.");
  await page
    .getByRole("button", { name: "Mark answer 1 correct for question 2" })
    .click();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page.getByRole("button", { name: "Move question 2 up" }).click();
  await expect(page.getByLabel("Question 1 prompt")).toHaveValue(
    "The Sun is a star.",
  );
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page.reload();
  await expect(page.getByLabel("Quiz name")).toHaveValue("Friday science");
  await accessible(page);
  await page
    .getByRole("button", { name: "Edit question", exact: false })
    .count();
  await page
    .getByRole("button", { name: "Question ideas", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/editor-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete question", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Delete question", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page.getByRole("link", { name: "← My quizzes" }).click();
  await expect(
    page.getByRole("heading", { name: "Friday science" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive Friday science" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your first quiz starts here." }),
  ).toBeVisible();
});
test("two tabs detect revision conflict and preserve edits", async ({
  page,
  context,
}) => {
  await register(page);
  await makeQuiz(page);
  await page
    .getByRole("button", { name: "+ Multiple choice", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  const second = await context.newPage();
  await second.goto(page.url());
  await page.getByLabel("Quiz name").fill("First tab saved");
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await second.getByLabel("Quiz name").fill("Second tab kept locally");
  await expect(second.getByRole("status")).toHaveText("Save conflict");
  await expect(second.getByLabel("Quiz name")).toHaveValue(
    "Second tab kept locally",
  );
  await expect(
    second.getByRole("button", { name: "Download my edits" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.screenshot({
    path: "test-results/editor-desktop.png",
    fullPage: true,
  });
});
test("ownership, CSRF and password-reset session revocation", async ({
  page,
  browser,
}) => {
  const email = await register(page);
  const id = await makeQuiz(page);
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3217" });
  const p = await other.newPage();
  await register(p);
  const attack = await p.request.get(`/api/v1/quizzes/${id}`);
  expect(attack.status()).toBe(404);
  const write = await p.request.put(`/api/v1/quizzes/${id}`, {
    headers: { Origin: "http://127.0.0.1:3217" },
    data: {
      draft: {
        title: "Stolen",
        description: "",
        language: "en",
        coverImageUrl: "",
        questions: [],
      },
      expectedRevision: 1,
    },
  });
  expect(write.status()).toBe(404);
  const csrf = await page.request.post("/api/v1/auth/logout", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(csrf.status()).toBe(403);
  const reset = await page.request.post("/api/v1/auth/forgot-password", {
    headers: { Origin: "http://127.0.0.1:3217" },
    data: { email },
  });
  expect(reset.status()).toBe(200);
  const files = await readdir(".data/e2e/mail");
  let url = "";
  for (const name of files) {
    const mail = JSON.parse(await readFile(`.data/e2e/mail/${name}`, "utf8"));
    if (mail.to === email) url = mail.url;
  }
  expect(url).toContain("#token=");
  await page.goto(url);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-quizzzz-password");
  await page.getByLabel("Confirm password").fill("new-quizzzz-password");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
  const token = url.split("#token=")[1];
  expect(
    (
      await page.request.post("/api/v1/auth/reset-password", {
        headers: { Origin: "http://127.0.0.1:3217" },
        data: { token, password: "another-new-password" },
      })
    ).status(),
  ).toBe(422);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-quizzzz-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  await other.close();
});
test("320px account and landing pages do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const route of ["/", "/login", "/register", "/forgot-password"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
});

test("failed saves keep edits and edits during an in-flight save are queued", async ({
  page,
}) => {
  await register(page);
  const id = await makeQuiz(page);
  await page.route(`**/api/v1/quizzes/${id}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.abort();
      await page.unroute(`**/api/v1/quizzes/${id}`);
    } else await route.continue();
  });
  await page.getByLabel("Quiz name").fill("Kept through failure");
  await expect(page.getByRole("status")).toHaveText("Save failed");
  await expect(page.getByLabel("Quiz name")).toHaveValue(
    "Kept through failure",
  );
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const arrival = new Promise<void>((resolve) => {
    started = resolve;
  });
  let first = true;
  await page.route(`**/api/v1/quizzes/${id}`, async (route) => {
    if (route.request().method() === "PUT" && first) {
      first = false;
      started();
      await gate;
    }
    await route.continue();
  });
  await page.getByLabel("Quiz name").fill("First queued save");
  await arrival;
  await page.getByLabel("Quiz name").fill("Latest queued save");
  release();
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page.reload();
  await expect(page.getByLabel("Quiz name")).toHaveValue("Latest queued save");
});

test("question ideas filter, copy independently, persist provenance and enforce capacity", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  expect((await page.request.get("/api/v1/question-ideas")).status()).toBe(401);
  await register(page);
  const firstPage = (
    await (
      await page.request.get("/api/v1/question-ideas?category=Science&limit=2")
    ).json()
  ).data;
  expect(firstPage.items).toHaveLength(2);
  const nextPage = (
    await (
      await page.request.get(
        `/api/v1/question-ideas?category=Science&limit=2&cursor=${firstPage.nextCursor}`,
      )
    ).json()
  ).data;
  expect(nextPage.items[0].id).not.toBe(firstPage.items[0].id);
  const id = await makeQuiz(page);
  await page
    .getByRole("button", { name: "Question ideas", exact: true })
    .click();
  const panel = page.getByRole("complementary", { name: "Question ideas" });
  await expect(panel.getByRole("article")).toHaveCount(30);
  await panel.getByRole("button", { name: "Science", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Science", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("article")).toHaveCount(6);
  const mercury = panel.getByRole("article", {
    name: "Which planet is closest to the Sun?",
    exact: true,
  });
  await mercury.getByRole("button", { name: /^Add:/ }).click();
  await expect(page.getByLabel("Question 1 prompt")).toBeFocused();
  await expect(page.getByLabel("Question 1 prompt")).toHaveValue(
    "Which planet is closest to the Sun?",
  );
  await expect(mercury.getByText("✓ Added", { exact: true })).toBeVisible();
  await page.getByLabel("Question 1 prompt").fill("My edited question");
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await page.reload();
  await expect(page.getByLabel("Question 1 prompt")).toHaveValue(
    "My edited question",
  );
  await page
    .getByRole("button", { name: "Question ideas", exact: true })
    .click();
  await expect(mercury.getByText("✓ Added", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete question", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await mercury.getByRole("button", { name: /^Add:/ }).click();
  await expect(page.getByLabel("Question 1 prompt")).toHaveValue(
    "Which planet is closest to the Sun?",
  );
  await panel
    .getByRole("article", { name: "The Sun is a star.", exact: true })
    .getByRole("button", { name: /^Add:/ })
    .click();
  await expect(page.getByLabel("Question 2 prompt")).toBeFocused();
  await expect(
    page.getByLabel("Question 2 answer 1", { exact: true }),
  ).toHaveValue("True");
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/ideas-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1360, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(panel).toBeVisible();
  await page.screenshot({
    path: "test-results/ideas-desktop.png",
    fullPage: true,
  });
  const quiz = (await (await page.request.get(`/api/v1/quizzes/${id}`)).json())
    .data;
  expect(quiz.draft.questions[0].sourceIdeaId).toBe("science-mercury");
  expect(quiz.draft.questions[1].sourceIdeaId).toBe("science-star");
  const template = quiz.draft.questions[0];
  quiz.draft.questions = Array.from({ length: 100 }, () => {
    const options = template.options.map((o: { label: string }) => ({
      id: crypto.randomUUID(),
      label: o.label,
    }));
    return {
      ...template,
      id: crypto.randomUUID(),
      sourceIdeaId: undefined,
      options,
      correctOptionId: options[0].id,
    };
  });
  const response = await page.request.put(`/api/v1/quizzes/${id}`, {
    headers: { Origin: "http://127.0.0.1:3217" },
    data: { draft: quiz.draft, expectedRevision: quiz.revision },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("100 questions");
  const buttons = panel.getByRole("button", { name: /^Add:/ });
  await expect(buttons).toHaveCount(30);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
});

test("question ideas skeleton, retry, empty category and stale responses", async ({
  page,
}) => {
  await register(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/v1/question-ideas?**", async (route) => {
    if (fail) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: { message: "Unavailable" } },
      });
    } else await route.continue();
  });
  await makeQuiz(page);
  const panel = page.getByRole("complementary", { name: "Question ideas" });
  await expect(panel.locator(".idea-skeleton")).toHaveCount(3);
  release();
  await expect(panel.getByRole("alert")).toContainText("Couldn't load");
  fail = false;
  await panel.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(panel.getByRole("article")).toHaveCount(30);
  await page.unroute("**/api/v1/question-ideas?**");
  await page.route("**/api/v1/question-ideas?**", async (route) => {
    const category = new URL(route.request().url()).searchParams.get(
      "category",
    );
    if (category === "General")
      await route.fulfill({
        json: { data: { items: [], total: 0, nextCursor: null } },
      });
    else await route.continue();
  });
  await panel.getByRole("button", { name: "General", exact: true }).click();
  await expect(
    panel.getByText("No ideas in this category yet", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Science", exact: true }).click();
  await panel.getByRole("button", { name: "Tech", exact: true }).click();
  await expect(panel.getByRole("article")).toHaveCount(6);
  for (const card of await panel.getByRole("article").all())
    await expect(card.getByText("Tech", { exact: true })).toBeVisible();
  await accessible(page);
  await page.unroute("**/api/v1/question-ideas?**");
  await page.route("**/api/v1/question-ideas?**", (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("limit", "2");
    return route.continue({ url: url.toString() });
  });
  await page.reload();
  await expect(panel.getByRole("article")).toHaveCount(2);
  await panel
    .getByRole("button", { name: "Load more ideas", exact: true })
    .click();
  await expect(panel.getByRole("article")).toHaveCount(4);
});
