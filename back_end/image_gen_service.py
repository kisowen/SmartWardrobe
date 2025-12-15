# image_gen_service.py
import httpx
import logging

logger = logging.getLogger("SmartWardrobe.GenAI")

SILICONFLOW_API_KEY = ""
API_URL = "https://api.siliconflow.cn/v1/images/generations"

def build_fashion_prompt(outfit_items: dict, user_profile: dict, weather_ctx: dict) -> str:
    """
    核心逻辑：将结构化数据转换为 Kolors 的绘画提示词
    """
    # 1. 人物画像 (Subject)
    gender = user_profile.get("gender", "man")  # e.g., "man", "woman"
    style = user_profile.get("style", "casual") # e.g., "casual", "business"
    subject = f"A full body shot of a stylish {gender}, {style} fashion style, fitting model pose, looking at camera"

    # 2. 服装描述 (Outfit Details)
    # 从推荐结果中提取属性
    top = outfit_items.get("top")
    bottom = outfit_items.get("bottom")
    outer = outfit_items.get("outer")

    clothing_desc = []
    
    # 上装描述
    if top:
        top_desc = f"{top.main_color} {top.category_sub}"
        if top.materials:
            top_desc += f", made of {top.materials[0]}" # 加材质增加真实感
        clothing_desc.append(f"wearing a {top_desc}")

    # 下装描述
    if bottom:
        bottom_desc = f"{bottom.main_color} {bottom.category_sub}"
        clothing_desc.append(f"wearing {bottom_desc}")

    # 外套描述
    if outer:
        outer_desc = f"{outer.main_color} {outer.category_sub}"
        clothing_desc.append(f"wearing a {outer_desc} over the top")

    outfit_str = ", ".join(clothing_desc)

    # 3. 环境与天气 (Environment & Weather)
    # 将天气状况翻译成背景描述
    skycon = weather_ctx.get("current", {}).get("skycon", "CLEAR_DAY")
    env_map = {
        "晴": "sunny city street background, bright natural lighting",
        "多云": "cloudy day, soft lighting, modern architecture background",
        "阴": "overcast day, soft diffused light, urban street",
        "小雨": "rainy day, wet street ground, holding a transparent umbrella, cinematic rain atmosphere",
        "大雨": "heavy rain, holding an umbrella, street lights reflection on wet ground",
        "雪": "snowy winter street, soft snow falling, cold atmosphere",
        "大风": "windy day, hair slightly blowing in wind, dynamic atmosphere"
    }
    # 模糊匹配 skycon
    environment = "clean studio background" # 默认
    for key, val in env_map.items():
        if key in skycon:
            environment = val
            break
            
    # 4. 组合最终 Prompt
    full_prompt = (
        f"High quality, photorealistic, 8k resolution, masterpiece. "
        f"{subject}. "
        f"{outfit_str}. "
        f"{environment}. "
        f"Detailed fabric texture, perfect face, cinematic lighting."
    )
    
    logger.info(f"Generated Prompt: {full_prompt}")
    return full_prompt

async def generate_outfit_image(outfit_items: dict, user_profile: dict, weather_ctx: dict):
    """
    调用 Kolors 生成穿搭效果图
    """
    # 1. 构建提示词
    prompt = build_fashion_prompt(outfit_items, user_profile, weather_ctx)
    
    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 2. 构建请求载荷
    # Kolors 参数调整
    payload = {
        "model": "Kwai-Kolors/Kolors",
        "prompt": prompt,
        "negative_prompt": "ugly, deformed, noisy, blurry, low contrast, text, watermark, face asymmetry, bad hands, missing fingers, extra limbs",
        "image_size": "1920x1080",
        "batch_size": 1,
        "num_inference_steps": 35,
        "guidance_scale": 5.0 
    }
    
    logger.info("Calling Kolors API...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(API_URL, json=payload, headers=headers)
            
            if resp.status_code != 200:
                logger.error(f"Kolors API Error: {resp.text}")
                return None
                
            result = resp.json()
            image_url = result.get('data', [{}])[0].get('url')
            logger.info("Image generation successful")
            return image_url
            
        except Exception as e:
            logger.error(f"Kolors generation failed: {e}")
            return None
def build_single_item_prompt(attrs: dict) -> str:
    """
    构建单品生成的提示词 (Product Photography)
    """
    category = attrs.get("category_sub", "clothes")
    color = attrs.get("main_color", "")
    material = attrs.get("materials", [""])[0] if attrs.get("materials") else ""
    style = attrs.get("styles", [""])[0] if attrs.get("styles") else ""
    pattern = attrs.get("color_pattern", "")
    
    # 构建描述
    desc = f"{color} {category}"
    if material:
        desc += f", made of {material}"
    if pattern and pattern != "纯色":
        desc += f", with {pattern} pattern"
    
    # 核心 Prompt: 强调专业摄影、纯净背景、高质感
    prompt = (
        f"Professional product photography of a {desc}, {style} style. "
        f"Studio lighting, clean solid background, high resolution, 8k, detailed texture, "
        f"centered composition, fashion magazine style."
    )
    
    return prompt

async def generate_virtual_item_image(attrs: dict):
    """
    生成单品图片并返回 URL
    """
    prompt = build_single_item_prompt(attrs)
    
    # 复用之前的 payload 结构，但可以调整参数以适应静物
    payload = {
        "model": "Kwai-Kolors/Kolors",
        "prompt": prompt,
        "negative_prompt": "human, person, face, hand, body, ugly, deformed, noisy, blurry, low contrast, text, watermark, messy background, mannequin", # 负向词去除人物
        "image_size": "1024x1024",
        "batch_size": 1,
        "num_inference_steps": 30,
        "guidance_scale": 5.0 
    }

    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json"
    }

    logger.info(f"Generating virtual item with prompt: {prompt}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(API_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Kolors API Error: {resp.text}")
                return None
            
            result = resp.json()
            return result.get('data', [{}])[0].get('url')
        except Exception as e:
            logger.error(f"Virtual item generation failed: {e}")
            return None