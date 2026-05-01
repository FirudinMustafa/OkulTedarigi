import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, invalidateSessionCache } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    // Logout'tan ÖNCE session bilgisini al ki audit log'a yazabilelim
    const session = await getSession()

    const cookieStore = await cookies()
    cookieStore.delete('token')

    if (session) {
      invalidateSessionCache(`admin:${session.id}`)
      try {
        await logAction({
          userId: session.id,
          userType: 'ADMIN',
          action: 'LOGOUT',
          entity: 'AUTH',
          ipAddress: getClientIp(request),
          details: { email: session.email }
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
