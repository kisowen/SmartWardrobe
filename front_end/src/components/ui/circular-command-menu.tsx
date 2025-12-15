"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface CommandItem {
  id: string
  icon: ReactNode
  label: string
  shortcut?: string
  onClick?: () => void
}

export interface CircularCommandMenuProps {
  items?: CommandItem[]
  trigger?: ReactNode
  className?: string
  radius?: number
  onSelect?: (item: CommandItem) => void
}

export function CircularCommandMenu({
  items = [],
  trigger,
  className,
  radius = 100, // 稍微缩小一点半径，使其更紧凑
  onSelect,
}: CircularCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const safeItems = items || []
  const itemCount = safeItems.length
  
  // 调整起始角度和步长，使其扇形展开或圆形展开更自然
  const angleStep = itemCount > 0 ? 360 / itemCount : 0
  const startAngle = -90 

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || itemCount === 0) return

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault()
          setActiveIndex((prev) => (prev + 1) % itemCount)
          break
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault()
          setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount)
          break
        case "Enter":
          e.preventDefault()
          const selectedItem = safeItems[activeIndex]
          if (selectedItem) {
            selectedItem.onClick?.()
            onSelect?.(selectedItem)
          }
          setIsOpen(false)
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          break
      }
    },
    [isOpen, activeIndex, safeItems, itemCount, onSelect],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const getItemPosition = (index: number) => {
    const angle = ((startAngle + index * angleStep) * Math.PI) / 180
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  }

  return (
    // 使用 fixed 定位，确保它永远在右下角
    <div className={cn("fixed bottom-8 right-8 z-[9999]", className)}>
      
      {/* 触发按钮 (悬浮球主体) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative z-20 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]", // 白色发光球体
          "hover:bg-neutral-200 transition-colors",
          "focus:outline-none",
        )}
        whileTap={{ scale: 0.9 }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {trigger || (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </motion.div>
      </motion.button>

      {/* 背景遮罩 (可选，这里用透明背景防止误触) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 环形菜单项 */}
      <AnimatePresence>
        {isOpen && itemCount > 0 && (
          <div className="absolute left-1/2 top-1/2 z-20" role="menu">
            {safeItems.map((item, index) => {
              const position = getItemPosition(index)
              const isActive = activeIndex === index

              return (
                <motion.button
                  key={item.id}
                  initial={{
                    opacity: 0,
                    x: 0,
                    y: 0,
                    scale: 0,
                  }}
                  animate={{
                    opacity: 1,
                    x: position.x - 24, // 居中修正 (ItemSize/2)
                    y: position.y - 24,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    x: 0,
                    y: 0,
                    scale: 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: index * 0.03,
                  }}
                  onClick={() => {
                    item.onClick?.()
                    onSelect?.(item)
                    setIsOpen(false)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "absolute flex h-12 w-12 items-center justify-center rounded-full",
                    "border border-white/20 bg-neutral-900/90 text-white shadow-lg backdrop-blur-md", // 暗黑磨砂质感
                    "transition-all hover:scale-110 hover:border-white/50",
                    isActive && "ring-2 ring-white/50 bg-neutral-800",
                  )}
                  role="menuitem"
                  aria-label={item.label}
                >
                  <div className="text-white/90">{item.icon}</div>

                  {/* 悬浮提示 Tooltip (位置根据象限自动调整) */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: isActive ? 1 : 0,
                      scale: isActive ? 1 : 0.9,
                    }}
                    // 根据按钮在左侧还是右侧来决定 Tooltip 弹出的方向，防止溢出屏幕
                    className={cn(
                      "absolute whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-bold text-black shadow-md",
                      position.x < 0 ? "left-full ml-3" : "right-full mr-3"
                    )}
                  >
                    <span>{item.label}</span>
                  </motion.div>
                </motion.button>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}