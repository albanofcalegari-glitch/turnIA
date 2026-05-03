import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  forceDark?: boolean
}

const sizes = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
}

export function BrandLogo({ size = 'md', className, forceDark = false }: Props) {
  return (
    <span className={cn('font-extrabold tracking-tight', sizes[size], className)}>
      <span className={forceDark ? '' : 'dark:!text-white'} style={{ color: '#111827' }}>Turn</span>
      <span style={{ color: '#16a34a' }}>it</span>
    </span>
  )
}
