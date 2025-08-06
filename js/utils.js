// js/utils.js

// デバッグ用: このファイルが正しく読み込まれたことを確認するログ
console.log('✅ js/utils.js が正常に読み込まれました。');

// ★★★ ここをあなたの情報に置き換えてください ★★★
const API_KEY = 'AIzaSyAANqYZlhyRKj7VAuFbFYQ0hYWPNkd1j70';             
const INITIAL_PUBLIC_CALENDAR_ID = 'kaigishitsu20000101@gmail.com'; 
const CLIENT_ID = '155458326593-g92losmr00mji7g4sun62lk8kjv9d01b.apps.googleusercontent.com';
// ★★★ ここまで ★★★

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const WRITE_SCOPES = 'https://www.googleapis.com/auth/calendar.events'; 
const APP_VERSION = 'Ver1.41'; 
const LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY = 'activeCalendarId';
const LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY = 'activeCalendarSummary';
const LOCAL_STORAGE_SETTINGS_KEY = 'appSettings'; 
const GITHUB_PAGES_BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
const ALLOWED_CALENDARS_CSV_PATH = GITHUB_PAGES_BASE_URL + '/allowed_calendars.csv';
window.allowedCalendars = []; 
window.canCloseSettings = true; 
window.currentCalendarState = 'ok';

window.DEFAULT_SETTINGS = { 
    refreshInterval: 30, 
    displayPastHours: 2, 
    displayFutureHours: 12, 
    baseFontSize: 16, 
    baseFontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", 
    availableText: "空室です",
    inProgressPrefix: "ただいま",
    inProgressSuffix: "中です",
    preAnnouncementMinutes: 5, 
    preAnnouncementPrefix: "まもなく",
    preAnnouncementSuffix: "開始",
    preAnnouncementDefaultText: "ご案内", 
    eventSummary: "緊急会議",
    lastEvents: [], 
    theme: "stylish", 
    mainTitle: "会議室予約表示Ver1.41", 
    eventListTitle: "現在の会議室の予定" 
};
window.appSettings = {}; 
window.tokenClient; 
window.isAuthorizedForWrite = false; 
window.currentCalendarId = INITIAL_PUBLIC_CALENDAR_ID; 
window.currentCalendarSummary = "初期設定カレンダー"; 
window.refreshIntervalId; 
window.lastFetchedEventsString = ""; 

window.displayError = function(msg) {
    const errorDisplay = document.getElementById('error_display');
    if (msg) {
        errorDisplay.textContent = `エラー: ${msg}`;
        errorDisplay.style.display = 'block';
        console.error("表示エラー:", msg);
    } else {
        errorDisplay.textContent = '';
        errorDisplay.style.display = 'none';
    }
}
window.displayExpiredCalendarNotice = function(expiredCalendar) {
    const errorContainer = document.getElementById('error_display');
    if (!errorContainer) return;
    const companyName = expiredCalendar.company_name || '不明';
    const calendarName = currentCalendarSummary || expiredCalendar.calendar_id;
    const validUntil = expiredCalendar.valid_until || '不明';
    errorContainer.innerHTML = `
        <div class="expired-calendar-notice">
            <div class="expired-calendar-name">⚠️ 有効期限切れ: ${calendarName}</div>
            <div>会社名: ${companyName}</div>
            <div>有効期限: ${validUntil}</div>
            <div class="switch-account-notice">
                💡 このカレンダーは有効期限が切れています。<br>
                別のGoogleアカウントでログインするか、管理者に期限延長を依頼してください。
            </div>
        </div>
    `;
    errorContainer.style.display = 'block';
}

window.getExpiryDisplay = function(validUntilStr) {
    if (!validUntilStr) return { text: '期限不明', class: 'expired' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let validUntilDate;
    const dateStr = validUntilStr.trim();
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
        return { text: '期限不明', class: 'expired' };
    }
    validUntilDate.setHours(23, 59, 59, 999);
    const diffTime = validUntilDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return { text: `期限切れ`, class: 'expired' };
    } else if (diffDays <= 7) {
        return { text: `${diffDays}日後期限`, class: 'warning' };
    } else {
        return { text: `${validUntilStr}まで`, class: 'valid' };
    }
}
window.updateCurrentDateTime = function() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const formattedDate = now.toLocaleDateString('ja-JP', dateOptions);
    const formattedTime = now.toLocaleTimeString('ja-JP', timeOptions);
    document.getElementById('current_datetime').textContent = `${formattedDate} ${formattedTime}`;
}
window.loadSettings = function() {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (savedSettings) {
        try {
            appSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
            if (!appSettings.lastEvents) {
                appSettings.lastEvents = [];
            }
            console.log('✅ 設定をlocalStorageからロードしました:', appSettings);
        } catch (e) {
            console.error('❌ localStorageからの設定読み込みに失敗しました。デフォルト設定を使用します。', e);
            appSettings = { ...DEFAULT_SETTINGS };
        }
    } else {
        appSettings = { ...DEFAULT_SETTINGS };
        console.log('ℹ️ 設定が見つかりませんでした。デフォルト設定を使用します:', appSettings);
    }
}
window.saveSettings = function() {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(appSettings));
    console.log('✅ 設定をlocalStorageに保存しました:', appSettings);
}
