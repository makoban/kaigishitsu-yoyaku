// js/settings.js

/**
 * アプリ設定をUI要素に適用します。
 */
window.applySettingsToUI = function() { // グローバル化
    document.getElementById('theme_select').value = appSettings.theme;
    document.getElementById('refresh_interval_select').value = appSettings.refreshInterval;
    document.getElementById('display_past_hours_input').value = appSettings.displayPastHours;
    document.getElementById('display_future_hours_input').value = appSettings.displayFutureHours;
    document.getElementById('base_font_size_input').value = appSettings.baseFontSize;
    document.getElementById('font_family_select').value = appSettings.baseFontFamily; 
    document.getElementById('main_title_input').value = appSettings.mainTitle; 
    document.getElementById('event_list_title_input').value = appSettings.eventListTitle; 
    document.getElementById('available_text_input').value = appSettings.availableText;
    document.getElementById('in_progress_prefix_input').value = appSettings.inProgressPrefix;
    document.getElementById('in_progress_suffix_input').value = appSettings.inProgressSuffix;
    document.getElementById('pre_announcement_minutes_select').value = appSettings.preAnnouncementMinutes;
    document.getElementById('pre_announcement_prefix_input').value = appSettings.preAnnouncementPrefix;
    document.getElementById('pre_announcement_suffix_input').value = appSettings.preAnnouncementSuffix;
    document.getElementById('pre_announcement_default_text_input').value = appSettings.preAnnouncementDefaultText;
    document.getElementById('event_summary_input').value = appSettings.eventSummary;
}

/**
 * 選択されたテーマをボディに適用します。
 * @param {string} themeName - テーマ名 ('pop', 'chic', 'stylish')
 */
window.applyTheme = function(themeName) { // グローバル化
    document.body.classList.remove('theme-pop', 'theme-chic', 'theme-stylish');
    document.body.classList.add(`theme-${themeName}`);
    console.log(`テーマを "${themeName}" に変更しました。`);
}

/**
 * 基本フォントサイズをCSSカスタムプロパティとして適用します。
 * @param {number} fontSize - 基本フォントサイズ (px)
 */
window.applyBaseFontSize = function(fontSize) { // グローバル化
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    console.log(`基本フォントサイズを ${fontSize}px に設定しました。`);
}

/**
 * フォントファミリーをCSSカスタムプロパティとして適用します。
 * @param {string} fontFamily - フォントファミリーの文字列
 */
window.applyFontFamily = function(fontFamily) { // グローバル化
    document.documentElement.style.setProperty('--base-font-family', fontFamily);
    console.log(`フォントファミリーを "${fontFamily}" に設定しました。`);
}

/**
 * 「緊急会議」ボタンのテキストを現在の設定に合わせて更新します。
 */
window.updateAddButtonText = function() { // グローバル化
    const eventSummary = appSettings.eventSummary || "緊急会議";
    document.getElementById('add_30min_event_button').textContent = `${eventSummary} (30分)`;
    document.getElementById('add_60min_event_button').textContent = `${eventSummary} (60分)`;
}

/**
 * メインタイトルとイベントリストのタイトルを現在の設定に合わせて更新します。
 */
window.updateDisplayTitles = function() { // グローバル化
    document.getElementById('main_app_title').textContent = appSettings.mainTitle;
    document.getElementById('event_list_section_title').textContent = appSettings.eventListTitle;
    console.log(`✅ 表示タイトルを更新しました: メイン「${appSettings.mainTitle}」、イベントリスト「${appSettings.eventListTitle}」`);
}


/**
 * Google Calendar APIからカレンダーのサマリー（名前）を取得します。
 * 失敗した場合はカレンダーIDを返します。
 * @param {string} calendarId - 取得するカレンダーのID
 * @returns {Promise<string>} カレンダーのサマリー、またはカレンダーID
 */
