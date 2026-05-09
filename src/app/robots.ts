import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/events"],
        // Tokenised links and the organiser dashboard must not be indexed.
        disallow: [
          "/dashboard/",
          "/api/",
          "/login",
          "/preferences/",
          "/rsvp/",
          "/unsubscribe/"
        ]
      }
    ],
    sitemap: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/sitemap.xml`
  };
}
