/**
 * Sistem Log Servisi
 *
 * Tum log detaylari (params.details) sanitizeForLog ile gecirilir —
 * password, token, PAN, CVV, secret, authorization gibi alanlar [REDACTED] olarak yazilir.
 */

import { prisma } from './prisma'
import { sanitizeForLog } from './security'

export type UserType = 'ADMIN' | 'MUDUR' | 'SYSTEM'

export type LogAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_UPDATED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
  | 'PAYMENT_RECEIVED'
  | 'INVOICE_CREATED'
  | 'CARGO_SHIPPED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_DOCUMENT_CREATED'
  | 'SCHOOL_CREATED'
  | 'SCHOOL_UPDATED'
  | 'SCHOOL_DELETED'
  | 'CLASS_CREATED'
  | 'CLASS_UPDATED'
  | 'CLASS_DELETED'
  | 'CLASS_PASSWORD_RESET'
  | 'PACKAGE_CREATED'
  | 'PACKAGE_UPDATED'
  | 'PACKAGE_DELETED'
  | 'COMMISSION_PAYMENT'
  | 'CANCEL_REQUEST_APPROVED'
  | 'CANCEL_REQUEST_REJECTED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'

export type LogEntity =
  | 'ORDER'
  | 'SCHOOL'
  | 'CLASS'
  | 'PACKAGE'
  | 'COMMISSION'
  | 'CANCEL_REQUEST'
  | 'DELIVERY_DOCUMENT'
  | 'USER'

export interface LogParams {
  userId?: string
  userType?: string
  action: string
  entity?: string
  entityId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export async function logAction(params: LogParams): Promise<void> {
  try {
    const sanitizedDetails = params.details
      ? sanitizeForLog(params.details) as Record<string, unknown>
      : null

    await prisma.systemLog.create({
      data: {
        userId: params.userId,
        userType: params.userType,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
        ipAddress: params.ipAddress
      }
    })
  } catch (error) {
    console.error('[LOGGER] Log kaydi olusturulamadi:', error)
  }
}

export interface LogFilters {
  userId?: string
  userType?: UserType
  action?: LogAction
  entity?: LogEntity
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

export async function getLogs(filters: LogFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (filters.userId) where.userId = filters.userId
  if (filters.userType) where.userType = filters.userType
  if (filters.action) where.action = filters.action
  if (filters.entity) where.entity = filters.entity

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) (where.createdAt as Record<string, Date>).gte = filters.startDate
    if (filters.endDate) (where.createdAt as Record<string, Date>).lte = filters.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.systemLog.count({ where })
  ])

  return {
    logs: logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}
