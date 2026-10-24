import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

// canvas.aultrum.co.uk is the app: visitors go to sign-in, members to the console.
// Marketing lives at aultrum.co.uk/canvas.
export default async function RootPage() {
  redirect((await getSessionUser()) ? "/dashboard" : "/login");
}
