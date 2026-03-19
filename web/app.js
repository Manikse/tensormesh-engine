// ==========================================
// 1. НАЛАШТУВАННЯ ТА ІНІЦІАЛІЗАЦІЯ
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

const SUPABASE_URL = 'https://xecybgqtnporjyvvsurs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_o9NOjYDgRRYyaOM_P4OHIw_AQVtrd3U'; 

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: false }
});

const privacyLabels = { 'public': 'Всі', 'friends': 'Друзі', 'private': 'Ніхто' };
const privacyModes = ['public', 'friends', 'private'];
let cachedYouTubePlaylists = [];

// --- ФУНКЦІЯ ОТРИМАННЯ ЮЗЕРА (БРАУЗЕР + TELEGRAM) ---
function getTgUser() {
    // 1. Спроба взяти з Telegram WebApp
    if (typeof tg !== 'undefined' && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user;
    }
    
    // 2. Спроба взяти збережений ID (для браузера)
    const savedId = localStorage.getItem('guest_tg_id');
    if (savedId) return { id: parseInt(savedId), first_name: "Гість (Web)" };
    
    // 3. Якщо ми в браузері і ще не мили ID - питаємо (окрім моменту повернення з Google)
    if (!window.location.hash.includes('access_token')) {
        const id = prompt("Введи свій Telegram ID для тестування в браузері:");
        if (id) {
            localStorage.setItem('guest_tg_id', id);
            return { id: parseInt(id), first_name: "Гість (Web)" };
        }
    }
    return null;
}

// ==========================================
// 2. АВТОРИЗАЦІЯ (OAUTH)
// ==========================================

async function handleAuthRedirect() {
    const hash = window.location.hash;

    // 1. СЦЕНАРІЙ: Ми щойно повернулися від Google
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const providerToken = params.get('provider_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            if (providerToken) {
                console.log("✅ Токен YouTube отримано!");
                localStorage.setItem('yt_access_token', providerToken);
            } else {
                console.error("❌ Google не дав provider_token. Можливо, треба 'Force Login'.");
            }

            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
            });

            if (!error) {
                window.history.replaceState(null, '', window.location.pathname);
                
                
                if (!localStorage.getItem('yt_access_token')) {
                    alert("Помилка: Немає доступу до YouTube. Перезайдіть.");
                    await handleLogout(); 
                    return;
                }

                updateUI_LoggedIn(data.session.user);
                if (getTgUser()) updateUserProfile(data.session.user);
            }
        }
    } 
    // 2. СЦЕНАРІЙ: Ми просто відкрили сторінку (вже були залогінені)
    else {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            // КРИТИЧНА ПЕРЕВІРКА: А ключ від YouTube у нас лишився?
            const savedToken = localStorage.getItem('yt_access_token');
            
            if (!savedToken) {
                console.warn("⚠️ Сесія є, але токена YouTube немає. Виходимо...");
                // Тихо виходимо, щоб змусити юзера нажати кнопку і отримати новий токен
                await supabaseClient.auth.signOut();
                updateUI_LoggedOut();
            } else {
                updateUI_LoggedIn(session.user);
                if (getTgUser()) updateVisibleCount();
            }
        } else {
            updateUI_LoggedOut();
        }
    }
}

// ==========================================
// 3. ІМПОРТ ПЛЕЙЛИСТІВ (ЛОГІКА + UI)
// ==========================================