window.getCalendarSummary = async function(calendarId) { // グローバル化
    try {
        // gapi.client.calendar が初期化されていない可能性があるのでチェックを強化
        if (!gapi.client || !gapi.client.calendar || !gapi.client.calendar.calendars) {
            console.warn('gapi.client.calendar が未初期化またはAPIサービスが利用不可のためサマリー取得をスキップします。');
            return calendarId;
        }
        const response = await gapi.client.calendar.calendars.get({
            calendarId: calendarId
        });
        return response.result.summary || calendarId;
    } catch (error) {
        console.warn(`カレンダーサマリー取得エラー (${calendarId}):`, error);
        return calendarId;
    }
}


/**
 * 許可されたカレンダーのCSVリストを読み込みます。
 * 各カレンダーの有効期限をチェックし、`allowedCalendars`配列を更新します。
 * @returns {Promise<boolean>} 読み込みが成功したかを示すPromise
 */
window.loadAllowedCalendars = async function() { // グローバル化
    const statusElement = document.getElementById('calendar_security_status');
    try {
        statusElement.textContent = '許可リストを読み込み中...';
        statusElement.className = 'calendar-security-status';
        
        const response = await fetch(ALLOWED_CALENDARS_CSV_PATH, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            throw new Error(`ファイルが見つかりません (HTTP ${response.status})`);
        }
        
        const csvText = await response.text();
        const parsedData = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            delimiter: ','
        });
        
        const rawCalendars = parsedData.data.filter(row => row.calendar_id && row.calendar_id.trim() !== '');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        let validCount = 0;
        let expiredCount = 0;
        
        window.allowedCalendars = rawCalendars.map(calendar => { // グローバル変数に代入
            const validUntilValue = calendar.valid_until || calendar['有効年月日'] || calendar['有効期限'];
            
            if (!validUntilValue || validUntilValue.trim() === '') {
                console.warn(`⚠️ カレンダー ${calendar.calendar_id} の有効期限が設定されていません。`);
                calendar.isExpired = true;
                calendar.expiryReason = '期限設定なし';
                expiredCount++;
                return calendar;
            }
            
            let validUntilDate;
            const dateStr = validUntilValue.trim();
            
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; 
                    const day = parseInt(parts[2]);
                    validUntilDate = new Date(year, month, day);
                }
            } else if (dateStr.includes('-')) {
                validUntilDate = new Date(dateStr);
            } else {
                validUntilDate = new Date(dateStr);
            }
            
            if (isNaN(validUntilDate.getTime())) {
                console.warn(`⚠️ カレンダー ${calendar.calendar_id} の有効期限形式が不正です: ${validUntilValue}`);
                calendar.isExpired = true;
                calendar.expiryReason = '期限形式不正';
                expiredCount++;
                return calendar;
            }
            
            if (today > validUntilDate) {
                console.warn(`⚠️ カレンダー ${calendar.calendar_id} の有効期限が切れています: ${validUntilValue} (今日: ${today.toLocaleDateString()})`);
                calendar.isExpired = true;
                calendar.expiryReason = '期限切れ';
                expiredCount++;
            } else {
                console.log(`✅ カレンダー ${calendar.calendar_id} は有効です (期限: ${validUntilValue}, 今日: ${today.toLocaleDateString()})`);
                calendar.isExpired = false;
                validCount++;
            }
            
            calendar.valid_until = validUntilValue;
            calendar.company_name = calendar.company_name || calendar['会社名'] || '';
            calendar.memo = calendar.memo || calendar['メモ'] || '';
            
            return calendar;
        });
        
        if (expiredCount > 0) {
            statusElement.textContent = `⚠️ 許可リスト読み込み完了 (有効: ${validCount}件, 期限切れ: ${expiredCount}件)`;
            statusElement.className = 'calendar-security-status expired';
        } else {
            statusElement.textContent = `✅ 許可リスト読み込み完了 (有効: ${validCount}件)`;
            statusElement.className = 'calendar-security-status success';
        }
        
        console.log('✅ 許可カレンダーリスト（期限切れ含む）:', allowedCalendars);
        
        return true;
        
    } catch (error) {
        console.error('❌ 許可カレンダーリスト読み込みエラー:', error);
        statusElement.textContent = `❌ 許可リスト読み込み失敗: ${error.message}`;
        statusElement.className = 'calendar-security-status error';
        
        window.allowedCalendars = [{ // グローバル変数に代入
            calendar_id: INITIAL_PUBLIC_CALENDAR_ID,
            valid_until: '2099-12-31',
            company_name: '初期設定',
            memo: 'デフォルトカレンダー',
            isExpired: false
        }];
        return false;
    }
}

