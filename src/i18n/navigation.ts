import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-aware navigasyon yardimcilari. Link/useRouter/redirect bunlardan import edilmeli
// ki URL'lere otomatik dil oneki eklensin.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