async function importPlaylists() {
    const token = localStorage.getItem('yt_access_token');
    
    if (!token) {
        tg.showAlert("⚠️ Токен застарів. Перезайдіть в акаунт.");
        loginWithGoogle();
        return;
    }

    // Підготовка модалки (Sticky Footer Layout)
    const modalContent = document.querySelector('#modal-visibility .modal-card');
    modalContent.innerHTML = `
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h3 style="margin:0; color:#FFF;">Вибір плейлистів</h3>
            <p style="font-size:12px; opacity:0.5; margin:0; color:#FFF;">Позначте плейлисти з YouTube</p>
        </div>
        <div class="modal-body" id="import-body" style="padding-bottom: 80px;">
            <p style="text-align:center; opacity:0.5; padding:40px; color:#FFF;">🔄 Завантаження списку...</p>
        </div>
        <div class="modal-footer-fixed">
            <button id="btn-sync" class="btn-main btn-juicy" onclick="saveSelectedPlaylists()" style="background: var(--accent); color:#FFF; font-weight:800; width:100%; opacity: 0.5; pointer-events: none;">
                ОБЕРІТЬ ПЛЕЙЛИСТИ
            </button>
        </div>
    `;

    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await response.json();

        if (data.error) {
            document.getElementById('import-body').innerHTML = `<p style="text-align:center; color:#F00; padding:20px;">Помилка API: ${data.error.message}</p>`;
            return;
        }

        cachedYouTubePlaylists = data.items || [];
        
        if (cachedYouTubePlaylists.length === 0) {
            document.getElementById('import-body').innerHTML = `<p style="text-align:center; color:#FFF; padding:20px;">Плейлистів не знайдено 🤷‍♂️</p>`;
            return;
        }

        renderImportList(cachedYouTubePlaylists);

    } catch (e) {
        tg.showAlert("Помилка мережі: " + e.message);
    }
}

function renderImportList(playlists) {
    const body = document.getElementById('import-body');
    if (!body) return;

    let html = `<form id="import-form" style="display:flex; flex-direction:column; gap:10px;">`;
    
    html += playlists.map((item, index) => `
        <label class="playlist-import-item" style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
            <input type="checkbox" name="playlist_select" value="${index}" style="display:none;" onchange="updateSyncButton()">
            <div class="custom-checkbox" style="border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-check" style="font-size: 10px; color: #000; display: none;"></i>
            </div>
            
            <img src="${item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
            
            <div style="flex:1; overflow:hidden; text-align:left;">
                <div style="color:#FFF; font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.snippet.title}</div>
                <div style="color:rgba(255,255,255,0.5); font-size:11px;">YouTube • ${item.contentDetails?.itemCount || 0} треків</div>
            </div>
        </label>
    `).join('');
    
    html += `</form>`;
    body.innerHTML = html;
    
    // Стилі для чекбокса
    const style = document.createElement('style');
    style.innerHTML = `
        input:checked + .custom-checkbox { background: var(--accent); border-color: var(--accent); }
        input:checked + .custom-checkbox i { display: block !important; }
    `;
    body.appendChild(style);
}

// Оновлення стану кнопки синхронізації
window.updateSyncButton = function() {
    const checked = document.querySelectorAll('input[name="playlist_select"]:checked').length;
    const btn = document.getElementById('btn-sync');
    if (!btn) return;
    
    if (checked > 0) {
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
        btn.innerText = `СИНХРОНІЗУВАТИ (${checked})`;
        if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    } else {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
        btn.innerText = "ОБЕРІТЬ ПЛЕЙЛИСТИ";
    }
};

// --- ГЛИБОКИЙ ІМПОРТ (ПЛЕЙЛИСТИ + ТРЕКИ) ---
async function saveSelectedPlaylists() {
    const form = document.getElementById('import-form');
    if (!form) return;

    const checkboxes = form.querySelectorAll('input[name="playlist_select"]:checked');
    const tgUser = getTgUser();
    const token = localStorage.getItem('yt_access_token');
    const btn = document.getElementById('btn-sync');

    if (!tgUser) { tg.showAlert("Помилка: Немає User ID!"); return; }

    btn.innerText = "⏳ ЗАВАНТАЖЕННЯ ТРЕКІВ...";
    btn.style.opacity = "0.8";
    btn.disabled = true;

    let totalSaved = 0;

    for (const checkbox of checkboxes) {
        const pl = cachedYouTubePlaylists[checkbox.value];

        // 1. Зберігаємо Плейлист
        const { error: plError } = await supabaseClient.from('playlists').upsert({
            user_id: tgUser.id,
            name: pl.snippet.title,
            external_id: pl.id,
            cover_url: pl.snippet.thumbnails.medium?.url || pl.snippet.thumbnails.default?.url,
            source: 'YouTube',
            is_visible: true
        });

        if (plError) {
            console.error("Playlist Error:", plError);
            continue; 
        }

        // 2. Витягуємо Треки
        try {
            const trackRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${pl.id}&maxResults=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const trackData = await trackRes.json();

            if (trackData.items) {
                const tracksToSave = trackData.items.map(item => ({
                    playlist_id: pl.id,
                    title: item.snippet.title,
                    video_id: item.snippet.resourceId.videoId,
                    cover_url: item.snippet.thumbnails.default?.url
                }));

                // 3. Зберігаємо Треки
                const { error: trError } = await supabaseClient.from('tracks').insert(tracksToSave);
                if (!trError) totalSaved += tracksToSave.length;
            }
        } catch (e) {
            console.error("Track Fetch Error:", e);
        }
    }

    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    tg.showAlert(`✅ Готово! Імпортовано ${totalSaved} треків.`);
    
    // Переходимо в медіатеку
    window.location.href = 'playlists.html';
}


