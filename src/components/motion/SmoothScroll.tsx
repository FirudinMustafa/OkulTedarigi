'use client'

import { ReactLenis } from 'lenis/react'
import type { ReactNode } from 'react'

// Apple-stili smooth scroll. lerp = 0.1 (yumuşak), syncTouch kapalı (mobilde native).
export default function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  )
}
