import io
import cv2
import torch
import numpy as np
import logging
import torch.nn as nn
from PIL import Image
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation
import colorsys

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ClothingSegmenter:
    # Segformer B2 Clothes 模型标签映射
    # 0:Background, 1:Hat, 2:Hair, 3:Sunglasses, 4:Upper-clothes, 5:Skirt, 
    # 6:Pants, 7:Dress, 8:Belt, 9:Left-shoe, 10:Right-shoe, 11:Face, 
    # 12:Left-leg, 13:Right-leg, 14:Left-arm, 15:Right-arm, 16:Bag, 17:Scarf
    
    # 定义身体部位标签（需要反向遮罩去除的区域）
    BODY_LABELS = {2, 11, 12, 13, 14, 15} 

    def __init__(self, model_name="mattmdjaga/segformer_b2_clothes"):
        self.device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        logger.info(f"正在初始化衣物分割服务，使用设备: {self.device}")
        
        try:
            # 直接通过 from_pretrained 加载处理器（自动处理配置）
            self.processor = SegformerImageProcessor.from_pretrained(
                model_name,
                use_fast=True,
                reduce_labels=False
            )
            
            # 加载分割模型并移至指定设备
            self.model = AutoModelForSemanticSegmentation.from_pretrained(model_name)
            self.model.to(self.device)
            self.model.eval()  # 切换到评估模式
            logger.info("模型加载完成")
        except Exception as e:
            logger.error(f"模型加载失败: {e}", exc_info=True)
            raise

    @staticmethod
    def apply_clahe(img_np):
        """
        使用 CLAHE 增强图像对比度
        流程: RGB -> LAB -> 限制对比度直方图均衡化(L通道) -> RGB
        """
        try:
            # 增加维度检查，避免非3通道图像报错
            if len(img_np.shape) != 3 or img_np.shape[2] != 3:
                logger.warning("CLAHE 增强失败：图像不是3通道RGB格式")
                return img_np
                
            lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            
            merged = cv2.merge((cl, a, b))
            return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        except Exception as e:
            logger.warning(f"CLAHE 增强失败，返回原图: {e}")
            return img_np

    def get_segmentation_map(self, pred_seg, width, height):
        """生成可视化的分割掩码调试图"""
        # 定义简单的颜色表 (R, G, B)
        color_map = {
            0: [0, 0, 0],       # 背景
            4: [255, 0, 0],     # 上衣(红)
            5: [0, 255, 255],   # 裙子(青)
            6: [0, 255, 0],     # 裤子(绿)
            7: [0, 0, 255],     # 连衣裙(蓝)
            11: [255, 255, 0],  # 脸(黄)
        }
        
        seg_img = np.zeros((height, width, 3), dtype=np.uint8)
        
        # 向量化操作提升效率
        for label_id in np.unique(pred_seg):
            color = color_map.get(label_id, [128, 128, 128])  # 未定义颜色为灰色
            mask = (pred_seg == label_id)
            seg_img[mask] = color
            
        return seg_img

    def _process_single_category(self, img_np, pred_seg, category_labels, padding=30):
        """处理单个类别的抠图逻辑 (优化版：去噪点 + 面积过滤)"""
        h, w = img_np.shape[:2]
        total_area = h * w
        
        # 1. 创建目标 Mask
        mask = np.isin(pred_seg, category_labels).astype(np.uint8) * 255
        
        # 2. 去除身体部位 (Anti-Body)
        unique_labels = np.unique(pred_seg)
        if any(l in self.BODY_LABELS for l in unique_labels):
            anti_mask = np.isin(pred_seg, list(self.BODY_LABELS)).astype(np.uint8) * 255
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            anti_mask = cv2.dilate(anti_mask, kernel, iterations=2)
            mask = cv2.subtract(mask, anti_mask)

        # 3. 形态学闭运算---
        # 针对 "包" 这种容易被切碎的物体，先膨胀再腐蚀，把碎块连起来
        kernel_close = np.ones((15, 15), np.uint8) 
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
        
        # 开运算去除微小噪点
        kernel_open = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)

        # 4. --- 面积过滤 ---
        # 计算 Mask 的非零像素数量
        valid_pixels = cv2.countNonZero(mask)
        # 阈值：如果切出来的东西小于原图的 1%，视为误判噪点，直接丢弃
        # (例如截图里的 帽子、下装 都是这种情况)
        if valid_pixels < (total_area * 0.01):
            logger.info(f"忽略过小区域 (占比 {valid_pixels/total_area:.4f})")
            return None

        # 5. 高斯模糊平滑边缘
        mask = cv2.GaussianBlur(mask, (5, 5), 0)

        # 6. 裁剪
        y_indices, x_indices = np.where(mask > 0)
        if len(y_indices) == 0:
            return None

        y1, y2 = np.min(y_indices), np.max(y_indices)
        x1, x2 = np.min(x_indices), np.max(x_indices)
        
        crop_x1 = max(0, x1 - padding)
        crop_y1 = max(0, y1 - padding)
        crop_x2 = min(w, x2 + padding)
        crop_y2 = min(h, y2 + padding)
        
        roi_img = img_np[crop_y1:crop_y2, crop_x1:crop_x2]
        roi_mask = mask[crop_y1:crop_y2, crop_x1:crop_x2]
        
        try:
            rgba_data = np.dstack((roi_img, roi_mask))
            return rgba_data
        except Exception as e:
            logger.warning(f"RGBA 组合失败: {e}")
            return None

    def segment_and_crop(self, image_bytes: bytes, custom_category_map=None) -> dict:
        """
        主处理函数
        :param image_bytes: 图片字节流
        :param custom_category_map: 可选的自定义类别映射字典
        """
        results = {}
        try:
            # 1. 读取与预处理
            img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # 限制最大尺寸以保证推理速度
            if max(img_pil.size) > 1500:
                img_pil.thumbnail((1500, 1500), Image.Resampling.LANCZOS)
            
            img_np_orig = np.array(img_pil)
            
            # 应用 CLAHE 增强
            img_np_enhanced = self.apply_clahe(img_np_orig)
            img_pil_enhanced = Image.fromarray(img_np_enhanced)

            # 2. 模型推理
            inputs = self.processor(images=img_pil_enhanced, return_tensors="pt").to(self.device)
            with torch.no_grad():  # 禁用梯度计算，节省显存
                outputs = self.model(**inputs)
            
            # 插值还原分辨率
            logits = outputs.logits
            upsampled_logits = nn.functional.interpolate(
                logits, 
                size=img_pil.size[::-1],  # (height, width)
                mode="bilinear", 
                align_corners=False
            )
            pred_seg = upsampled_logits.argmax(dim=1)[0].cpu().numpy().astype(np.uint8)

            logger.info(f"检测到的标签 ID: {np.unique(pred_seg)}")

            # 3. 生成调试图
            debug_map = self.get_segmentation_map(pred_seg, img_pil.width, img_pil.height)
            debug_pil = Image.fromarray(debug_map)
            buf_debug = io.BytesIO()
            debug_pil.save(buf_debug, format="PNG")
            results["debug_map"] = buf_debug.getvalue()

            # 4. 定义提取规则
            categories = custom_category_map or {
                "upper": [4, 7],      # 4:Upper, 7:Dress
                "lower": [5, 6],      # 5:Skirt, 6:Pants
                "shoes": [9, 10],     # 9:Left-shoe, 10:Right-shoe
                "dress": [7],         # 单独提取连衣裙
                "bag": [16],  
                "hat": [1], 
                "accessory": [3, 8, 17] 
            }

            # 5. 循环提取
            for cat_name, labels in categories.items():
                rgba_data = self._process_single_category(img_np_orig, pred_seg, labels)
                
                if rgba_data is not None:
                    # 转换为 PIL RGBA 图像
                    final_pil = Image.fromarray(rgba_data, mode="RGBA")
                    final_pil.thumbnail((800, 800), Image.Resampling.LANCZOS)
                    
                    # 保存为 PNG 字节流
                    buf = io.BytesIO()
                    final_pil.save(buf, format="PNG", optimize=True)  # 开启优化减小体积
                    results[cat_name] = buf.getvalue()
                    logger.info(f"成功提取分类: {cat_name}")
            
            return results

        except Exception as e:
            logger.error(f"图像处理严重错误: {e}", exc_info=True)
            return {}

