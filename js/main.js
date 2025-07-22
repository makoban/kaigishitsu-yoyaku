// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // バージョン情報を表示
    document.getElementById('version_info').textContent = APP_VERSION;
    
    // 設定をロードし、UIとアプリに適用
    loadSettings();
    applySettingsToUI();
    applyTheme(appSettings.theme);
    applyBaseFontSize(appSettings.baseFontSize);
    applyFontFamily(appSettings.baseFontFamily); 
    updateDisplayTitles(); 

    // UI要素の取得
    const settingsButton = document.getElementById('settings_button');
    const settingsPanel = document.getElementById('settings_panel');
    const closeSettingsPanelButton = document.getElementById('close_settings_panel');
    const authorizeButton = document.getElementById('authorize_button');
    const switchAccountButton = document.getElementById('switch_account_button'); 
    const refreshButton = document.getElementById('refresh_button'); 

    // 設定UI要素の取得 (設定保存/適用用)
    const themeSelect = document.getElementById('theme_select');
    const refreshIntervalSelect = document.getElementById('refresh_interval_select');
    const displayPastHoursInput = document.getElementById('display_past_hours_input');
    const displayFutureHoursInput = document.getElementById('display_future_hours_input');
    const baseFontSizeInput = document.getElementById('base_font_size_input');
    const fontFamilySelect = document.getElementById('font_family_select'); 
    const mainTitleInput = document.getElementById('main_title_input'); 
    const eventListTitleInput = document.getElementById('event_list_title_input'); 
    const availableTextInput = document.getElementById('available_text_input');
    const inProgressPrefixInput = document.getElementById('in_progress_prefix_input');
    const inProgressSuffixInput = document.getElementById('in_progress_suffix_input');
    const preAnnouncementMinutesSelect = document.getElementById('pre_announcement_minutes_select'); 
    const preAnnouncementPrefixInput = document.getElementById('pre_announcement_prefix_input'); 
    const preAnnouncementSuffixInput = document.getElementById('pre_announcement_suffix_input'); 
    const preAnnouncementDefaultTextInput = document.getElementById('pre_announcement_default_text_input'); 
    const eventSummaryInput = document.getElementById('event_summary_input');
    
    // --- 設定ボタンのイベントリスナー ---
    settingsButton.style.display = 'none'; // 初期は非表示
    settingsButton.onclick = () => {
        settingsPanel.classList.toggle('open');
        if (settingsPanel.classList.contains('open')) {
            checkCurrentCalendarStatus(); // 設定パネルを開いた際に状態をチェック
            if (isAuthorizedForWrite) {
                listWritableCalendars(); 
                listAccessibleCalendars(); // 追加: アクセス可能なカレンダーリストを表示
            } else {
                // 認証されていない場合は、アクセス可能リストのセクションを表示するが、内容は認証を促すメッセージ
                document.getElementById('accessible_calendar_list_section').style.display = 'block';
                document.getElementById('accessible_calendar_list').innerHTML = '<li>Googleアカウントで認証すると、アクセス可能なカレンダーリストが表示されます。</li>';
            }
        } else {
            displayError(''); // パネルが閉じたらエラー表示をクリア
        }
    };
    
    // --- 更新ボタンのダブルクリック検出 ---
    let clickCount = 0;
    let clickTimer = null;
    
    refreshButton.addEventListener('click', (e) => {
        clickCount++;
        
        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                listEvents();
                clickCount = 0;
            }, 400); 
        } else if (clickCount === 2) {
            clearTimeout(clickTimer);
            clickCount = 0;
            
            console.log('--- 更新ボタンがダブルクリックされました ---');
            
            if (settingsButton.style.display === 'none' || settingsButton.style.display === '') {
                settingsButton.style.display = 'block';
                settingsButton.disabled = false;
                console.log('設定ボタンが表示されました');
                
                refreshButton.style.backgroundColor = '#28a745';
                refreshButton.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    refreshButton.style.backgroundColor = '';
                    refreshButton.style.transform = '';
                }, 500);
            } else {
                settingsButton.style.display = 'none';
                settingsPanel.classList.remove('open');
                console.log('設定ボタンが非表示になりました');
                
                refreshButton.style.backgroundColor = '#dc3545';
                refreshButton.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    refreshButton.style.backgroundColor = '';
                    refreshButton.style.transform = '';
                }, 500);
            }
        }
    });

    // --- 設定パネルを閉じるボタン（脱出制御追加） ---
    closeSettingsPanelButton.onclick = () => {
        if (!canCloseSettings) {
            if (currentCalendarState === 'id_not_found') {
                displayError('アカウントエラー: このカレンダーIDは許可されていません。設定から許可されたカレンダーを選択してください。');
            } else if (currentCalendarState === 'expired') {
                const expiredCal = allowedCalendars.find(cal => cal.calendar_id === currentCalendarId);
                displayExpiredCalendarNotice(expiredCal); 
            } else if (currentCalendarState === 'api_error') {
                 displayError('APIの初期化に失敗しています。ネットワーク接続を確認してください。');
            }
            console.log('🚨 設定画面からの脱出がブロックされました：カレンダーに問題あり');
            return;
        }
        settingsPanel.classList.remove('open');
        displayError(''); 
    };
    
    // --- 設定パネル外クリックでの閉鎖も制御 ---
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) { 
            if (!canCloseSettings) {
                if (currentCalendarState === 'id_not_found') {
                    displayError('アカウントエラー: このカレンダーIDは許可されていません。設定から許可されたカレンダーを選択してください。');
                } else if (currentCalendarState === 'expired') {
                    const expiredCal = allowedCalendars.find(cal => cal.calendar_id === currentCalendarId);
                    displayExpiredCalendarNotice(expiredCal); 
                } else if (currentCalendarState === 'api_error') {
                    displayError('APIの初期化に失敗しています。ネットワーク接続を確認してください。');
                }
                console.log('🚨 設定画面からの脱出がブロックされました：カレンダーに問題あり');
                return;
            }
            settingsPanel.classList.remove('open');
            displayError('');
        }
    });

    // --- 各種設定UI要素のイベントリスナー ---
    themeSelect.onchange = (e) => { appSettings.theme = e.target.value; saveSettings(); applyTheme(appSettings.theme); };
    refreshIntervalSelect.onchange = (e) => { appSettings.refreshInterval = parseInt(e.target.value); saveSettings(); startAutoRefresh(); };
    displayPastHoursInput.onchange = (e) => { appSettings.displayPastHours = parseInt(e.target.value); saveSettings(); listEvents(); };
    displayFutureHoursInput.onchange = (e) => { appSettings.displayFutureHours = parseInt(e.target.value); saveSettings(); listEvents(); };
    baseFontSizeInput.onchange = (e) => { appSettings.baseFontSize = parseInt(e.target.value); saveSettings(); applyBaseFontSize(appSettings.baseFontSize); };
    fontFamilySelect.onchange = (e) => { appSettings.baseFontFamily = e.target.value; saveSettings(); applyFontFamily(appSettings.baseFontFamily); }; 
    mainTitleInput.onchange = (e) => { appSettings.mainTitle = e.target.value; saveSettings(); updateDisplayTitles(); }; 
    eventListTitleInput.onchange = (e) => { appSettings.eventListTitle = e.target.value; saveSettings(); updateDisplayTitles(); }; 
    availableTextInput.onchange = (e) => { appSettings.availableText = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); }; 
    inProgressPrefixInput.onchange = (e) => { appSettings.inProgressPrefix = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); };
    inProgressSuffixInput.onchange = (e) => { appSettings.inProgressSuffix = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); };
    preAnnouncementMinutesSelect.onchange = (e) => { appSettings.preAnnouncementMinutes = parseInt(e.target.value); saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); }; 
    preAnnouncementPrefixInput.onchange = (e) => { appSettings.preAnnouncementPrefix = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); }; 
    preAnnouncementSuffixInput.onchange = (e) => { appSettings.preAnnouncementSuffix = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); }; 
    preAnnouncementDefaultTextInput.onchange = (e) => { appSettings.preAnnouncementDefaultText = e.target.value; saveSettings(); updateEventHighlightsAndAnnouncement(appSettings.lastEvents || []); }; 
    eventSummaryInput.onchange = (e) => { appSettings.eventSummary = e.target.value; saveSettings(); updateAddButtonText(); }; 

    // --- 認証関連ボタンのイベントリスナー ---
    authorizeButton.onclick = () => {
        console.log('--- Googleアカウントで認証ボタンがクリックされました（操作用）。認証フローを開始します。---');
        tokenClient.requestAccessToken({ prompt: 'consent', ux_mode: 'popup' }); 
    };
    switchAccountButton.onclick = () => { 
        console.log('--- 別のアカウントで認証ボタンがクリックされました。アカウント選択を強制します。---');
        tokenClient.requestAccessToken({ prompt: 'select_account', ux_mode: 'popup' }); 
    };

    // --- 操作ボタンのイベントリスナー ---
    document.getElementById('add_30min_event_button').onclick = () => handleAddEvent(30);
    document.getElementById('add_60min_event_button').onclick = () => handleAddEvent(60); 

    setInterval(updateCurrentDateTime, 1000);
    updateCurrentDateTime(); 

    updateAddButtonText();

    console.log('--- 許可カレンダーリストの読み込みを開始 ---');
    loadAllowedCalendars().then(() => {
        checkCurrentCalendarStatus(); // 起動時のカレンダー状態チェック
        
        console.log('--- gapiクライアントロードを開始 ---');
        gapi.load('client', initGapiClientForRead);
    });
});

