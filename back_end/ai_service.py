import httpx
import base64
import json
import os
from sentence_transformers import SentenceTransformer
from PIL import Image
import numpy as np
import logging

# 配置日志记录
logger = logging.getLogger("SmartWardrobe.AI")
logger.setLevel(logging.INFO)
# 避免重复添加处理器
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# 模型初始化
try:
    logger.info("Loading CLIP model...")
    clip_model = SentenceTransformer('clip-ViT-B-32')
    logger.info("CLIP model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load CLIP model: {e}")
    clip_model = None

def get_image_embedding(image_path: str):
    """提取图片的视觉向量 (512维)，用于衣物特征匹配"""
    if clip_model is None:
        logger.error("CLIP model is not initialized, cannot extract embedding")
        return None
    
    try:
        # 验证文件路径有效性
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        img = Image.open(image_path)
        # 编码并归一化向量（提升匹配精度）
        embedding = clip_model.encode(img, normalize_embeddings=True)
        return embedding.tolist()  # 转为列表格式，便于数据库存储
    except FileNotFoundError as e:
        logger.error(f"Image processing error: {e}")
        return None
    except Exception as e:
        logger.error(f"Vector extraction failed: {str(e)}")
        return None

# 配置 API 核心参数
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "")
API_URL = "https://api.siliconflow.cn/v1/chat/completions"
MODEL_NAME = "Qwen/Qwen3-VL-235B-A22B-Instruct"
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "") 
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL_NAME = "deepseek-chat"

SYSTEM_PROMPT = """
你是一个专业的时尚穿搭数据录入员，专注于衣物属性的精准提取。你的核心任务是根据输入图片，从给定的标准属性库中选择最匹配的标签，严禁主观创造。

【执行原则】
1. 严格约束：所有属性值必须从【标准值列表】中选择，不得创造新词。
2. 类型规则：材质、季节、风格、场景为数组类型（支持多选），其余属性为字符串或数字（单选）。
3. 层级匹配：只有[上衣]类目需要填充 default_layer，其他大类该字段固定为 null。
4. 量化标准：保暖等级 1=极薄(夏)、2=薄(春秋)、3=中(卫衣/毛衣)、4=厚(大衣)、5=极寒(羽绒)。

【标准值列表】
gender (单选): ["男款", "女款", "中性"]
# 判定逻辑：
# 1. 强特征判定 (优先级最高):
#    - [女款]: 裙装(半身裙/连衣裙)、高跟鞋、玛丽珍鞋、抹胸/吊带、短款露脐(Crop Top)、蕾丝/荷叶边/蝴蝶结装饰、透视材质、女士手提包(Handbag)。
#    - [男款]: 领带/领结、工装裤(粗犷风格)、皮鞋(商务男款)、男士公文包。

# 2. 版型与剪裁判定:
#    - [女款]: 收腰设计、X型剪裁、A字版型、袖口紧缩或花苞袖、领口较大(大U领/大V领)。
#    - [男款]: 宽肩廓形(Boxy fit)、直筒剪裁、传统“左盖右”扣位(若清晰可见)。

# 3. 颜色与图案辅助 (仅作参考):
#    - [女款]: 粉色系/紫色系、碎花/波点图案、亮片/水钻。
#    - [男款]: 军绿/深灰/迷彩(非潮流款)。

# 4. 默认/兜底规则:
#    - [中性]: 基础款T恤、卫衣(无明显收腰)、运动鞋(Sneakers)、帆布袋、棒球帽、牛仔外套、羽绒服(常规款)。
#    - 若无法确定，优先归类为 [中性]。

1. category_main (大类，单选): 
   - [上衣, 裤子, 连体类, 鞋, 包, 帽子, 首饰, 配饰]

2. category_sub (子类，单选 - 请严格对应大类):
   - 上衣: [T恤(长/短), 卫衣(连帽/圆领), 毛衣/针织衫, 衬衫, 吊带/背心, 夹克, 风衣, 大衣, 羽绒服, 西装, 马甲, 皮衣, 冲锋衣, 其他上衣]
   - 裤子: [牛仔裤, 休闲裤, 运动裤, 西装裤, 工装裤, 短裤, 半身裙, 百褶裙, A字裙, 皮裙, 打底裤, 其他下装]
   - 连体类: [连衣裙, 连体裤, 背带裤/裙]
   - 鞋: [运动鞋, 板鞋, 帆布鞋, 皮鞋, 靴子(短/长), 乐福鞋, 凉鞋, 拖鞋, 高跟鞋, 其他鞋类]
   - 包: [单肩包, 双肩包, 手提包, 斜挎包, 胸包/腰包, 帆布袋, 其他包类]
   - 帽子: [鸭舌帽/棒球帽, 渔夫帽, 毛线帽, 贝雷帽, 礼帽, 遮阳帽, 其他帽子]
   - 首饰: [项链, 耳饰, 戒指, 手链/手镯, 胸针, 手表, 其他首饰]
   - 配饰: [围巾, 丝巾, 手套, 腰带/皮带, 墨镜/眼镜, 袜子, 领带, 发饰, 其他配饰]

3. 上衣专属层级 (default_layer，单选):
   - Base(内搭): T恤, 吊带/背心, 衬衫, 打底衫
   - Mid(中层): 卫衣, 毛衣/针织衫, 马甲
   - Outer(外套): 西装, 夹克, 风衣, 大衣, 皮衣
   - Outer_Heavy(厚外套): 冲锋衣, 羽绒服, 棉服
   - Unknown: 非上衣类或无法判断
   - 非 [上衣] 大类请返回 null

4. 气象与物理属性:
   - warmth_level (保暖等级): [1, 2, 3, 4, 5]
   - materials (材质): ["棉", "涤纶/聚酯纤维", "牛仔", "羊毛/羊绒", "真丝/丝绸", "亚麻", "皮质", "羽绒", "针织", "雪纺", "尼龙", "其他"]
   - is_windproof (防风): [True, False]
   - waterproof_level (防水): ["无", "防泼水", "完全防水"]
   - breathability (透气): ["低(闷)", "中", "高(透气)"]
   - collar_type (领型): ["圆领", "V领", "连帽", "翻领", "立领", "高领", "方领", "一字领", "其他", "无"]
   - length_type (衣/裤长): ["短", "中长", "长", "九分", "七分", "超长"]

5. 基础外观:
   - color_pattern: ["纯色", "图案/印花", "格纹/条纹", "拼接/撞色"]
   - main_color: ["黑", "白", "灰", "卡其", "棕", "深蓝", "浅蓝", "红", "粉", "绿", "紫", "黄", "橙", "银", "金", "多色"]
   - fit: ["紧身", "合身", "宽松/Oversize"]
   - status: ["正常"]
   - seasons: ["春", "夏", "秋", "冬"]

6. 风格与场景:
   - styles: ["休闲", "商务", "运动", "街头", "复古", "极简", "优雅", "日系", "工装", "甜酷"]
   - occasions: ["通勤", "居家", "户外", "约会", "正式宴会", "旅行", "运动", "逛街"]

【输出要求】
仅返回纯JSON对象，键名严格匹配上述英文字段。
"""

