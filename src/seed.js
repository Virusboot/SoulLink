// src/seed.js
require('dotenv').config();
const prisma = require('./config/db');

const INTERESTS = [
  'Music','Travel','Gaming','Movies','Fitness','Cooking',
  'Photography','Reading','Art','Technology','Sports','Dance',
  'Fashion','Nature','Yoga','Anime','Podcasts','Meditation',
  'Food','Comedy','Startups','Cars','Pets','Spirituality',
];

async function main() {
  console.log('🌱 Seeding...');
  for (const name of INTERESTS) {
    await prisma.interest.upsert({ where: { name }, create: { name }, update: {} });
  }
  console.log(`✅ ${INTERESTS.length} interests seeded`);
  console.log('🚀 Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
