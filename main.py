import json
import os
import random
import math
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

# ==========================================
# ⚠️ 여기에 본인의 Gemini API 키를 입력하세요!
# ==========================================
GEMINI_API_KEY = ""

# API 키 설정
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI(title="AI TRPG: Abyss Backend")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 로드
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "world_data.json")

def load_world_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"maps": {}, "mob_groups": {}}

WORLD_DATA = load_world_data()

# 데이터 모델
class PlayerStats(BaseModel):
    courage: int
    wisdom: int
    temperance: int
    justice: int

class MonsterData(BaseModel):
    name: str
    hp: int
    max_hp: int
    atk: int
    stats: Dict[str, int]
    aa_art: Optional[List[str]] = None

class BattleTurnRequest(BaseModel):
    player_stats: PlayerStats
    player_hp: int
    monsters: List[MonsterData]
    action: str = "attack"
    target_idx: int = 0
    custom_input: Optional[str] = None

# AI 묘사 생성 함수
def generate_narrative(context_logs: List[str]):
    if not GEMINI_API_KEY:
        return ["(API 키가 없어 AI 묘사를 건너뜁니다.)"] + context_logs

    try:
        prompt = f"""
        당신은 '다크 판타지 TRPG'의 내레이터입니다.
        아래의 전투 결과 데이터를 바탕으로, 상황을 **짧고 강렬하게(2~3문장)** 묘사하세요.
        수치는 직접 언급하지 말고 행동과 결과 위주로 서술하세요.
        말투는 하십시오체(~했습니다, ~합니다)를 사용하세요.

        [전투 데이터]
        {chr(10).join(context_logs)}
        """
        response = model.generate_content(prompt)
        return [response.text.strip()]
    except Exception as e:
        print(f"AI Error: {e}")
        return ["(AI 연결 중 오류가 발생했습니다.)"] + context_logs

# 데미지 계산 함수
def calculate_damage(attacker_atk, defender_stats, is_player_defending=False):
    justice = defender_stats.get('justice', 1)
    dodge_chance = min(justice * 0.5, 50.0)
    if random.uniform(0, 100) < dodge_chance:
        return 0, "evaded"

    is_critical = random.random() < 0.05
    crit_multiplier = 1.5 if is_critical else 1.0

    def_val = defender_stats.get('courage', 0) * 2
    raw_dmg = (attacker_atk * crit_multiplier) - def_val
    if raw_dmg < 1: raw_dmg = 1

    final_dmg = raw_dmg
    if is_player_defending:
        temperance = defender_stats.get('temperance', 5)
        eff_temp = max(0, temperance - 5)
        reduction = 25 / (25 + eff_temp)
        final_dmg = raw_dmg * reduction

    return math.floor(final_dmg), "critical" if is_critical else "hit"

# API 엔드포인트
@app.get("/")
def health_check():
    return {"status": "ok"}

@app.get("/game/map/{location_id}")
def enter_location(location_id: str):
    if location_id not in WORLD_DATA["maps"]:
        raise HTTPException(status_code=404, detail="Unknown Location")
    
    map_info = WORLD_DATA["maps"][location_id]
    pool = map_info["encounter_pool"]
    mob_group_id = random.choice(pool) if pool else None
    
    monsters = []
    group_info = {}
    
    if mob_group_id and mob_group_id in WORLD_DATA["mob_groups"]:
        group_data = WORLD_DATA["mob_groups"][mob_group_id]
        group_info = {
            "name": group_data["display_name"],
            "desc": group_data["ai_hint"]
        }
        for m_def in group_data["mobs"]:
            monsters.append({
                "name": m_def["name"],
                "hp": m_def["base_hp"],
                "max_hp": m_def["base_hp"],
                "atk": m_def["base_atk"],
                "stats": m_def["stats"],
                "aa_art": m_def.get("aa_art")
            })

    return {
        "location": map_info["name"],
        "description": map_info["description"],
        "monsters": monsters,
        "group_info": group_info
    }

@app.post("/game/battle/turn")
def process_turn(req: BattleTurnRequest):
    # [디버깅] 받은 데이터 출력
    print(f"\n📩 [Request] Action: {req.action}, Custom: {req.custom_input}")

    raw_logs = []
    p_stats = req.player_stats.dict()
    current_p_hp = req.player_hp
    monsters = req.monsters
    
    # -- 플레이어 턴 --
    target = None
    if 0 <= req.target_idx < len(monsters):
        target = monsters[req.target_idx]
    
    if req.action == "attack":
        if target and target.hp > 0:
            p_atk = p_stats['courage'] * 3 + 10 
            dmg, hit_type = calculate_damage(p_atk, target.stats, is_player_defending=False)
            
            if hit_type == "evaded":
                raw_logs.append(f"플레이어 공격 -> {target.name} 회피.")
            else:
                target.hp -= dmg
                crit = " (치명타)" if hit_type == "critical" else ""
                raw_logs.append(f"플레이어 공격 -> {target.name}에게 {dmg} 피해{crit}.")
                if target.hp <= 0:
                    target.hp = 0
                    raw_logs.append(f"{target.name} 사망.")
        else:
            raw_logs.append("플레이어가 허공을 공격.")

    elif req.action == "custom":
        raw_logs.append(f"플레이어 행동: {req.custom_input}")
        raw_logs.append("특별한 효과는 없었으나, 전황이 이어짐.")

    # -- 몬스터 턴 --
    for mob in monsters:
        if mob.hp > 0:
            if current_p_hp <= 0:
                break
            
            dmg, hit_type = calculate_damage(mob.atk, p_stats, is_player_defending=True)
            if hit_type == "evaded":
                raw_logs.append(f"{mob.name} 공격 -> 플레이어 회피.")
            else:
                current_p_hp -= dmg
                crit = " (치명타)" if hit_type == "critical" else ""
                raw_logs.append(f"{mob.name} 공격 -> 플레이어에게 {dmg} 피해{crit}.")

    # -- 종료 판정 --
    alive_mobs = [m for m in monsters if m.hp > 0]
    status = "ongoing"
    if current_p_hp <= 0:
        current_p_hp = 0
        status = "defeat"
        raw_logs.append("플레이어 패배.")
    elif not alive_mobs:
        status = "victory"
        raw_logs.append("플레이어 승리. 모든 적 처치.")

    # AI 내레이션 생성
    ai_narrative = generate_narrative(raw_logs)

    # [디버깅] 보낼 데이터 출력
    print(f"📤 [Response] AI Text: {ai_narrative[0][:30]}...") 

    return {
        "player_hp": current_p_hp,
        "monsters": monsters,
        "logs": ai_narrative,
        "status": status
    }