/**
 * 指定されたカレンダーIDが許可リストに存在するかどうかをチェックします。
 * @param {string} calendarId - チェックするカレンダーID
 * @returns {boolean} 許可リストに存在すればtrue、そうでなければfalse
 */
window.isCalendarAllowed = function(calendarId) { // グローバル化
    return allowedCalendars.some(allowed => allowed.calendar_id === calendarId);
}

/**
 * 指定されたカレンダーIDが有効期限内であるかをチェックします。
 * (許可リストに存在することが前提)
 * @param {string} calendarId - チェックするカレンダーID
 * @returns {boolean} 有効期限内であればtrue、そうでなければfalse
 */
window.isCalendarValid = function(calendarId) { // グローバル化
    const calendar = allowedCalendars.find(allowed => allowed.calendar_id === calendarId);
    return calendar && !calendar.isExpired;
}

/**
 * 現在選択されているカレンダーの許可状態と有効期限をチェックし、
 * UIの表示と設定パネルの閉じられ制御を更新します。
 * `currentCalendarState` グローバル変数を更新します。
 */
window.checkCurrentCalendarStatus = function() { // グローバル化
    const statusElement = document.getElementById('calendar_security_status');
    const foundCalendarInAllowedList = allowedCalendars.find(cal => cal.calendar_id === currentCalendarId);
    const closeButton = document.getElementById('close_settings_panel');
    
    if (!foundCalendarInAllowedList) {
        currentCalendarState = 'id_not_found';
        canCloseSettings = false; 
        statusElement.textContent = `❌ アカウントエラー: このカレンダーID (${currentCalendarId}) は許可されていません。`;
        statusElement.className = 'calendar-security-status error';
        displayError('アカウントエラー: 現在選択中のカレンダーIDは許可リストにありません。管理者に連絡してください。');
        console.error('🚨 カレンダー状態: IDが許可リストに見つかりません。');
    } else if (foundCalendarInAllowedList.isExpired) {
        currentCalendarState = 'expired';
        canCloseSettings = false; 
        statusElement.textContent = `⚠️ 有効期限切れ: ${currentCalendarSummary} (${currentCalendarId})`;
        statusElement.className = 'calendar-security-status expired';
        displayExpiredCalendarNotice(foundCalendarInAllowedList); 
        console.warn('🚨 カレンダー状態: 有効期限切れです。');
    } else {
        currentCalendarState = 'ok';
        canCloseSettings = true; 
        statusElement.textContent = `✅ 現在のカレンダーは有効です: ${currentCalendarSummary} (${currentCalendarId})`;
        statusElement.className = 'calendar-security-status success';
        displayError(''); // 問題なければエラー表示をクリア
        console.log('✅ カレンダー状態: 問題ありません。');
    }

    if (document.getElementById('settings_panel').classList.contains('open')) {
         closeButton.disabled = !canCloseSettings;
    } else {
        closeButton.disabled = false; // パネルが閉じているときはボタンを有効に戻す
    }
}

/**
 * Google Identity Services (GIS) クライアントを初期化し、
 * 書き込み操作のための認証フローを設定します。
 */
