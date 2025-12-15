"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, MapPin, Thermometer, Wind, User, Loader2, 
  ThumbsUp, ThumbsDown, Shirt, AlertCircle 
} from "lucide-react"
import { cn } from "@/lib/utils"

// 引入公共组件
import { GlowingCard } from "@/components/glowing-card"
import { BackgroundPaths } from "@/components/ui/background-paths"
import { GlobalNav } from "@/components/global-nav"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { UserProfileCard } from "@/components/user-profile-card"

const API_BASE_URL = "http://127.0.0.1:8000"

// 定义默认标签（与后端保持一致）
const DEFAULT_STYLES = ["休闲", "商务", "运动", "街头", "复古", "极简", "优雅", "日系", "工装", "甜酷"]
const DEFAULT_SCENARIOS = ["通勤", "居家", "户外", "约会", "正式宴会", "旅行", "运动", "逛街"]

// 定义所有可选品类
const CATEGORY_OPTIONS = ["上衣", "裤子", "连体类", "鞋", "包", "帽子", "配饰"]

// --- 类型定义 ---
interface OutfitItem {
  id: number
  name: string
  image_url: string
  warmth: number
  type: string
  gender?: "男款" | "女款" | "中性"
}

// Outfit 改为灵活的键值对结构，适配多品类
interface RecommendationResult {
  status: string
  weather_summary: string
  outfit: Record<string, OutfitItem>
  ai_comment: string
  score: number
  virtual_tryon_url?: string | null
  message?: string
}

// 增加客户端环境判断，避免服务端访问localStorage
const getUserId = () => {
  if (typeof window === 'undefined') return "test_user" // 服务端默认值
  return localStorage.getItem("user_id") || "test_user"
}

const getImageUrl = (path?: string | null) => {
  if (!path) return "/placeholder.png"
  if (path.startsWith("http")) return path
  return `${API_BASE_URL}/${path.startsWith("/") ? path.slice(1) : path}`
}