/**
 * Google APIクライアントを読み込み専用モードで初期化します。
 * localStorageからアクティブカレンダーをロードし、イベントリストの表示を開始します。
 */
function initGapiClientForRead() {
    console.log('--- initGapiClientForRead: 読み込み専用クライアント初期化中 ---');
    gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    }).then(async () => {
        console.log('✅ gapi client initialized for read-only access (API Key only).');
        
        console.log('--- initGapiClientForRead: localStorageからアクティブカレンダーを読み込み試行 ---');
        const savedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY);
        const savedActiveSummary = localStorage.getItem(LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY);

        if (savedActiveId) { 
            currentCalendarId = savedActiveId;
            currentCalendarSummary = savedActiveSummary || savedActiveId; 
            
            try {
                const actualSummary = await getCalendarSummary(savedActiveId);
                if (actualSummary && actualSummary !== savedActiveId) { 
                    currentCalendarSummary = actualSummary;
                    localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY, actualSummary);
                }
            } catch (error) {
                console.warn('サマリー再取得に失敗しました:', error);
            }
            console.log(`✅ localStorageからアクティブカレンダーを読み込みました: ${currentCalendarSummary} (${currentCalendarId})`);
        } else {
            currentCalendarId = INITIAL_PUBLIC_CALENDAR_ID; 
            try {
                currentCalendarSummary = await getCalendarSummary(INITIAL_PUBLIC_CALENDAR_ID);
            } catch (error) {
                currentCalendarSummary = "初期設定カレンダー";
            }
            console.log(`ℹ️ localStorageにアクティブカレンダーが見つかりませんでした。初期設定カレンダー (${INITIAL_PUBLIC_CALENDAR_ID}) を使用します。`);
        }
        
        checkCurrentCalendarStatus(); 
        updateDisplayedCalendarInfo();

        console.log(`--- initGapiClientForRead: イベントリスト表示を開始 (カレンダーID: ${currentCalendarId}) ---`);
        listEvents(); 
        startAutoRefresh(); 

        console.log('--- initGapiClientForRead: GISクライアント初期化を開始（書き込み操作用） ---');
        initGisClientForWrite();

    }).catch(err => {
        console.error('❌ gapiクライアントの初期化エラー（読み込み用）:', err);
        displayError('イベント表示の初期化に失敗しました。APIキーまたはネットワーク接続を確認してください。');
        currentCalendarState = 'api_error'; 
        canCloseSettings = false; 
        checkCurrentCalendarStatus(); 
    });
}

