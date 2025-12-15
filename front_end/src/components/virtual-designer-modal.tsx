"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { X, Sparkles, Loader2, Save, Shirt, Palette, Scissors, Tag, RefreshCw, Check, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { LiquidButton } from "@/components/ui/liquid-glass-button"

interface VirtualDesignerModalProps {
  onClose: () => void
  onSuccess: () => void
}

const API_BASE_URL = "http://127.0.0.1:8000"
const getUserId = () => localStorage.getItem("user_id") || "test_user"

// --- 数据字典 (保持不变) ---
const OPTIONS = {
  categories: {
    "上衣": ["T恤(长/短)", "卫衣(连帽/圆领)", "毛衣/针织衫", "衬衫", "吊带/背心", "夹克", "风衣", "大衣", "羽绒服", "西装", "马甲", "皮衣", "冲锋衣", "其他上衣"],
    "裤子": ["牛仔裤", "休闲裤", "运动裤", "西装裤", "工装裤", "短裤", "半身裙", "百褶裙", "A字裙", "皮裙", "打底裤", "其他下装"],
    "连体类": ["连衣裙", "连体裤", "背带裤/裙"],
    "鞋": ["运动鞋", "板鞋", "帆布鞋", "皮鞋", "靴子(短/长)", "乐福鞋", "凉鞋", "拖鞋", "高跟鞋", "其他鞋类"],
    "包": ["单肩包", "双肩包", "手提包", "斜挎包", "胸包/腰包", "帆布袋", "其他包类"],
    "帽子": ["鸭舌帽/棒球帽", "渔夫帽", "毛线帽", "贝雷帽", "礼帽", "遮阳帽", "其他帽子"],
    "首饰": ["项链", "耳饰", "戒指", "手链/手镯", "胸针", "手表", "其他首饰"],
    "配饰": ["围巾", "丝巾", "手套", "腰带/皮带", "墨镜/眼镜", "袜子", "领带", "发饰", "其他配饰"]
  } as Record<string, string[]>,

  colors: ["黑", "白", "灰", "卡其", "棕", "深蓝", "浅蓝", "红", "粉", "绿", "紫", "黄", "橙", "银", "金", "多色"],
  materials: ["棉", "涤纶/聚酯纤维", "牛仔", "羊毛/羊绒", "真丝/丝绸", "亚麻", "皮质", "羽绒", "针织", "雪纺", "尼龙", "其他"],
  styles: ["休闲", "商务", "运动", "街头", "复古", "极简", "优雅", "日系", "工装", "甜酷"],
  seasons: ["春", "夏", "秋", "冬"],
  patterns: ["纯色", "图案/印花", "格纹/条纹", "拼接/撞色"],
  fits: ["紧身", "合身", "宽松/Oversize"],
  genders: ["男款", "女款", "中性"]
}

