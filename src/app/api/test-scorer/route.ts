export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { POST as processPreview } from "../score-preview/route";

export async function GET() {
  try {
    // Construct a mock Request object
    const mockReq = new Request("http://localhost/api/score-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains: ['ai-marketing.com', 'digitalseo.de', 'healthblog.net'] })
    });

    const res = await processPreview(mockReq);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