/**
 * イベントリストの自動更新を開始します。
 * 既存のタイマーがあればクリアします。
 */
function startAutoRefresh() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId); 
    }
    refreshIntervalId = setInterval(listEvents, appSettings.refreshInterval * 1000);
    console.log(`--- 自動更新を開始しました: ${appSettings.refreshInterval}秒間隔 ---`);
}

/**
 * Google Calendar APIからイベントリストを取得し、表示を更新します。
 * カレンダーの状態によってはイベントの取得をスキップします。
 */
async function listEvents() {
    const eventListUl = document.getElementById('event_list');
    displayError(''); 

    checkCurrentCalendarStatus(); 

    if (currentCalendarState !== 'ok') {
        let errorMessageText = '';
        if (currentCalendarState === 'id_not_found') {
            errorMessageText = 'アカウントエラー: このカレンダーIDは許可されていません。';
        } else if (currentCalendarState === 'expired') {
            errorMessageText = '有効期限エラー: このカレンダーは有効期限が切れています。';
        } else if (currentCalendarState === 'api_error') {
            errorMessageText = 'APIの初期化に失敗しました。';
        }
        displayError(errorMessageText + '設定から別のカレンダーを選択してください。');
        eventListUl.innerHTML = `<li class="error-message">イベントの読み込みに失敗しました。${errorMessageText}</li>`; 
        updateActionButtonStates(); 
        return;
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - (appSettings.displayPastHours * 60 * 60 * 1000)).toISOString(); 
    const timeMax = new Date(now.getTime() + (appSettings.displayFutureHours * 60 * 60 * 1000)).toISOString(); 

    console.log(`--- listEvents: イベント取得を試みます。カレンダーID: ${currentCalendarId}, 期間: ${timeMin} から ${timeMax} ---`);

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': currentCalendarId,
            'timeMin': timeMin,
            'timeMax': timeMax,
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime', 
            'maxResults': 20
        });

        let events = response.result.items;
        // 現在進行中または次に開始するイベントを先頭に移動するロジック
        if (events && events.length > 0) {
            const currentTime = new Date(); 
            events.sort((a, b) => {
                const startA = new Date(a.start.dateTime || a.start.date);
                const endA = new Date(a.end.dateTime || a.end.date);
                const startB = new Date(b.start.dateTime || b.start.date);
                const endB = new Date(b.end.dateTime || b.end.date);

                const aIsCurrent = (currentTime >= startA && currentTime < endA);
                const bIsCurrent = (currentTime >= startB && currentTime < endB);

                const aStartsSoon = (startA > currentTime && (startA.getTime() - currentTime.getTime()) <= (appSettings.preAnnouncementMinutes * 60 * 1000));
                const bStartsSoon = (startB > currentTime && (startB.getTime() - currentTime.getTime()) <= (appSettings.preAnnouncementMinutes * 60 * 1000)); 

                if (aIsCurrent && !bIsCurrent) return -1; 
                if (!aIsCurrent && bIsCurrent) return 1;  

                if (aStartsSoon && !bStartsSoon) return -1;
                if (!aStartsSoon && bStartsSoon) return 1;

                return startA.getTime() - startB.getTime();
            });
        }

        const eventsForComparison = events.map(event => ({
            id: event.id,
            summary: event.summary,
            start: event.start,
            end: event.end
        }));
        const newEventsString = JSON.stringify(eventsForComparison); 

        if (newEventsString === lastFetchedEventsString && eventListUl.children.length > 0 && !eventListUl.innerHTML.includes("イベントを読み込み中")) {
            console.log('ℹ️ イベントデータに変化がないため、DOM更新をスキップします。');
            updateEventHighlightsAndAnnouncement(events); 
            return; 
        }

        lastFetchedEventsString = newEventsString; 
        appSettings.lastEvents = events; 
        saveSettings(); 

        eventListUl.innerHTML = ''; 

        if (events && events.length > 0) {
            events.forEach(event => {
                const start = new Date(event.start.dateTime || event.start.date);
                const end = new Date(event.end.dateTime || event.end.date);

                const startDate = start.toLocaleDateString('ja-JP');
                const startTime = start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const endTime = end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                const li = document.createElement('li');
                li.className = 'event-item';
                let eventDetailsHtml;

                if (event.start.date && !event.start.dateTime) { 
                     eventDetailsHtml = `
                         <div class="event-details">
                             <span class="event-time">${startDate} (終日)</span>
                             <span class="event-summary">${event.summary || 'タイトルなし'}</span>
                         </div>
                     `;
                } else {
                    eventDetailsHtml = `
                         <div class="event-details">
                             <span class="event-time">${startDate} ${startTime} - ${endTime}</span>
                             <span class="event-summary">${event.summary || 'タイトルなし'}</span>
                         </div>
                     `;
                }
                
                li.innerHTML = eventDetailsHtml + `<button class="event-delete-button" data-event-id="${event.id}">削除</button>`;
                eventListUl.appendChild(li);
            });
            console.log(`✅ イベントを正常に表示しました (${currentCalendarSummary}):`, events);

            document.querySelectorAll('.event-delete-button').forEach(button => {
                button.onclick = (event) => {
                    const eventIdToDelete = event.target.dataset.eventId;
                    handleDeleteEvent(eventIdToDelete); 
                };
            });

        } else {
            const li = document.createElement('li');
            li.className = 'no-events';
            li.textContent = '指定された期間にイベントが見つかりませんでした。';
            eventListUl.appendChild(li);
            console.log(`ℹ️ イベントが見つかりませんでした (${currentCalendarSummary})。`);
        }

        updateEventHighlightsAndAnnouncement(events); 
        updateActionButtonStates(); 

    } catch (err) {
        console.error(`❌ イベントの取得エラー (${currentCalendarId}):`, err.result ? err.result.error : err);
        // APIエラー時の表示を強化
        let apiErrorMessage = 'イベントの読み込みに失敗しました。';
        if (err.result && err.result.error && err.result.error.message) {
            apiErrorMessage += `エラー: ${err.result.error.message}`;
        }
        displayError(apiErrorMessage);
        eventListUl.innerHTML = `<li class="error-message">${apiErrorMessage}</li>`;
        updateActionButtonStates(); 
    }
}
        