LAYER_MAPPING = {
    # Base(内搭)
    "T恤(长/短)": "Base",
    "吊带/背心": "Base",
    "衬衫": "Base",
    # Mid(中层)
    "卫衣(连帽/圆领)": "Mid",
    "毛衣/针织衫": "Mid",
    "马甲": "Mid",
    # Outer(外套)
    "西装": "Outer",
    "夹克": "Outer",
    "风衣": "Outer",
    "大衣": "Outer",
    "皮衣": "Outer",
    # Outer_Heavy(厚外套)
    "冲锋衣": "Outer_Heavy",
    "羽绒服": "Outer_Heavy",
    # Unknown
    "其他上衣": "Unknown"
}

async def analyze_clothing_image(image_bytes: bytes):
    """
    调用AI视觉模型分析衣物图片，返回标准化属性数据
    :param image_bytes: 衣物图片的字节流数据
    :return: 包含衣物属性的字典，异常时返回含error字段的字典
    """
    logger.info("Starting clothing image analysis process")
    
    # 1. 基础参数校验
    if "sk-" not in SILICONFLOW_API_KEY:
        logger.error("Invalid API Key: Missing 'sk-' prefix")
        return {"error": "API Key配置错误，需包含'sk-'前缀"}
    
    if not image_bytes:
        logger.error("Empty image data received")
        return {"error": "图片字节流数据为空"}
    
    # 2. 图片编码处理
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        logger.info("Image converted to base64 successfully")
    except Exception as e:
        logger.error(f"Image base64 encoding failed: {str(e)}")
        return {"error": f"图片编码失败: {str(e)}"}
    
    # 3. 构建API请求参数
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user", 
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                    {"type": "text", "text": "请基于提供的标准属性库，全面分析该衣物并返回指定格式的JSON数据，确保所有属性值符合约束要求。"}
                ]
            }
        ],
        "temperature": 0.1,  # 降低随机性，提升结果稳定性
        "max_tokens": 2048,  # 预留足够token空间
        "response_format": {"type": "json_object"}
    }

    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json"
    }

    # 4. 发送API请求并处理响应
    logger.info(f"Sending request to AI model: {MODEL_NAME}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(API_URL, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"API request successful, status code: {response.status_code}")
            
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # 清理可能的格式残留
            content = content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            logger.info("AI response parsed to JSON successfully")
            
            # 5. 数据二次校验与修正
            # 5.1 上衣层级修正
            if data.get("category_main") == "上衣":
                sub_category = data.get("category_sub", "其他上衣")
                data["default_layer"] = LAYER_MAPPING.get(sub_category, "Unknown")
                logger.debug(f"Updated default_layer for top: {data['default_layer']} (sub category: {sub_category})")
            else:
                data["default_layer"] = None
            
            # 5.2 保暖等级类型修正
            if not isinstance(data.get("warmth_level"), int):
                logger.warning(f"Invalid warmth_level type, reset to default. Raw value: {data.get('warmth_level')}")
                data["warmth_level"] = 3  # 默认中厚等级
            
            # 5.3 数组类型属性校验
            array_fields = ["materials", "seasons", "styles", "occasions"]
            for field in array_fields:
                if not isinstance(data.get(field), list):
                    logger.warning(f"Field {field} is not list type, reset to empty list")
                    data[field] = []
            
            logger.info(f"Clothing analysis completed successfully, result: {data}")
            return data
            
        except httpx.HTTPError as e:
            logger.error(f"API request failed: {str(e)}")
            return {"error": f"API请求失败: {str(e)}"}
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {str(e)} | Raw content: {content}")
            return {"error": f"AI返回格式错误，无法解析JSON: {str(e)}"}
        except KeyError as e:
            logger.error(f"Missing key in AI response: {str(e)} | Raw result: {result}")
            return {"error": f"AI返回数据缺失关键字段: {str(e)}"}
        except Exception as e:
            logger.error(f"Clothing analysis process failed: {str(e)}", exc_info=True)
            return {"error": f"分析过程异常: {str(e)}"}

async def generate_outfit_comment(weather_summary, outfit_names):
    """
    调用 DeepSeek API，结合天气情况和穿搭组合，生成幽默风趣且实用的穿搭点评
    :param weather_summary: 天气概况（如"20度雨"、"35度晴"）
    :param outfit_names: 穿搭组合描述（如"上衣:白T, 下装:牛仔裤"）
    :return: 一句话穿搭点评，异常时返回含error字段的字典
    """
    logger.info(f"Generating outfit comment via DeepSeek - Weather: {weather_summary}, Outfit: {outfit_names}")
    
    # 1. 基础校验
    if not weather_summary or not outfit_names:
        logger.error("Weather summary or outfit names is empty")
        return {"error": "天气信息和穿搭信息不能为空"}

    if not DEEPSEEK_API_KEY or "sk-" not in DEEPSEEK_API_KEY:
        logger.error("DeepSeek API Key not found or invalid")
        return {"error": "DeepSeek API Key 未配置"}
    
    # 2. 构建符合 DeepSeek 调性的 Prompt
    system_prompt = """
    你是一个幽默风趣的时尚博主，擅长用轻松的梗来聊穿搭。
    你的说话风格：活泼、有梗、脑洞大开，但绝对不刻薄。
    任务目标：用一句有趣的话点评今日穿搭。
    约束条件：
    1. 结合天气情况，用幽默的方式提醒用户注意（例如：“这种天气穿白色，是想和雨水玩泥巴吗？”）。
    2. 氛围要轻松愉快。
    3. 字数控制在60字以内。
    """

    user_content = f"""
    今日天气：{weather_summary}
    用户穿搭：{outfit_names}
    
    请开始你的点评：
    """
    
    # 3. 构建 API 请求
    payload = {
        "model": DEEPSEEK_MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 1.2,  
        "max_tokens": 100,
        "stream": False
    }
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 4. 发送请求并处理响应
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API Error: {response.text}")
                return {"error": f"DeepSeek 服务异常: {response.status_code}"}

            result = response.json()
            comment = result['choices'][0]['message']['content'].strip()
            
            # 去除可能存在的引号（DeepSeek有时会输出引号）
            comment = comment.strip('"').strip("'")
            
            logger.info(f"DeepSeek comment generated: {comment}")
            return comment

        except httpx.TimeoutException:
            logger.error("DeepSeek API request timed out")
            return {"error": "点评生成超时，DeepSeek 正在思考人生"}
        except Exception as e:
            logger.error(f"Failed to generate outfit comment via DeepSeek: {str(e)}")
            return {"error": f"穿搭点评生成失败: {str(e)}"}