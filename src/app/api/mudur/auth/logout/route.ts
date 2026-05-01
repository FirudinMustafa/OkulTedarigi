import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getMudurSession, invalidateSessionCache } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    // Logout'tan ÖNCE session bilgisini al ki audit log'a yazabilelim
    const session = await getMudurSession()

    const cookieStore = await cookies()
    cookieStore.delete('mudur_token')

    if (session) {
      invalidateSessionCache(`mudur:${session.schoolId}:${session.email}`)
      try {
        await logAction({
          userId: session.id,
          userType: 'MUDUR',
          action: 'LOGOUT',
          entity: 'AUTH',
          ipAddress: getClientIp(request),
          details: { email: session.email, schoolId: session.schoolId }
        })
      } catch (logErr) {
        console.error('Logout log hatasi:', logErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout hatasi:', error)
    return NextResponse.json(
      { error: 'Cikis yapilamadi' },
      { status: 500 }
    )
  }
}
