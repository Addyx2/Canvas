import { redirect } from "next/navigation";

import { workspaceUrl } from "@/lib/aultrum-id/hosts";

// id.aultrum.co.uk on its own: Workspace is where people go.
export default function IdHome() {
  redirect(workspaceUrl());
}
