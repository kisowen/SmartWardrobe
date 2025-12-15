"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, Shirt, CloudSun, Sparkles, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline"
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "outline" && "border border-neutral-700 bg-transparent",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// --- 定制化部分：定义系统功能模块 ---
interface Category {
  id: string
  label: string
  icon: React.ElementType
  color: string
  path: string
}

const categories: Category[] = [
  { 
    id: "upload", 
    label: "AI 识衣入库", 
    icon: PlusCircle, 
    color: "#4ECDC4", 
    path: "/upload" 
  },
  { 
    id: "wardrobe", 
    label: "衣橱与气象", 
    icon: CloudSun, 
    color: "#F9C74F", 
    path: "/wardrobe" 
  },
  { 
    id: "recommend", 
    label: "智能穿搭推荐", 
    icon: Sparkles, 
    color: "#FF6B6B", 
    path: "/recommend" 
  },
]

// Icon wrapper with animation
const IconWrapper = ({
  icon: Icon,
  isHovered,
  color,
}: { icon: React.ElementType; isHovered: boolean; color: string }) => (
  <motion.div 
    className="w-4 h-4 mr-2 relative" 
    initial={false} 
    animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
  >
    <Icon className="w-4 h-4" />
    {isHovered && (
      <motion.div
        className="absolute inset-0"
        style={{ color }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <Icon className="w-4 h-4" strokeWidth={2} />
      </motion.div>
    )}
  </motion.div>
)

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      // 修复 2: 添加 "as const" 断言，告诉 TS 这是一个固定的贝塞尔曲线元组，而不是普通数字数组
      ease: [0.25, 0.1, 0.25, 1] as const, 
    },
  },
}

// Hook for click outside
// 修复 1: 修改泛型约束，允许 ref.current 为 null (RefObject<T | null>)
function useClickAway<T extends HTMLElement>(
  ref: React.RefObject<T | null>, 
  handler: (event: MouseEvent | TouchEvent) => void
) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler(event)
    }
    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)
    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}

// --- 主组件 ---
interface FluidDropdownProps {
  onSelect?: (path: string) => void;
}

export function FluidDropdown({ onSelect }: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(true) 
  const [selectedCategory, setSelectedCategory] = React.useState<Category>(categories[0])
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)
  
  // 这里的 ref 初始化为 null，类型为 HTMLDivElement
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  useClickAway(dropdownRef, () => setIsOpen(false))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="w-full max-w-xs relative mx-auto"
        ref={dropdownRef}
      >
          {/* 主按钮 */}
          <Button
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "w-full justify-between bg-neutral-900/80 backdrop-blur-md text-neutral-400 border-white/10",
              "hover:bg-neutral-800 hover:text-neutral-200",
              "focus:ring-2 focus:ring-neutral-700 focus:ring-offset-2 focus:ring-offset-black",
              "transition-all duration-200 ease-in-out",
              "h-12 px-4 rounded-xl",
              isOpen && "bg-neutral-800 text-neutral-200 border-white/20",
            )}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <span className="flex items-center">
              <span className="text-neutral-500 mr-2">选择功能:</span>
              <IconWrapper 
                icon={selectedCategory.icon} 
                isHovered={false} 
                color={selectedCategory.color} 
              />
              <span className="text-white font-medium">{selectedCategory.label}</span>
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center w-5 h-5"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </Button>

          {/* 下拉列表 */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  height: "auto",
                  transition: {
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 1,
                  },
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                  height: 0,
                  transition: { duration: 0.2 }
                }}
                className="absolute left-0 right-0 top-full mt-2 z-50"
                onKeyDown={handleKeyDown}
              >
                <motion.div
                  className="w-full rounded-xl border border-white/10 bg-neutral-900/90 backdrop-blur-xl p-1 shadow-2xl shadow-black/50"
                  initial={{ borderRadius: 8 }}
                  animate={{
                    borderRadius: 12,
                    transition: { duration: 0.2 },
                  }}
                  style={{ transformOrigin: "top" }}
                >
                  <motion.div 
                    className="py-1 relative" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="visible"
                  >
                    {/* 悬停背景块 */}
                    <motion.div
                      layoutId="hover-highlight"
                      className="absolute inset-x-1 bg-white/10 rounded-lg"
                      animate={{
                        y: categories.findIndex((c) => (hoveredCategory || selectedCategory.id) === c.id) * 44,
                        height: 40,
                      }}
                      transition={{
                        type: "spring",
                        bounce: 0.15,
                        duration: 0.5,
                      }}
                    />
                    
                    {categories.map((category, index) => (
                      <React.Fragment key={category.id}>
                        <motion.button
                          onClick={() => {
                            setSelectedCategory(category)
                            setIsOpen(false)
                            if(onSelect) onSelect(category.path)
                          }}
                          onHoverStart={() => setHoveredCategory(category.id)}
                          onHoverEnd={() => setHoveredCategory(null)}
                          className={cn(
                            "relative flex w-full items-center px-4 py-2.5 text-sm rounded-lg my-0.5",
                            "transition-colors duration-150",
                            "focus:outline-none",
                            selectedCategory.id === category.id || hoveredCategory === category.id
                              ? "text-white font-medium"
                              : "text-neutral-400",
                          )}
                          whileTap={{ scale: 0.98 }}
                          variants={itemVariants}
                        >
                          <IconWrapper
                            icon={category.icon}
                            isHovered={hoveredCategory === category.id}
                            color={category.color}
                          />
                          {category.label}
                        </motion.button>
                      </React.Fragment>
                    ))}
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </MotionConfig>
  )
}