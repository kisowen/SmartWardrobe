"use client"

import { CATEGORY_HIERARCHY, ATTRIBUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"

// 定义表单数据类型
export interface ClothingFormData {
  category_main: string;
  category_sub: string;
  color_type: string;
  colors: string[];
  status: string;
  seasons: string[];
  material: string;
  thickness: string;
  collar: string;
  closure: string;
  sleeve: string;
}

interface ClothingFormProps {
  formData: ClothingFormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>; // 使用 any 兼容不同页面的完整类型
}

export function ClothingForm({ formData, setFormData }: ClothingFormProps) {
  
  // --- 表单更新逻辑 ---
  const updateField = (field: keyof ClothingFormData, value: any) => {
    setFormData((prev: ClothingFormData) => ({ ...prev, [field]: value }))
  }

  const toggleArrayItem = (field: "colors" | "seasons", value: string) => {
    setFormData((prev: ClothingFormData) => {
      const current = prev[field]
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) }
      } else {
        if (field === "colors") {
           if (prev.color_type === "纯色" && current.length >= 1) return { ...prev, [field]: [value] }
           if (prev.color_type === "单主色" && current.length >= 4) return prev
        }
        return { ...prev, [field]: [...current, value] }
      }
    })
  }
  
  const showTopAttributes = ["上衣", "连体裤"].includes(formData.category_main)

  return (
    <div className="space-y-6">
      {/* --- 基础分类 --- */}
      <Section title="基础分类">
        <div className="grid grid-cols-2 gap-4">
          <SelectGroup 
            label="大类" 
            value={formData.category_main} 
            options={Object.keys(CATEGORY_HIERARCHY)}
            onChange={(val) => {
              setFormData((prev: ClothingFormData) => ({ ...prev, category_main: val, category_sub: "" }))
            }}
          />
          <SelectGroup 
            label="子类" 
            value={formData.category_sub} 
            options={formData.category_main ? CATEGORY_HIERARCHY[formData.category_main] : []}
            onChange={(val) => updateField("category_sub", val)}
          />
        </div>
      </Section>

      {/* --- 颜色 --- */}
      <Section title="颜色信息">
        <div className="mb-3">
          <label className="text-xs text-zinc-500 mb-2 block">类型</label>
          <div className="flex gap-2">
            {ATTRIBUTES.color_types.map(type => (
              <SelectBadge 
                key={type} 
                label={type} 
                selected={formData.color_type === type}
                onClick={() => {
                    setFormData((prev: ClothingFormData) => ({ ...prev, color_type: type, colors: [] }))
                }} 
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-2 block">
            选择颜色 <span className="ml-2 text-zinc-600">({formData.colors.join(", ") || "未选择"})</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ATTRIBUTES.colors.map(color => (
              <SelectBadge 
                key={color} 
                label={color} 
                selected={formData.colors.includes(color)}
                onClick={() => toggleArrayItem("colors", color)} 
              />
            ))}
          </div>
        </div>
      </Section>

      {/* --- 材质与季节 --- */}
      <Section title="材质与季节">
        <div className="grid grid-cols-1 gap-4">
          <SelectGroup 
            label="材质" 
            value={formData.material} 
            options={ATTRIBUTES.materials}
            onChange={(val) => updateField("material", val)}
          />
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">适用季节 (多选)</label>
            <div className="flex gap-2">
              {ATTRIBUTES.seasons.map(season => (
                <SelectBadge 
                  key={season} 
                  label={season} 
                  selected={formData.seasons.includes(season)}
                  onClick={() => toggleArrayItem("seasons", season)} 
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectGroup 
                label="厚度" 
                value={formData.thickness} 
                options={ATTRIBUTES.thickness}
                onChange={(val) => updateField("thickness", val)}
            />
            <SelectGroup 
                label="当前状态" 
                value={formData.status} 
                options={ATTRIBUTES.status}
                onChange={(val) => updateField("status", val)}
            />
          </div>
        </div>
      </Section>

      {/* --- 上衣/连体裤专属属性 --- */}
      {showTopAttributes && (
        <Section title="版型细节">
          <div className="grid grid-cols-2 gap-4">
            <SelectGroup label="领型" value={formData.collar} options={ATTRIBUTES.collars} onChange={(val) => updateField("collar", val)} />
            <SelectGroup label="闭合方式" value={formData.closure} options={ATTRIBUTES.closures} onChange={(val) => updateField("closure", val)} />
            <SelectGroup label="袖长" value={formData.sleeve} options={ATTRIBUTES.sleeves} onChange={(val) => updateField("sleeve", val)} />
          </div>
        </Section>
      )}
    </div>
  )
}


// --- UI 子组件 (保持不变) ---
function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

function SelectGroup({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (val: string) => void }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1.5 block">{label}</label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-black border border-zinc-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-white transition-colors cursor-pointer"
        >
          <option value="" disabled>请选择</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
          <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </div>
  )
}

const SelectBadge = ({ selected, onClick, label }: { selected: boolean, onClick: () => void, label: string }) => (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs transition-all border",
        selected 
          ? "bg-white text-black border-white font-medium" 
          : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500"
      )}
    >
      {label}
    </button>
  )