"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, RotateCcw, Loader2, Save, Scissors, ArrowRight, MousePointerClick } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClothingForm } from "@/components/clothing-form"
import { GlowingCard } from "@/components/glowing-card"
import { BackgroundPaths } from "@/components/ui/background-paths"
import type { ClothingFormData } from "@/lib/types"
import { GlobalNav } from "@/components/global-nav"

const API_BASE_URL = "http://127.0.0.1:8000"

// --- 类型定义 ---
interface SegmentPart {
  category_key: string
  label: string
  image_path: string
}

interface ExtendedFormData extends ClothingFormData {
  embedding_vector?: number[];
  user_id: string;
  default_layer?: string;
}

// 基础初始表单数据
const BASE_INITIAL_FORM_DATA: ExtendedFormData = {
  user_id: "test_user",
  category_main: "",
  category_sub: "",
  warmth_level: 3,             
  is_windproof: false,         
  waterproof_level: "无",      
  breathability: "中",         
  fit: "合身",                 
  color_pattern: "纯色",
  main_color: "",
  colors: [],
  status: "正常",
  seasons: [],
  material: "",
  materials: [],
  thickness: "",
  collar: "",
  collar_type: "",
  closure: "",
  sleeve: "",
  length_type: "",
  image_url: "",
  styles: [],
  occasions: [],
  embedding_vector: []
}

// 提取获取用户ID的辅助函数
const getUserId = () => {
  return localStorage.getItem("user_id") || "test_user";
};