window.initGisClientForWrite = function() { // グローバル化
    console.log('--- initGisClientForWrite: GISクライアント初期化中 ---');
    // ★ tokenClient がここで初期化され、グローバル変数に割り当てられる ★
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: WRITE_SCOPES,
        callback: (tokenResponse) => {
            console.log('--- tokenClient callback executed for write scope ---');
            if (tokenResponse && tokenResponse.access_token) {
                gapi.client.setToken(tokenResponse);
                isAuthorizedForWrite = true;
                document.getElementById('auth_status').textContent = '操作権限が認証されました。';
                document.getElementById('auth_status').style.color = 'green';
                document.getElementById('authorize_button').style.display = 'none'; 
                document.getElementById('switch_account_button').style.display = 'block'; 
                document.getElementById('calendar_selection_panel').style.display = 'block'; 
                document.getElementById('accessible_calendar_list_section').style.display = 'block'; // 追加: アクセス可能リストを表示
                console.log('✅ 書き込み権限のためのアクセストークンを取得しました。');
                
                // 認証成功後、カレンダー状態を再チェックし、リストを更新
                checkCurrentCalendarAfterAuth(); 
                listWritableCalendars(); 
                listAccessibleCalendars(); // 追加: アクセス可能なカレンダーリストを表示
                updateActionButtonStates(); // ボタンの状態を更新
            } else {
                isAuthorizedForWrite = false;
                document.getElementById('auth_status').textContent = '操作権限の認証に失敗しました。';
                document.getElementById('auth_status').style.color = 'red';
                document.getElementById('authorize_button').style.display = 'block'; 
                document.getElementById('switch_account_button').style.display = 'none'; 
                document.getElementById('calendar_selection_panel').style.display = 'none'; 
                document.getElementById('accessible_calendar_list_section').style.display = 'none'; // 追加: アクセス可能リストを非表示
                console.error('❌ 書き込み権限のためのアクセストークン取得に失敗しました。', tokenResponse);
                checkCurrentCalendarStatus(); 
                updateActionButtonStates(); // ボタンの状態を更新
            }
        },
        error_callback: (error) => {
            isAuthorizedForWrite = false;
            document.getElementById('auth_status').textContent = '認証エラーが発生しました。';
            document.getElementById('auth_status').style.color = 'red';
            document.getElementById('authorize_button').style.display = 'block'; 
            document.getElementById('switch_account_button').style.display = 'none'; 
            document.getElementById('calendar_selection_panel').style.display = 'none'; 
            document.getElementById('accessible_calendar_list_section').style.display = 'none'; // 追加: アクセス可能リストを非表示
            console.error('❌ GISトークンクライアントエラー（書き込み用）:', error);
            checkCurrentCalendarStatus(); 
            updateActionButtonStates(); // ボタンの状態を更新
        }
    });
}

/**
 * 認証が完了した後、現在選択されているカレンダーが適切であるかを確認し、
 * 必要に応じて適切なカレンダーに切り替えます。
 */
