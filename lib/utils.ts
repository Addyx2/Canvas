import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Only allow same-site relative paths as post-login redirects. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export function appUrl(path = ""): string {
  const fallback = process.env.NODE_ENV === "production" ? "https://canvas.aultrum.co.uk" : "http://localhost:3200";
  const base = (process.env.APP_URL ?? fallback).replace(/\/$/, "");
  return `${base}${path}`;
}
