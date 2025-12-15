"use client"
import { StatusToggle } from "@/components/ui/status-toggle"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, Thermometer, Leaf, Search, Edit, Trash2, X, MapPin, Navigation, Check, Loader2, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

// --- 公共组件与类型 ---
import { ClothingForm } from "@/components/clothing-form"
import { GlowingCard } from "@/components/glowing-card"
import type { ClothingItem, ClothingFormData } from "@/lib/types"
import { BackgroundPaths } from "@/components/ui/background-paths"
import { GlobalNav } from "@/components/global-nav"
import { VirtualDesignerModal } from "@/components/virtual-designer-modal"

const API_BASE_URL = "http://127.0.0.1:8000"
const WEATHER_CACHE_DURATION = 3600 * 1000 // 1小时

const MAIN_CATEGORIES = ["全部", "上衣", "裤子", "连体类", "鞋", "包", "帽子", "首饰", "配饰"]

// 加空值保护，避免 condition 为 undefined 时报错
const getWeatherIcon = (condition: string = "") => {
  if (!condition) return <Cloud className="w-8 h-8 text-gray-400" />
  if (condition.includes("晴")) return <Sun className="w-8 h-8 text-yellow-400" />
  if (condition.includes("多云") || condition.includes("阴")) return <Cloud className="w-8 h-8 text-gray-400" />
  if (condition.includes("雨")) return <CloudRain className="w-8 h-8 text-blue-400" />
  if (condition.includes("雪")) return <CloudSnow className="w-8 h-8 text-white" />
  if (condition.includes("风")) return <Wind className="w-8 h-8 text-gray-300" />
  return <Cloud className="w-8 h-8 text-gray-400" />
}

// 统一获取用户ID的辅助函数
const getUserId = () => {
  return localStorage.getItem("user_id") || "test_user";
};

