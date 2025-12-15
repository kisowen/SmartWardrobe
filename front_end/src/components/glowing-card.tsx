"use client"

import { GlowingEffect } from "@/components/ui/glowing-effect"
import { cn } from "@/lib/utils"

interface GlowingCardProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function GlowingCard({ children, className, disabled = false }: GlowingCardProps) {
  return (
    <div className={cn("relative rounded-[1.25rem] border-[0.75px] border-zinc-800 p-2", className)}>
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={disabled}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={3}
      />
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl border-[0.75px] border-zinc-800 bg-zinc-900/50 shadow-sm">
          {children}
      </div>
    </div>
  )
}