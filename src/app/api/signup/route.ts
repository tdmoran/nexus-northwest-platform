import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/validation";
import { signupMember } from "@/server/members";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const { memberId, created } = await signupMember(parsed.data);
    return NextResponse.json({ ok: true, memberId, created }, { status: 201 });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