export default function WardrobePage() {
  const [weather, setWeather] = useState<any>(null)
  const [currentLocation, setCurrentLocation] = useState("厦门市") // 默认为厦门
  const [show7DayForecast, setShow7DayForecast] = useState(false)
  const [items, setItems] = useState<ClothingItem[]>([])
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null)
  const [selectedCategory, setSelectedCategory] = useState("全部")
  const [searchTerm, setSearchTerm] = useState("")
  const [showDesigner, setShowDesigner] = useState(false) 

  // --- 数据获取逻辑 (带缓存 & 支持动态地点) ---
  const fetchWeatherWithCache = async (location: string, forceRefresh = false) => {
    const cacheKeyData = `weather_data_${location}`
    const cacheKeyTime = `weather_time_${location}`
  
    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
      const cachedData = localStorage.getItem(cacheKeyData)
      const cachedTimestamp = localStorage.getItem(cacheKeyTime)

      if (cachedData && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp, 10)
        if (age < WEATHER_CACHE_DURATION) {
          console.log(`✅ 使用缓存的天气数据 [${location}]`)
          setWeather(JSON.parse(cachedData))
          return
        }
      }
    }

    console.log(`🚀 获取新的天气数据: ${location}...`)
    try {
      // 修复：后端参数名是 location_input 而非 location
      const res = await fetch(`${API_BASE_URL}/weather?location_input=${location}`)
      const newData = await res.json()
      
      if (!newData.error) {
        // 适配后端数据结构，统一字段名
        const adaptedWeather = {
          temp_now: newData.current?.temp_real || 0,
          condition: newData.current?.skycon || "",
          description: newData.summary_text || "",
          temp_feel: newData.current?.temp_feel || 0,
          humidity: newData.current?.humidity || 0,
          aqi: newData.current?.aqi || "未知",
          hourly_forecast: newData.hourly_trend || [],
          daily_forecast: newData.daily_forecast || [
            {
              date: new Date().toISOString(),
              condition: newData.current?.skycon || "",
              min_temp: newData.today_stat?.temp_min || 0,
              max_temp: newData.today_stat?.temp_max || 0
            }
          ]
        }
        setWeather(adaptedWeather)
        localStorage.setItem(cacheKeyData, JSON.stringify(adaptedWeather))
        localStorage.setItem(cacheKeyTime, Date.now().toString())
        // 保存用户的地点偏好
        localStorage.setItem("user_preferred_location", location)
      }
    } catch (error) {
      console.error("获取天气失败:", error)
    }
  }

  // fetchItems 改用动态用户ID
  const fetchItems = async () => {
    const userId = getUserId(); // 动态获取用户ID
    try {
      const res = await fetch(`${API_BASE_URL}/items/?user_id=${userId}`)
      const data = await res.json()
      setItems(data)
    } catch (error) {
      console.error("获取衣橱数据失败:", error)
    }
  }

  useEffect(() => {
    // 1. 初始化时，先看有没有存过的地点偏好
    const savedLocation = localStorage.getItem("user_preferred_location")
    const locToUse = savedLocation || "厦门市"
    setCurrentLocation(locToUse)

    // 2. 获取数据
    fetchWeatherWithCache(locToUse)
    fetchItems()
  }, [])

  // 处理地点变更
  const handleLocationChange = (newLocation: string) => {
    setCurrentLocation(newLocation)
    setWeather(null) // 先清空当前显示，显示加载状态
    fetchWeatherWithCache(newLocation, true)
  }

  const handleSave = async (updatedItem: ClothingItem) => {
    const userId = getUserId(); // 动态获取用户ID
    try {
      await fetch(`${API_BASE_URL}/items/${updatedItem.id}?user_id=${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem)
      })
      alert("更新成功！")
      setEditingItem(null)
      fetchItems()
    } catch (error) {
      console.error("更新失败:", error)
      alert("更新失败，请检查后端接口是否支持 PUT 方法")
    }
  }
  
  const handleDelete = async (itemId: number) => {
    const userId = getUserId(); // 动态获取用户ID
    if (window.confirm("确定要删除这件衣物吗？")) {
       try {
        await fetch(`${API_BASE_URL}/items/${itemId}?user_id=${userId}`, { method: "DELETE" })
        alert("删除成功！")
        setEditingItem(null)
        fetchItems()
      } catch (error) {
        console.error("删除失败:", error)
        alert("删除失败")
      }
    }
  }

  // 处理卡片上的状态切换
  const handleStatusUpdate = async (item: ClothingItem, newStatus: string) => {
    const userId = getUserId(); // 动态获取用户ID
    setItems(prevItems => 
      prevItems.map(i => i.id === item.id ? { ...i, status: newStatus } : i)
    )

    try {
      // 2. 发送请求给后端
      const updatedItem = { ...item, status: newStatus }
      await fetch(`${API_BASE_URL}/items/${item.id}?user_id=${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem)
      })
      // 成功后不需要做什么，因为前端已经更新了
    } catch (error) {
      console.error("状态更新失败", error)
      alert("状态更新失败，请重试")
      fetchItems() // 失败了就回滚（重新获取数据）
    }
  }
  
  // 搜索逻辑 - 匹配 materials 数组
  const filteredItems = items.filter(item => {
    const sub = (item.category_sub || "").toLowerCase()
    const mat = Array.isArray(item.materials) 
      ? item.materials.join(" ").toLowerCase() 
      : ""
    
    const searchLower = searchTerm.trim().toLowerCase()
    
    // 只要子类、材质、或颜色包含关键词即可
    const matchesSearch = sub.includes(searchLower) ||
                          mat.includes(searchLower) ||
                          (item.main_color || "").includes(searchLower)

    const matchesCategory = selectedCategory === "全部" || item.category_main === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen text-white p-4 md:p-8 relative">
      <BackgroundPaths />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold tracking-tight mb-8">衣橱与气象</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 天气面板区域 */}
          <div className="lg:col-span-1 space-y-6">
            <GlowingCard disabled={false}>
              <WeatherPanel 
                weather={weather} 
                locationName={currentLocation}
                onLocationChange={handleLocationChange}
                onClick={() => setShow7DayForecast(true)} 
              />
            </GlowingCard>

            <GlowingCard>
              <div className="p-6">
                <HourlyForecastContent weather={weather} />
              </div>
            </GlowingCard>
          </div>

          {/* 衣橱区域 */}
          <div className="lg:col-span-2">
            <GlowingCard className="h-[800px]">
              <div className="p-6 flex flex-col h-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    我的衣橱 
                    <span className="text-zinc-500 text-sm font-normal">({filteredItems.length})</span>
                  </h2>
                  <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
                    <input 
                      type="text" 
                      placeholder="搜索子类或材质..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-white w-full md:w-48 text-white"
                    />
                  </div>
                </div>

                <div className="mb-6 overflow-x-auto pb-2 custom-scrollbar">
                  <div className="flex gap-2">
                    {MAIN_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                          selectedCategory === cat
                            ? "bg-white text-black border-white"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                      {filteredItems.map(item => (
                        <ClothingCard 
                          key={item.id} 
                          item={item} 
                          onCardClick={() => setEditingItem(item)} 
                          onStatusChange={(newStatus) => handleStatusUpdate(item, newStatus)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                      <Search className="w-12 h-12 mb-3 opacity-20" />
                      <p>没有找到相关衣物</p>
                    </div>
                  )}
                </div>
              </div>
            </GlowingCard>
          </div>
        </div>
      </div>

      <div className="fixed bottom-32 right-8 flex flex-col gap-4 z-40">
        <button 
          onClick={() => setShowDesigner(true)}
          className="w-14 h-14 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-900/50 flex items-center justify-center hover:scale-110 transition-transform"
          title="虚拟衣物设计"
        >
          <Wand2 className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {showDesigner && (
          <VirtualDesignerModal 
            onClose={() => setShowDesigner(false)} 
            onSuccess={() => {
              fetchItems(); // 生成成功后刷新衣橱列表
              // 不自动关闭模态框，让用户决定是否继续操作
            }} 
          />
        )}
      </AnimatePresence>

      {/* 7天预报弹窗 */}
      <AnimatePresence>
        {show7DayForecast && weather && (
          <DailyForecastModal 
            dailyData={weather.daily_forecast} 
            onClose={() => setShow7DayForecast(false)}
          />
        )}
      </AnimatePresence>

      {/* 编辑衣物弹窗 */}
      <AnimatePresence>
        {editingItem && (
          <EditClothingModal 
            item={editingItem} 
            onClose={() => setEditingItem(null)} 
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* GlobalNav 组件 */}
      <GlobalNav />
    </div>
  )
}

// --- WeatherPanel 组件 ---
function WeatherPanel({ weather, locationName, onLocationChange, onClick }: { 
  weather: any; 
  locationName: string; 
  onLocationChange: (loc: string) => void; 
  onClick: () => void; 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(locationName)
  const [locating, setLocating] = useState(false)

  // 增强版定位函数
  const handleGPS = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLocating(true)

    // 定义 IP 定位作为备选方案
    const fallbackToIP = async () => {
      try {
        console.log("正在尝试 IP 定位兜底...")
        // 使用免费的 geojs.io 接口，无需权限
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json")
        const data = await res.json()
        
        if (data.latitude && data.longitude) {
          const coords = `${data.longitude},${data.latitude}`
          console.log("IP 定位成功:", data.city, coords)
          onLocationChange(coords)
          setIsEditing(false)
          alert(`已通过网络定位到：${data.city || "当前城市"}`)
        } else {
          throw new Error("IP info incomplete")
        }
      } catch (err) {
        console.error("IP 定位也失败了:", err)
        alert("无法获取位置，请手动输入城市名称（如：北京）。")
      } finally {
        setLocating(false)
      }
    }

    // 1. 尝试浏览器原生 GPS
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 成功：使用高精度 GPS
          const { latitude, longitude } = position.coords
          const coords = `${longitude},${latitude}`
          onLocationChange(coords)
          setIsEditing(false)
          setLocating(false)
        },
        (error) => {
          // 失败：打印错误码并切换到 IP 定位
          console.warn("GPS 定位失败 (错误码 " + error.code + "): " + error.message)
          fallbackToIP()
        },
        { timeout: 5000 } // 设置5秒超时，防止无限等待
      )
    } else {
      // 浏览器不支持 GPS，直接 IP 定位
      fallbackToIP()
    }
  }

  // 处理回车确认
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation()
      onLocationChange(inputValue)
      setIsEditing(false)
    }
  }

  // 处理输入框点击（防止冒泡触发外层的7天预报）
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  if (!weather || weather.error) {
    return (
      <div className="p-6 text-center text-zinc-500 h-[210px] flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin"/>
        <p>天气加载中...</p>
        <button onClick={(e) => {e.stopPropagation(); setIsEditing(true)}} className="text-xs text-blue-400 hover:underline">修改地点</button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 cursor-pointer" onClick={onClick}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 h-8">
            {isEditing ? (
              <div className="flex items-center gap-1 bg-black/50 rounded-lg p-1 border border-zinc-600 w-full" onClick={handleInputClick}>
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent text-sm text-white w-full outline-none px-1"
                  placeholder="输入城市..."
                  autoFocus
                />
                <button onClick={handleGPS} disabled={locating} className="p-1 hover:text-green-400 transition-colors">
                  {locating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Navigation className="w-3 h-3"/>}
                </button>
                <button onClick={(e) => {
                  e.stopPropagation(); 
                  onLocationChange(inputValue); 
                  setIsEditing(false)
                }} className="p-1 hover:text-blue-400 transition-colors">
                  <Check className="w-3 h-3"/>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <MapPin className="w-3 h-3 text-zinc-400"/>
                <p className="text-zinc-400 text-sm truncate max-w-[100px]">{locationName.includes(",") ? "当前定位" : locationName}</p>
                <button 
                  onClick={(e) => {e.stopPropagation(); setIsEditing(true); setInputValue(locationName)}}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded transition-all"
                >
                  <Edit className="w-3 h-3 text-zinc-500"/>
                </button>
              </div>
            )}
          </div>
          <p className="text-5xl font-bold">{Math.round(weather.temp_now)}°</p>
        </div>
        {getWeatherIcon(weather.condition)}
      </div>
      <p className="text-zinc-300 text-sm">{weather.description}</p>
      <div className="grid grid-cols-3 gap-4 text-center text-sm pt-4 border-t border-zinc-800/50">
        <WeatherMetric icon={<Thermometer className="w-5 h-5 text-orange-400"/>} label="体感" value={`${Math.round(weather.temp_feel)}°`} />
        <WeatherMetric icon={<Droplets className="w-5 h-5 text-cyan-400"/>} label="湿度" value={`${Math.round(weather.humidity * 100)}%`} />
        <WeatherMetric icon={<Leaf className="w-5 h-5 text-green-400"/>} label="AQI" value={weather.aqi} />
      </div>
    </div>
  )
}

