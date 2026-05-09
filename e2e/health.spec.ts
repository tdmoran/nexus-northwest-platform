import { test, expect } from "@playwright/test";

test("health endpoint returns ok shape", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body).toHaveProperty("ok");
  expect(body).toHaveProperty("uptimeMs");
  expect(body.db).toHaveProperty("ok");
});

test("robots.txt is served", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("Disallow: /dashboard");
});

test("sitemap.xml is served", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("<urlset");
});
