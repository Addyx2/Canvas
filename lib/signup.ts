import { prisma } from "./db";

/**
 * Canvas is invite-only by default. Sign-up is open to set up the first
 * organisation, or when ALLOW_SIGNUP=true.
 */
export async function signupOpen(): Promise<boolean> {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  return (await prisma.user.count()) === 0;
}