// 流程状态
type UploadStep = "upload" | "select" | "review"

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>("upload")
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingText, setLoadingText] = useState("")
  
  const [file, setFile] = useState<File | null>(null)
  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null)
  const [segmentParts, setSegmentParts] = useState<SegmentPart[]>([])
  
  // 初始化表单时使用动态用户ID
  const [formData, setFormData] = useState<ExtendedFormData>({
    ...BASE_INITIAL_FORM_DATA,
    user_id: getUserId() // 初始化为当前登录用户ID
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. 处理文件选择 -> 调用 /segment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setPreviewOriginal(URL.createObjectURL(selectedFile))
    setIsProcessing(true)
    setLoadingText("正在进行智能分割与去背景...")

    const data = new FormData()
    data.append("file", selectedFile)

    try {
      // segment接口传入动态user_id
      const res = await fetch(`${API_BASE_URL}/segment?user_id=${getUserId()}`, {
        method: "POST",
        body: data
      })
      
      if (!res.ok) throw new Error("分割服务响应异常")
      const result = await res.json()

      if (result.parts && result.parts.length > 0) {
        setSegmentParts(result.parts)
        setStep("select")
      } else {
        throw new Error("未能识别出任何衣物主体")
      }

    } catch (error: any) {
      console.error(error)
      alert(`处理失败: ${error.message}`)
      setFile(null)
      setPreviewOriginal(null)
    } finally {
      setIsProcessing(false)
    }
  }

  // 2. 用户选择某张图 -> 调用 /analyze-selected
  const handleSelectPart = async (part: SegmentPart) => {
    setIsProcessing(true)
    setLoadingText(`正在识别"${part.label}"的材质、风格与细节...`)

    try {
      // analyze-selected接口传入动态user_id
      const res = await fetch(`${API_BASE_URL}/analyze-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_path: part.image_path,
          user_id: getUserId() // 动态用户ID
        })
      })

      if (!res.ok) throw new Error("AI 分析服务异常")
      const result = await res.json()
    const rawGender = result.attributes.gender || "中性";
    const cleanGender = rawGender.trim(); // 去除空格

      // 合并 AI 分析结果到表单
      setFormData(prev => ({
        ...prev,
        ...result.attributes,
        gender: cleanGender,
        materials: result.attributes.materials || [],
        seasons: result.attributes.seasons || [],
        styles: result.attributes.styles || [],
        occasions: result.attributes.occasions || [],
        image_url: result.selected_image,
        embedding_vector: result.embedding_vector,
        category_main: result.attributes.category_main || mapCategoryKeyToMain(part.category_key),
        user_id: getUserId()
      }))

      setStep("review")

    } catch (error: any) {
      console.error(error)
      alert(`分析失败: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // 3. 提交入库 -> 调用 /items/
  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        // 提交时兜底使用动态user_id
        user_id: formData.user_id || getUserId(),
        image_url: formData.image_url || "uploads/default.png"
      }

      const res = await fetch(`${API_BASE_URL}/items/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error("保存失败")
      
      alert("🎉 衣物已成功存入衣橱！")
      setStep("select")
      // 重置表单时保留当前用户ID
      setFormData(prev => ({
        ...BASE_INITIAL_FORM_DATA, 
        user_id: getUserId() // 确保重置后仍为当前用户ID
      }))

    } catch (error: any) {
      alert(`入库失败: ${error.message}`)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreviewOriginal(null)
    setSegmentParts([])
    // 重置表单时使用动态user_id
    setFormData({
      ...BASE_INITIAL_FORM_DATA,
      user_id: getUserId()
    })
    setStep("upload")
  }

  // 辅助：根据分割的 key 猜测大类
  const mapCategoryKeyToMain = (key: string) => {
    if (key === "upper") return "上衣"
    if (key === "lower") return "下装"
    if (key === "shoes") return "鞋"
    return ""
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 pb-24 relative">
      <BackgroundPaths />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* 顶部导航栏 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI 识衣入库</h1>
            <p className="text-zinc-500 mt-1">上传全身照，AI 自动分割并提取属性</p>
          </div>
          {step !== "upload" && (
            <button 
              onClick={handleReset}
              className="flex items-center text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2 bg-zinc-800 rounded-lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> 重新开始
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[600px]">
          
          {/* 左侧：主显示区 (上传/预览) */}
          <div className="lg:col-span-5">
            <GlowingCard className="h-full flex flex-col relative overflow-hidden">
              {/* 加载遮罩 */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <Scissors className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">AI 处理中</h3>
                  <p className="text-emerald-400 animate-pulse">{loadingText}</p>
                </div>
              )}

              {/* 状态 1: 待上传 */}
              {!file && !isProcessing && (
                <div 
                  className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors p-8 text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/50">
                    <Upload className="w-10 h-10 text-zinc-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">点击上传图片</h3>
                  <p className="text-zinc-500">支持全身照、挂拍图 (JPG/PNG)</p>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
              )}

              {/* 状态 2: 显示原图 (供参考) */}
              {file && (
                <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center p-4">
                  <img src={previewOriginal!} className="max-w-full max-h-full object-contain opacity-50" />
                  <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded-full text-xs text-zinc-400">
                    原始图片
                  </div>
                </div>
              )}
            </GlowingCard>
          </div>

          {/* 右侧：交互区 (选择/编辑) */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              
              {/* 阶段 2: 选择分割部分 */}
              {step === "select" && (
                <motion.div 
                  key="select"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full"
                >
                   <GlowingCard className="h-full p-6 flex flex-col">
                      <div className="mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <MousePointerClick className="w-5 h-5 text-blue-400"/>
                          请选择要入库的主体
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1">AI 已从原图中切割出以下部分，请点击一个进行分析</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar flex-1 content-start">
                        {segmentParts.map((part, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectPart(part)}
                            className="group relative bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 hover:border-blue-500 transition-all text-left"
                          >
                            <div className="aspect-square w-full bg-zinc-900/50 p-4 flex items-center justify-center">
                              <img 
                                src={`${API_BASE_URL}/${part.image_path}`} 
                                className="max-w-full max-h-full object-contain drop-shadow-2xl transition-transform group-hover:scale-110"
                              />
                            </div>
                            <div className="p-3 bg-zinc-900 border-t border-zinc-800 group-hover:bg-blue-900/20">
                              <div className="font-bold text-white">{part.label}</div>
                              <div className="text-xs text-zinc-500 group-hover:text-blue-300">点击识别属性 &rarr;</div>
                            </div>
                          </button>
                        ))}
                      </div>
                   </GlowingCard>
                </motion.div>
              )}

              {/* 阶段 3: 编辑与确认 */}
              {step === "review" && (
                <motion.div 
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="h-full"
                >
                  <GlowingCard className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                      <div>
                        <h2 className="text-lg font-bold text-white">确认衣物属性</h2>
                        <p className="text-xs text-zinc-500">AI 自动填充，如有误请手动修改</p>
                      </div>
                      <div className="w-16 h-16 bg-black rounded-lg border border-zinc-700 overflow-hidden">
                        <img src={`${API_BASE_URL}/${formData.image_url}`} className="w-full h-full object-contain" />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                       <ClothingForm formData={formData} setFormData={setFormData as any} />
                    </div>

                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                      <button
                        onClick={handleSubmit}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                      >
                        <Save className="w-5 h-5" />
                        确认入库
                      </button>
                    </div>
                  </GlowingCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 渲染 GlobalNav 组件（确保 z-index 生效） */}
      <GlobalNav />
    </div>
  )
}