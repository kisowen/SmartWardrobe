"use client"
import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ClothingFormData } from "@/lib/types"
import { Plus, X, AlertCircle } from "lucide-react"

interface ClothingFormProps {
  formData: ClothingFormData
  setFormData: React.Dispatch<React.SetStateAction<ClothingFormData>>
}

const API_BASE_URL = "http://127.0.0.1:8000"
const getUserId = () => localStorage.getItem("user_id") || "test_user"

// --- 静态默认值  ---
const DEFAULT_OPTIONS = {
  main_categories: ["上衣", "裤子", "连体类", "鞋", "包", "帽子", "首饰", "配饰"],
  sub_categories: {
    "上衣": ["T恤(长/短)", "卫衣(连帽/圆领)", "毛衣/针织衫", "衬衫", "吊带/背心", "夹克", "风衣", "大衣", "羽绒服", "西装", "马甲", "皮衣", "冲锋衣", "其他上衣"],
    "裤子": ["牛仔裤", "休闲裤", "运动裤", "西装裤", "工装裤", "短裤", "半身裙", "百褶裙", "A字裙", "皮裙", "打底裤", "其他下装"],
    "连体类": ["连衣裙", "连体裤", "背带裤/裙"],
    "鞋": ["运动鞋", "板鞋", "帆布鞋", "皮鞋", "靴子(短/长)", "乐福鞋", "凉鞋", "拖鞋", "高跟鞋", "其他鞋类"],
    "包": ["单肩包", "双肩包", "手提包", "斜挎包", "胸包/腰包", "帆布袋", "其他包类"],
    "帽子": ["鸭舌帽/棒球帽", "渔夫帽", "毛线帽", "贝雷帽", "礼帽", "遮阳帽", "其他帽子"],
    "首饰": ["项链", "耳饰", "戒指", "手链/手镯", "胸针", "手表", "其他首饰"],
    "配饰": ["围巾", "丝巾", "手套", "腰带/皮带", "墨镜/眼镜", "袜子", "领带", "发饰", "其他配饰"]
  } as Record<string, string[]>,
  
  default_layer: [
    { val: "Base", label: "内搭 (贴身穿)" },
    { val: "Mid", label: "中层 (卫衣/毛衣)" },
    { val: "Outer", label: "常规外套" },
    { val: "Outer_Heavy", label: "厚外套 (羽绒/棉服)" }
  ],
  
  warmth_level: [
    { val: 1, label: "1 - 极薄 (夏)" },
    { val: 2, label: "2 - 薄 (春秋)" },
    { val: 3, label: "3 - 中 (卫衣)" },
    { val: 4, label: "4 - 厚 (大衣)" },
    { val: 5, label: "5 - 极寒 (羽绒)" }
  ],
  
  fit: ["紧身", "合身", "宽松/Oversize"],
  materials: ["棉", "涤纶/聚酯纤维", "牛仔", "羊毛/羊绒", "真丝/丝绸", "亚麻", "皮质", "羽绒", "针织", "雪纺", "尼龙"],
  seasons: ["春", "夏", "秋", "冬"],

  styles: ["休闲", "商务", "运动", "街头", "复古", "极简", "优雅", "日系", "工装", "甜酷"],
  occasions: ["通勤", "居家", "户外", "约会", "正式宴会", "旅行", "运动", "逛街"],
  
  color_patterns: ["纯色", "图案/印花", "格纹/条纹", "拼接/撞色"],
  genders: ["男款", "女款", "中性"]
}