/**
 * イベントのハイライト表示と案内文（使用中、空室、予約前案内）を更新します。
 * @param {Array<object>} events - 表示中のイベントオブジェクトの配列
 */
function updateEventHighlightsAndAnnouncement(events) {
    const now = new Date();
    let currentEventFound = false;
    let currentEventSummary = '';
    let preAnnouncementFound = false; 
    let preAnnouncementSummary = ''; 

    document.querySelectorAll('.event-item').forEach(item => {
        item.classList.remove('current-event');
    });

    let closestUpcomingEvent = null;

    events.forEach((event, index) => {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        
        if (now >= start && now < end) {
            const liElement = document.querySelector(`#event_list li:nth-child(${index + 1})`);
            if (liElement) {
                liElement.classList.add('current-event');
            }
            currentEventFound = true;
            currentEventSummary = event.summary || '名称未設定の会議';
        }
        
        if (now < start) {
            const timeUntilStart = start.getTime() - now.getTime(); 
            if (timeUntilStart > 0 && timeUntilStart <= (appSettings.preAnnouncementMinutes * 60 * 1000)) { 
                if (!closestUpcomingEvent || timeUntilStart < (new Date(closestUpcomingEvent.start.dateTime || closestUpcomingEvent.start.date).getTime() - now.getTime())) {
                    closestUpcomingEvent = event;
                }
            }
        }
    });

    const preAnnouncementTextElement = document.getElementById('pre_announcement_text');
    if (closestUpcomingEvent) {
        preAnnouncementFound = true;
        preAnnouncementSummary = closestUpcomingEvent.summary || '名称未設定の会議';
    }
    
    if (preAnnouncementFound) {
        preAnnouncementTextElement.textContent = `${appSettings.preAnnouncementPrefix}「${preAnnouncementSummary}」${appSettings.preAnnouncementSuffix}`;
        preAnnouncementTextElement.style.display = 'block';
    } else {
        preAnnouncementTextElement.textContent = appSettings.preAnnouncementDefaultText; 
        preAnnouncementTextElement.style.display = 'block'; 
    }

    const announcementTextElement = document.getElementById('announcement_text');
    if (currentEventFound) {
        announcementTextElement.textContent = `${appSettings.inProgressPrefix}「${currentEventSummary}」${appSettings.inProgressSuffix}`;
        announcementTextElement.classList.remove('available'); 
        announcementTextElement.style.display = 'block';
    } else { 
        announcementTextElement.textContent = appSettings.availableText;
        announcementTextElement.classList.add('available'); 
        announcementTextElement.style.display = 'block'; 
    }
}

