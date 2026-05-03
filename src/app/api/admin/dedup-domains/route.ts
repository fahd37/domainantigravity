import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/dedup-domains
 * Deletes all duplicate Domain rows, keeping only the one with the MIN(createdAt)
 * per unique domain name. Equivalent to:
 *   DELETE FROM "Domain" WHERE id NOT IN (
 *     SELECT DISTINCT ON (name) id FROM "Domain" ORDER BY name, "createdAt" ASC
 *   )
 */
export async function POST() {
  try {
    // Step 1: find all names that have duplicates
    const dupes = await prisma.$queryRaw<{ name: string; count: bigint }[]>`
      SELECT name, COUNT(*) as count
      FROM "Domain"
      GROUP BY name
      HAVING COUNT(*) > 1
    `;

    if (dupes.length === 0) {
      return NextResponse.json({ message: "No duplicates found", deleted: 0 });
    }

    // Step 2: for each duplicated name, keep the earliest record, delete the rest
    let totalDeleted = 0;
    for (const { name } of dupes) {
      // Get all records for this domain ordered by createdAt asc
      const records = await prisma.domain.findMany({
        where: { name },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      // Keep the first (oldest), delete the rest
      const toDelete = records.slice(1).map((r) => r.id);
      if (toDelete.length > 0) {
        const { count } = await prisma.domain.deleteMany({
          where: { id: { in: toDelete } },
        });
        totalDeleted += count;
      }
    }

    return NextResponse.json({
      message: `Deduplication complete`,
      duplicateNames: dupes.length,
      deleted: totalDeleted,
    });
  } catch (error) {
    console.error("[Dedup] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