window.checkCurrentCalendarAfterAuth = async function() { // グローバル化
    console.log('--- checkCurrentCalendarAfterAuth: 認証後のカレンダーチェック ---');
    
    // loadAllowedCalendars() を再度呼び出して、最新のCSV内容を反映
    await loadAllowedCalendars();

    const foundCalendar = allowedCalendars.find(cal => cal.calendar_id === currentCalendarId);

    if (!foundCalendar || foundCalendar.isExpired) {
        console.warn(`⚠️ 現在のカレンダーID (${currentCalendarId}) は許可されていないか、有効期限が切れています。適切なカレンダーに切り替えます。`);
        
        let newSelectedCalendar = null;
        newSelectedCalendar = allowedCalendars.find(cal => !cal.isExpired);

        if (!newSelectedCalendar && allowedCalendars.length > 0) {
            newSelectedCalendar = allowedCalendars[0];
            console.log(`⚠️ 有効なカレンダーが見つからないため、許可された最初のカレンダー（期限切れ含む）に設定しました。`);
        }

        if (newSelectedCalendar) {
            currentCalendarId = newSelectedCalendar.calendar_id;
            currentCalendarSummary = await getCalendarSummary(currentCalendarId); 
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY, currentCalendarId);
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY, currentCalendarSummary);
            console.log(`✅ 新しいアクティブカレンダーに切り替えました: ${currentCalendarSummary} (${currentCalendarId})`);
        } else {
            currentCalendarId = INITIAL_PUBLIC_CALENDAR_ID;
            currentCalendarSummary = await getCalendarSummary(INITIAL_PUBLIC_CALENDAR_ID);
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY, currentCalendarId);
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY, currentCalendarSummary);
            console.log(`⚠️ 許可されたカレンダーが一つも見つからないため、初期設定カレンダーにフォールバックしました: ${currentCalendarId}`);
        }
        
        updateDisplayedCalendarInfo();
        listEvents();
    } else {
        console.log(`✅ 現在のカレンダーID (${currentCalendarId}) は適切です。`);
    }
    
    try {
        // gapi.client.calendar が初期化されていることを確認
        if (!gapi.client || !gapi.client.calendar || !gapi.client.calendar.calendarList) {
            console.warn('gapi.client.calendar が未初期化またはAPIサービスが利用不可のためカレンダーリストのチェックをスキップします。');
            document.getElementById('auth_status').textContent = '⚠️ カレンダーリストAPIが準備できていません。しばらくしてから再度お試しください。';
            document.getElementById('auth_status').style.color = 'orange';
            return;
        }

        const response = await gapi.client.calendar.calendarList.list();
        const accessibleCalendars = response.result.items || [];
        const writableCalendars = accessibleCalendars.filter(calendar => 
            calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
        );
        const allowedWritableCalendars = writableCalendars.filter(calendar => 
            isCalendarAllowed(calendar.id) && !allowedCalendars.find(cal => cal.calendar_id === calendar.id && cal.isExpired) 
        );
        
        if (allowedWritableCalendars.length === 0) {
            document.getElementById('auth_status').textContent = '⚠️ このアカウントでは操作可能な許可カレンダーが見つかりませんでした。別のGoogleアカウントでログインするか、管理者に連絡してください。';
            document.getElementById('auth_status').style.color = 'orange';
            console.warn('❌ 新しいアカウントでは許可された操作可能カレンダーにアクセスできません。');
        } else {
            document.getElementById('auth_status').textContent = `✅ 操作権限が認証されました (操作可能カレンダー: ${allowedWritableCalendars.length}件)`;
            document.getElementById('auth_status').style.color = 'green';
            console.log(`✅ 新しいアカウントで許可された操作可能カレンダーにアクセス可能: ${allowedWritableCalendars.length}件`);
        }
        
    } catch (err) {
        console.error('❌ アカウント切り替え後のカレンダーアクセスチェックエラー:', err);
        document.getElementById('auth_status').textContent = '⚠️ カレンダーアクセス確認中にエラーが発生しました。';
        document.getElementById('auth_status').style.color = 'orange';
    }
    checkCurrentCalendarStatus(); 
    updateActionButtonStates(); // 認証後、ボタンの状態も更新を確実にする
}

/**
 * 認証済みユーザーが書き込み可能なカレンダーのリストを取得し、設定パネルに表示します。
 * 許可リストでフィルタリングされ、期限切れのカレンダーも情報とともに表示されます。
 */