/**
 * 緊急会議追加ボタンとイベント削除ボタンの有効/無効状態を更新します。
 * 認証状態とカレンダーの許可状態に依存します。
 */
function updateActionButtonStates() {
    const add30Button = document.getElementById('add_30min_event_button');
    const add60Button = document.getElementById('add_60min_event_button');
    const deleteButtons = document.querySelectorAll('.event-delete-button');

    const canPerformOperations = isAuthorizedForWrite && currentCalendarState === 'ok';

    add30Button.disabled = !canPerformOperations;
    add60Button.disabled = !canPerformOperations;

    deleteButtons.forEach(button => {
        button.disabled = !canPerformOperations;
    });

    console.log(`ℹ️ 操作ボタンの状態を更新しました。認証済み: ${isAuthorizedForWrite}, カレンダー状態: ${currentCalendarState}`);
}

/**
 * 指定された時間（分）の緊急会議イベントをカレンダーに追加します。
 * 認証状態とカレンダーの許可状態をチェックします。
 * @param {number} durationMinutes - 追加するイベントの期間（分）
 */
async function handleAddEvent(durationMinutes) {
    checkCurrentCalendarStatus(); 

    if (!isAuthorizedForWrite) {
        document.getElementById('settings_panel').classList.add('open');
        document.getElementById('auth_status').textContent = `イベントを追加するにはGoogleアカウントで認証してください。`;
        document.getElementById('auth_status').style.color = 'blue';
        document.getElementById('authorize_button').style.display = 'block';
        document.getElementById('switch_account_button').style.display = 'none'; 
        document.getElementById('calendar_selection_panel').style.display = 'none';
        console.log('🚨 イベント追加: 書き込み権限がありません。認証を促します。');
        return;
    }

    if (currentCalendarState !== 'ok') {
        let errorMessage = '';
        if (currentCalendarState === 'id_not_found') {
            errorMessage = 'アカウントエラー: このカレンダーIDは許可されていません。';
        } else if (currentCalendarState === 'expired') {
            errorMessage = '有効期限エラー: このカレンダーは有効期限が切れています。';
        } else if (currentCalendarState === 'api_error') {
            errorMessage = 'APIの初期化に失敗しました。';
        }
        displayError(errorMessage + '設定から別のカレンダーを選択してください。');
        console.log(`🚨 イベント追加: カレンダー状態が不正です (${currentCalendarState})。`);
        return;
    }

    console.log(`✅ ${durationMinutes}分間のイベントを追加します。`);
    const now = new Date();
    const eventEndTime = new Date(now.getTime() + (durationMinutes * 60 * 1000)); 

    const event = {
        'summary': `${appSettings.eventSummary} (${durationMinutes}分)`, 
        'location': '会議室', 
        'description': '', 
        'start': {
            'dateTime': now.toISOString(),
            'timeZone': 'Asia/Tokyo'
        },
        'end': {
            'dateTime': eventEndTime.toISOString(),
            'timeZone': 'Asia/Tokyo'
        },
        'reminders': {
            'useDefault': true
        }
    };

    try {
        const response = await gapi.client.calendar.events.insert({
            'calendarId': currentCalendarId, 
            'resource': event
        });
        console.log('✅ イベントが追加されました:', response.result);
        listEvents(); 
    } catch (err) {
        console.error('❌ イベント追加エラー:', err.result ? err.result.error : err);
        displayError(`イベントの追加に失敗しました: ${err.result && err.result.error && err.result.error.message ? err.result.error.message : err.message}`);
    }
}

