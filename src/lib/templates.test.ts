import { describe, it, expect } from "vitest";
import { welcomeEmail, announcementEmail, escapeHtml } from "./templates";

describe("escapeHtml", () => {
  it("escapes the standard HTML metacharacters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
    expect(escapeHtml("&")).toBe("&amp;");
  });
});

describe("welcomeEmail", () => {
  it("includes the recipient name and management links", () => {
    const tmpl = welcomeEmail({
      name: "Tom",
      preferencesUrl: "https://example.com/preferences/abc",
      unsubscribeUrl: "https://example.com/unsubscribe/abc"
    });
    expect(tmpl.subject).toMatch(/Welcome/);
    expect(tmpl.html).toContain("Tom");
    expect(tmpl.html).toContain("https://example.com/preferences/abc");
    expect(tmpl.html).toContain("https://example.com/unsubscribe/abc");
  });

  it("escapes a name containing HTML to prevent injection", () => {
    const tmpl = welcomeEmail({
      name: "<img src=x>",
      preferencesUrl: "https://example.com/p",
      unsubscribeUrl: "https://example.com/u"
    });
    expect(tmpl.html).toContain("&lt;img src=x&gt;");
    expect(tmpl.html).not.toContain("<img src=x>");
  });
});

describe("announcementEmail", () => {
  it("renders all three RSVP buttons", () => {
    const tmpl = announcementEmail({
      memberName: "Tom",
      eventTitle: "Meetup",
      eventDate: "Tomorrow",
      eventLocation: "Sligo",
      description: "Hello",
      rsvpYesUrl: "https://example.com/rsvp/y",
      rsvpNoUrl: "https://example.com/rsvp/n",
      rsvpMaybeUrl: "https://example.com/rsvp/m",
      preferencesUrl: "https://example.com/p",
      unsubscribeUrl: "https://example.com/u"
    });
    expect(tmpl.html).toContain("https://example.com/rsvp/y");
    expect(tmpl.html).toContain("https://example.com/rsvp/n");
    expect(tmpl.html).toContain("https://example.com/rsvp/m");
    expect(tmpl.subject).toBe("Meetup");
  });
});
