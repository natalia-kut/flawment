"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CreateProjectState } from "./create-project-form";

function readText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

export async function createProject(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
 
  if (process.env.NODE_ENV !== "development") {
    return {
      success: false,
      message: "Project creation is not available.",
    };
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const startValue = readText(formData, "start_date");
  const endValue = readText(formData, "end_date");
  const ownerValue = readText(formData, "owner_id");

  if (!name || name.length > 150) {
    return {
      success: false,
      message: "Enter a project name between 1 and 150 characters.",
    };
  }

  if (description.length > 5000) {
    return {
      success: false,
      message: "Description must not exceed 5000 characters.",
    };
  }

  const startDate = parseDate(startValue);
  const endDate = endValue ? parseDate(endValue) : null;

  if (!startDate || (endValue && !endDate)) {
    return {
      success: false,
      message: "Enter valid project dates.",
    };
  }

  if (endDate && endDate < startDate) {
    return {
      success: false,
      message: "Deadline cannot be earlier than the start date.",
    };
  }

  const ownerId = Number(ownerValue);

  if (!/^[1-9]\d*$/.test(ownerValue) || !Number.isSafeInteger(ownerId)) {
    return {
      success: false,
      message: "Select a project owner.",
    };
  }

  try {
    const owner = await prisma.user.findFirst({
      where: {
        id: ownerId,
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    if (!owner) {
      return {
        success: false,
        message: "The selected project owner is not available.",
      };
    }

    await prisma.project.create({
      data: {
        name,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        status: "TO_DO",
        owner_id: owner.id,
        memberships: {
          create: {
            user_id: owner.id,
            role: "ADMIN",
          },
        },
      },
    });
  } catch {
    return {
      success: false,
      message: "Could not save the project. Please try again.",
    };
  }

  revalidatePath("/");

  return {
    success: true,
    message: "Project created successfully.",
  };
}