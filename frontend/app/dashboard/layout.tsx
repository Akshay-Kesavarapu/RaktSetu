import { DashHeader } from '@/components/dashboard/DashHeader'

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" style={{ colorScheme: 'light' }} className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <DashHeader />
      <main className="pt-[56px]">{children}</main>
    </div>
  )
}