// ==========================================
// 4. МЕДІАТЕКА (СІТКА)
// ==========================================

async function loadLibrary() {
    const container = document.getElementById('library-grid');
    if (!container) return; // Нема куди писати

    // 1. Перевіряємо юзера
    const tgUser = getTgUser();
    
    // ОСЬ ТУТ БУЛА ПРОБЛЕМА: Якщо юзера немає, ми просто йшли, а спінер лишався.
    if (!tgUser) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding-top:50px;">
                <p style="color:#FF3B30; font-weight:bold;">❌ ПОМИЛКА: Немає ID користувача</p>
                <p style="color:#FFF; font-size:12px;">Спробуй оновити сторінку або ввести ID вручну.</p>
                <button onclick="location.reload()" class="btn-main" style="margin-top:15px; width:auto;">Оновити</button>
            </div>`;
        return;
    }

    try {
        // 2. Робим запит до бази
        const { data: playlists, error } = await supabaseClient
            .from('playlists')
            .select('*')
            .eq('user_id', tgUser.id);

        // 3. Якщо Supabase видав помилку (наприклад, RLS)
        if (error) {
            console.error("Supabase Error:", error);
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding-top:50px;">
                    <p style="color:#FF3B30;">❌ Помилка бази даних:</p>
                    <code style="color:#FFF; background:#222; padding:5px; border-radius:4px;">${error.message}</code>
                </div>`;
            return;
        }

        // 4. Якщо просто пусто
        if (!playlists || playlists.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding-top:50px;">
                    <p style="opacity:0.5; color:#FFF;">
                        Знайдено 0 плейлистів для ID: <b>${tgUser.id}</b>
                    </p>
                    <p style="color:#FFF; font-size:12px; margin-top:10px;">Ти точно імпортував їх під цим ID?</p>
                    <button onclick="window.location.href='settings.html'" class="btn-main" style="margin-top:15px; width:auto;">В налаштування</button>
                </div>`;
            return;
        }

        // 5. Успіх - рендеримо
        container.innerHTML = playlists.map(pl => `
            <div class="library-card" onclick="playPlaylist('${pl.external_id}', '${pl.cover_url}')" style="cursor:pointer;">
                <img src="${pl.cover_url || 'https://via.placeholder.com/300'}" class="library-cover">
                <div class="library-info">
                    <div class="library-title">${pl.name}</div>
                    <div class="library-subtitle">
                        <i class="fab fa-youtube" style="color:#FF0000; font-size:10px;"></i> YouTube
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        // 6. Якщо все впало (JS Error)
        container.innerHTML = `<p style="color:red; text-align:center;">Critical Error: ${err.message}</p>`;
    }
}

// Клік по плейлисту -> Збереження даних -> Перехід на Головну
function playPlaylist(id, cover) {
    localStorage.setItem('active_playlist_id', id);
    localStorage.setItem('active_playlist_cover', cover);
    
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    window.location.href = 'index.html';
}

