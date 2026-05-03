"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createNiche(data: { displayName: string; slug: string; keywords: string[]; targetTlds: string[] }) {
  try {
    await prisma.niche.create({ data });
    revalidatePath("/settings/niches");
    return { success: true };
  } catch (error) {
    console.error("Failed to create niche:", error);
    return { error: "Failed to create niche" };
  }
}

export async function updateNiche(id: string, data: Partial<{ displayName: string; slug: string; keywords: string[]; targetTlds: string[]; active: boolean; }>) {
  try {
    console.log("Updating niche via Server Action:", id, data);
    const result = await prisma.niche.update({ where: { id }, data });
    console.log("Update niche result:", result);
    revalidatePath("/settings/niches");
    return { success: true };
  } catch (error) {
    console.error(`Failed to update niche ${id}:`, error);
    return { error: String(error) };
  }
}

export async function deleteNiche(id: string) {
  try {
    await prisma.niche.delete({ where: { id } });
    revalidatePath("/settings/niches");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete niche:", error);
    return { error: "Failed to delete niche" };
  }
}

export async function activateAllNiches() {
  try {
    await prisma.niche.updateMany({
      data: { active: true },
    });
    revalidatePath("/settings/niches");
    return { success: true };
  } catch (error) {
    console.error("Failed to activate all niches:", error);
    return { error: "Failed to activate all niches" };
  }
}
