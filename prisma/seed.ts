import { PrismaClient, OrganiserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = "ChangeMe!123";
  const hash = await bcrypt.hash(password, 12);

  // Use update on conflict so re-seeding rewrites the password hash —
  // important when migrating between hashing libraries.
  const fields = (
    email: string,
    name: string,
    role: OrganiserRole
  ) => ({
    where: { email },
    update: { passwordHash: hash, role, active: true },
    create: { email, name, passwordHash: hash, role, active: true }
  });

  await prisma.organiserUser.upsert(
    fields("admin@nexusnorthwest.local", "Default Super Admin", OrganiserRole.SUPER_ADMIN)
  );
  await prisma.organiserUser.upsert(
    fields("manager@nexusnorthwest.local", "Sample Manager", OrganiserRole.MANAGER)
  );
  await prisma.organiserUser.upsert(
    fields("viewer@nexusnorthwest.local", "Sample Viewer", OrganiserRole.VIEWER)
  );

  console.log("Seeded organiser users (bcrypt hashes):");
  console.log(`  Super Admin: admin@nexusnorthwest.local / ${password}`);
  console.log(`  Manager:     manager@nexusnorthwest.local / ${password}`);
  console.log(`  Viewer:      viewer@nexusnorthwest.local / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
