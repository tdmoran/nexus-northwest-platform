import { PrismaClient, OrganiserRole } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = "admin@nexusnorthwest.local";
  const superAdminPass = "ChangeMe!123";
  const passwordHash = await argon2.hash(superAdminPass);

  await prisma.organiserUser.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      name: "Default Super Admin",
      passwordHash,
      role: OrganiserRole.SUPER_ADMIN,
      active: true
    }
  });

  await prisma.organiserUser.upsert({
    where: { email: "manager@nexusnorthwest.local" },
    update: {},
    create: {
      email: "manager@nexusnorthwest.local",
      name: "Sample Manager",
      passwordHash: await argon2.hash("ChangeMe!123"),
      role: OrganiserRole.MANAGER,
      active: true
    }
  });

  await prisma.organiserUser.upsert({
    where: { email: "viewer@nexusnorthwest.local" },
    update: {},
    create: {
      email: "viewer@nexusnorthwest.local",
      name: "Sample Viewer",
      passwordHash: await argon2.hash("ChangeMe!123"),
      role: OrganiserRole.VIEWER,
      active: true
    }
  });

  console.log("Seeded organiser users:");
  console.log(`  Super Admin: ${superAdminEmail} / ${superAdminPass}`);
  console.log("  Manager:     manager@nexusnorthwest.local / ChangeMe!123");
  console.log("  Viewer:      viewer@nexusnorthwest.local / ChangeMe!123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
