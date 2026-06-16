import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import MudurSidebar from '@/components/mudur/sidebar'

export default async function MudurDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  // Okul bilgilerini getir
  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true, directorName: true }
  })

  if (!school) {
    redirect('/mudur/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <MudurSidebar school={{ name: school.name, principalName: school.directorName || 'Mudur' }} />
      <div className="lg:pl-64">
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
