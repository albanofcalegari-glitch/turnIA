import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  darkAware?: boolean
}

const sizes = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
}

export function BrandLogo({ size = 'md', className, darkAware = false }: Props) {
  return (
    <span className={cn('font-extrabold tracking-tight', sizes[size], className)}>
      <span className={darkAware ? 'dark:!text-white' : ''} style={{ color: '#111827' }}>Turn</span>
      <span style={{ color: '#16a34a' }}>it</span>
    </span>
  )
}
