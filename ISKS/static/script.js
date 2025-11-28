// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
    updateTooltips();
});

// 4대 스탯 파생 능력치 계산 및 툴팁 갱신 함수
function updateTooltips() {
    // 1. HTML에서 data-stat 속성이 있는 모든 요소를 가져옴
    const statRows = document.querySelectorAll('.stat-row[data-stat]');

    statRows.forEach(row => {
        const statType = row.dataset.stat; // courage, wisdom 등
        const val = parseInt(row.dataset.val); // 현재 수치 (예: 5)
        
        let tooltipText = "";

        switch(statType) {
            case 'courage':
                // 용기: 체력 x15, 물방 x2
                // Lv1(5) -> HP 75, 방어 10
                tooltipText = `Max HP: ${val * 15}\n물리 방어: ${val * 2}`;
                break;
            
            case 'wisdom':
                // 지혜: 마력 x15, 마방 x2
                // Lv1(5) -> MP 75, 방어 10
                tooltipText = `Max MP: ${val * 15}\n마법 방어: ${val * 2}`;
                break;
            
            case 'temperance':
                // 절제: 데미지 감소율 (공식: 25 / (25 + (val-5)))
                // 기본값 5는 0으로 취급 (보정)
                let effective = Math.max(0, val - 5);
                
                // 받는 피해 비율 계산
                let factor = 25 / (25 + effective); 
                
                // 감소율(%)로 변환
                let reduction = (1 - factor) * 100;
                
                tooltipText = `받는 피해 감소: ${reduction.toFixed(1)}%\n(기본보정 -5 적용됨)`;
                break;
            
            case 'justice':
                // 정의: 치명 x1.5%, 회피 x0.5%
                tooltipText = `치명타 확률: ${(val * 1.5).toFixed(1)}%\n회피율: ${(val * 0.5).toFixed(1)}%`;
                break;
        }

        // 2. 계산된 텍스트를 HTML의 data-tooltip 속성에 넣음 (CSS가 이걸 보여줌)
        row.setAttribute('data-tooltip', tooltipText);
        
        // 3. 화면에 보이는 숫자도 갱신
        const valDisplay = row.querySelector('.stat-val');
        if (valDisplay) {
            valDisplay.innerText = val;
        }
    });
}