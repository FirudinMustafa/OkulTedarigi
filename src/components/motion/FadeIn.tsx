'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// Apple-stili scroll-trigger fade + upward translate.
// easing = ease-apple-out (cubic-bezier(0.16, 1, 0.3, 1)) — aşırı hareket yok, sakin.
// viewport.once = true → animasyon bir kez oynar, scroll yukarı inince tekrarlamaz.
export default function FadeIn({
  children,
  delay = 0,
  y = 24,
  duration = 0.7,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  duration?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
