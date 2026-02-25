let state = {
    dayId: null,
    words: [],
    currentStage: 1, 
    learnIndex: 0,
    quizIndex: 0,
    matchState: { type: null, chunkIndex: 0, left: null, right: null, matchesLeft: 0 },
    failedWords: [], // Hem eşleştirme hem test hatalarını burada topluyoruz
    completedDays: JSON.parse(localStorage.getItem('yokdilCompletedDays')) || []
};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    updateStats();
});

// --- HARİTA VE İSİMLENDİRME ---
function initMap() {
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';
    
    for(let i = 1; i <= 58; i++) {
        const dayId = `day${i}`;
        const btn = document.createElement('button');
        btn.className = `day-btn ${state.completedDays.includes(dayId) ? 'completed' : ''}`;
        
        // 55-58 arası özel isimlendirme
        if (i >= 55) {
            btn.textContent = `Phrasal Verbs ${i - 54}`;
            btn.style.fontSize = "0.8rem";
        } else {
            btn.textContent = `Gün ${i}`;
        }
        
        if(courseData && courseData[dayId]) {
            btn.onclick = () => startDay(dayId);
        } else {
            btn.disabled = true;
        }
        grid.appendChild(btn);
    }
}

function updateStats() {
    document.getElementById('completed-days-count').textContent = state.completedDays.length;
}

// --- MODAL SİSTEMİ (Alert Yerine) ---
function showModal(title, text, callback) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    modal.classList.remove('hidden');
    
    document.getElementById('modal-close').onclick = () => {
        modal.classList.add('hidden');
        if(callback) callback();
    };
}

// --- AKIŞ KONTROLÜ ---
function startDay(dayId) {
    state.dayId = dayId;
    state.words = [...courseData[dayId]]; // Orijinal veriyi bozmamak için kopyalıyoruz
    state.failedWords = []; // Yeni gün için hataları temizle
    document.getElementById('map-view').classList.add('hidden');
    document.getElementById('mission-view').classList.remove('hidden');
    switchStage(1);
}

function switchStage(stageNum) {
    state.currentStage = stageNum;
    
    // Göstergeleri güncelle
    for(let i=1; i<=4; i++) {
        const ind = document.getElementById(`ind-${i}`);
        if(ind) ind.classList.remove('active');
    }
    if(stageNum <= 4) {
        const activeInd = document.getElementById(`ind-${stageNum}`);
        if(activeInd) activeInd.classList.add('active');
    }

    // Sahneleri gizle
    document.getElementById('stage-1').classList.add('hidden');
    document.getElementById('stage-match').classList.add('hidden');
    document.getElementById('stage-4').classList.add('hidden');
    document.getElementById('stage-completed').classList.add('hidden');

    if(stageNum === 1) { 
        state.learnIndex = 0; 
        initLearnMode();
        loadLearnWord(); 
    }
    if(stageNum === 2) startMatchStage('synonym');
    if(stageNum === 3) startMatchStage('tr');
    if(stageNum === 4) { state.quizIndex = 0; loadQuizWord(); }
    if(stageNum === 5) document.getElementById('stage-completed').classList.remove('hidden');
}

// --- AŞAMA 1: ÖĞRENME ---
function initLearnMode() {
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const speakBtn = document.getElementById('speakBtn');

    nextBtn.onclick = () => {
        state.learnIndex++;
        if(state.learnIndex >= state.words.length) {
            switchStage(2);
        } else {
            loadLearnWord();
        }
    };

    prevBtn.onclick = () => {
        if(state.learnIndex > 0) {
            state.learnIndex--;
            loadLearnWord();
        }
    };

    speakBtn.onclick = () => {
        const text = document.getElementById('word-title').textContent;
        const msg = new SpeechSynthesisUtterance();
        msg.text = text;
        msg.lang = 'en-US';
        msg.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
    };
}

function loadLearnWord() {
    document.getElementById('stage-1').classList.remove('hidden');
    const wordObj = state.words[state.learnIndex];
    
    document.getElementById('word-title').textContent = wordObj.word;
    document.getElementById('word-type').textContent = `(${wordObj.type})`;
    document.getElementById('word-tr').textContent = wordObj.tr;
    document.getElementById('word-synonyms').textContent = wordObj.synonyms;
    document.getElementById('word-example').textContent = wordObj.example;
    document.getElementById('word-example-tr').textContent = wordObj.exampleTr;

    const prevBtn = document.getElementById('prevBtn');
    prevBtn.style.visibility = (state.learnIndex === 0) ? 'hidden' : 'visible';
}

// --- AŞAMA 2 & 3: EŞLEŞTİRME (HATA TAKİPLİ) ---
function startMatchStage(type) {
    state.matchState.type = type;
    state.matchState.chunkIndex = 0;
    loadMatchChunk();
}

