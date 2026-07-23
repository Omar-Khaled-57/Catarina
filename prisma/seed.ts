// prisma/seed.ts — Seeds the database with the initial July 2026 plan
// Run with: npx tsx prisma/seed.ts

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

  // Clear existing data
  await prisma.goalAssignment.deleteMany({});
  await prisma.step.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.month.deleteMany({});
  await prisma.userSection.deleteMany({});
  await prisma.user.deleteMany({});

  /* ─── Create Admin User ─────────────────────────────────────────────────── */
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@devora.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@devora.com",
      password: adminPassword,
      role: "ADMIN",
      bio: "Devora team administrator",
      pfp: null,
      primarySection: "MANAGEMENT",
    },
  });
  console.log(`  Admin user: ${admin.email}`);

  /* ─── Create July 2026 Month ────────────────────────────────────────────── */
  const july = await prisma.month.upsert({
    where: { year_month: { year: 2026, month: 7 } },
    update: {},
    create: {
      name: "July 2026",
      year: 2026,
      month: 7,
    },
  });
  console.log(`  Month: ${july.name}`);

  /* ─── Create Mock June 2026 Month ───────────────────────────────────────── */
  const june = await prisma.month.upsert({
    where: { year_month: { year: 2026, month: 6 } },
    update: {},
    create: {
      name: "June 2026",
      year: 2026,
      month: 6,
      isArchived: true,
    },
  });
  console.log(`  Month: ${june.name} (Archived)`);

  /* ─── Create Section Members ─────────────────────────────────────────────── */
  const memberPassword = await bcrypt.hash("member123", 12);
  const sections = ["MARKETING", "ART", "TECHNICAL", "MANAGEMENT"] as const;

  // Primary section members (one section each)
  const memberData: { name: string; email: string; section: string; bio?: string }[] = [
    { name: "Marketing Member", email: "marketing@devora.com", section: "MARKETING", bio: "Marketing specialist" },
    { name: "Art Member", email: "art@devora.com", section: "ART", bio: "UI/UX & graphic designer" },
    { name: "Technical Member", email: "technical@devora.com", section: "TECHNICAL", bio: "Full-stack developer" },
    { name: "Management Member", email: "management@devora.com", section: "MANAGEMENT", bio: "Project coordinator" },
  ];

  const createdUsers = [];
  for (const m of memberData) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        name: m.name,
        email: m.email,
        password: memberPassword,
        role: "MEMBER",
        bio: m.bio,
      },
    });
    // Assign primary section via join table
    await prisma.userSection.upsert({
      where: { userId_section: { userId: user.id, section: m.section } },
      update: {},
      create: { userId: user.id, section: m.section },
    });
    createdUsers.push(user);
    console.log(`  Member: ${m.email} -> ${m.section}`);
  }

  // Multi-section member: Art member also in Marketing
  const artUser = createdUsers.find((u) => u.email === "art@devora.com");
  if (artUser) {
    await prisma.userSection.upsert({
      where: { userId_section: { userId: artUser.id, section: "MARKETING" } },
      update: {},
      create: { userId: artUser.id, section: "MARKETING" },
    });
    console.log(`  Multi-section: art@devora.com also in MARKETING`);
  }

  // Assign admin to all sections
  for (const section of sections) {
    await prisma.userSection.upsert({
      where: { userId_section: { userId: admin.id, section } },
      update: {},
      create: { userId: admin.id, section },
    });
  }
  console.log(`  Admin assigned to all 4 sections`);

  /* ─── Seed Goals from CSV Data ───────────────────────────────────────────── */
  const goalsData = [
    // Marketing Goals
    { name: "Devora mission and vision", description: "Define the Mission & vision of Devora and give the art section the key ideas", current: 0, target: 2, done: false, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Why we named Devora", description: "Define why we named it devora & give to art section the key ideas, assets, and keyword", current: 1, target: 1, done: true, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Show one of our projects", description: "Specify how to show one of our projects and give it to the art section with the keywords", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Talk about team members", description: "Description and how to view it with the art section", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Services", description: "Define and specify what are our services and how to market with them", current: 1, target: 1, done: true, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Put next week plan", description: "Make the full week plan with every single detail, such as how to view them, the keywords in the post, and a reference", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "MARKETING" },
    { name: "Describe in the system the plan", description: "Specify the next week's plan in the system", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "MARKETING" },

    // Art Goals
    { name: "Dentist System UI/UX", description: "Design the UI/UX based on the requirement of the technical team", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Zamalk's Cafe website UI/UX", description: "Design a meaningful UI/UX based on the cafe's identity and the requirements from the technical team", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Personal Cards Design", description: "Design a professional personal card for the company team that is required to be professional and simple", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Services posts", description: "Based on the description and data from the marketing team, design meaningful posts for our services", current: 7, target: 9, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Mission & vision post design", description: "Based on the description and data from the marketing team, design a 3-photo post describing our mission & vision", current: 0, target: 3, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Design project post", description: "Based on the description and data from the marketing team, design a 3-photo post describing one of our projects", current: 0, target: 3, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Design Team members post", description: "Based on the description and data from the marketing team, design a post viewing our team members", current: 0, target: 6, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Devora Website UI/UX", description: "Based on the requirements of the management team, design several UI/UX pages of Devora as a website", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "ART" },
    { name: "Why we named Devora Post", description: "Based on the description and data from the marketing team, design a post viewing why we named it Devora", current: 0, target: 3, done: false, deadline: "2026-07-31", section: "ART" },

    // Technical Goals
    { name: "Create the dentist app system design", description: "Create the System Design of the dentist system and provide the required to the art team", current: 1, target: 1, done: true, deadline: "2026-07-31", section: "TECHNICAL" },
    { name: "Create the system design and req. of the Zamalk Cafe", description: "Create the System Design of the cafe website and provide the required to the art team", current: 1, target: 1, done: true, deadline: "2026-07-31", section: "TECHNICAL" },
    { name: "Provide the System Design and req. of devora site", description: "Create the System Design of the Devora website and provide the required to the art team", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "TECHNICAL" },
    { name: "Implement Zamalk website", description: "Start implementing the website as soon as the art team finishes the design", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "TECHNICAL" },
    { name: "Hover Website", description: "Finish Implementing Hover Website", current: 1, target: 1, done: true, deadline: "2026-07-31", section: "TECHNICAL" },

    // Management Goals
    { name: "Create Editable System", description: "Create a system to track the progress and performance of the team", current: 1, target: 1, done: true, deadline: "2026-07-22", section: "MANAGEMENT" },
    { name: "Setup Team Plans", description: "Initialize the team goals and targets", current: 3, target: 3, done: true, deadline: "2026-07-22", section: "MANAGEMENT" },
    { name: "Organize & Maintain New Services", description: "Offer and try to provide new services for the team and clients", current: 0, target: 2, done: false, deadline: "2026-07-31", section: "MANAGEMENT" },
    { name: "Offer Free Services", description: "Try to contact some clients for free services", current: 0, target: 3, done: true, deadline: "2026-07-31", section: "MANAGEMENT" },
    { name: "Track The Team Sections For 9 Days", description: "Track the system and performance for each team member", current: 3, target: 10, done: false, deadline: "2026-07-31", section: "MANAGEMENT" },
    { name: "Supply New Customers", description: "Make the full week plan with every single detail, such as how to view them, the keywords in the post, and a reference", current: 0, target: 3, done: false, deadline: "2026-07-31", section: "MANAGEMENT" },
    { name: "Create a LinkedIn Account", description: "Create Devora LinkedIn Account", current: 0, target: 1, done: false, deadline: "2026-07-25", section: "MANAGEMENT" },
    { name: "Meet with Hisham Abd El Latif", description: "Schedule a meeting with him", current: 0, target: 1, done: false, deadline: "2026-07-31", section: "MANAGEMENT" },
    { name: "Gather Zamalk cafe info.", description: "Collect All info about the cafe", current: 0, target: 1, done: false, deadline: "2026-07-26", section: "MANAGEMENT" },
  ];

  const sectionCounters: Record<string, number> = {};
  for (const goal of goalsData) {
    sectionCounters[goal.section] = (sectionCounters[goal.section] || 0) + 1;
    await prisma.goal.create({
      data: {
        ...goal,
        goalNumber: sectionCounters[goal.section],
        deadline: new Date(goal.deadline),
        completedAt: goal.done ? new Date() : null,
        monthId: july.id,
        authorId: admin.id,
        deadlineSetByAdmin: true,
      },
    });
  }

  const juneGoalsData = [
    { name: "Initial Brand Identity", description: "Design the first draft of the brand identity", current: 1, target: 1, done: true, deadline: "2026-06-15", section: "ART" },
    { name: "Competitor Analysis", description: "Research 5 main competitors", current: 5, target: 5, done: true, deadline: "2026-06-20", section: "MARKETING" },
    { name: "Server Setup", description: "Deploy initial staging server", current: 1, target: 1, done: true, deadline: "2026-06-25", section: "TECHNICAL" },
    { name: "Onboard Team", description: "Setup accounts and permissions for all members", current: 4, target: 4, done: true, deadline: "2026-06-10", section: "MANAGEMENT" },
    { name: "Social Media Templates", description: "Create templates for Instagram and LinkedIn", current: 3, target: 5, done: false, deadline: "2026-06-30", section: "ART" },
  ];

  const juneSectionCounters: Record<string, number> = {};
  for (const goal of juneGoalsData) {
    juneSectionCounters[goal.section] = (juneSectionCounters[goal.section] || 0) + 1;
    await prisma.goal.create({
      data: {
        ...goal,
        goalNumber: juneSectionCounters[goal.section],
        deadline: new Date(goal.deadline),
        completedAt: goal.done ? new Date("2026-06-28") : null,
        monthId: june.id,
        authorId: admin.id,
        deadlineSetByAdmin: true,
      },
    });
  }

  // Create Archive entry for June
  await prisma.archive.create({
    data: {
      summary: "June 2026 Planning Report",
      monthId: june.id,
    }
  });

  /* ─── Pinned Welcome Notification for Everyone ───────────────────────────── */
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  await prisma.notification.createMany({
    data: allUsers.map((u) => ({
      userId: u.id,
      type: "SYSTEM",
      title: "Why Catarina? 🌸",
      message:
        "Catarina — named after Omar's grandmother. She was the one who taught him that quiet dedication, care for others, and showing up every day is what truly builds something great. This system is built in her spirit: to help the Devora team grow, track their work, and celebrate every small win together.",
      pinned: true,
      refType: "audio",
      refId: "/fun.mp3",
    })),
  });
  console.log(`  Pinned 'Why Catarina?' notification sent to ${allUsers.length} users`);

  console.log(`  Created ${goalsData.length} goals for July and ${juneGoalsData.length} for June`);
  console.log("Seeding complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
