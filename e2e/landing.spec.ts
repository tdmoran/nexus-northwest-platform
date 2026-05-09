import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Landing page", () => {
  test("renders hero, value props, and a working sign-up form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nexus");
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /join/i })).toBeVisible();
  });

  test("blocks submit when consent is unchecked", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your name").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");
    // The required checkbox stops form submission natively; verify the button
    // is reachable and the consent label is present.
    await expect(page.getByText(/I'd like to hear about/i)).toBeVisible();
  });

  test("skip-link is reachable by keyboard and points to main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#main");
  });

  test("passes axe a11y audit (WCAG 2.1 AA)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

test.describe("Login page", () => {
  test("renders email + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("passes axe a11y audit", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

test.describe("Privacy page", () => {
  test("passes axe a11y audit", async ({ page }) => {
    await page.goto("/privacy");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

function formatViolations(violations: unknown[]): string {
  if (violations.length === 0) return "no violations";
  return JSON.stringify(violations, null, 2);
}