// --- 子组件 ---
const EditableTagSection = ({ 
  label, 
  field, 
  options, 
  formData, 
  handleChange 
}: { 
  label: string, 
  field: keyof ClothingFormData, 
  options: string[], 
  formData: ClothingFormData,
  handleChange: (f: keyof ClothingFormData, v: any) => void
}) => {
  const [inputValue, setInputValue] = useState("")
  const currentTags = (formData[field] as string[]) || []
  
  const toggleItem = (item: string) => {
    if (currentTags.includes(item)) {
      handleChange(field, currentTags.filter(i => i !== item))
    } else {
      handleChange(field, [...currentTags, item])
    }
  }

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault()
    const val = inputValue.trim()
    if (val && !currentTags.includes(val)) {
      handleChange(field, [...currentTags, val])
      setInputValue("")
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(tag => (
          <button
            key={tag}
            onClick={() => toggleItem(tag)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs border transition-all select-none",
              currentTags.includes(tag)
                ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            )}
          >
            {tag}
          </button>
        ))}
        
        {/* 显示那些不在 options 列表中（即本次新输入）的标签 */}
        {currentTags.filter(t => !options.includes(t)).map(tag => (
          <button
            key={tag}
            onClick={() => toggleItem(tag)}
            className="px-3 py-1.5 rounded-full text-xs border bg-emerald-900/40 border-emerald-500/50 text-emerald-200 flex items-center gap-1 group"
          >
            {tag}
            <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
          </button>
        ))}

        <div className="flex items-center group focus-within:ring-1 ring-emerald-500/50 rounded-full">
           <input 
             type="text"
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleAdd(e)}
             placeholder="自定义+"
             className="w-16 px-3 py-1.5 rounded-l-full text-xs bg-zinc-950 border border-zinc-700 border-r-0 focus:outline-none text-white placeholder:text-zinc-600 text-center"
           />
           <button onClick={() => handleAdd()} className="px-2 py-1.5 rounded-r-full border border-l-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
             <Plus className="w-3 h-3" />
           </button>
        </div>
      </div>
    </div>
  )
}

