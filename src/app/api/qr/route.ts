import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("url");
  const fmt = (url.searchParams.get("format") ?? "svg").toLowerCase();
  if (!target) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (fmt === "png") {
    const buffer = await QRCode.toBuffer(target, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M"
    });
    // Buffer isn't a BodyInit under newer @types/node, but the underlying
    // bytes are. Wrap in Uint8Array which is.
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr.png"`,
        "Cache-Control": "public, max-age=86400, immutable"
      }
    });
  }

  // SVG default
  const svg = await QRCode.toString(target, {
    type: "svg",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M"
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="qr.svg"`,
      "Cache-Control": "public, max-age=86400, immutable"
    }
  });
}
