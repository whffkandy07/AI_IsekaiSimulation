import json
import os
import random
import math
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------
# 1. 초기 설정 및 데이터 로드
# ---------------------------------------------------------
app = FastAPI(title="AI TRPG: Abyss Backend")

# world_data.json 파일 불러오기
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "world_data.json")

def load_world_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            print("[System] 월드 데이터를 성공적으로 불러왔습니다.")
            return json.load(f)
    except FileNotFoundError:
        print("[Error] world_data.json 파일을 찾을 수 없습니다.")
        return {"maps": {}, "mob_groups": {}}

WORLD_DATA = load_world_data()

# ---------------------------------------------------------
# 2. 데이터 모델 정의 (Pydantic - 데이터 검증용)
# ---------------------------------------------------------

# 플레이어 스탯 구조 (4대 스탯)
class PlayerStats(BaseModel):
    courage: int    # 용기 (HP, 물방)
    wisdom: int     # 지혜 (MP, 마방)
    temperance: int # 절제 (뎀감율)
    justice: int    # 정의 (치명, 회피)

# 캐릭터 생성 요청
class CreateCharRequest(BaseModel):
    name: str
    stats: PlayerStats

# 전투 턴 요청 (유저가 공격 버튼 눌렀을 때)
class BattleTurnRequest(BaseModel):
    player_stats: PlayerStats
    monster_data: Dict[str, Any] # 몬스터 정보 통째로
    action_type: str = "attack"  # attack, skill, run
    player_hp: int

# ---------------------------------------------------------
# 3. 게임 핵심 로직 (The Brain)
# ---------------------------------------------------------

def calculate_derived_stats(stats: PlayerStats):
    """플레이어 스탯 -> 실제 전투 수치 변환"""
    return {
        "max_hp": stats.courage * 15,
        "max_mp": stats.wisdom * 15,
        "phys_def": stats.courage * 2,
        "mag_def": stats.wisdom * 2,
        # 절제: 기본 5를 뺀 투자분만 적용. 공식: 25 / (25 + 투자분)
        "dmg_reduction_rate": 1 - (25 / (25 + max(0, stats.temperance - 5))),
        "crit_rate": stats.justice * 1.5,
        "dodge_rate": min(stats.justice * 0.5, 50.0)
    }

def calculate_damage(attacker_atk, defender_stats, is_player_defending=False):
    """
    전투 공식: 회피 -> 치명타 -> 깡방어 -> (플레이어만) 절제 뎀감
    """
    # 1. 회피 판정
    # (간단화를 위해 몬스터 회피는 justice * 0.5로 가정)
    justice = defender_stats.get('justice', 1)
    dodge_chance = min(justice * 0.5, 50.0)
    
    if random.uniform(0, 100) < dodge_chance:
        return 0, "evaded"

    # 2. 치명타 판정 (공격자 기준 - 여기선 단순화하여 5% 고정 or 인자 필요)
    is_critical = random.random() < 0.05 
    
    # 3. 깡방어 적용
    # 물리 공격으로 가정 (마법 몬스터 구현 시 type 파라미터 추가 필요)
    flat_def = defender_stats.get('courage', 0) * 2
    
    if is_player_defending:
        # 몬스터 공격력 - 플레이어 방어
        raw_dmg = attacker_atk - flat_def
    else:
        # 플레이어 공격력 - 몬스터 방어 (몬스터 배율 적용 필요하지만 일단 1.0 가정)
        raw_dmg = attacker_atk - flat_def

    if is_critical:
        raw_dmg = attacker_atk # 관통
        
    if raw_dmg < 1: raw_dmg = 1 # 최소 데미지

    # 4. 절제(Temperance) 적용 (플레이어만 해당)
    final_dmg = raw_dmg
    if is_player_defending:
        temperance = defender_stats.get('temperance', 5)
        eff_temp = max(0, temperance - 5)
        reduction_factor = 25 / (25 + eff_temp)
        final_dmg = raw_dmg * reduction_factor

    return math.floor(final_dmg), "critical" if is_critical else "hit"

# ---------------------------------------------------------
# 4. AI 연동 파트 (LLM API Integration)
# ---------------------------------------------------------

async def call_llm_api(prompt_type: str, context_data: Dict):
    """
    [API가 들어갈 곳]
    여기에 Google Gemini API 호출 코드를 넣으면 됩니다.
    지금은 가짜 응답(Mock)을 반환합니다.
    """
    
    # 1. 프롬프트 구성 (나중에 실제 프롬프트로 교체)
    system_prompt = "당신은 판타지 TRPG의 던전 마스터입니다. 상황을 생생하게 묘사하세요."
    user_prompt = f"상황 데이터: {context_data}"

    # --- [실제 API 코드가 들어갈 자리] ---
    # import google.generativeai as genai
    # model = genai.GenerativeModel('gemini-pro')
    # response = model.generate_content(system_prompt + user_prompt)
    # ai_text = response.text
    # -----------------------------------

    # [테스트용 가짜 응답]
    if prompt_type == "encounter":
        mob_name = context_data.get('monster_name', '괴물')
        return f"어둠 속에서 {mob_name}이(가) 나타났습니다! 놈의 눈빛이 번뜩입니다."
    
    elif prompt_type == "battle_result":
        dmg = context_data.get('damage_taken', 0)
        return f"당신의 공격이 적중했습니다! 적은 고통스러워합니다. (적의 반격으로 {dmg} 피해를 입음)"

    return "알 수 없는 상황입니다."

# ---------------------------------------------------------
# 5. API 엔드포인트 (프론트엔드와 통신)
# ---------------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Abyss Server is Running"}

@app.post("/game/start")
def start_game(req: CreateCharRequest):
    """캐릭터 생성 및 스탯 계산"""
    derived = calculate_derived_stats(req.stats)
    return {
        "name": req.name,
        "base_stats": req.stats,
        "combat_stats": derived,
        "message": "캐릭터 생성이 완료되었습니다."
    }

@app.get("/game/map/{location_id}")
async def enter_location(location_id: str):
    """특정 지역 입장 -> 랜덤 인카운터 발생"""
    
    # 1. 맵 데이터 확인
    if location_id not in WORLD_DATA["maps"]:
        raise HTTPException(status_code=404, detail="존재하지 않는 지역입니다.")
    
    map_info = WORLD_DATA["maps"][location_id]
    
    # 2. 조우 확률 체크 (코드에서 주사위 굴리기)
    encounter_roll = random.randint(1, 100)
    is_battle = encounter_roll <= map_info["encounter_rate"]
    
    response_data = {
        "location": map_info["name"],
        "description": map_info["description"],
        "event": "none"
    }

    # 3. 전투 당첨 시 몬