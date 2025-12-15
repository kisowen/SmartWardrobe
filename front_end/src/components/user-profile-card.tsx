"use client"

import { useState, useEffect } from "react"
import { User, Thermometer, Briefcase, Bike, Heart, Zap, X, Save, Car, Train, Footprints, Palette, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlowingCard } from "@/components/glowing-card"

const API_BASE_URL = "http://127.0.0.1:8000"
const getUserId = () => localStorage.getItem("user_id") || "test_user"

// 1. 更新接口定义
export interface UserProfile {
  thermal_sensitivity: number
  sweat_tendency: boolean
  body_shape: string
  commute_method: string
  occupation: string
  fit_preference: string
  avoid_colors: string[]
  preferred_colors: string[] 
}

const DEFAULT_PROFILE: UserProfile = {
  thermal_sensitivity: 0,
  sweat_tendency: false,
  body_shape: "标准",
  commute_method: "地铁/公交",
  occupation: "互联网/自由职业",
  fit_preference: "合身",
  avoid_colors: [],
  preferred_colors: [] 
}

// 颜色常量
const COLORS = ["黑", "白", "灰", "卡其", "棕", "深蓝", "浅蓝", "红", "粉", "绿", "紫", "黄", "橙", "银", "金", "多色"]

export function UserProfileCard() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/profile?user_id=${getUserId()}`)
      if (res.ok) {
        const data = await res.json()
        setProfile({
            ...DEFAULT_PROFILE, // 兜底防止老数据缺字段
            ...data
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSave = async (newProfile: UserProfile) => {
    try {
      await fetch(`${API_BASE_URL}/user/profile?user_id=${getUserId()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile)
      })
      setProfile(newProfile)
      setIsModalOpen(false)
    } catch (e) {
      alert("保存失败")
    }
  }

  const getThermalText = (val: number) => {
    if (val <= -2) return "极怕冷"
    if (val === -1) return "怕冷"
    if (val === 0) return "正常"
    if (val === 1) return "怕热"
    return "极怕热"
  }

  return (
    <>
      <div onClick={() => setIsModalOpen(true)} className="cursor-pointer group">
        <GlowingCard className="p-5 hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-zinc-100 font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              用户画像
            </h3>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
              点击编辑
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 flex items-center gap-2">
              <Thermometer className={cn("w-3.5 h-3.5", profile.thermal_sensitivity < 0 ? "text-blue-400" : profile.thermal_sensitivity > 0 ? "text-orange-400" : "text-zinc-400")} />
              <span className="text-zinc-300">{getThermalText(profile.thermal_sensitivity)}</span>
            </div>
            <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-300 truncate">{profile.occupation.split("/")[0]}</span>
            </div>
            <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 flex items-center gap-2">
              <Bike className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-300 truncate">{profile.commute_method}</span>
            </div>
             <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-zinc-300 truncate">
                  {profile.preferred_colors?.length > 0 ? profile.preferred_colors.slice(0,2).join(",") + (profile.preferred_colors.length > 2 ? "..." : "") : "无偏好"}
              </span>
            </div>
          </div>
        </GlowingCard>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <UserProfileModal 
            initialData={profile} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSave} 
          />
        )}
      </AnimatePresence>
    </>
  )
}

