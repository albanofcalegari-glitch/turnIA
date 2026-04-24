import { PublicMenu } from '@/components/ui/PublicMenu'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicMenu />
      {children}
    </>
  )
}
