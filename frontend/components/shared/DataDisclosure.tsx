export function DataDisclosure() {
  return (
    <div className="w-full bg-[#FFFBEB] border-t border-[#FDE68A] px-4 py-2 flex items-center gap-2">
      <svg className="w-3.5 h-3.5 text-[#92400E] shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <p className="text-[10px] text-[#92400E] font-medium">
        <span className="font-bold">Prototype Data Only:</span> This is a hackathon demonstration. Do not use for actual medical emergencies. Inventory is synthetic — verify with bank directly.
      </p>
    </div>
  )
}