window.listWritableCalendars = async function() { // グローバル化
    const writableCalendarListUl = document.getElementById('writable_calendar_list');
    writableCalendarListUl.innerHTML = '<li>カレンダーを読み込み中...</li>';
    displayError('');
    console.log('--- listWritableCalendars: 書き込み可能カレンダーリスト取得中 ---');

    if (!isAuthorizedForWrite) {
        writableCalendarListUl.innerHTML = '<li>Googleアカウントで認証すると、カレンダーリストが表示されます。</li>';
        return;
    }

    try {
        // gapi.client.calendar が初期化されていることを確認
        if (!gapi.client || !gapi.client.calendar || !gapi.client.calendar.calendarList) {
            console.warn('gapi.client.calendar が未初期化またはAPIサービスが利用不可のため書き込み可能カレンダーリスト取得をスキップします。');
            writableCalendarListUl.innerHTML = '<li>カレンダーリストのAPIが準備できていません。しばらくしてから再度お試しください。</li>';
            return;
        }

        const response = await gapi.client.calendar.calendarList.list();
        const allCalendars = response.result.items;
        const writableCalendars = allCalendars.filter(calendar => 
            calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
        );

        const allowedWritableCalendars = writableCalendars.filter(calendar => 
            isCalendarAllowed(calendar.id)
        );

        if (allowedWritableCalendars && allowedWritableCalendars.length > 0) {
            writableCalendarListUl.innerHTML = ''; 
            allowedWritableCalendars.forEach(calendar => {
                const li = document.createElement('li');
                const isCurrent = (calendar.id === currentCalendarId) ? ' (現在選択中)' : '';
                
                const allowedCalInfo = allowedCalendars.find(ac => ac.calendar_id === calendar.id);
                const expiryDisplay = allowedCalInfo ? getExpiryDisplay(allowedCalInfo.valid_until) : { text: 'N/A', class: 'expired' };

                li.innerHTML = `
                    <div class="calendar-info">
                        <span class="calendar-name">${calendar.summary || calendar.id}</span>
                        <span class="calendar-details">
                            ${allowedCalInfo ? allowedCalInfo.company_name : '不明な会社'}
                            ${allowedCalInfo && allowedCalInfo.memo ? ` - ${allowedCalInfo.memo}` : ''}
                        </span>
                    </div>
                    <span class="calendar-expiry ${expiryDisplay.class}">${expiryDisplay.text}</span>
                    <button class="select-button" 
                        data-calendar-id="${calendar.id}" 
                        data-calendar-summary="${calendar.summary}"
                        ${allowedCalInfo && allowedCalInfo.isExpired ? 'disabled' : ''}>選択</button>
                `;
                writableCalendarListUl.appendChild(li);
            });
            console.log('✅ 許可された書き込み可能なカレンダーリストを正常に表示しました:', allowedWritableCalendars);

            document.querySelectorAll('#writable_calendar_list .select-button').forEach(button => {
                button.onclick = async (event) => { 
                    console.log('--- カレンダー選択ボタンが押されました ---');
                    const newActiveId = event.target.dataset.calendarId;
                    let newActiveSummary = event.target.dataset.calendarSummary;
                    
                    const selectedAllowedCal = allowedCalendars.find(ac => ac.calendar_id === newActiveId);
                    if (!selectedAllowedCal) {
                        displayError('選択されたカレンダーは許可されていません。');
                        return;
                    }
                    if (selectedAllowedCal.isExpired) {
                        displayExpiredCalendarNotice(selectedAllowedCal);
                        return; 
                    }

                    localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY, newActiveId);
                    
                    try {
                        newActiveSummary = await getCalendarSummary(newActiveId);
                        currentCalendarSummary = newActiveSummary;
                        localStorage.setItem(LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY, newActiveSummary);
                    } catch (error) {
                        console.warn(`選択したカレンダーのサマリー取得に失敗しました。IDをサマリーとして使用します: ${newActiveId}`, error);
                        currentCalendarSummary = newActiveId; 
                    }

                    currentCalendarId = newActiveId; 
                    updateDisplayedCalendarInfo(); 
                    console.log(`✅ アクティブカレンダーが選択・保存されました: ${currentCalendarSummary} (${currentCalendarId})`);
                    
                    checkCurrentCalendarStatus(); 
                    listEvents(); 
                    
                    if (canCloseSettings) { 
                        document.getElementById('settings_panel').classList.remove('open'); 
                    }
                };
            });
        } else {
            writableCalendarListUl.innerHTML = '<li>許可された書き込み可能なカレンダーが見つかりませんでした。<br>別のGoogleアカウントでログインするか、管理者に連絡してください。</li>';
            console.log(`ℹ️ 許可された書き込み可能なカレンダーが見つかりませんでした。`);
        }
    } catch (err) {
        console.error('❌ 書き込み可能カレンダーリストの取得エラー:', err.result ? err.result.error : err);
        displayError(`カレンダーリストの取得中にエラーが発生しました: ${err.result && err.result.error && err.result.error.message ? err.result.error.message : err.message}`);
    } finally {
        checkCurrentCalendarStatus(); 
    }
}

