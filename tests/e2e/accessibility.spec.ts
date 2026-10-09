import { test, expect } from "@playwright/test";
import { accessible } from "./accessibility";
test("public screens support accessible names, contrast and keyboard navigation", async ({
  page,
  browserName,
}) => {
  for (const route of [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/join",
  ]) {
    await page.goto(route);
    await accessible(page);
  }
  await page.goto("/join");
  // Safari uses Option+Tab to include every interactive control.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("Game PIN").focus();
  await page.keyboard.type("123456");
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("button", { name: "Join the game" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await accessible(page);
});