function UserProfileModal({ initialData, onClose, onSave }: { initialData: UserProfile, onClose: () => void, onSave: (p: UserProfile) => void }) {
  const [data, setData] = useState(initialData)

  const THERMAL_OPTIONS = [
    { val: -2, label: "极怕冷", color: "bg-blue-600" },
    { val: -1, label: "怕冷", color: "bg-blue-400" },
    { val: 0, label: "正常", color: "bg-zinc-500" },
    { val: 1, label: "怕热", color: "bg-orange-400" },
    { val: 2, label: "极怕热", color: "bg-orange-600" },
  ]

  const COMMUTE_OPTIONS = [
    { label: "驾车", icon: Car },
    { label: "地铁/公交", icon: Train },
    { label: "骑行", icon: Bike },
    { label: "步行", icon: Footprints },
  ]

  const OCCUPATION_OPTIONS = ["互联网/自由职业", "金融/律所/体制内", "学生", "户外工作者"]

  const toggleColor = (color: string) => {
    const current = data.preferred_colors || []
    if (current.includes(color)) {
        setData({ ...data, preferred_colors: current.filter(c => c !== color) })
    } else {
        if (current.length >= 5) return // 限制最多选5个
        setData({ ...data, preferred_colors: [...current, color] })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" /> 用户画像配置
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          
          {/* 1. 生理感知 */}
          <section className="space-y-4">
            <h3 className="text-sm text-zinc-400 font-bold uppercase tracking-wider">1. 生理感知 (Physiological)</h3>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500">冷热敏感度</label>
              <div className="grid grid-cols-5 gap-2">
                {THERMAL_OPTIONS.map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setData({ ...data, thermal_sensitivity: opt.val })}
                    className={cn(
                      "py-2 rounded-lg text-xs font-bold transition-all border",
                      data.thermal_sensitivity === opt.val 
                        ? `${opt.color} text-white border-transparent scale-105 shadow-lg` 
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
               <span className="text-sm text-zinc-300">易出汗体质</span>
               <div 
                 onClick={() => setData({ ...data, sweat_tendency: !data.sweat_tendency })}
                 className={cn("w-12 h-6 rounded-full p-1 cursor-pointer transition-colors", data.sweat_tendency ? "bg-blue-600" : "bg-zinc-700")}
               >
                 <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", data.sweat_tendency ? "translate-x-6" : "translate-x-0")} />
               </div>
            </div>
          </section>

          {/* 2. 场景与生活 */}
          <section className="space-y-4">
            <h3 className="text-sm text-zinc-400 font-bold uppercase tracking-wider">2. 场景与生活 (Lifestyle)</h3>
            <div className="space-y-2">
               <label className="text-xs text-zinc-500">通勤方式</label>
               <div className="grid grid-cols-4 gap-2">
                 {COMMUTE_OPTIONS.map(opt => (
                   <button
                     key={opt.label}
                     onClick={() => setData({ ...data, commute_method: opt.label })}
                     className={cn(
                       "flex flex-col items-center justify-center py-3 rounded-xl border transition-all gap-1",
                       data.commute_method === opt.label
                         ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                         : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                     )}
                   >
                     <opt.icon className="w-4 h-4" />
                     <span className="text-[10px]">{opt.label}</span>
                   </button>
                 ))}
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-xs text-zinc-500">职业/常驻场景</label>
               <select 
                 value={data.occupation}
                 onChange={(e) => setData({...data, occupation: e.target.value})}
                 className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-emerald-500"
               >
                 {OCCUPATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
               </select>
            </div>
          </section>

          {/* 3. 审美偏好 */}
          <section className="space-y-4">
             <h3 className="text-sm text-zinc-400 font-bold uppercase tracking-wider">3. 审美偏好 (Aesthetic)</h3>
             
             {/* 版型选择 */}
             <div className="space-y-2">
                <label className="text-xs text-zinc-500">版型偏好</label>
                <div className="grid grid-cols-3 gap-2">
                    {["紧身", "合身", "宽松"].map(fit => (
                    <button
                        key={fit}
                        onClick={() => setData({ ...data, fit_preference: fit })}
                        className={cn(
                        "py-2 rounded-lg text-xs transition-all border",
                        data.fit_preference === fit
                            ? "bg-purple-600/20 border-purple-500 text-purple-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                        )}
                    >
                        {fit}
                    </button>
                    ))}
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs text-zinc-500 flex justify-between">
                    偏好色系 (可多选)
                    <span className="text-[10px] opacity-50">{data.preferred_colors?.length || 0}/5</span>
                </label>
                <div className="grid grid-cols-6 gap-2">
                    {COLORS.map(c => (
                        <ColorToggle 
                            key={c} 
                            label={c} 
                            active={(data.preferred_colors || []).includes(c)} 
                            onClick={() => toggleColor(c)} 
                        />
                    ))}
                </div>
             </div>
          </section>

        </div>

        <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900 flex-shrink-0">
           <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white text-sm">取消</button>
           <button 
             onClick={() => onSave(data)}
             className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-2"
           >
             <Save className="w-4 h-4" /> 保存画像
           </button>
        </div>

      </motion.div>
    </div>
  )
}

// 颜色选择按钮组件
function ColorToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    const colorMap: Record<string, string> = {
      "黑": "#000000", "白": "#ffffff", "灰": "#808080", "卡其": "#c3b091",
      "棕": "#8b4513", "深蓝": "#00008b", "浅蓝": "#add8e6", "红": "#ff0000",
      "粉": "#ffc0cb", "绿": "#008000", "紫": "#800080", "黄": "#ffff00",
      "橙": "#ffa500", "银": "#c0c0c0", "金": "#ffd700", "多色": "linear-gradient(45deg, red, blue)"
    }
    const bgStyle = colorMap[label] || "#333"
  
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center p-2 rounded-lg border transition-all gap-1 relative overflow-hidden",
          active 
            ? "bg-zinc-800 border-purple-500 ring-1 ring-purple-500/50" 
            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
        )}
      >
        <div 
          className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
          style={{ background: bgStyle }}
        />
        <span className={cn("text-[10px]", active ? "text-white font-bold" : "text-zinc-500")}>
            {label}
        </span>
        {active && (
            <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
        )}
      </button>
    )
  }