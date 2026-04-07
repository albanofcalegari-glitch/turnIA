import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@turnia.com'
  const password = '12345678'
  const passwordHash = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { isSuperAdmin: true, passwordHash },
    })
    console.log(`SuperAdmin updated: ${email}`)
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        isSuperAdmin: true,
      },
    })
    console.log(`SuperAdmin created: ${email}`)
  }

  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