export default function RecommendPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<RecommendationResult | null>(null)
  // 动态标签状态（初始值为默认标签）
  const [styles, setStyles] = useState<string[]>(DEFAULT_STYLES)
  const [scenarios, setScenarios] = useState<string[]>(DEFAULT_SCENARIOS)
  
  // 表单状态
  const [location, setLocation] = useState("厦门市")
  // 先设默认值，再在useEffect中读取localStorage
  const [gender, setGender] = useState("男士") 
  const [style, setStyle] = useState(DEFAULT_STYLES[0]) 
  const [scenario, setScenario] = useState(DEFAULT_SCENARIOS[0]) 

  // 目标品类状态 (默认选上衣+裤子)
  const [targetCategories, setTargetCategories] = useState<string[]>(["上衣", "裤子"])

  // 反馈状态
  const [hasFeedback, setHasFeedback] = useState(false)

  // 组件挂载后（客户端）读取localStorage中的gender
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedGender = localStorage.getItem("gender") || "男士"
      setGender(savedGender)
    }
  }, [])

  // 组件挂载时获取用户自定义标签
  useEffect(() => {
    const fetchUserTags = async () => {
      try {
        const userId = getUserId() // 此时已确保是客户端环境
        const response = await fetch(`${API_BASE_URL}/user/tags?user_id=${userId}`)
        
        if (response.ok) {
          const data = await response.json()
          
          // 更新风格标签（确保是数组且有值）
          if (Array.isArray(data.styles) && data.styles.length > 0) {
            setStyles(data.styles)
            // 如果当前选中的风格不在新列表中，自动选中第一个
            if (!data.styles.includes(style)) {
              setStyle(data.styles[0])
            }
          }
          
          // 更新场景标签（确保是数组且有值）
          if (Array.isArray(data.occasions) && data.occasions.length > 0) {
            setScenarios(data.occasions)
            // 如果当前选中的场景不在新列表中，自动选中第一个
            if (!data.occasions.includes(scenario)) {
              setScenario(data.occasions[0])
            }
          }
        }
      } catch (error) {
        console.error("获取用户标签失败:", error)
        // 失败时保持默认标签不变
      }
    }

    fetchUserTags()
  }, [style, scenario])

  // 切换选中品类的函数（含互斥逻辑）
  const toggleCategory = (cat: string) => {
    setTargetCategories(prev => {
      if (prev.includes(cat)) {
        // 至少保留一个
        if (prev.length === 1) return prev 
        return prev.filter(c => c !== cat)
      } else {
        // 互斥逻辑：选了连体类，去掉上衣裤子；选了上衣裤子，去掉连体类
        if (cat === "连体类") return ["连体类", ...prev.filter(c => !["上衣", "裤子"].includes(c))]
        if (["上衣", "裤子"].includes(cat)) return [...prev.filter(c => c !== "连体类"), cat]
        return [...prev, cat]
      }
    })
  }

  // 确保localStorage操作在客户端执行
  const handleGenderChange = (g: string) => {
    setGender(g)
    if (typeof window !== 'undefined') {
      localStorage.setItem("gender", g)
    }
  }

  // 1. 发起推荐请求
  const handleRecommend = async () => {
    setIsLoading(true)
    setResult(null)
    setHasFeedback(false)

    try {
      const payload = {
        user_id: getUserId(),
        location,
        gender, 
        style,
        scenario,
        // 传递选中的目标品类给后端
        target_categories: targetCategories
      }

      const res = await fetch(`${API_BASE_URL}/recommend/outfit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      
      if (data.status === "failed") {
        alert(data.message || "推荐失败，请检查衣橱是否有足够衣物")
      } else {
        setResult(data)
      }

    } catch (error) {
      console.error("推荐请求失败:", error)
      alert("服务器连接失败，请稍后重试")
    } finally {
      setIsLoading(false)
    }
  }

  // 2. 提交反馈
  const handleFeedback = async (code: number) => {
    if (!result || !result.outfit) return
    
    const tempMatch = result.weather_summary.match(/(\d+)度/)
    const currentTemp = tempMatch ? parseInt(tempMatch[1]) : 20

    // 适配多品类的反馈提交逻辑（兼容原有结构）
    const outfitEntries = Object.entries(result.outfit)
    const topId = outfitEntries.find(([k]) => k === "top")?.[1].id || null
    const bottomId = outfitEntries.find(([k]) => k === "bottom")?.[1].id || null
    const outerId = outfitEntries.find(([k]) => k === "outer")?.[1].id || null
    const onePieceId = outfitEntries.find(([k]) => k === "one_piece" || k === "onepiece")?.[1]?.id || null

    try {
      await fetch(`${API_BASE_URL}/recommend/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: getUserId(),
          top_id: topId,
          bottom_id: bottomId,
          outer_id: outerId,
          one_piece_id: onePieceId,
          feedback_code: code,
          weather_temp: currentTemp,
          gender: gender
        })
      })
      setHasFeedback(true)
      alert("感谢反馈！系统将根据您的偏好进行调整。")
    } catch (error) {
      console.error("反馈提交失败:", error)
      alert("反馈提交失败，请稍后重试")
    }
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 relative pb-32">
      <BackgroundPaths />
      
      <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧：控制面板 */}
        <div className="lg:col-span-4 space-y-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-tight">智能穿搭</h1>
            <p className="text-zinc-400 text-sm mt-1">基于天气与库存的 AI 决策引擎</p>
          </div>

          <GlowingCard className="p-6 space-y-6">
            {/* 地点 */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3 h-3" /> 当前位置
              </label>
              <input 
                type="text" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none transition-all"
                placeholder="例如: 北京市"
              />
            </div>

            {/* 性别 */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-2">
                <User className="w-3 h-3" /> 性别
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                  影响衣物筛选
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["男士", "女士"].map(g => (
                  <button
                    key={g}
                    onClick={() => handleGenderChange(g)}
                    className={cn(
                      "py-2.5 rounded-lg text-sm font-medium border transition-all relative overflow-hidden",
                      gender === g 
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80"
                    )}
                  >
                    {g}
                    {gender === g && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full"
                      />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                {gender === "男士" ? "仅展示男款/中性衣物" : "展示女款/中性/男款(Oversize)衣物"}
              </p>
            </div>

            {/* 搭配品类多选区 */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                选择搭配单品 (多选)
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      targetCategories.includes(cat)
                        ? "bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 风格与场景 - 改为动态渲染 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">风格偏好</label>
                <select 
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none"
                >
                  {styles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">出行场景</label>
                <select 
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none"
                >
                  {scenarios.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4">
              <LiquidButton 
                onClick={handleRecommend} 
                disabled={isLoading}
                className="w-full h-12 bg-white text-black font-bold hover:bg-zinc-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    思考中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成今日搭配
                  </>
                )}
              </LiquidButton>
            </div>
          </GlowingCard>

          {/* 用户画像卡片 */}
          <div className="animate-in slide-in-from-left duration-500 delay-200">
            <UserProfileCard />
          </div>

          {/* AI 点评区域 */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-24 h-24 text-white" />
                </div>
                <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                  <span className="bg-emerald-500/10 p-1 rounded">AI</span> 穿搭点评
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed italic">
                  "{result.ai_comment}"
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                     <Thermometer className="w-3 h-3" />
                     {result.weather_summary.split(",")[0]}
                  </span>
                  <span>匹配度: <span className="text-white font-bold">{Math.round(result.score)}%</span></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右侧：结果展示区 */}
        <div className="lg:col-span-8 space-y-6">
          {!result && !isLoading && (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
              <Shirt className="w-16 h-16 mb-4 opacity-20" />
              <p>配置左侧选项，点击生成获取今日穿搭推荐</p>
              <p className="text-xs mt-2 text-zinc-700">性别选择会影响衣物筛选范围</p>
            </div>
          )}

          {isLoading && (
             <div className="h-full min-h-[500px] flex flex-col items-center justify-center rounded-3xl bg-zinc-900/20 backdrop-blur-sm">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <p className="mt-6 text-zinc-400 animate-pulse">正在分析天气与衣橱库存...</p>
                <p className="text-xs text-zinc-600 mt-2">
                  {gender === "男士" ? "筛选男款/中性衣物中..." : "筛选女款/中性/男款衣物中..."}
                </p>
                <p className="text-xs text-zinc-600 mt-1">生成虚拟试穿图可能需要 10-20 秒</p>
             </div>
          )}

          {result && result.outfit && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 gap-6"
            >
              {/* 重构结果展示布局，适配多品类 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                {/* 左侧大图 (保持不变) */}
                <GlowingCard className="h-full overflow-hidden relative group">
                  {result.virtual_tryon_url ? (
                    <>
                      <img 
                        src={result.virtual_tryon_url} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        alt="AI Generated Outfit" 
                      />
                      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent">
                        <span className="px-2 py-1 bg-emerald-500 text-black text-xs font-bold rounded">AI 效果预览</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
                      <AlertCircle className="w-10 h-10 mb-2" />
                      <p className="text-sm">未生成效果图</p>
                      <p className="text-xs opacity-50">(可能由于API限流或网络原因)</p>
                    </div>
                  )}
                </GlowingCard>

                {/* 动态网格展示所有单品 */}
                <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
                  {/* 遍历 result.outfit 对象 */}
                  {Object.entries(result.outfit).map(([key, item]: [string, OutfitItem], index) => (
                    <ClothingItemCard 
                      key={key} 
                      item={item} 
                      // 简单的 key 转中文标签逻辑
                      label={
                        key === "top" ? "上装" : 
                        key === "bottom" ? "下装" : 
                        key === "outer" ? "外套" : 
                        key === "shoes" ? "鞋履" :
                        key === "bag" ? "包袋" :
                        key === "hat" ? "帽子" :
                        key === "accessory" ? "配饰" :
                        key === "onepiece" ? "连体类" : key
                      } 
                      delay={0.1 * index} 
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <p className="text-sm text-zinc-400">这套搭配感觉如何？</p>
                {hasFeedback ? (
                  <span className="text-emerald-500 text-sm font-medium flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" /> 已收到反馈
                  </span>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <FeedbackButton 
                      label="太冷了" 
                      icon={<Thermometer className="w-4 h-4 text-blue-400" />} 
                      onClick={() => handleFeedback(-1)} 
                    />
                    <FeedbackButton 
                      label="太热了" 
                      icon={<Wind className="w-4 h-4 text-orange-400" />} 
                      onClick={() => handleFeedback(-2)} 
                    />
                    <FeedbackButton 
                      label="不喜欢" 
                      icon={<ThumbsDown className="w-4 h-4 text-zinc-400" />} 
                      onClick={() => handleFeedback(0)} 
                    />
                    <button 
                      onClick={() => handleFeedback(1)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <ThumbsUp className="w-4 h-4" /> 完美
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <GlobalNav />
    </div>
  )
}

function ClothingItemCard({ item, label, delay }: { item: OutfitItem, label: string, delay: number }) {
  const genderTagStyle = {
    "男款": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "女款": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    "中性": "bg-purple-500/20 text-purple-400 border-purple-500/30"
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex-1 bg-zinc-800 rounded-xl p-3 flex gap-4 items-center border border-zinc-700/50 hover:border-zinc-500 transition-colors"
    >
      <div className="w-20 h-20 bg-black rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800">
        <img src={getImageUrl(item.image_url)} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start flex-wrap gap-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-bold">{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">Lv.{item.warmth}</span>
          {item.gender && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${genderTagStyle[item.gender]}`}>
              {item.gender}
            </span>
          )}
        </div>
        <h4 className="text-white font-medium truncate mt-1">{item.name}</h4>
        <p className="text-xs text-zinc-400 mt-1 truncate">{item.type}</p>
      </div>
    </motion.div>
  )
}

function FeedbackButton({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors flex items-center gap-2"
    >
      {icon}
      {label}
    </button>
  )
}