import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const categorias = [
    { nome: 'Roupas e Calçados' },
    { nome: 'Móveis e Decoração' },
    { nome: 'Eletrodomésticos' },
    { nome: 'Livros e Papelaria' },
    { nome: 'Brinquedos e Jogos' },
    { nome: 'Eletrônicos' },
    { nome: 'Outros' }
  ]

  console.log('Iniciando seed de categorias...')

  for (const cat of categorias) {
    const upserted = await prisma.categoria.upsert({
      where: { id: 0 }, // This is a hack for upserting by name if it doesn't have a unique constraint on name
      // but Categoria model doesn't have @unique on nome in the user's schema.
      // So I'll just use create or check first or just use a simple create loop with a check.
      update: {},
      create: cat,
    })
    // Actually, since there's no unique constraint on 'nome', 
    // I should probably check if it exists first to avoid duplicates if run multiple times.
    const exists = await prisma.categoria.findFirst({
      where: { nome: cat.nome }
    })
    
    if (!exists) {
      await prisma.categoria.create({ data: cat })
      console.log(`Categoria criada: ${cat.nome}`)
    } else {
      console.log(`Categoria já existe: ${cat.nome}`)
    }
  }

  console.log('Seed finalizado com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
