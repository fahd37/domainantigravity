import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queue, KILL_SWITCH } from "@/lib/queue";

export async function GET() {
  try {
    // Last scan run
    const lastScan = await prisma.scanRun.findFirst({
      where: { source: "cron-scan" },
      orderBy: { startedAt: "desc" },
    });

    // Last purchase (domain with BOUGHT status)
    const lastPurchase = await prisma.domain.findFirst({
      where: { status: "BOUGHT" },
      orderBy: { boughtAt: "desc" },
    });

    // Queue state
    const queueStatus = queue.getQueueStatus();
    const pendingCount = queueStatus.items.filter(i => i.status === "pending").length;

    return NextResponse.json({
      lastScan: lastScan
        ? {
            startedAt: lastScan.startedAt,
            domainsFound: lastScan.domainsScanned,
            status: lastScan.status,
          }
        : null,
      lastPurchase: lastPurchase
        ? {
            domain: lastPurchase.name,
            price: lastPurchase.price,
            boughtAt: lastPurchase.boughtAt,
          }
        : null,
      queue: {
        pending: pendingCount,
        dailyCount: queueStatus.dailyCount,
        dailySpend: queueStatus.dailySpend,
        killSwitchActive: KILL_SWITCH.active,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
