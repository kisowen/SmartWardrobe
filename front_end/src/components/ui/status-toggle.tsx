"use client"

import { Check, Droplets } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusToggleProps {
  status: string // "正常" | "清洗"
  onToggle: (newStatus: string) => void
  className?: string
}

export function StatusToggle({ status, onToggle, className }: StatusToggleProps) {
  const isNormal = status === "正常"

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止触发卡片的点击事件
    const newStatus = isNormal ? "清洗" : "正常"
    onToggle(newStatus)
  }

  return (
    <div
      className={cn(
        "flex w-14 h-7 p-0.5 rounded-full cursor-pointer transition-all duration-300 shadow-md",
        isNormal 
          ? "bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-sm" // 正常态：绿色玻璃质感
          : "bg-red-500/20 border border-red-500/50 backdrop-blur-sm",       // 清洗态：红色玻璃质感
        className
      )}
      onClick={handleClick}
      role="button"
      title={isNormal ? "当前状态：可穿戴 (点击切换为清洗中)" : "当前状态：清洗中 (点击切换为可穿戴)"}
    >
      <div className="relative w-full h-full">
        {/* 滑块 */}
        <div
          className={cn(
            "absolute top-0 flex justify-center items-center w-5 h-5 rounded-full transition-all duration-300 shadow-sm mt-0.5",
            isNormal 
              ? "left-0 bg-emerald-500" // 绿色滑块
              : "left-[calc(100%-1.25rem)] bg-red-500" // 红色滑块
          )}
        >
          {isNormal ? (
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          ) : (
            <Droplets className="w-3 h-3 text-white" strokeWidth={3} />
          )}
        </div>
        
        {/* 背景图标提示 (可选，增加视觉层次) */}
        <div className={cn(
            "absolute top-0.5 right-1.5 transition-opacity duration-300",
            isNormal ? "opacity-100" : "opacity-0"
        )}>
            <Droplets className="w-3 h-3 text-emerald-300/50" />
        </div>
        <div className={cn(
            "absolute top-0.5 left-1.5 transition-opacity duration-300",
            isNormal ? "opacity-0" : "opacity-100"
        )}>
            <Check className="w-3 h-3 text-red-300/50" />
        </div>
      </div>
    </div>
  )
}