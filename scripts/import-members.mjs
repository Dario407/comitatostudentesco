import { PrismaClient, Role } from "@prisma/client";
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizePhone(input) {
  let value = input.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  if (/^3\d{9}$/.test(value)) value = "+39" + value.slice(0);
  if (!/^\+\d{8,15}$/.test(value)) {
    throw new Error(`Invalid phone: ${input}`);
  }
  return value;
}

function phoneLookup(phone) {
  return createHmac("sha256", required("PHONE_LOOKUP_SECRET"))
    .update(normalizePhone(phone))
    .digest("hex");
}

function hashCode(code) {
  const salt = randomBytes(16);
  const hash = scryptSync(code.trim(), salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function randomCode() {
  return randomBytes(6).toString("hex").toUpperCase();
}

const path = process.argv[2] ?? "members.csv";
const file = await readFile(path, "utf8");
const rows = file.split(/\r?\n/).filter(Boolean);

const header = rows.shift()?.split(";").map((x) => x.trim());
const expected = [
  "first_name",
  "last_name",
  "class_name",
  "phone",
  "role",
  "access_code"
];

if (!header || expected.some((value, index) => header[index] !== value)) {
  throw new Error(`Expected header: ${expected.join(";")}`);
}

const issued = [];

for (const line of rows) {
  const [
    firstName,
    lastName,
    className,
    phone,
    roleRaw,
    codeRaw
  ] = line.split(";").map((x) => x.trim());

  if (!firstName || !lastName || !className || !phone) {
    throw new Error(`Invalid row: ${line}`);
  }

  const code = codeRaw || randomCode();

  if (!Object.values(Role).includes(roleRaw)) {
    throw new Error(`Invalid role "${roleRaw}" for ${firstName} ${lastName}`);
  }

  const role = roleRaw;
  const lookup = phoneLookup(phone);

  await prisma.user.upsert({
    where: { phoneLookup: lookup },
    create: {
      firstName,
      lastName,
      className,
      role,
      phoneLookup: lookup,
      accessCodeHash: hashCode(code)
    },
    update: {
      firstName,
      lastName,
      className,
      role,
      active: true,
      accessCodeHash: hashCode(code)
    }
  });

  issued.push({
    firstName,
    lastName,
    className,
    role,
    code
  });
}

console.table(issued);
console.log(
  "Conserva i codici in un luogo sicuro: nel database vengono memorizzati solo gli hash."
);

await prisma.$disconnect();
