import httpx
import re
from datetime import datetime

CAIYUN_TOKEN = "" 
BASE_URL = "https://api.caiyunapp.com/v2.6"

SKYCON_MAP = {
    "CLEAR_DAY": "晴", "CLEAR_NIGHT": "晴",
    "PARTLY_CLOUDY_DAY": "多云", "PARTLY_CLOUDY_NIGHT": "多云",
    "CLOUDY": "阴",
    "LIGHT_HAZE": "轻度雾霾", "MODERATE_HAZE": "中度雾霾", "HEAVY_HAZE": "重度雾霾",
    "LIGHT_RAIN": "小雨", "MODERATE_RAIN": "中雨", "HEAVY_RAIN": "大雨", "STORM_RAIN": "暴雨",
    "FOG": "雾", "LIGHT_SNOW": "小雪", "MODERATE_SNOW": "中雪", "HEAVY_SNOW": "大雪",
    "STORM_SNOW": "暴雪", "DUST": "浮尘", "SAND": "沙尘", "WIND": "大风"
}

def translate_skycon(skycon_code):
    return SKYCON_MAP.get(skycon_code, skycon_code)

async def resolve_coordinates(input_str: str):
    """
    智能解析地址：地名 -> 经纬度
    """
    if re.match(r'^-?\d+(\.\d+)?,-?\d+(\.\d+)?$', input_str):
        return input_str

    search_url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": "SmartWardrobe/1.0"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(search_url, params={"q": input_str, "format": "json", "limit": 1}, headers=headers)
            data = resp.json()
            if data and len(data) > 0:
                return f"{data[0]['lon']},{data[0]['lat']}"
            else:
                return None
        except Exception as e:
            print(f"地址解析失败: {e}")
            return None

async def get_weather_info(location_input: str = "厦门"):
    coords = await resolve_coordinates(location_input)
    if not coords:
        return {"error": f"无法识别该地址: {location_input}"}

    url = f"{BASE_URL}/{CAIYUN_TOKEN}/{coords}/weather.json"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params={"alert": "true", "dailysteps": "3", "hourlysteps": "24"})
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("status") != "ok":
                return {"error": f"API Error: {data.get('error')}"}

            result = data.get("result", {})
            realtime = result.get("realtime", {})
            hourly = result.get("hourly", {})
            daily = result.get("daily", {}) 

            def to_float(val, default=0.0):
                try:
                    if val is None: return default
                    return float(val)
                except (ValueError, TypeError):
                    return default

            # 1. 实时数据
            current_data = {
                "temp_real": to_float(realtime.get("temperature")),
                "temp_feel": to_float(realtime.get("apparent_temperature")),
                "humidity": to_float(realtime.get("humidity")),
                "skycon": translate_skycon(realtime.get("skycon")), 
                "wind_speed": to_float(realtime.get("wind", {}).get("speed")),
                "uv_index": to_float(realtime.get("life_index", {}).get("ultraviolet", {}).get("index")),
                "aqi": to_float(realtime.get("air_quality", {}).get("aqi", {}).get("chn")),
            }

            # 2. 当日详情
            today_daily = {
                "temp_max": to_float(daily.get("temperature", [])[0].get("max")),
                "temp_min": to_float(daily.get("temperature", [])[0].get("min")),
                "rain_prob": to_float(daily.get("precipitation", [])[0].get("probability")), 
                "wind_max": to_float(daily.get("wind", [])[0].get("max", {}).get("speed")),  
                "uv_max": to_float(daily.get("life_index", {}).get("ultraviolet", [])[0].get("index")), 
                "comfort_index": to_float(daily.get("life_index", {}).get("comfort", [])[0].get("index")), 
                "sunrise": daily.get("astro", [])[0].get("sunrise"),
                "sunset": daily.get("astro", [])[0].get("sunset"),
            }

            # 3. 小时级趋势
            hourly_trend = []
            h_temps = hourly.get("temperature", [])
            h_skycons = hourly.get("skycon", [])
            for i in range(min(len(h_temps), 12)):
                hourly_trend.append({
                    "time": h_temps[i].get("datetime")[11:16], 
                    "temp": to_float(h_temps[i].get("value")),
                    "cond": translate_skycon(h_skycons[i].get("value"))
                })

            # --- 4. 未来多天预报 (Daily Forecast) ---
            daily_forecast = []
            d_temps = daily.get("temperature", [])
            d_skycons = daily.get("skycon", [])
            
            # 遍历 API 返回的所有天数
            count = min(len(d_temps), len(d_skycons))
            for i in range(count):
                daily_forecast.append({
                    "date": d_temps[i].get("date"), # "2023-12-14"
                    "min_temp": to_float(d_temps[i].get("min")),
                    "max_temp": to_float(d_temps[i].get("max")),
                    "condition": translate_skycon(d_skycons[i].get("value"))
                })

            # 5. 特征工程
            wind_tag = False
            if today_daily["wind_max"] > 20: wind_tag = True
            
            water_tag = "无"
            prob = today_daily["rain_prob"]
            if prob >= 80: water_tag = "完全防水" 
            elif prob >= 30: water_tag = "防泼水"   
            
            # 构造返回
            final_context = {
                "location": coords,
                "summary_text": result.get("forecast_keypoint", "暂无预报描述"), 
                "current": current_data,
                "today_stat": today_daily,
                "hourly_trend": hourly_trend,
                "daily_forecast": daily_forecast,
                
                "signals": {
                    "need_umbrella": prob >= 30,
                    "need_windbreaker": wind_tag,
                    "need_sun_protection": today_daily["uv_max"] >= 5,
                    "high_humidity": current_data["humidity"] > 0.7, 
                    "temp_diff_alert": (today_daily["temp_max"] - today_daily["temp_min"]) > 10 
                }
            }
            
            return final_context

        except Exception as e:
            print(f"API调用失败详细信息: {e}")
            return {"error": "无法获取天气信息"}