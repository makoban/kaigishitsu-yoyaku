// js/utils.js

// ★★★ ここをあなたの情報に置き換えてください ★★★
const API_KEY = 'AIzaSyDUFH1jbIa66NjzSM8I9Xpicwo6I6H2sB8';             
const INITIAL_PUBLIC_CALENDAR_ID = 'kaigishitsu20000101@gmail.com'; 
const CLIENT_ID = '155458326593-redrcpnqa2iqapvg8p1kb3cgegeenvse.apps.googleusercontent.com'; 
// ★★★ ここまで ★★★

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const WRITE_SCOPES = 'https://www.googleapis.com/auth/calendar.events'; 
// 広範なカレンダー情報へのアクセスも必要になるため、可能であれば追加のスコープ検討も
// 'https://www.googleapis.com/auth/calendar.readonly' はカレンダーリスト取得に十分ですが、
// 'calendar.events' (書き込み権限を含む) があれば、通常 'calendar.readonly' もカバーします。
// ただし、もし calendarList.list で公開カレンダーのみ表示するなどの要件があれば、個別に検討が必要です。

const LOCAL_STORAGE_ACTIVE_CALENDAR_ID_KEY = 'activeCalendarId';
const LOCAL_STORAGE_ACTIVE_CALENDAR_SUMMARY_KEY = 'activeCalendarSummary';
const LOCAL_STORAGE_SETTINGS_KEY = 'appSettings'; 

const APP_VERSION = 'Ver1.5'; // バージョンをVer1.5に変更

const GITHUB_PAGES_BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
const ALLOWED_CALENDARS_CSV_PATH = GITHUB_PAGES_BASE_URL + '/allowed_calendars.csv';

let allowedCalendars = []; // 許可されたカレンダーのリスト
let canCloseSettings = true; // 設定画面を閉じることができるかどうか

// カレンダーの現在の状態を保持する変数
// 'ok': 許可され、有効期限内
// 'id_not_found': IDが許可リストに見つからない
// 'expired': IDは許可リストにあるが、有効期限切れ
// 'api_error': Google APIの初期化に失敗
let currentCalendarState = 'ok';

// デフォルト設定値
const DEFAULT_SETTINGS = {
    refreshInterval: 30, // 秒
    displayPastHours: 2, // 現在時刻から過去何時間分のイベントを表示するか
    displayFutureHours: 12, // 現在時刻から未来何時間分のイベントを表示するか
    baseFontSize: 16, // 基本フォントサイズ (px)
    baseFontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", 
    availableText: "空室です",
    inProgressPrefix: "ただいま",
    inProgressSuffix: "中です",
    preAnnouncementMinutes: 5, // 予約前案内：デフォルト5分前
    preAnnouncementPrefix: "まもなく",
    preAnnouncementSuffix: "開始",
    preAnnouncementDefaultText: "ご案内", 
    eventSummary: "緊急会議",
    lastEvents: [], // 最後に取得したイベントデータをここに保存（案内文用）
    theme: "stylish", // デフォルトテーマをstylishに設定
    mainTitle: "会議室予約表示Ver1.5", // メインタイトルのデフォルト値
    eventListTitle: "現在の会議室の予定" // イベントリストタイトルのデフォルト値
};
let appSettings = {}; // 現在のアプリ設定

// ★この tokenClient が main.js から参照できるようにグローバルに定義されている必要があります★
let tokenClient; 
let isAuthorizedForWrite = false; 
let currentCalendarId = INITIAL_PUBLIC_CALENDAR_ID; 
let currentCalendarSummary = "初期設定カレンダー"; 
let refreshIntervalId; 
let lastFetchedEventsString = ""; 

/**
 * 画面下部にエラーメッセージを表示またはクリアします。
 * @param {string} msg - 表示するエラーメッセージ。空文字列でクリア。
 */
function displayError(msg) {
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

/**
 * 有効期限切れのカレンダーが選択された際に、ユーザーに通知するメッセージを表示します。
 * @param {object} expiredCalendar - 期限切れカレンダーの情報
 */
function displayExpiredCalendarNotice(expiredCalendar) {
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

/**
 * カレンダーの有効期限情報から表示テキストとCSSクラスを生成します。
 * @param {string} validUntilStr - 有効期限の文字列
 * @returns {{text: string, class: string}} 表示テキストとCSSクラス
 */
function getExpiryDisplay(validUntilStr) {
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

/**
 * 現在の日付と時刻を更新して表示します。
 */
function updateCurrentDateTime() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const formattedDate = now.toLocaleDateString('ja-JP', dateOptions);
    const formattedTime = now.toLocaleTimeString('ja-JP', timeOptions);
    document.getElementById('current_datetime').textContent = `${formattedDate} ${formattedTime}`;
}

/**
 * ローカルストレージからアプリ設定をロードします。
 */
function loadSettings() {
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

/**
 * 現在のアプリ設定をローカルストレージに保存します。
 */
function saveSettings() {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(appSettings));
    console.log('✅ 設定をlocalStorageに保存しました:', appSettings);
}
