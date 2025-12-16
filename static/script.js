// --- 전역 상태 변수 ---
let playerCreationData = {
    name: "전생자",
    stats: { courage: 5, wisdom: 5, temperance: 5, justice: 5 }
};
let introStep = 0; 
let isTyping = false;      // 현재 타이핑 효과가 진행 중인가?
let fullTextBuffer = "";   // 현재 출력 중인 전체 대사 내용
let typingTimer = null;    // 타이핑 타이머 ID
// =================================================================
// [중요] Replit 실행 후 Webview 상단의 주소를 아래에 복사해 넣으세요!
// 예시: "https://My-Project.username.replit.co" (끝에 슬래시 / 제거)
// =================================================================
const SERVER_URL = "https://24307d0c-8c34-4b31-aab5-7a369c14f501-00-1snbwl2fmhu2s.sisko.replit.dev"; 


let gameState = {
    player: {
        name: "",
        hp: 0, max_hp: 0,
        mp: 0, max_mp: 0,
        stats: {}
    },
    monsters: [], 
    location: null
};

document.addEventListener("DOMContentLoaded", () => {
    updateTooltips();
    setupMainMenu();
    setupGameButtons();

    console.log(`📡 서버 주소 설정됨: ${SERVER_URL}`);
});

// --- 인트로 & 메인 메뉴 ---
function setupMainMenu() {
    const btnStart = document.getElementById('btn-start');
    const btnLoad = document.getElementById('btn-load');
    const btnExit = document.getElementById('btn-exit');

    // [인트로 진행용] 화면 전체 클릭 리스너
    const overlay = document.getElementById('start-overlay');
    overlay.addEventListener('click', (e) => {
        // 게임 시작 전(메뉴 화면)이거나, 입력창(input)이나 버튼을 클릭했을 때는 무시
        if (!document.getElementById('start-content-wrapper').classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        handleIntroClick();
    });

    btnStart.addEventListener('click', (e) => {
        e.stopPropagation(); // 상위 클릭 이벤트 전파 방지
        const contentWrapper = document.getElementById('start-content-wrapper');

        // 메뉴 숨기기 & 클릭 방지
        contentWrapper.style.opacity = '0'; 
        contentWrapper.style.pointerEvents = 'none'; 

        setTimeout(() => {
            contentWrapper.classList.add('hidden');
            const introContainer = document.getElementById('intro-container');
            introContainer.classList.remove('hidden'); 
            // 인트로 시작
            runIntroSequence(); 
        }, 1500);
    });

    btnLoad.addEventListener('click', () => alert("저장된 기억이 없습니다."));
    btnExit.addEventListener('click', () => {
        const overlay = document.getElementById('start-overlay');
        overlay.innerHTML = "<div style='color:#666; font-size:20px; margin-top:20%'>당신의 존재가 소멸했습니다...</div>";
        overlay.style.backgroundColor = "#000";
        overlay.style.cursor = "none";
    });
}
// [핵심] 화면 클릭 시 동작 처리
function handleIntroClick() {
    const dialogueEl = document.getElementById('intro-dialogue');
    const inputArea = document.getElementById('intro-input-area');

    // 1. 타이핑 중이라면 -> 즉시 전체 텍스트 표시
    if (isTyping) {
        clearTimeout(typingTimer); // 타이핑 중단
        dialogueEl.innerHTML = fullTextBuffer; // 전체 텍스트 즉시 출력
        isTyping = false;

        // 타이핑 완료 후 실행되어야 할 콜백(입력창 표시 등)이 있다면 즉시 실행
        if (onTypingComplete) {
            onTypingComplete();
            onTypingComplete = null; // 실행 후 초기화
        }
        return;
    }

    // 2. 타이핑이 끝난 상태라면 -> 다음 단계로 진행
    // 단, 입력창이 떠있는 단계(이름 입력, 스탯 분배)에서는 화면 클릭으로 넘어가지 않음
    if (!inputArea.classList.contains('hidden')) {
        return; 
    }

    // 다음 단계 진행
    introStep++;
    runIntroSequence();
}

let onTypingComplete = null; // 타이핑 완료 시 실행할 함수 저장소
function runIntroSequence() {
    const dialogueEl = document.getElementById('intro-dialogue');
    const inputArea = document.getElementById('intro-input-area');
    // "다음" 버튼은 이제 사용하지 않으므로 숨김 처리
    document.getElementById('btn-next-step').classList.add('hidden');

    if (introStep === 0) {
        // [Step 0] 첫 대사
        typeWriter(dialogueEl, "가여운 영혼이여... 죽음을 맞이했는가?<br>내가 너에게 새로운 삶을 부여하겠다.<br><br><span style='font-size:14px; color:#666;'>(화면을 클릭하여 계속)</span>");

    } else if (introStep === 1) {
        // [Step 1] 이름 입력
        typeWriter(dialogueEl, "새로운 세계에서 불릴 그대의 이름은 무엇인가?", () => {
            // 타이핑이 끝나면 입력창 표시
            inputArea.classList.remove('hidden');
            inputArea.innerHTML = `
                <input type="text" id="intro-name-input" class="intro-input" placeholder="이름 입력" value="Andy"> 
                <button id="submit-name" class="menu-btn" style="padding:5px 10px;">확정</button>
            `;
            document.getElementById('submit-name').onclick = (e) => {
                e.stopPropagation(); // 클릭 버블링 방지
                const nameVal = document.getElementById('intro-name-input').value;
                if (!nameVal) { alert("이름이 필요하다."); return; }
                playerCreationData.name = nameVal;

                // 입력 완료 후 다음 단계로
                inputArea.classList.add('hidden'); // 입력창 숨김
                introStep++; 
                runIntroSequence();
            };
        });

    } else if (introStep === 2) {
        // [Step 2] 스탯 분배
        typeWriter(dialogueEl, `${playerCreationData.name}... 좋은 울림이구나.<br>그대가 가졌던 잠재력은 어느 정도였지?`, () => {
            inputArea.classList.remove('hidden');
            inputArea.innerHTML = `
                <div class="stat-distribute-row"><label>용기 (HP)</label><input type="number" class="intro-input" id="s-courage" value="5" min="1" max="10" style="width:60px;"></div>
                <div class="stat-distribute-row"><label>지혜 (MP)</label><input type="number" class="intro-input" id="s-wisdom" value="5" min="1" max="10" style="width:60px;"></div>
                <div class="stat-distribute-row"><label>절제 (방어)</label><input type="number" class="intro-input" id="s-temperance" value="5" min="1" max="10" style="width:60px;"></div>
                <div class="stat-distribute-row"><label>정의 (치명)</label><input type="number" class="intro-input" id="s-justice" value="5" min="1" max="10" style="width:60px;"></div>
                <button id="submit-stats" class="menu-btn" style="margin-top:10px; width:100%;">이대로 다시 태어나기</button>
            `;
            document.getElementById('submit-stats').onclick = (e) => {
                e.stopPropagation();
                playerCreationData.stats.courage = parseInt(document.getElementById('s-courage').value);
                playerCreationData.stats.wisdom = parseInt(document.getElementById('s-wisdom').value);
                playerCreationData.stats.temperance = parseInt(document.getElementById('s-temperance').value);
                playerCreationData.stats.justice = parseInt(document.getElementById('s-justice').value);

                inputArea.classList.add('hidden');
                introStep++; 
                runIntroSequence();
            };
        });

    } else if (introStep === 3) {
        // [Step 3] 게임 시작 직전
        // 서버 등록 테스트
        testRegisterEndpoint();

        typeWriter(dialogueEl, "준비는 끝났다. 심연이 그대를 기다린다.<br>행운을 비네.", () => {
            // 대사가 다 출력된 후 잠시 뒤 자동 시작 혹은 클릭 대기
            setTimeout(startGame, 1500);
        });
    }
}
async function testRegisterEndpoint() {
    try {
        console.log("📤 [Test] 서버로 캐릭터 등록 요청 전송 중...");
        const res = await fetch(`${SERVER_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(playerCreationData)
        });
        const data = await res.json();
        console.log("✅ [Test] 서버 응답:", data);
    } catch (err) {
        console.error("❌ [Test] 서버 통신 실패:", err);
    }
}

function typeWriter(element, text, callback = null) {
    element.innerHTML = ""; // 초기화
    fullTextBuffer = text;  // 전체 텍스트 저장 (클릭 시 사용)
    isTyping = true;        // 타이핑 상태 시작
    onTypingComplete = callback; // 완료 후 할 일 저장

    let i = 0;
    let speed = 40; 

    function type() {
        if (!isTyping) return; // 클릭으로 강제 종료되었으면 중단

        if (i < text.length) {
            let char = text.charAt(i);
            // <br> 태그 처리
            if (char === "<") {
                let tag = "";
                while (text.charAt(i) !== ">" && i < text.length) {
                    tag += text.charAt(i);
                    i++;
                }
                tag += ">";
                i++;
                element.innerHTML += tag;
            } else {
                element.innerHTML += char;
                i++;
            }
            typingTimer = setTimeout(type, speed);
        } else {
            // 자연스럽게 타이핑이 끝난 경우
            isTyping = false;
            if (callback) callback();
        }
    }
    type();
}

function startGame() {
    const overlay = document.getElementById('start-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        gameState.player.name = playerCreationData.name;
        gameState.player.stats = playerCreationData.stats;
        recalcMaxStats();
        enterLocation("forest_zone");
    }, 1500);
}

function recalcMaxStats() {
    gameState.player.max_hp = gameState.player.stats.courage * 15;
    gameState.player.max_mp = gameState.player.stats.wisdom * 15;
    gameState.player.hp = gameState.player.max_hp;
    gameState.player.mp = gameState.player.max_mp;
    updateDisplayStats();
}

// --- 게임 버튼 및 입력 처리 ---
// 3. 버튼 이벤트 (시스템/행동 로그)
function setupGameButtons() 
{
    // 1. 물리 공격 버튼 연결
    const btnPhysical = document.getElementById('btn-physical');
    if (btnPhysical) {
        btnPhysical.addEventListener('click', () => combatTurn('physical'));
    }

    // 2. 마법 공격 버튼 연결
    const btnMagic = document.getElementById('btn-magic');
    if (btnMagic) {
        btnMagic.addEventListener('click', () => combatTurn('magic'));
    }

    // 3. 아이템 사용 버튼 연결
    const btnItem = document.getElementById('btn-item');
    if (btnItem) {
        btnItem.addEventListener('click', () => combatTurn('item'));
    }

    // 4. 도주 버튼 연결
    const btnRun = document.getElementById('btn-run');
    if (btnRun) {
        btnRun.addEventListener('click', () => {
             // 도주는 서버 통신 없이 로그만 띄우거나, 필요하면 combatTurn('run')으로 확장 가능
            addLog("[시스템] 도망칠 수 없습니다!");
        });
    }

    // 5. 채팅 입력창 (기존 유지)
    const inputBox = document.getElementById('user-input-box');
    if (inputBox) {
        inputBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = inputBox.value.trim();
                if (!text) return;
                addLog(`[명령] ${text}`, "log-entry");
                inputBox.value = '';
                combatTurn('custom', text);
            }
        });
    }
}

// --- 핵심: 전투/행동 처리 (UI 수정됨) ---
// 2. 전투 행동 (전투 로그)
async function combatTurn(action, customInput = null) {
    if (gameState.monsters.length === 0 && action !== 'custom') {
        // ----------------------------------------------------
        // [추가] 행동에 따른 효과음 재생 로직
        // ----------------------------------------------------
        if (action === 'physical') {
            playSfx('sfx-attack'); // ⚔️ 칼 소리
        } else if (action === 'magic') {
            playSfx('sfx-magic');  // ✨ 마법 소리
        } else if (action === 'item') {
            // 아이템 소리가 있다면 여기에 추가 (예: playSfx('sfx-potion'))
        }
        // ----------------------------------------------------
        addLog("[시스템] 공격할 대상이 없습니다.");
        return;
    }

    let targetIdx = 0; 
    const payload = {
        player_name: gameState.player.name, 
        player_stats: gameState.player.stats,
        player_hp: gameState.player.hp,
        monsters: gameState.monsters,
        action: action,
        target_idx: targetIdx,
        custom_input: customInput
    };

    console.log("🚀 [Send]", payload);

    try {
        const storyBox = document.getElementById('story-text');
        storyBox.innerHTML = "<span style='color:#888;'>... 운명을 판정하는 중 ...</span>";

        const res = await fetch(`${SERVER_URL}/game/battle/turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const result = await res.json();

        console.log("✅ [Receive]", result);

        gameState.player.hp = result.player_hp;
        gameState.monsters = result.monsters;

        const narrativeText = result.logs.join("<br>");
        storyBox.innerHTML = narrativeText; 

        // [수정] 왼쪽 로그창에 기록할 때 '[전투]' 태그 붙이기
        result.logs.forEach(txt => {
            // AI가 준 텍스트가 너무 길면 잘라서 한 줄 요약처럼 보여주거나, 그대로 출력
            // 여기서는 태그만 붙여서 출력
            addLog(`[전투] ${txt}`, "log-highlight");
        });

        updateDisplayStats();
        renderMonsters(); 

        if (result.status === 'victory') {
            storyBox.innerHTML += "<br><br><span style='color:#f1c40f; font-weight:bold;'>[승리] 모든 적을 물리쳤습니다!</span>";
            addLog("[전투] 승리하였습니다.");
        } else if (result.status === 'defeat') {
            storyBox.innerHTML += "<br><br><span style='color:#c0392b; font-weight:bold;'>[패배] 눈앞이 캄캄해집니다...</span>";
            addLog("[전투] 패배하였습니다.");
        }

    } catch (err) {
        console.error(err);
        addLog("[오류] 서버 통신 실패");
        document.getElementById('story-text').innerHTML = "<span style='color:red'>(통신 오류)</span>";
    }
}
// 1. 맵 진입 (환경 로그)
async function enterLocation(locId) {
    try {
        const res = await fetch(`${SERVER_URL}/game/map/${locId}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        document.getElementById('location-name').innerText = `📍 ${data.location}`;

        // [수정] 태그 추가
        addLog(`[환경] ${data.location}에 진입했습니다.`);

        document.getElementById('story-text').innerHTML = data.description;


        if (data.monsters && data.monsters.length > 0) {
            gameState.monsters = data.monsters;
            renderMonsters(); 
            // [추가] 몬스터가 있으면 전투 음악 시작! 🎵
            playBattleMusic();
            addLog("[시스템] 전투가 시작되어 긴장감이 흐릅니다!");
        } else {
            gameState.monsters = [];
            document.getElementById('main-screen').innerHTML = `<div style="color:#888; margin-top:50px;">(몬스터 없음)</div>`;
        }
    } catch (err) {
        console.error(err);
        addLog("[시스템] 서버 연결 실패");
    }
}

function renderMonsters() {
    const screen = document.getElementById('main-screen');
    screen.innerHTML = "";
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.justifyContent = 'center';
    container.style.width = '100%';
    gameState.monsters.forEach((mob, idx) => {
        if (mob.hp <= 0) return;
        const card = document.createElement('div');
        card.className = 'monster-card';
        const art = mob.aa_art ? mob.aa_art.join('\n') : `( o . o )\n (  ^  )`;
        card.innerHTML = `
            <div class="status-text" style="color:#c0392b;">HP: ${mob.hp}/${mob.max_hp}</div>
            <pre class="monster-art">${art}</pre>
            <div class="monster-name">[ ${mob.name} ]</div>
        `;
        container.appendChild(card);
    });
    screen.appendChild(container);
}

function addLog(text, className="") {
    const logWindow = document.getElementById('log-window');
    const div = document.createElement('div');
    div.className = `log-entry ${className}`;
    div.innerHTML = text.replace(/\n/g, "<br>");
    logWindow.appendChild(div);
    logWindow.scrollTop = logWindow.scrollHeight;
}

function updateDisplayStats() {
    const p = gameState.player;
    document.getElementById('hp-text').innerText = `${p.hp}/${p.max_hp}`;
    document.getElementById('mp-text').innerText = `${p.mp}/${p.max_mp}`;
    document.querySelector('.hp-bar').style.width = `${(p.hp / p.max_hp) * 100}%`;
    document.querySelector('.mp-bar').style.width = `${(p.mp / p.max_mp) * 100}%`;

    if(document.getElementById('row-courage')) {
        document.getElementById('row-courage').dataset.val = p.stats.courage;
        document.querySelector('#row-courage .stat-val').innerText = p.stats.courage;
        document.getElementById('row-wisdom').dataset.val = p.stats.wisdom;
        document.querySelector('#row-wisdom .stat-val').innerText = p.stats.wisdom;
        document.getElementById('row-temperance').dataset.val = p.stats.temperance;
        document.querySelector('#row-temperance .stat-val').innerText = p.stats.temperance;
        document.getElementById('row-justice').dataset.val = p.stats.justice;
        document.querySelector('#row-justice .stat-val').innerText = p.stats.justice;
    }
    updateTooltips();
}

function updateTooltips()
    {
    const statRows = document.querySelectorAll('.stat-row[data-stat]');
    statRows.forEach(row =>
        {
        const statType = row.dataset.stat;
        const val = parseInt(row.dataset.val);
        let tooltipText = "";
        switch(statType)
            {
            case 'courage': tooltipText = `Max HP: ${val * 15}\n물리 방어: ${val * 2}`; break;
            case 'wisdom': tooltipText = `Max MP: ${val * 15}\n마법 방어: ${val * 2}`; break;
            case 'temperance': 
                let effective = Math.max(0, val - 5);
                let reduction = (1 - (25 / (25 + effective))) * 100;
                tooltipText = `받는 피해 감소: ${reduction.toFixed(1)}%\n(기본보정 -5 적용됨)`; break;
            case 'justice': tooltipText = `치명타 확률: ${(val * 1.5).toFixed(1)}%\n회피율: ${(val * 0.5).toFixed(1)}%`; break;
            }
        row.setAttribute('data-tooltip', tooltipText);
    });
}
function playBattleMusic() {
    const audio = document.getElementById('bgm-battle');
    if (audio) {
        audio.volume = 0.1; // 볼륨 조절 (0.0 ~ 1.0)
        audio.currentTime = 0; // 처음부터 재생
        audio.play().catch(error => {
            console.log("브라우저 정책으로 자동 재생이 막혔을 수 있습니다:", error);
        });
    }
}

function stopBattleMusic() {
    const audio = document.getElementById('bgm-battle');
    if (audio) {
        audio.pause(); // 일시 정지
        audio.currentTime = 0; // 되감기
    }
}function playSfx(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0; // 재생 위치를 0초로 초기화 (연타 가능하게 함)
        audio.volume = 1;    // 볼륨 적당히 조절
        audio.play().catch(e => console.log("효과음 재생 실패", e));
    }
}
