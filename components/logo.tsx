import React from 'react'

export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <div className={`flex items-baseline gap-1 select-none tracking-tight ${className}`}>
      <span 
        className="font-black text-2xl uppercase tracking-[0.08em] text-[#181C25]" 
        style={{ fontFamily: "'Arial Black', 'Impact', sans-serif" }}
      >
        DORSAL
      </span>
      <span className="w-2.5 h-2.5 bg-[#71FC8F] inline-block rounded-[1px] transform translate-y-[-1px]" />
    </div>
  )
}