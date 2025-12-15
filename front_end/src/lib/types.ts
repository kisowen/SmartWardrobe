export interface ClothingItem {
  id: number;
  user_id: string;
  image_url: string;
  created_at?: string;
  
  // 核心分类
  category_main: string;
  category_sub: string;
  default_layer?: string | null;
  
  // 属性
  warmth_level: number;
  materials: string[]; // 后端是列表
  is_windproof: boolean;
  waterproof_level: string;
  breathability: string;
  collar_type?: string;
  length_type?: string;
  
  // 外观
  color_pattern: string;
  main_color: string;
  status: string; // "正常" | "清洗中" | "闲置"
  seasons: string[];
  fit: string;
  
  // 风格
  styles: string[];
  occasions: string[];
  gender?: string;
}

// 表单数据类型（允许部分字段为空，方便编辑）
export interface ClothingFormData {
  category_main: string;
  category_sub: string;
  default_layer?: string;
  
  warmth_level: number;
  materials: string[]; // 前端交互时可能是 string[]，也可以是逗号分隔字符串，组件内处理
  is_windproof: boolean;
  waterproof_level: string;
  breathability: string;
  collar_type?: string;
  length_type?: string;
  
  color_pattern: string;
  main_color: string;
  status: string;
  seasons: string[];
  fit: string;
  
  styles: string[];
  occasions: string[];
  
  image_url?: string;
  material?: string; 
  colors?: string[];
  thickness?: string;
  collar?: string;
  closure?: string;
  sleeve?: string;
  color_type?: string;
  gender?: string;
}