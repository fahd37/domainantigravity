import { NextResponse } from "next/server";
import { queue } from "@/lib/queue";

export async function GET() {
  try {
    const status = queue.getQueueStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
