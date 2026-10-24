// Local development data. Never run against production.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { hashSecret } from "../lib/credentials";

const prisma = new PrismaClient();

// Fixed demo credentials so a local Pleasant can talk to a local Canvas.
export const DEMO = {
  email: "admin@canvas.demo",
  password: "canvas-demo-123",
  clientId: "cv_live_pleasant_demo",
  clientSecret: "cvs_pleasant_demo_secret",
  webhookSecret: "whsec_pleasant_demo_secret",
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({ data: { name: "Aultrum" } });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: DEMO.email,
      name: "Amara Okafor",
      passwordHash: await bcrypt.hash(DEMO.password, 10),
      role: "ADMIN",
    },
  });
  const pleasant = await prisma.platform.create({
    data: {
      organizationId: org.id,
      name: "Pleasant",
      clientId: DEMO.clientId,
      secretHash: hashSecret(DEMO.clientSecret),
      webhookSecret: DEMO.webhookSecret,
      allowedOrigins: ["http://localhost:3100", "https://pleasant.aultrum.co.uk"],
    },
  });
  const gateway = await prisma.installation.create({
    data: {
      organizationId: org.id,
      platformId: pleasant.id,
      moduleKey: "gateway",
      tenantId: "brightwater",
      tenantName: "Brightwater Care",
    },
  });
  await prisma.event.createMany({
    data: [
      { installationId: gateway.id, direction: "INBOUND", type: "platform.person.updated", payload: { personId: "carer_1" } },
      { installationId: gateway.id, direction: "INBOUND", type: "platform.shift.assigned", payload: { shiftId: "shift_1" } },
    ],
  });
  console.log(`Seeded. Sign in as ${DEMO.email} / ${DEMO.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