// ==========================================
// 5. ЛОГІКА ГОЛОВНОЇ СТОРІНКИ (ВІНІЛ)
// ==========================================

function initVinylPlayer() {
    const activeCover = localStorage.getItem('active_playlist_cover');
    
    if (activeCover) {
        // Оновлюємо картинку на вінілі
        const vinylImg = document.getElementById('vinyl-cover');
        if (vinylImg) vinylImg.src = activeCover;

        // Оновлюємо фон (Glow)
        const glow = document.getElementById('glow');
        if (glow) {
            glow.style.background = `url(${activeCover}) center/cover no-repeat`;
            // Важливо: переконатись що це не перекриває контент
        }
    }
}

// ==========================================
// 6. ДОПОМІЖНІ ФУНКЦІЇ (SETTINGS & UI)
// ==========================================

async function openVisibilityModal() {
    const tgUser = getTgUser();
    if (!tgUser) { tg.showAlert("Тільки в Telegram"); return; }

    const modal = document.getElementById('modal-visibility');
    const content = modal.querySelector('.modal-card');
    modal.classList.add('active');

    // Отримуємо плейлисти для керування видимістю
    const { data: playlists } = await supabaseClient.from('playlists').select('*').eq('user_id', tgUser.id).order('name', { ascending: true });
    
    content.innerHTML = `
        <h3 style="padding:20px 20px 0; color:#FFF; margin:0;">Керування</h3>
        <p style="padding:0 20px; color:rgba(255,255,255,0.5); font-size:12px; margin-bottom:15px;">Які плейлисти бачать друзі?</p>
        
        <div id="visibility-list" style="flex:1; overflow-y:auto; padding:0 20px 20px; display:flex; flex-direction:column; gap:8px;">
            <div class="list-item btn-juicy" onclick="importPlaylists()" style="background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); color:#FF0000; font-weight:700; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-cloud-download-alt"></i> Імпортувати з YouTube
                </div>
                <i class="fas fa-chevron-right" style="opacity:0.5;"></i>
            </div>
            
            <div style="height:1px; background:rgba(255,255,255,0.1); margin: 5px 0;"></div>

            ${(playlists || []).map(pl => `
                <div class="list-item" onclick="togglePlaylistVisibility(this, '${pl.id}', ${pl.is_visible})" style="cursor:pointer;">
                    <span style="color:#FFF; font-weight:600;">${pl.name}</span>
                    <div class="playlist-check ${pl.is_visible ? 'checked' : ''}"><i class="fas fa-check"></i></div>
                </div>
            `).join('')}
        </div>
        
        <div style="padding:20px; border-top:1px solid rgba(255,255,255,0.05); background:#121212;">
            <button class="btn-main" onclick="closeAllModals()">Готово</button>
        </div>
    `;
}

async function togglePlaylistVisibility(el, id, status) {
    const check = el.querySelector('.playlist-check');
    const newStatus = !check.classList.contains('checked');
    
    check.classList.toggle('checked');
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    await supabaseClient.from('playlists').update({ is_visible: newStatus }).eq('id', id);
    el.setAttribute('onclick', `togglePlaylistVisibility(this, '${id}', ${newStatus})`);
    updateVisibleCount();
}

async function updateVisibleCount() {
    const tgUser = getTgUser();
    if (!tgUser) return;
    const { count } = await supabaseClient.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', tgUser.id).eq('is_visible', true);
    const el = document.getElementById('allowed-count');
    if(el) el.innerText = count || 0;
}

// --- АВТОРИЗАЦІЯ ---
async function loginWithGoogle() {
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    const redirectUrl = window.location.origin + window.location.pathname;
    
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            scopes: 'https://www.googleapis.com/auth/youtube.readonly',
            queryParams: { access_type: 'offline', prompt: 'select_account consent' },
        },
    });
}

async function handleLogout() {
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    await supabaseClient.auth.signOut();
    localStorage.removeItem('yt_access_token');
    location.reload();
}

