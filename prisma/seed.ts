// prisma/seed.ts — Seeds the database with default sections, admin user, and demo data
// Run with: npm run db:seed
//
// This creates a clean starting point for any team:
//   - 4 default sections (Marketing, Art, Technical, Management)
//   - 1 admin user (admin@team.com / admin123)
//   - Current month with 4 generic demo goals (one per section)
//
// For a full reset (wipe + re-seed), use: npm run db:reset

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env");
    process.exit(1);
  }
  const adapter = new PrismaLibSql({ url, authToken });
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding database...");

  // Clear existing data (safe — this is a fresh setup script)
  await prisma.goalAssignment.deleteMany({});
  await prisma.step.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.month.deleteMany({});
  await prisma.userSection.deleteMany({});
  await prisma.sectionConfig.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.approval.deleteMany({});

  /* ─── Default Sections ─────────────────────────────────────────────────── */
  const defaultSections = [
    { key: "MARKETING", label: "Marketing", prefix: "MRK-", color: "#FF4D6A", sortOrder: 0 },
    { key: "ART", label: "Art", prefix: "ART-", color: "#7C3AED", sortOrder: 1 },
    { key: "TECHNICAL", label: "Technical", prefix: "TEC-", color: "#3B82F6", sortOrder: 2 },
    { key: "MANAGEMENT", label: "Management", prefix: "MNG-", color: "#F59E0B", sortOrder: 3 },
  ];
  for (const section of defaultSections) {
    await prisma.sectionConfig.create({ data: section });
  }
  console.log(`  Created ${defaultSections.length} default sections`);

  /* ─── Admin User ───────────────────────────────────────────────────────── */
  const adminPassword = await bcrypt.hash("admin123", 12);
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@team.com",
      password: adminPassword,
      role: "ADMIN",
      bio: "Team administrator",
      primarySection: "MANAGEMENT",
    },
  });

  // Assign admin to all sections
  for (const section of defaultSections) {
    await prisma.userSection.create({
      data: { userId: admin.id, section: section.key },
    });
  }
  console.log(`  Admin user: ${admin.email} (password: admin123)`);

  /* ─── Current Planning Month ───────────────────────────────────────────── */
  const month = await prisma.month.create({
    data: {
      name: `${new Date(currentYear, currentMonth - 1).toLocaleString("en", { month: "long" })} ${currentYear}`,
      year: currentYear,
      month: currentMonth,
    },
  });
  console.log(`  Month: ${month.name}`);

  /* ─── Demo Goals (one per section) ─────────────────────────────────────── */
  const demoGoals = [
    { name: "Define team mission & vision", description: "Collaborate across sections to define the team's core mission, values, and long-term vision.", target: 3, section: "MARKETING" },
    { name: "Create brand style guide", description: "Design a consistent visual identity — colors, typography, logo usage, and tone of voice.", target: 5, section: "ART" },
    { name: "Set up development environment", description: "Configure repositories, CI/CD pipelines, staging server, and development tooling.", target: 4, section: "TECHNICAL" },
    { name: "Establish planning workflow", description: "Define how the team plans, tracks, and reviews work on a monthly cadence.", target: 3, section: "MANAGEMENT" },
  ];

  let goalCounter = 0;
  for (const goal of demoGoals) {
    goalCounter++;
    await prisma.goal.create({
      data: {
        name: goal.name,
        description: goal.description,
        goalNumber: goalCounter,
        current: 0,
        target: goal.target,
        done: false,
        deadline: new Date(currentYear, currentMonth - 1, 28), // end of current month
        section: goal.section,
        deadlineSetByAdmin: true,
        monthId: month.id,
        authorId: admin.id,
      },
    });
  }
  console.log(`  Created ${demoGoals.length} demo goals`);

  console.log("\nSeeding complete! Sign in with admin@team.com / admin123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