// 竖排版 24小时预报组件
function HourlyForecastContent({ weather }: { weather: any }) {
  if (!weather || !weather.hourly_forecast) return null;
  
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">24小时预报</h3>
      <div className="flex flex-col space-y-3 overflow-y-auto pb-2 custom-scrollbar max-h-[320px]">
        {weather.hourly_forecast.map((hour: any, index: number) => (
          <div 
            key={index} 
            className="w-full p-3 bg-zinc-800/50 rounded-lg flex items-center justify-between"
          >
            <p className="text-sm text-zinc-400">
              {hour.time ? (
                hour.time.includes(":") ? hour.time : `${new Date(hour.time).getHours()}:00`
              ) : `${index}:00`}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex justify-center">{getWeatherIcon(hour.cond || hour.condition)}</div>
              <p className="font-semibold text-lg">{Math.round(hour.temp)}°</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherMetric({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}<span className="text-zinc-400">{label}</span></div>
      <p className="font-semibold text-lg">{value}</p>
    </div>
  )
}

// 衣物卡片组件 - 核心修改部分
function ClothingCard({ item, onCardClick, onStatusChange }: { 
  item: ClothingItem; 
  onCardClick: () => void; 
  onStatusChange: (newStatus: string) => void; 
}) {
  // 判断是否为未拥有/虚拟物品
  const isNotOwned = item.status === "未拥有"

  return (
    <div 
      className={cn(
        "relative group rounded-lg overflow-hidden border aspect-[3/4] cursor-pointer transition-transform duration-300 hover:scale-105",
        // 样式区分：未拥有的用虚线边框，且稍微暗一点
        isNotOwned 
          ? "bg-zinc-900/50 border-dashed border-zinc-700" 
          : "bg-zinc-800 border-zinc-700 hover:border-white/50"
      )}
      onClick={onCardClick}
    >
      <img 
        src={`${API_BASE_URL}/${item.image_url}`} 
        alt={item.category_sub || "衣物图片"} 
        className={cn(
          "w-full h-full object-cover", 
          isNotOwned && "opacity-80 grayscale-[0.3]" // 未拥有物品图片灰度+透明度调整
        )}
      />
      
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />
      
      {/* 右上角标签容器（未拥有标签 + 性别标签） */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
        {/* 未拥有/虚拟物品标签 */}
        {isNotOwned && (
          <span className="px-2 py-1 bg-purple-600/80 text-white text-[10px] font-bold rounded backdrop-blur-sm">
            虚拟/未拥有
          </span>
        )}
        
        {/* 性别标签 - 仅当有性别且不是中性时显示 */}
        {item.gender && item.gender !== "中性" && (
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-bold backdrop-blur-md",
            item.gender === "男款" ? "bg-blue-600/80 text-white" : "bg-pink-600/80 text-white"
          )}>
            {item.gender}
          </span>
        )}
      </div>

      {/* 左侧状态切换组件（非未拥有时显示） */}
      {!isNotOwned && (
        <div className="absolute top-2 left-2 z-20">
          <StatusToggle 
            status={item.status || "正常"} 
            onToggle={(newStatus) => onStatusChange(newStatus)} 
          />
        </div>
      )}

      {/* 编辑按钮（仅正常物品显示，调整位置避免和性别标签重叠） */}
      {!isNotOwned && (
        <div className="absolute top-10 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-white/10 pointer-events-auto">
          <Edit className="w-4 h-4 text-white" />
        </div>
      )}

      {/* 底部信息 */}
      <div className="absolute bottom-0 left-0 p-3 w-full">
        <div className="flex justify-between items-end">
          <div>
            <p className="font-bold text-base capitalize text-white">{item.category_sub}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {Array.isArray(item.materials) ? (
                item.materials.length > 0 ? item.materials[0] : "未知材质"
              ) : "未知材质"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// 7天预报弹窗
function DailyForecastModal({ dailyData, onClose }: { dailyData: any[], onClose: () => void }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${date.getMonth() + 1}/${date.getDate()} ${weekdays[date.getDay()]}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-zinc-900/90 w-auto rounded-2xl border border-zinc-700 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold tracking-wide">未来天气</h2>
          <button onClick={onClose} className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        <table className="w-full border-spacing-y-3 border-separate">
          <tbody>
            {dailyData.map((day, index) => (
              <motion.tr
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <td className="text-left font-medium text-zinc-400 pr-6 whitespace-nowrap">{formatDate(day.date)}</td>
                <td className="px-4">{getWeatherIcon(day.condition)}</td>
                <td className="text-right font-semibold text-zinc-200 tracking-wider pl-6 whitespace-nowrap">
                  {Math.round(day.min_temp)}° / {Math.round(day.max_temp)}°
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}

// 编辑衣物弹窗
function EditClothingModal({ item, onClose, onSave, onDelete }: { 
  item: ClothingItem; 
  onClose: () => void; 
  onSave: (item: ClothingItem) => void; 
  onDelete: (id: number) => void; 
}) {
  // 解构剥离只读字段
  const { id, user_id, created_at, ...editableFields } = item;
  
  // 初始化表单数据
  const [formData, setFormData] = useState<ClothingFormData>({
    category_main: editableFields.category_main || "",
    category_sub: editableFields.category_sub || "",
    default_layer: editableFields.default_layer || "",
    warmth_level: editableFields.warmth_level || 1,
    materials: editableFields.materials || [],
    is_windproof: editableFields.is_windproof || false,
    waterproof_level: editableFields.waterproof_level || "",
    breathability: editableFields.breathability || "",
    collar_type: editableFields.collar_type || "",
    length_type: editableFields.length_type || "",
    color_pattern: editableFields.color_pattern || "",
    main_color: editableFields.main_color || "",
    status: editableFields.status || "正常",
    seasons: editableFields.seasons || [],
    fit: editableFields.fit || "",
    styles: editableFields.styles || [],
    occasions: editableFields.occasions || [],
    image_url: editableFields.image_url
  });

  // 保存时合并所有字段
  const handleSaveClick = () => {
    const updatedItem: ClothingItem = {
      id: item.id,
      user_id: user_id || getUserId(),
      image_url: formData.image_url || item.image_url,
      created_at: item.created_at,
      category_main: formData.category_main,
      category_sub: formData.category_sub,
      default_layer: formData.default_layer || null,
      warmth_level: formData.warmth_level,
      materials: formData.materials,
      is_windproof: formData.is_windproof,
      waterproof_level: formData.waterproof_level,
      breathability: formData.breathability,
      collar_type: formData.collar_type,
      length_type: formData.length_type,
      color_pattern: formData.color_pattern,
      main_color: formData.main_color,
      status: formData.status,
      seasons: formData.seasons,
      fit: formData.fit,
      styles: formData.styles,
      occasions: formData.occasions
    };
    
    onSave(updatedItem);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-zinc-900 w-full max-w-4xl rounded-2xl border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-zinc-800">
          <h2 className="text-xl font-semibold">编辑衣物</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800">
            <X className="w-5 h-5 text-zinc-500 hover:text-white"/>
          </button>
        </div>
        
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
          {/* 衣物图片预览 */}
          <div className="relative w-full h-64 lg:h-full bg-zinc-950/50 rounded-xl flex items-center justify-center border border-zinc-800">
            <img 
              src={`${API_BASE_URL}/${formData.image_url || item.image_url}`} 
              alt={formData.category_sub || "衣物图片"} 
              className="max-w-full max-h-full object-contain p-4"
            />
          </div>
          
          {/* 表单组件 */}
          <div className="overflow-y-auto custom-scrollbar pr-3">
            <ClothingForm formData={formData} setFormData={setFormData} />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex-shrink-0 p-5 mt-auto border-t border-zinc-800 flex justify-between items-center">
          <button 
            onClick={() => onDelete(item.id)}
            className="px-4 py-2 text-sm bg-red-800/50 text-red-300 rounded-lg hover:bg-red-800/80 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4"/>删除
          </button>
          <button 
            onClick={handleSaveClick}
            className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200"
          >
            保存更改
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}