/**
 * 認証済みユーザーがアクセス可能な全てのカレンダーのリストを取得し、設定パネルに表示します。
 * これらのカレンダーはallowed_calendars.csvに登録されているかどうかを問いません。
 * 主にユーザーが自分のカレンダーIDを調べるために使用します。
 */
window.listAccessibleCalendars = async function() { // グローバル化
    const accessibleCalendarListUl = document.getElementById('accessible_calendar_list');
    accessibleCalendarListUl.innerHTML = '<li>カレンダーを読み込み中...</li>';
    console.log('--- listAccessibleCalendars: アクセス可能カレンダーリスト取得中 ---');

    if (!isAuthorizedForWrite) { 
        accessibleCalendarListUl.innerHTML = '<li>Googleアカウントで認証すると、アクセス可能なカレンダーリストが表示されます。</li>';
        document.getElementById('accessible_calendar_list_section').style.display = 'block'; 
        return;
    }

    try {
        // gapi.client.calendar が初期化されていることを確認
        if (!gapi.client || !gapi.client.calendar || !gapi.client.calendar.calendarList) {
            console.warn('gapi.client.calendar が未初期化またはAPIサービスが利用不可のためアクセス可能カレンダーリスト取得をスキップします。');
            accessibleCalendarListUl.innerHTML = '<li>カレンダーリストのAPIが準備できていません。しばらくしてから再度お試しください。</li>';
            return;
        }

        const response = await gapi.client.calendar.calendarList.list();
        const allAccessibleCalendars = response.result.items;

        if (allAccessibleCalendars && allAccessibleCalendars.length > 0) {
            accessibleCalendarListUl.innerHTML = '';
            allAccessibleCalendars.forEach(calendar => {
                const li = document.createElement('li');
                const isAlreadyAllowed = isCalendarAllowed(calendar.id);
                const allowedStatusText = isAlreadyAllowed ? ' (CSV登録済み)' : '';
                
                li.innerHTML = `
                    <span>${calendar.summary || calendar.id} (${calendar.id})${allowedStatusText}</span>
                    <button class="copy-id-button" data-id="${calendar.id}">IDコピー</button>
                `;
                accessibleCalendarListUl.appendChild(li);
            });

            document.querySelectorAll('.copy-id-button').forEach(button => {
                button.onclick = (event) => {
                    const calendarIdToCopy = event.target.dataset.id;
                    navigator.clipboard.writeText(calendarIdToCopy).then(() => {
                        event.target.textContent = 'コピー完了!';
                        setTimeout(() => {
                            event.target.textContent = 'IDコピー';
                        }, 1500);
                    }).catch(err => {
                        console.error('IDコピーに失敗しました:', err);
                        alert('IDのコピーに失敗しました。手動でコピーしてください: ' + calendarIdToCopy);
                    });
                };
            });
            console.log('✅ アクセス可能なカレンダーリストを正常に表示しました:', allAccessibleCalendars);
            document.getElementById('accessible_calendar_list_section').style.display = 'block';
        } else {
            accessibleCalendarListUl.innerHTML = '<li>アクセス可能なカレンダーが見つかりませんでした。</li>';
            console.log(`ℹ️ アクセス可能なカレンダーが見つかりませんでした。`);
            document.getElementById('accessible_calendar_list_section').style.display = 'block';
        }
    } catch (err) {
        console.error('❌ アクセス可能カレンダーリストの取得エラー:', err);
        accessibleCalendarListUl.innerHTML = '<li>カレンダーリストの取得中にエラーが発生しました。<br>認証状態とネットワーク接続を確認してください。</li>';
        document.getElementById('accessible_calendar_list_section').style.display = 'block';
    }
}