// --- UI UPDATES ---
function updateUI_LoggedIn(user) {
    const btn = document.getElementById('btn-connect-yt');
    if (!btn) return;
    btn.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px">
            <img src="${user.user_metadata.avatar_url}" style="width:24px; height:24px; border-radius:50%; border:2px solid #F00;">
            <div style="text-align:left;">
                <div style="color:#FFF; font-size:14px; font-weight:600;">YouTube Music</div>
                <div style="color:rgba(255,255,255,0.5); font-size:10px;">${user.email}</div>
            </div>
        </div>
        <i class="fas fa-cog" style="opacity:0.5; color:#FFF;"></i>
    `;
    btn.onclick = () => openAccountModal(user);
    const st = document.getElementById('yt-status');
    if(st) st.innerText = "";
}

function updateUI_LoggedOut() {
    const btn = document.getElementById('btn-connect-yt');
    if (!btn) return;
    btn.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fab fa-youtube" style="color: #FF0000; font-size:18px;"></i>
            <span style="color:#FFF; font-weight:600;">Підключити YouTube Music</span>
        </div>
    `;
    btn.onclick = () => document.getElementById('modal-connect-yt').classList.add('active');
}

async function updateUserProfile(user) {
    const tgUser = getTgUser();
    if (!tgUser) return;
    await supabaseClient.from('profiles').upsert({
        id: tgUser.id,
        email: user.email,
        full_name: user.user_metadata.full_name,
        avatar_url: user.user_metadata.avatar_url
    });
}

function openAccountModal(user) {
    const modal = document.getElementById('modal-account-actions');
    const info = document.getElementById('account-info-modal');
    info.innerHTML = `
        <img src="${user.user_metadata.avatar_url}" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; border: 3px solid var(--accent);">
        <p style="font-size: 16px; font-weight: 700; color:#FFF;">${user.user_metadata.full_name}</p>
        <p style="font-size: 12px; opacity: 0.5; color:#FFF;">${user.email}</p>
    `;
    modal.classList.add('active');
}

function closeAllModals() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
}

async function loadPrivacySettings() {
    const tgUser = getTgUser();
    if (!tgUser) return;
    const { data } = await supabaseClient.from('profiles').select('privacy_mode').eq('id', tgUser.id).single();
    if (data) updatePrivacyUI(data.privacy_mode || 'friends');
}

async function cyclePrivacyMode() {
    const tgUser = getTgUser();
    if (!tgUser) { tg.showAlert("Тільки в Telegram"); return; }
    
    const statusEl = document.getElementById('privacy-status');
    const currentText = statusEl ? statusEl.innerText : 'Друзі';
    
    let currentKey = Object.keys(privacyLabels).find(key => privacyLabels[key] === currentText) || 'friends';
    let nextIndex = (privacyModes.indexOf(currentKey) + 1) % privacyModes.length;
    let nextMode = privacyModes[nextIndex];

    updatePrivacyUI(nextMode);
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    await supabaseClient.from('profiles').update({ privacy_mode: nextMode }).eq('id', tgUser.id);
}

function updatePrivacyUI(mode) {
    const statusEl = document.getElementById('privacy-status');
    const iconEl = document.getElementById('privacy-icon');
    if (statusEl) statusEl.innerText = privacyLabels[mode];
    if (iconEl) {
        iconEl.className = ''; 
        if (mode === 'public') iconEl.className = 'fas fa-globe';
        else if (mode === 'friends') iconEl.className = 'fas fa-user-friends';
        else iconEl.className = 'fas fa-lock';
    }
}

// ==========================================
// 7. MAIN ENTRY POINT (ВИЗНАЧАЄМО СТОРІНКУ)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // Загальні функції (Авторизація, налаштування приватності)
    handleAuthRedirect();
    loadPrivacySettings();

    // Якщо ми на сторінці МЕДІАТЕКИ (playlists.html)
    if (document.getElementById('library-grid')) {
        loadLibrary();
    }
    
    // Якщо ми на ГОЛОВНІЙ (index.html) - ініціалізуємо вініл
    if (document.getElementById('vinyl-cover')) {
        initVinylPlayer();
    }
});