export function ClothingForm({ formData, setFormData }: ClothingFormProps) {
  // 状态化 Options
  const [styleOptions, setStyleOptions] = useState(DEFAULT_OPTIONS.styles)
  const [occasionOptions, setOccasionOptions] = useState(DEFAULT_OPTIONS.occasions)

  // 动态获取后端标签 (合并默认值和用户自定义值)
  useEffect(() => {
    const fetchUserTags = async () => {
        try {
            const uid = getUserId()
            const res = await fetch(`${API_BASE_URL}/user/tags?user_id=${uid}`)
            if (res.ok) {
                const data = await res.json()
                // 合并并去重 (Set)
                const mergedStyles = Array.from(new Set([...DEFAULT_OPTIONS.styles, ...data.styles]))
                const mergedOccasions = Array.from(new Set([...DEFAULT_OPTIONS.occasions, ...data.occasions]))
                
                setStyleOptions(mergedStyles)
                setOccasionOptions(mergedOccasions)
            }
        } catch (error) {
            console.error("Failed to fetch user tags", error)
        }
    }
    fetchUserTags()
  }, [])

  const handleChange = (field: keyof ClothingFormData, value: any) => {
    if (field === "warmth_level") value = Number(value);
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const currentSubCategories = DEFAULT_OPTIONS.sub_categories[formData.category_main] || []
  const cat = formData.category_main;
  
  const shouldShowWarmth = !["包", "首饰", "配饰"].includes(cat);
  const shouldShowFit = ["上衣", "裤子", "连体类"].includes(cat);
  const shouldShowWindproof = ["上衣", "裤子", "连体类", "帽子"].includes(cat);
  const shouldShowLayer = cat === "上衣";

  return (
    <div className="space-y-8 text-sm pb-8">
      
      {/* 1. 核心分类区域 */}
      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-4">
        <h3 className="text-zinc-100 font-semibold mb-2 flex items-center gap-2">
           <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
           基础信息
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-zinc-400 text-xs">适用性别</label>
            <select 
              value={formData.gender || "中性"}
              onChange={(e) => handleChange("gender", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none transition-colors"
            >
              {DEFAULT_OPTIONS.genders.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 text-xs">大类</label>
            <select 
              value={formData.category_main}
              onChange={(e) => {
                handleChange("category_main", e.target.value)
                handleChange("category_sub", "") 
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none transition-colors"
            >
              <option value="">请选择</option>
              {DEFAULT_OPTIONS.main_categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="space-y-2 col-span-2">
            <label className="text-zinc-400 text-xs">子类</label>
            <select 
              value={formData.category_sub}
              onChange={(e) => handleChange("category_sub", e.target.value)}
              disabled={!formData.category_main}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none disabled:opacity-50 transition-colors"
            >
              <option value="">请选择</option>
              {currentSubCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {shouldShowLayer && (
          <div className="space-y-2 pt-2 animate-in fade-in">
            <label className="text-zinc-400 text-xs flex items-center gap-2">
              穿搭层级 <span className="text-zinc-600 text-[10px]">(影响推荐逻辑)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_OPTIONS.default_layer.map(opt => (
                <button
                  key={opt.val}
                  onClick={() => handleChange("default_layer" as any, opt.val)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs border text-left transition-all",
                    // @ts-ignore
                    formData.default_layer === opt.val
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-100"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  <div className="font-bold">{opt.val}</div>
                  <div className="text-[10px] opacity-70">{opt.label}</div>
                </button>
              ))}
            </div>
            {(!formData.default_layer || formData.default_layer === "Unknown") && (
               <div className="flex items-center gap-2 text-amber-500 text-xs mt-1">
                 <AlertCircle className="w-3 h-3" />
                 <span>请手动指定该上衣属于哪一层，否则无法准确推荐</span>
               </div>
            )}
          </div>
        )}
      </div>

      {/* 2. 物理属性 */}
      {shouldShowWarmth && (
        <div className="space-y-2">
          <label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold flex justify-between">
            保暖等级 (Warmth)
            <span className="text-emerald-400 font-mono font-bold">Lv.{formData.warmth_level}</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {DEFAULT_OPTIONS.warmth_level.map((opt) => (
              <button
                key={opt.val}
                onClick={() => handleChange("warmth_level", opt.val)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 rounded-md border text-xs transition-all",
                  formData.warmth_level === opt.val
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-md"
                    : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                )}
              >
                <span className="text-sm font-bold">{opt.val}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 text-right">
            {DEFAULT_OPTIONS.warmth_level.find(o => o.val === formData.warmth_level)?.label}
          </p>
        </div>
      )}

      {/* 3. 材质与外观 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="col-span-1 md:col-span-2">
            <EditableTagSection 
                label="材质成分" 
                field="materials" 
                options={DEFAULT_OPTIONS.materials} 
                formData={formData} 
                handleChange={handleChange}
            />
         </div>

         <div className="space-y-2">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">主色系</label>
            <input 
                type="text"
                value={formData.main_color}
                onChange={(e) => handleChange("main_color", e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                placeholder="如: 黑/藏青"
            />
         </div>

         <div className="space-y-2">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">花色/图案</label>
            <select 
              value={formData.color_pattern}
              onChange={(e) => handleChange("color_pattern", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
            >
              {DEFAULT_OPTIONS.color_patterns.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {shouldShowFit && (
          <div className="space-y-2">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">版型</label>
            <select 
              value={formData.fit}
              onChange={(e) => handleChange("fit", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
            >
              <option value="">请选择</option>
              {DEFAULT_OPTIONS.fit.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        
        {shouldShowWindproof && (
          <div className="flex items-center gap-3 pt-6">
              <input 
                  type="checkbox"
                  id="windproof"
                  checked={formData.is_windproof}
                  onChange={(e) => handleChange("is_windproof", e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <label htmlFor="windproof" className="text-zinc-300 text-sm cursor-pointer select-none">具备防风功能</label>
          </div>
        )}
      </div>

      <hr className="border-zinc-800" />

      {/* 4. 标签系统 (已连接动态数据) */}
      <div className="space-y-6">
        <EditableTagSection 
            label="适用季节 (多选)" 
            field="seasons" 
            options={DEFAULT_OPTIONS.seasons} 
            formData={formData} 
            handleChange={handleChange}
        />
        
        {/* 使用动态获取的 styleOptions */}
        <EditableTagSection 
            label="风格标签" 
            field="styles" 
            options={styleOptions} 
            formData={formData} 
            handleChange={handleChange}
        />

        {/* 使用动态获取的 occasionOptions */}
        <EditableTagSection 
            label="适用场景" 
            field="occasions" 
            options={occasionOptions} 
            formData={formData} 
            handleChange={handleChange}
        />
      </div>

    </div>
  )
}