"use client"

import { CircularCommandMenu, type CommandItem } from "@/components/ui/circular-command-menu"
import { Home, Shirt, CloudSun, Sparkles, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function GlobalNav() {
  const router = useRouter()

  const items: CommandItem[] = [
    { 
      id: "home", 
      label: "主界面", 
      icon: <Home className="w-5 h-5" />, 
      onClick: () => router.push("/") 
    },
    { 
      id: "upload", 
      label: "AI 识衣", 
      icon: <PlusCircle className="w-5 h-5" />, 
      onClick: () => router.push("/upload") 
    },
    { 
      id: "wardrobe", 
      label: "衣橱与气象", 
      icon: <CloudSun className="w-5 h-5" />, 
      onClick: () => router.push("/wardrobe") 
    },
    { 
      id: "recommend", 
      label: "穿搭推荐", 
      icon: <Sparkles className="w-5 h-5" />, 
      onClick: () => router.push("/recommend") 
    },
  ]

  return (
    <CircularCommandMenu 
      items={items} 
      // bottom-32 right-32 大约是 128px，足够容纳展开的菜单
      className="fixed bottom-32 right-32 z-[9999]"
      // 稍微调小半径，让菜单更紧凑，不至于伸太远
      radius={85}
    />
  )
}