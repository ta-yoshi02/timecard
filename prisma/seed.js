/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomBytes, scryptSync } = require('crypto');

const datasourceUrl = process.env.DATABASE_URL;
const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;

if (!datasourceUrl) {
  throw new Error('DATABASE_URL is not set. Seed aborted.');
}

const pool = accelerateUrl ? null : new Pool({ connectionString: datasourceUrl });
const adapter = pool ? new PrismaPg(pool) : null;

const prisma = accelerateUrl
  ? new PrismaClient({
      accelerateUrl,
    })
  : new PrismaClient({
      adapter,
    });

const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const startOfDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
};

async function main() {
  await prisma.attendanceRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();

  const hanako = await prisma.employee.create({
    data: { name: '山田花子', role: 'ホール', hourlyRate: 1200 },
  });
  const taro = await prisma.employee.create({
    data: { name: '佐藤太郎', role: 'キッチン', hourlyRate: 1300 },
  });

  await prisma.user.createMany({
    data: [
      {
        loginId: 'admin',
        passwordHash: hashPassword('adminpass'),
        role: 'ADMIN',
      },
      {
        loginId: 'hanako',
        passwordHash: hashPassword('hanako'),
        role: 'EMPLOYEE',
        employeeId: hanako.id,
      },
      {
        loginId: 'taro',
        passwordHash: hashPassword('taro'),
        role: 'EMPLOYEE',
        employeeId: taro.id,
      },
    ],
  });

  await prisma.attendanceRecord.createMany({
    data: [
      {
        employeeId: hanako.id,
        date: startOfDay(1),
        clockIn: '09:00',
        clockOut: '17:30',
        breakMinutes: 60,
      },
      {
        employeeId: hanako.id,
        date: startOfDay(2),
        clockIn: '10:00',
        clockOut: '18:00',
        breakMinutes: 45,
      },
      {
        employeeId: taro.id,
        date: startOfDay(1),
        clockIn: '12:00',
        clockOut: '21:00',
        breakMinutes: 60,
      },
      {
        employeeId: taro.id,
        date: startOfDay(3),
        clockIn: '12:30',
        clockOut: '20:30',
        breakMinutes: 60,
      },
    ],
  });

  console.log('Seed completed.');
  console.log('管理者: admin / adminpass');
  console.log('従業員: hanako / password');
  console.log('従業員: taro / password');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) {
      await pool.end();
    }
  });
