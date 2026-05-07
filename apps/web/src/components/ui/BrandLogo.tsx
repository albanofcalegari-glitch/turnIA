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
      <span className="text-gray-900 dark:text-white">Turn</span>
      <span className="text-green-600">it</span>
    </span>
  )
}