export function VirtualDesignerModal({ onClose, onSuccess }: VirtualDesignerModalProps) {
  const [step, setStep] = useState<"design" | "generating" | "result">("design")
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [currentItemId, setCurrentItemId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"basic" | "detail">("basic")
  
  // --- 表单状态 ---
  const [gender, setGender] = useState("男款")
  const [mainCat, setMainCat] = useState("上衣")
  const [subCat, setSubCat] = useState("T恤(长/短)")
  const [color, setColor] = useState("黑")
  const [material, setMaterial] = useState("棉")
  const [style, setStyle] = useState("极简")
  const [season, setSeason] = useState("夏")
  const [pattern, setPattern] = useState("纯色")
  const [fit, setFit] = useState("合身")

  // 生成逻辑
  const handleGenerateAndSave = async () => {
    setStep("generating")
    
    const finalStyles = [style, gender]; 

    const payload = {
      user_id: getUserId(),
      category_main: mainCat,
      category_sub: subCat,
      main_color: color,
      materials: [material],
      styles: finalStyles, 
      seasons: [season],
      color_pattern: pattern,
      fit: fit,
      warmth_level: 3,
      gender: gender // 传递性别给后端
    }

    try {
      const res = await fetch(`${API_BASE_URL}/items/generate_virtual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error("生成失败")
      
      const data = await res.json()
      
      setGeneratedImage(`${API_BASE_URL}/${data.image_url}`)
      setCurrentItemId(data.id) // 记录ID，以便后续删除
      setStep("result")
      
    } catch (e) {
      console.error(e)
      alert("生成失败，请稍后重试")
      setStep("design")
    }
  }

  const handleRegenerate = async () => {
    if (!currentItemId) return;

    // 1. 先静默删除当前不满意的那件
    try {
      await fetch(`${API_BASE_URL}/items/${currentItemId}?user_id=${getUserId()}`, {
        method: "DELETE"
      });
      console.log(`已删除不满意物品 ID: ${currentItemId}`);
    } catch (e) {
      console.error("删除旧物品失败，但继续生成新物品", e);
    }

    // 2. 清空状态并重新生成
    setGeneratedImage(null);
    setCurrentItemId(null);
    handleGenerateAndSave(); // 重新调用生成
  }

  const handleFinish = () => {
    onSuccess(); // 触发父组件的刷新
    onClose();
  }

  const handleMainCatChange = (newMain: string) => {
    setMainCat(newMain)
    setSubCat(OPTIONS.categories[newMain][0]) 
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[700px]"
      >
        
        {/* 左侧：预览区 */}
        <div className="w-full md:w-5/12 bg-black relative flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800">
          {step === "design" && (
            <div className="text-center text-zinc-600 p-6">
               <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                  <Shirt className="w-10 h-10 opacity-30" />
               </div>
               <h3 className="text-lg font-bold text-zinc-400 mb-2">配置您的专属单品</h3>
               <p className="text-xs max-w-[200px] mx-auto opacity-60">
                 AI 将为您生成超高分辨率的静物摄影图
               </p>
            </div>
          )}
          
          {step === "generating" && (
            <div className="text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                 <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full animate-spin"></div>
                 <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"></div>
                 <Sparkles className="absolute inset-0 m-auto text-purple-500 animate-pulse w-8 h-8" />
              </div>
              <div>
                <p className="text-purple-400 font-bold animate-pulse text-lg">AI 正在绘制...</p>
                <p className="text-xs text-zinc-500 mt-2">正在编织面料、调整光影...</p>
              </div>
            </div>
          )}

          {step === "result" && generatedImage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-full h-full group"
            >
              <img 
                src={generatedImage} 
                className="w-full h-full object-cover"
                alt="Generated"
              />
              {/* 悬停提示 */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-8">
                 <p className="text-white text-xs font-medium">预览效果</p>
              </div>
            </motion.div>
          )}

          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-600 to-transparent opacity-50" />
        </div>

        {/* 右侧：控制区 */}
        <div className="w-full md:w-7/12 flex flex-col bg-zinc-900/50">
          
          {/* Header */}
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" /> 虚拟设计师
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">Custom AI Fashion Generator</p>
            </div>
            {/* 只有在非生成状态下才允许直接关闭 */}
            {step !== "generating" && (
                <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400"/>
                </button>
            )}
          </div>

          {step === "result" ? (
             <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mx-auto">
                       <Check className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">生成完毕！</h3>
                      <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                        这件 <span className="text-white font-bold">{color}{subCat}</span> 已暂时存入衣橱。
                        <br/>如果不满意，可以立即重新生成。
                      </p>
                    </div>
                </div>

                <div className="flex flex-col w-full gap-3 max-w-sm">
                   <button 
                     onClick={handleFinish}
                     className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                   >
                     <Save className="w-4 h-4" />
                     满意，保留并关闭
                   </button>
                   
                   <button 
                     onClick={handleRegenerate}
                     className="w-full py-3.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2 group"
                   >
                     <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                     不满意？重新生成
                   </button>
                </div>
                
                <p className="text-[10px] text-zinc-600">
                    点击“重新生成”将自动删除当前图片并创建新方案
                </p>
             </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex px-6 pt-4 gap-6 border-b border-zinc-800/50">
                <button 
                  onClick={() => setActiveTab("basic")}
                  className={cn(
                    "pb-3 text-sm font-medium transition-all relative",
                    activeTab === "basic" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  基础信息
                  {activeTab === "basic" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500" />}
                </button>
                <button 
                  onClick={() => setActiveTab("detail")}
                  className={cn(
                    "pb-3 text-sm font-medium transition-all relative",
                    activeTab === "detail" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  细节与风格
                  {activeTab === "detail" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500" />}
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {activeTab === "basic" && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    {/* 1. 性别与品类 */}
                    <div className="space-y-3">
                      <Label icon={<Shirt className="w-3.5 h-3.5" />} text="品类选择" />
                      <div className="flex gap-3">
                        <select 
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-24 bg-zinc-950 border border-zinc-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-sm"
                        >
                          {OPTIONS.genders.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select 
                          value={mainCat}
                          onChange={(e) => handleMainCatChange(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-sm"
                        >
                          {Object.keys(OPTIONS.categories).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <select 
                         value={subCat}
                         onChange={(e) => setSubCat(e.target.value)}
                         className="w-full bg-zinc-950 border border-zinc-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-sm"
                       >
                          {OPTIONS.categories[mainCat].map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>

                    {/* 2. 颜色 */}
                    <div className="space-y-3">
                       <Label icon={<Palette className="w-3.5 h-3.5" />} text="主色系" />
                       <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                          {OPTIONS.colors.map(c => (
                            <ColorButton key={c} label={c} active={color === c} onClick={() => setColor(c)} />
                          ))}
                       </div>
                    </div>

                    {/* 3. 季节 */}
                    <div className="space-y-3">
                       <Label icon={<Sparkles className="w-3.5 h-3.5" />} text="适用季节" />
                       <div className="grid grid-cols-4 gap-2">
                          {OPTIONS.seasons.map(s => (
                            <OptionButton key={s} label={s} active={season === s} onClick={() => setSeason(s)} />
                          ))}
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "detail" && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    {/* 4. 材质 */}
                    <div className="space-y-3">
                       <Label icon={<Scissors className="w-3.5 h-3.5" />} text="材质成分" />
                       <div className="flex flex-wrap gap-2">
                          {OPTIONS.materials.map(m => (
                            <OptionButton key={m} label={m} active={material === m} onClick={() => setMaterial(m)} size="sm" />
                          ))}
                       </div>
                    </div>

                    {/* 5. 风格 */}
                    <div className="space-y-3">
                       <Label icon={<Tag className="w-3.5 h-3.5" />} text="风格标签" />
                       <div className="flex flex-wrap gap-2">
                          {OPTIONS.styles.map(s => (
                            <OptionButton key={s} label={s} active={style === s} onClick={() => setStyle(s)} size="sm" />
                          ))}
                       </div>
                    </div>

                    {/* 6. 版型与图案 */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-3">
                          <Label text="版型" />
                          <select 
                            value={fit}
                            onChange={(e) => setFit(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-sm"
                          >
                             {OPTIONS.fits.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                       </div>
                       <div className="space-y-3">
                          <Label text="图案/花色" />
                          <select 
                            value={pattern}
                            onChange={(e) => setPattern(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2.5 rounded-lg text-white outline-none focus:border-purple-500 text-sm"
                          >
                             {OPTIONS.patterns.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                       </div>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900">
                <LiquidButton 
                   disabled={step === "generating"}
                   onClick={handleGenerateAndSave}
                   className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold h-12 shadow-lg shadow-purple-900/20"
                >
                   {step === "generating" ? (
                     <span className="flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin" /> AI 正在绘制...
                     </span>
                   ) : "生成并入库"}
                </LiquidButton>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// --- UI Components ---

function Label({ icon, text }: { icon?: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
      {icon}
      <span>{text}</span>
    </div>
  )
}

function OptionButton({ label, active, onClick, size = "md" }: { label: string, active: boolean, onClick: () => void, size?: "sm" | "md" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border transition-all truncate hover:bg-zinc-800",
        size === "sm" ? "px-3 py-1.5 text-xs" : "py-2.5 text-xs",
        active 
          ? "bg-white text-black border-white font-bold hover:bg-white ring-2 ring-white/20" 
          : "bg-zinc-900 text-zinc-400 border-zinc-800"
      )}
    >
      {label}
    </button>
  )
}

function ColorButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
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
        "flex items-center gap-2 px-2 py-2 rounded-lg border transition-all text-xs",
        active 
          ? "bg-zinc-800 border-purple-500 text-white" 
          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
      )}
    >
      <div 
        className="w-3 h-3 rounded-full border border-black/10 shadow-sm flex-shrink-0"
        style={{ background: bgStyle }}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}