/**
 * 指定されたIDのイベントをカレンダーから削除します。
 * 認証状態とカレンダーの許可状態をチェックします。
 * @param {string} eventIdToDelete - 削除するイベントのID
 */
async function handleDeleteEvent(eventIdToDelete) {
    checkCurrentCalendarStatus(); 

    if (!isAuthorizedForWrite) {
        document.getElementById('settings_panel').classList.add('open');
        document.getElementById('auth_status').textContent = `イベントを削除するにはGoogleアカウントで認証してください。`;
        document.getElementById('auth_status').style.color = 'blue';
        document.getElementById('authorize_button').style.display = 'block';
        document.getElementById('switch_account_button').style.display = 'none'; 
        document.getElementById('calendar_selection_panel').style.display = 'none';
        console.log('🚨 イベント削除: 書き込み権限がありません。認証を促します。');
        return;
    }

    if (currentCalendarState !== 'ok') {
        let errorMessage = '';
        if (currentCalendarState === 'id_not_found') {
            errorMessage = 'アカウントエラー: このカレンダーIDは許可されていません。';
        } else if (currentCalendarState === 'expired') {
            errorMessage = '有効期限エラー: このカレンダーは有効期限が切れています。';
        } else if (currentCalendarState === 'api_error') {
            errorMessage = 'APIの初期化に失敗しました。';
        }
        displayError(errorMessage + '設定から別のカレンダーを選択してください。');
        console.log(`🚨 イベント削除: カレンダー状態が不正です (${currentCalendarState})。`);
        return;
    }

    console.log(`✅ イベント (ID: ${eventIdToDelete}) を削除します。`);
    try {
        await gapi.client.calendar.events.delete({
            'calendarId': currentCalendarId, 
            'eventId': eventIdToDelete
        });
        console.log('✅ イベントが削除されました。');
        listEvents(); 
    } catch (err) {
        console.error('❌ イベント削除エラー:', err.result ? err.result.error : err);
        displayError(`イベントの削除に失敗しました: ${err.result && err.result.error && err.result.error.message ? err.result.error.message : err.message}`);
    }
}
