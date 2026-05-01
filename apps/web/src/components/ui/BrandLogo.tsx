import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
}

export function BrandLogo({ size = 'md', className }: Props) {
  return (
    <span className={cn('font-extrabold tracking-tight', sizes[size], className)}>
      <span style={{ color: '#111827' }} className="dark:text-white">Turn</span>
      <span style={{ color: '#16a34a' }}>it</span>
    </span>
  )
}
