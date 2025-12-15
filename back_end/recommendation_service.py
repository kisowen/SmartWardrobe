import numpy as np
from sqlalchemy import and_, or_
import models
import logging
import random
import os
import httpx
from uuid import uuid4
import image_gen_service
import datetime
from models import UserProfile, OutfitHistory, ClothingItem

logger = logging.getLogger("SmartWardrobe.Recommender")

# 确保目录存在
UPLOAD_DIR = "uploads"
VIRTUAL_DIR = os.path.join(UPLOAD_DIR, "virtual")
os.makedirs(VIRTUAL_DIR, exist_ok=True)

class ProfessionalRecommender:
    def __init__(self, db, user_id, weather_ctx, request_data):
        self.db = db
        self.user_id = user_id
        self.weather = weather_ctx
        self.req = request_data
        
        # 获取用户画像 (如果没有则使用默认)
        from models import UserProfile  # 延迟导入避免循环引用
        self.profile = self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not self.profile:
            self.profile = UserProfile(user_id=user_id)  # 默认空配置

        # 1. 结合画像计算体感偏差
        self.user_offset = self._calculate_complex_thermal_offset()
        
        # 2. 加载基于历史反馈的权重字典
        self.history_weights = self._load_history_weights()
        
    def _calculate_complex_thermal_offset(self):
        """ 
        综合 [生理画像] + [历史反馈] + [通勤方式] 计算温度修正
        """
        offset = 0
        
        # A. 生理画像修正 (-2 ~ +2 对应 -4度 ~ +4度)
        offset += (self.profile.thermal_sensitivity or 0) * 2
        
        # B. 通勤方式修正
        current_temp = self.weather["current"]["temp_real"]
        
        # 如果是驾车，且外面很冷，不需要穿那么厚
        if self.profile.commute_method == "驾车" and current_temp < 10:
            offset += 3 
        
        # 如果是骑行，且有风，体感会更冷
        wind_speed = self.weather["current"]["wind_speed"]
        if self.profile.commute_method == "骑行" and wind_speed > 5:
            offset -= 2 

        logger.info(f"用户{self.user_id}温度修正值计算完成: {offset} (生理敏感度:{self.profile.thermal_sensitivity}, 通勤方式:{self.profile.commute_method})")
        return offset
    
    def _load_history_weights(self):
        """
        [核心升级] 简单的在线学习机制
        根据当前气温，查询历史反馈，计算每个单品的偏好权重（含时间衰减）
        """
        current_temp = self.weather["current"]["temp_real"]
        
        # 查询该用户的所有历史记录
        history_records = self.db.query(OutfitHistory).filter(
            OutfitHistory.user_id == self.user_id
        ).all()
        
        weights = {}  # {item_id: score_bonus}
        
        for record in history_records:
            # 计算天数差
            days_diff = (datetime.datetime.now() - record.date).days
            # 衰减因子：每过30天，权重打9折
            decay_factor = 0.9 ** (days_diff / 30) 
            
            # --- 场景 1: 相似天气下的反馈 (气温差异在 ±5 度以内) ---
            if abs(record.weather_temp - current_temp) <= 5:
                # 基础反馈分: 1(喜欢), 0(一般), -1(太冷), -2(太热), -3(不喜欢)
                score = record.feedback_score * 20 * decay_factor
                
                # 累加分数 (因为一件衣服可能被穿多次)
                if record.top_id: 
                    weights[record.top_id] = weights.get(record.top_id, 0) + score
                if record.bottom_id: 
                    weights[record.bottom_id] = weights.get(record.bottom_id, 0) + score
                if record.outer_id: 
                    weights[record.outer_id] = weights.get(record.outer_id, 0) + score
                if record.one_piece_id: 
                    weights[record.one_piece_id] = weights.get(record.one_piece_id, 0) + score

            # --- 场景 2: 修正逻辑 ---
            # 如果上次穿这件衣服觉得"太冷"(-1)，而今天比那天还冷 -> 扣分
            if record.feedback_score == -1 and current_temp <= record.weather_temp:
                 penalty = -50 * decay_factor  # 惩罚也应用时间衰减
                 if record.top_id: 
                     weights[record.top_id] = weights.get(record.top_id, 0) + penalty
                 if record.bottom_id: 
                     weights[record.bottom_id] = weights.get(record.bottom_id, 0) + penalty
                 if record.outer_id: 
                     weights[record.outer_id] = weights.get(record.outer_id, 0) + penalty
                 if record.one_piece_id: 
                     weights[record.one_piece_id] = weights.get(record.one_piece_id, 0) + penalty

            # 如果上次穿这件衣服觉得"太热"(-2)，而今天比那天还热 -> 扣分
            if record.feedback_score == -2 and current_temp >= record.weather_temp:
                 penalty = -50 * decay_factor
                 if record.top_id: 
                     weights[record.top_id] = weights.get(record.top_id, 0) + penalty
                 if record.bottom_id: 
                     weights[record.bottom_id] = weights.get(record.bottom_id, 0) + penalty
                 if record.outer_id: 
                     weights[record.outer_id] = weights.get(record.outer_id, 0) + penalty
                 if record.one_piece_id: 
                     weights[record.one_piece_id] = weights.get(record.one_piece_id, 0) + penalty

        logger.info(f"用户{self.user_id}的历史偏好权重计算完成: {len(weights)} 个物品受到影响")
        return weights

    def _get_target_warmth(self):
        """ 根据天气和体质，计算目标保暖等级范围 """
        # 获取体感温度 + 用户修正
        feels_like = self.weather["current"]["temp_feel"] + self.user_offset
        max_temp = self.weather["today_stat"]["temp_max"]
        
        # 决策逻辑：决定穿多厚
        if feels_like >= 30:
            return (1, 1)  # 极薄
        elif feels_like >= 24:
            return (1, 2)  # 薄
        elif feels_like >= 18:
            return (2, 3)  # 中
        elif feels_like >= 10:
            return (3, 4)  # 厚
        else:
            return (4, 5)  # 极寒

    def _apply_hard_filters(self, query, category):
        """ 应用基于画像的硬过滤规则 """
        
        # 1. 颜色黑名单 (Aesthetic)
        if self.profile.avoid_colors:
            for color in self.profile.avoid_colors:
                query = query.filter(models.ClothingItem.main_color != color)
        
        # 2. 职业场景约束 (Lifestyle)
        is_formal_context = getattr(self.req, "scenario", "") in ["通勤", "正式宴会"]
        
        if self.profile.occupation == "金融/律所/体制内" and is_formal_context:
            # 过滤掉休闲单品
            query = query.filter(models.ClothingItem.category_sub.notin_(["背心/吊带", "短裤", "拖鞋", "凉鞋", "运动裤"]))
            
        # 3. 骑行约束 (Commute)
        if self.profile.commute_method == "骑行":
            if category == "裤子":  # 骑行不便穿长裙
                query = query.filter(models.ClothingItem.category_sub.notin_(["半身裙", "连衣裙", "长裙"]))
                
        return query

    def _get_candidates(self, category, warmth_range, relaxed=False):
        """ 召回层 (Recall): 基于属性硬过滤 """
        min_w, max_w = warmth_range
        
        # 如果开启宽松模式，保暖范围扩大 (上下各扩1级)
        if relaxed:
            min_w = max(1, min_w - 1)
            max_w = min(5, max_w + 1)
            logger.info(f"用户{self.user_id}宽松模式生效，{category}保暖范围调整为: [{min_w}, {max_w}] (原范围: {warmth_range})")

        query = self.db.query(models.ClothingItem).filter(
            models.ClothingItem.user_id == self.user_id,
            models.ClothingItem.category_main == category,
            models.ClothingItem.status == "正常"
        )
        
        # 应用画像硬过滤
        if not relaxed:
            query = self._apply_hard_filters(query, category)
        
        # ===== 新增性别过滤逻辑 =====
        # 获取前端传来的性别 (例如: "男士" 或 "女士")，兼容无gender字段的情况
        user_gender_input = getattr(self.req, "gender", "男士")
        
        # 定义允许的性别分类列表
        allowed_genders = ["中性"]  # 中性是通用的
        
        if "男" in user_gender_input:
            allowed_genders.append("男款")
            # 注意：男士绝对不穿女款
        else:
            allowed_genders.append("女款")
            # 允许女生穿男款 (Oversize风)
            req_style = getattr(self.req, "style", "")
            if relaxed or req_style in ["街头", "运动", "休闲"]:
                allowed_genders.append("男款")
        
        # 应用性别过滤
        query = query.filter(models.ClothingItem.gender.in_(allowed_genders))
        # ===== 性别过滤逻辑结束 =====
        
        # 保暖度过滤 (配饰类可以放宽)
        if category in ["上衣", "裤子"]:
            query = query.filter(models.ClothingItem.warmth_level.between(min_w, max_w))
            
        items = query.all()
        
        # 兜底：如果过滤太狠没衣服了，尝试放宽一级保暖度
        if not items and category in ["上衣", "裤子"] and not relaxed:
            query = self.db.query(models.ClothingItem).filter(
                models.ClothingItem.user_id == self.user_id,
                models.ClothingItem.category_main == category,
                models.ClothingItem.status == "正常",
                models.ClothingItem.gender.in_(allowed_genders),  # 兜底时保留性别过滤
                models.ClothingItem.warmth_level.between(max(1, min_w-1), min(5, max_w+1))
            )
            # 仍然应用硬过滤（例如你是律师，没衣服穿也不能穿拖鞋上班）
            query = self._apply_hard_filters(query, category)
            items = query.all()
            logger.info(f"用户{self.user_id}{category}严格模式兜底召回: {len(items)} 件")
            
        return items

    def _cosine_similarity(self, vec1, vec2):
        if not vec1 or not vec2: return 0.5 
        try:
            v1 = np.array(vec1)
            v2 = np.array(vec2)
            dot = np.dot(v1, v2)
            norm = np.linalg.norm(v1) * np.linalg.norm(v2)
            if norm == 0: return 0
            return dot / norm
        except:
            return 0.5

    def _calc_weather_score(self, item):
        """ 精排层特征: 气象适应性打分 + [新增] 历史偏好修正 """
        score = 80  # 基础分
        signals = self.weather.get("signals", {})
        
        # --- 天气逻辑 ---
        if signals.get("need_umbrella", False):
            if item.waterproof_level == "无" and item.category_main != "上衣": 
                score -= 30
            if item.materials and any(m in ["翻毛皮", "丝绸", "羊毛/羊绒"] for m in item.materials):
                score -= 40 

        if signals.get("need_windbreaker", False):
            if not item.is_windproof: score -= 10
            else: score += 10

        if signals.get("high_humidity", False) and item.breathability == "低(闷)":
            score -= 20
        
        # 1. 出汗倾向
        is_hot_humid = self.weather["current"]["humidity"] > 0.7 or self.weather["current"]["temp_real"] > 25
        if self.profile.sweat_tendency and is_hot_humid:
            if item.breathability == "低(闷)":
                score -= 50 
            if item.materials and any(m in ["涤纶/聚酯纤维", "皮质"] for m in item.materials):
                score -= 20
            if item.materials and any(m in ["棉", "亚麻", "真丝/丝绸"] for m in item.materials):
                score += 10

        # 2. 骑行防风
        if self.profile.commute_method == "骑行":
            if item.is_windproof: score += 20 
            elif self.weather["current"]["wind_speed"] > 5: score -= 15

        # 3. 版型偏好
        if item.fit == self.profile.fit_preference:
            score += 10

        # =================================================
        # 注入历史反馈权重 (Feedback Loop)
        # =================================================
        history_bonus = self.history_weights.get(item.id, 0)
        
        # 限制加分/减分上限，防止过度拟合
        history_bonus = max(-60, min(60, history_bonus))
        
        if history_bonus != 0:
            logger.debug(f"Item {item.id} 获得历史修正分: {history_bonus}")
            
        score += history_bonus

        return score

    def compute_match_score(self, top, bottom):
        """ 搭配模型核心逻辑 """
        # 1. 视觉兼容性
        sim = self._cosine_similarity(top.embedding_vector, bottom.embedding_vector)
        visual_score = (sim + 1) * 50 

        # 2. 风格一致性
        styles_top = set(top.styles or [])
        styles_bottom = set(bottom.styles or [])
        common_styles = styles_top.intersection(styles_bottom)
        style_score = 100 if common_styles else 40
        
        req_style = getattr(self.req, "style", "")
        if req_style in common_styles:
            style_score += 20 

        

        # 3. 规则约束
        rule_penalty = 0
        if top.color_pattern == "拼色/复杂" and bottom.color_pattern == "拼色/复杂":
            rule_penalty += 20
        
            
        final = (visual_score * 0.5) + (style_score * 0.5) - rule_penalty
        return final

    def _select_outer(self, inner_top):
        """ 外套决策逻辑 """
        # 计算体感（含画像修正）
        feels_like = self.weather["current"]["temp_feel"] + self.user_offset
        signals = self.weather.get("signals", {})
        
        # 触发条件：体感低于 18度 或 必须防风/防雨
        needs_coat = feels_like < 18 or signals.get("need_windbreaker", False) or signals.get("temp_diff_alert", False)
        
        if not needs_coat:
            return None
            
        outer_candidates = self.db.query(models.ClothingItem).filter(
            models.ClothingItem.user_id == self.user_id,
            models.ClothingItem.category_main == "上衣",
            or_(models.ClothingItem.default_layer == "Outer", models.ClothingItem.default_layer == "Outer_Heavy"),
            models.ClothingItem.status == "正常"
        )
        
        # 应用硬过滤 + 性别过滤
        outer_candidates = self._apply_hard_filters(outer_candidates, "上衣")
        
        # 外套也需要应用性别过滤
        user_gender_input = getattr(self.req, "gender", "男士")
        allowed_genders = ["中性"]
        if "男" in user_gender_input:
            allowed_genders.append("男款")
        else:
            allowed_genders.append("女款")
            req_style = getattr(self.req, "style", "")
            if req_style in ["街头", "运动", "休闲"]:
                allowed_genders.append("男款")
        outer_candidates = outer_candidates.filter(models.ClothingItem.gender.in_(allowed_genders))
        
        outer_candidates = outer_candidates.all()
        
        if not outer_candidates: return None
        
        best_outer = None
        best_score = -1
        
        for outer in outer_candidates:
            # 基础匹配分 (和内搭)
            score = self._cosine_similarity(inner_top.embedding_vector, outer.embedding_vector)
            
            # 天气/画像适应分
            weather_score = self._calc_weather_score(outer)
            
            # 综合分
            total_score = score * 50 + weather_score * 0.5
            
            if total_score > best_score:
                best_score = total_score
                best_outer = outer
                
        return best_outer

    async def _auto_generate_item(self, category_main, warmth_target, gender_target):
        logger.info(f"正在自动生成缺失单品: {category_main}, 保暖Lv.{warmth_target}, 性别:{gender_target}")
        
        # 1. 智能推断属性 (基于用户画像和天气)
        style = getattr(self.req, "style", "休闲")
        is_cycling = self.profile.commute_method == "骑行"
        
        # 默认属性池（补全缺失字段）
        item_attrs = {
            "user_id": self.user_id,
            "category_main": category_main,
            "category_sub": "其他",  # 兜底
            "main_color": "黑", # 安全色
            "warmth_level": warmth_target,
            "gender": gender_target,
            "status": "未拥有", # 标记为虚拟
            "materials": ["混合材质"],
            "styles": [style],
            "seasons": ["春", "夏", "秋", "冬"],
            "fit": self.profile.fit_preference or "合身",
            "is_windproof": False,
            "waterproof_level": "无",
            "breathability": "中",
            "color_pattern": "纯色",
            "occasions": ["通勤", "休闲"]
        }

        # --- 针对不同品类的生成策略 ---
        if category_main == "上衣":
            item_attrs["warmth_level"] = warmth_target
            if warmth_target >= 4:
                item_attrs["category_sub"] = "大衣" if not is_cycling else "冲锋衣"
                item_attrs["default_layer"] = "Outer"
                item_attrs["breathability"] = "低(闷)"
            else:
                item_attrs["category_sub"] = "卫衣" if style == "运动" else "衬衫"
                item_attrs["default_layer"] = "Mid"
                item_attrs["breathability"] = "高(透气)" if warmth_target <=2 else "中"
            # 骑行优化
            if is_cycling:
                item_attrs["is_windproof"] = True
                item_attrs["materials"] = ["尼龙"] if warmth_target >=3 else ["棉"]
                
        elif category_main == "裤子":
            item_attrs["warmth_level"] = warmth_target
            if is_cycling:
                item_attrs["category_sub"] = "工装裤"
                item_attrs["is_windproof"] = True
                item_attrs["materials"] = ["尼龙"] # 防风材质
            elif style in ["工装", "街头"]:
                item_attrs["category_sub"] = "工装裤"
            elif style == "商务":
                item_attrs["category_sub"] = "西装裤"
            elif style == "运动":
                item_attrs["category_sub"] = "运动裤"
            else:
                item_attrs["category_sub"] = "休闲裤"
                item_attrs["materials"] = ["牛仔"] if warmth_target >=3 else ["棉"]
                
        elif category_main == "连体类":
            item_attrs["category_sub"] = "连衣裙"
            item_attrs["warmth_level"] = warmth_target
            if warmth_target >=3:
                item_attrs["materials"] = ["毛呢"]
                item_attrs["breathability"] = "低(闷)"
            else:
                item_attrs["materials"] = ["棉麻"]
                item_attrs["breathability"] = "高(透气)"
                
        elif category_main == "鞋":
            if style in ["运动", "街头"]: 
                item_attrs["category_sub"] = "运动鞋"
                item_attrs["materials"] = ["网布"] if warmth_target <=2 else ["皮革"]
            elif style in ["商务", "优雅"]: 
                item_attrs["category_sub"] = "皮鞋"
                item_attrs["materials"] = ["真皮"]
            else: 
                item_attrs["category_sub"] = "休闲鞋"
                item_attrs["materials"] = ["帆布"] if warmth_target <=2 else ["牛皮"]
            # 骑行优化
            if is_cycling:
                item_attrs["is_windproof"] = True
                item_attrs["waterproof_level"] = "轻度"
                
        elif category_main == "包":
            if style == "商务": 
                item_attrs["category_sub"] = "公文包"
                item_attrs["materials"] = ["真皮"]
            elif style == "运动": 
                item_attrs["category_sub"] = "腰包"
                item_attrs["materials"] = ["尼龙"]
            else: 
                item_attrs["category_sub"] = "单肩包"
                item_attrs["materials"] = ["帆布"]
            item_attrs["warmth_level"] = 1  # 包无保暖属性
            
        elif category_main == "帽子":
            item_attrs["category_sub"] = "棒球帽" if style == "运动" else "渔夫帽"
            if warmth_target >=4:
                item_attrs["materials"] = ["羊毛"]
            else:
                item_attrs["materials"] = ["棉质"]
            item_attrs["warmth_level"] = 1  # 帽子保暖属性弱化
            
        elif category_main == "配饰":
            item_attrs["category_sub"] = "围巾" if warmth_target >=4 else "墨镜"
            if warmth_target >=4:
                item_attrs["materials"] = ["羊绒"]
            else:
                item_attrs["materials"] = ["金属"]
            item_attrs["warmth_level"] = 1  # 配饰无核心保暖属性

        # 2. 调用 AI 生成图片 (复用 image_gen_service)
        try:
            img_url = await image_gen_service.generate_virtual_item_image(item_attrs)
            if not img_url: raise Exception("AI 生成返回空 URL")
            
            # 3. 下载并保存图片
            filename = f"auto_{uuid4().hex}.jpg"
            local_path = os.path.join(VIRTUAL_DIR, filename).replace("\\", "/")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(img_url)
                if resp.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(resp.content)
                else:
                    raise Exception(f"图片下载失败，状态码: {resp.status_code}")
            
            item_attrs["image_url"] = local_path
            
        except Exception as e:
            logger.error(f"自动生成图片失败: {e}，使用默认图")
            item_attrs["image_url"] = "uploads/default_virtual.jpg"

        # 4. 存入数据库
        db_item = models.ClothingItem(**item_attrs)
        self.db.add(db_item)
        self.db.commit()
        self.db.refresh(db_item)
        
        return db_item

    async def recommend(self):
        """ 主推荐流程 (全品类支持 + 自动生成机制) """
        warmth_range = self._get_target_warmth()
        target_warmth = max(warmth_range[0], min(warmth_range[1], 4))
        
        # 处理性别逻辑
        gender_req = getattr(self.req, "gender", "中性")
        target_gender = "男款" if "男" in gender_req else ("女款" if "女" in gender_req else "中性")
        
        # 获取用户想要搭配的品类列表 (默认上衣+裤子)
        target_categories = list(getattr(self.req, "target_categories", ["上衣", "裤子"]))  # 转为 list 以便修改（remove操作）
        
        # 互斥逻辑：如果选了连体类，就不要上衣和裤子了
        if "连体类" in target_categories:
            if "上衣" in target_categories: target_categories.remove("上衣")
            if "裤子" in target_categories: target_categories.remove("裤子")

        final_outfit = {}
        auto_gen_log = []
        total_score = 0

        # --- 循环处理每一个目标品类 ---
        for cat in target_categories:
            # 1. 尝试召回 (Relaxed 模式)
            candidates = self._get_candidates(cat, warmth_range, relaxed=True)
            
            # 特殊处理上衣层级，避免把外套当内搭
            if cat == "上衣":
                candidates = [t for t in candidates if t.default_layer in ["Base", "Mid", "Unknown", None]]

            selected_item = None
            
            # 2. 如果没找到 -> 自动生成
            if not candidates:
                logger.info(f"❌ 缺少 {cat}，正在调用 AI 自动生成...")
                selected_item = await self._auto_generate_item(cat, target_warmth, target_gender)
                auto_gen_log.append(cat)
                total_score += 80  # 自动生成的基础分
            else:
                # 3. 如果找到了 -> 简单打分选最好的 (贪心算法)
                current_style = getattr(self.req, "style", None)
                # 优先匹配风格，再按天气适配度排序
                candidates.sort(
                    key=lambda x: (
                        1 if current_style in (x.styles or []) else 0,
                        self._calc_weather_score(x)
                    ), 
                    reverse=True
                )
                selected_item = candidates[0]
                total_score += self._calc_weather_score(selected_item) # 累加天气适配分

            # 放入结果集 (适配前端key映射)
            key_map = {
                "上衣": "top", 
                "裤子": "bottom", 
                "连体类": "one_piece", 
                "鞋": "shoes", 
                "包": "bag",
                "帽子": "hat",
                "配饰": "accessory"
            }
            json_key = key_map.get(cat, cat) # 兼容未映射的品类
            final_outfit[json_key] = selected_item

        # 4. 外套补充
        if "top" in final_outfit:
            outer = self._select_outer(final_outfit["top"])
            if outer:
                final_outfit["outer"] = outer
                total_score += self._calc_weather_score(outer)

        # 5. 最终检查：无有效搭配返回错误
        if not final_outfit:
            return {
                "error": "无法生成有效搭配，请检查目标品类配置或录入更多衣物"
            }

        # 6. 构造返回结构
        weather_desc = self.weather.get("summary_text", "")
        reasoning = f"基于今天{weather_desc}的天气推荐。"
        if auto_gen_log:
            reasoning += f" 另外，为了完美搭配，AI 为您全新设计了：{'、'.join(auto_gen_log)}。"
        
        # 补充用户画像相关的推荐理由
        if self.profile.thermal_sensitivity < 0:
            reasoning += " 考虑到您较怕冷，已加强保暖配置。"
        if self.profile.commute_method == "骑行":
            reasoning += " 为骑行通勤优化了防风防水性能。"

        return {
            "outfit_items": final_outfit,
            "score": int(total_score / len(target_categories)) if target_categories else 0,
            "weather_summary": weather_desc,
            "reasoning": reasoning,
            "weather_context": self.weather,
            "auto_generated": auto_gen_log
        }