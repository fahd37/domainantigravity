import { NextResponse } from "next/server";
import { KILL_SWITCH } from "@/lib/queue";

export async function POST() {
  try {
    KILL_SWITCH.active = !KILL_SWITCH.active;
    return NextResponse.json({ active: KILL_SWITCH.active });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