class ColorHarmonyAnalyzer:
    """色彩分析工具类"""
    
    @staticmethod
    def rgb_to_hsv_standardized(rgb_tuple):
        """将 RGB (0-255) 转换为标准化 HSV (H:0-360, S:0-1, V:0-1)"""
        r, g, b = [x/255.0 for x in rgb_tuple]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        return h * 360, s, v

    @staticmethod
    def calculate_score(rgb1, rgb2):
        """
        计算两个 RGB 颜色的和谐度
        :param rgb1: tuple (r, g, b)
        :param rgb2: tuple (r, g, b)
        :return: score (0-100), description
        """
        h1, s1, v1 = ColorHarmonyAnalyzer.rgb_to_hsv_standardized(rgb1)
        h2, s2, v2 = ColorHarmonyAnalyzer.rgb_to_hsv_standardized(rgb2)
        
        # 计算色相环上的最短距离
        diff_h = abs(h1 - h2)
        if diff_h > 180:
            diff_h = 360 - diff_h
            
        # 1. 无彩色逻辑 (黑白灰)
        is_neutral_1 = s1 < 0.15 or v1 < 0.15 or (v1 > 0.9 and s1 < 0.1)
        is_neutral_2 = s2 < 0.15 or v2 < 0.15 or (v2 > 0.9 and s2 < 0.1)
        
        if is_neutral_1 or is_neutral_2:
            return 85, "百搭基础色"
            
        # 2. 同色系 (色相差 < 15)
        if diff_h < 15:
            return 90, "同色系高级感"
            
        # 3. 邻近色 (15 < 色相差 < 45)
        if 15 <= diff_h < 45:
            return 80, "邻近色柔和"
            
        # 4. 互补色/撞色 (150 < 色相差 < 210)
        if 150 < diff_h < 210:
            return 95, "吸睛撞色"
        
        # 5. 对比色 (110 < 色相差 < 150)
        if 110 < diff_h <= 150:
            return 75, "对比强烈"

        return 50, "常规搭配"

# 全局初始化实例
_segmenter_instance = None

def get_segmenter():
    global _segmenter_instance
    if _segmenter_instance is None:
        try:
            _segmenter_instance = ClothingSegmenter()
        except Exception as e:
            logger.error(f"全局分割器初始化失败: {e}", exc_info=True)
            raise
    return _segmenter_instance

# 提供给 main.py 调用的顶层函数
def remove_background_and_crop(image_bytes: bytes):
    """
    main.py 调用的包装函数
    """
    try:
        segmenter = get_segmenter()
        return segmenter.segment_and_crop(image_bytes)
    except Exception as e:
        logger.error(f"抠图接口调用失败: {e}", exc_info=True)
        return {}