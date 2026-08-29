import { Header } from '@/components/shared/Header'

export default function LightLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" style={{ colorScheme: 'light' }} className="min-h-screen bg-light-bg text-light-body">
      <Header />
      <main className="pt-[56px]">{children}</main>
    </div>
  )
}
