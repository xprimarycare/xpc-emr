"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"
import { rateLimit } from "@/lib/rate-limit"

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
})

export async function register(
  input: { name: string; email: string; password: string }
): Promise<{ success: true } | { error: string }> {
  const headersList = await headers()
  // Use x-real-ip (set by reverse proxies like Vercel/nginx) first,
  // then fall back to the rightmost x-forwarded-for entry (proxy-appended, not client-controlled)
  const forwardedFor = headersList.get("x-forwarded-for")
  const ips = forwardedFor?.split(",").map((s) => s.trim()) ?? []
  const ip = headersList.get("x-real-ip") ?? (ips[ips.length - 1] || "unknown")

  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { success } = rateLimit(`register:${ip}`, { maxRequests: 5, windowMs: 60_000 })
  if (!success) {
    return { error: "Too many requests. Please try again later." }
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        hashedPassword,
      },
    })

    return { success: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "An account with this email already exists" }
    }
    console.error("Registration error:", error)
    return { error: "Registration failed" }
  }
}
