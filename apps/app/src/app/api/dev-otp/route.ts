import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.CONVEX_SELF_HOSTED_URL ||
    "http://127.0.0.1:3210";

  try {
    const res = await fetch(`${convexUrl.replace(/\/$/, "")}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "otp:getLatestOtp",
        args: { email },
        format: "json",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Convex query error" }, { status: 502 });
    }

    const data = await res.json();
    if (data.status === "success" && data.value && data.value.code) {
      return NextResponse.json({
        success: true,
        code: data.value.code,
        createdAt: data.value.createdAt,
      });
    }

    return NextResponse.json({ success: false, message: "No active OTP found" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