function loadMatchChunk() {
    document.getElementById('stage-match').classList.remove('hidden');
    const chunkSize = 5;
    const totalChunks = Math.ceil(state.words.length / chunkSize);
    const startIndex = state.matchState.chunkIndex * chunkSize;
    const currentWords = state.words.slice(startIndex, startIndex + chunkSize);
    
    const currentPart = state.matchState.chunkIndex + 1;
    document.getElementById('match-title').textContent = 
        (state.matchState.type === 'synonym' ? 'Eş Anlamlıları Eşleştir' : 'Türkçe Karşılıkları Eşleştir') + 
        ` (${currentPart}/${totalChunks})`;
    
    const leftCol = document.getElementById('match-col-left');
    const rightCol = document.getElementById('match-col-right');
    leftCol.innerHTML = ''; rightCol.innerHTML = '';

    let leftItems = currentWords.map(w => ({ id: w.word, text: w.word }));
    let rightItems = currentWords.map(w => ({ 
        id: w.word, 
        text: state.matchState.type === 'synonym' ? w.synonyms : w.tr 
    }));

    leftItems.sort(() => Math.random() - 0.5);
    rightItems.sort(() => Math.random() - 0.5);
    state.matchState.matchesLeft = currentWords.length;

    leftItems.forEach(item => createMatchNode(item, 'left', leftCol));
    rightItems.forEach(item => createMatchNode(item, 'right', rightCol));
}

function createMatchNode(item, side, container) {
    const div = document.createElement('div');
    div.className = 'match-item';
    div.textContent = item.text;
    div.dataset.id = item.id;
    div.dataset.side = side;
    div.onclick = () => handleMatchClick(div);
    container.appendChild(div);
}

function handleMatchClick(element) {
    const side = element.dataset.side;
    if(element.classList.contains('selected')) {
        element.classList.remove('selected');
        state.matchState[side] = null;
        return;
    }
    if(state.matchState[side]) state.matchState[side].classList.remove('selected');
    element.classList.add('selected');
    state.matchState[side] = element;

    if(state.matchState.left && state.matchState.right) checkMatch();
}

function checkMatch() {
    const { left, right } = state.matchState;
    if(left.dataset.id === right.dataset.id) {
        setTimeout(() => {
            left.classList.add('matched');
            right.classList.add('matched');
            state.matchState.matchesLeft--;
            if(state.matchState.matchesLeft === 0) {
                state.matchState.chunkIndex++;
                if(state.matchState.chunkIndex < Math.ceil(state.words.length / 5)) {
                    loadMatchChunk();
                } else {
                    switchStage(state.currentStage + 1);
                }
            }
        }, 300);
    } else {
        left.classList.add('wrong'); right.classList.add('wrong');
        
        // --- EŞLEŞTİRME HATASINI KAYDET ---
        const failedWord = state.words.find(w => w.word === left.dataset.id);
        if(!state.failedWords.find(w => w.word === failedWord.word)) {
            state.failedWords.push(failedWord);
        }

        setTimeout(() => {
            left.classList.remove('wrong', 'selected');
            right.classList.remove('wrong', 'selected');
        }, 400);
    }
    state.matchState.left = null; state.matchState.right = null;
}

// --- AŞAMA 4: TEST ---
function loadQuizWord() {
    document.getElementById('stage-4').classList.remove('hidden');
    const wordObj = state.words[state.quizIndex];
    document.getElementById('quiz-word').textContent = wordObj.word;
    
    const quizSpeakBtn = document.getElementById('quizSpeakBtn');
    quizSpeakBtn.onclick = () => {
        const msg = new SpeechSynthesisUtterance();
        msg.text = wordObj.word;
        msg.lang = 'en-US';
        msg.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
    };

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    let options = [wordObj.tr];
    const allDayWords = courseData[state.dayId]; 
    
    while(options.length < 3) {
        let randomWord = allDayWords[Math.floor(Math.random() * allDayWords.length)].tr;
        if(!options.includes(randomWord)) options.push(randomWord);
    }
    
    options.sort(() => Math.random() - 0.5);

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        btn.onclick = (e) => handleQuizAnswer(opt, wordObj.tr, e.target);
        optionsContainer.appendChild(btn);
    });
}

function handleQuizAnswer(selected, correct, btn) {
    const wordObj = state.words[state.quizIndex];
    if(selected === correct) {
        btn.classList.add('correct');
        setTimeout(() => checkQuizProgress(), 1000);
    } else {
        btn.classList.add('wrong');
        // TEST HATASINI KAYDET
        if(!state.failedWords.find(w => w.word === wordObj.word)) {
            state.failedWords.push(wordObj);
        }
        setTimeout(() => checkQuizProgress(), 1500);
    }
}

function checkQuizProgress() {
    state.quizIndex++;
    if (state.quizIndex >= state.words.length) {
        if (state.failedWords.length > 0) {
            // MODERN MODAL ÇAĞRISI
            showModal(
                "Tekrar Gerekiyor", 
                `${state.failedWords.length} kelimede hata yaptın. Şimdi bu kelimeleri tekrar edeceksin.`,
                () => {
                    state.words = [...state.failedWords];
                    state.failedWords = [];
                    switchStage(1);
                }
            );
        } else {
            switchStage(5);
        }
    } else {
        loadQuizWord();
    }
}

function completeDayAndReturn() {
    if(!state.completedDays.includes(state.dayId)) {
        state.completedDays.push(state.dayId);
        localStorage.setItem('yokdilCompletedDays', JSON.stringify(state.completedDays));
    }
    initMap(); updateStats(); returnToMap();
}

function returnToMap() {
    document.getElementById('mission-view').classList.add('hidden');
    document.getElementById('map-view').classList.remove('hidden');
}