// ローカルストレージから設定取得
const proxyUrl = localStorage.getItem('proxyUrl') || '';
const clientId = localStorage.getItem('clientId') || '';
const calendarId = localStorage.getItem('calendarId') || '';

function init() {
  if (window.location.pathname.includes('settings.html')) {
    // settings.htmlロジック
    document.getElementById('calendarId').value = calendarId;
    document.getElementById('proxyUrl').value = proxyUrl;
    document.getElementById('clientId').value = clientId;
    document.getElementById('saveBtn').addEventListener('click', () => {
      localStorage.setItem('calendarId', document.getElementById('calendarId').value);
      localStorage.setItem('proxyUrl', document.getElementById('proxyUrl').value);
      localStorage.setItem('clientId', document.getElementById('clientId').value);
      alert('保存しました');
      window.location.href = 'index.html';
    });
  } else {
    // index.htmlロジック
    if (!calendarId || !proxyUrl || !clientId) {
      alert('設定が必要です');
      window.location.href = 'settings.html';
      return;  // 関数内OK
    }

    function loadEvents() {
      fetch(`${proxyUrl}/getEvents?calendarId=${encodeURIComponent(calendarId)}`)
        .then(res => res.json())
        .then(events => {
          const eventsDiv = document.getElementById('events');
          let newContent = '';
          events.forEach(event => {
            newContent += `<p>${new Date(event.start.dateTime).toLocaleString()} - ${new Date(event.end.dateTime).toLocaleString()}: ${event.summary} <button onclick="deleteEvent('${event.id}')">削除</button></p>`;
          });
          if (newContent !== eventsDiv.innerHTML) eventsDiv.innerHTML = newContent;
          localStorage.setItem('cachedEvents', JSON.stringify(events));
        })
        .catch(() => {
          const cached = localStorage.getItem('cachedEvents');
          if (cached) document.getElementById('events').innerHTML = '<p>オフライン: キャッシュ表示</p>' + JSON.parse(cached).map(e => `<p>${new Date(e.start.dateTime).toLocaleString()} - ${e.summary}</p>`).join('');
        });
    }

    loadEvents();
    setInterval(loadEvents, 60000);

    document.getElementById('reserveBtn').addEventListener('click', () => {
      gapi.load('client:auth2', () => {
        gapi.client.init({ clientId, scope: 'https://www.googleapis.com/auth/calendar.events' }).then(() => {
          gapi.auth2.getAuthInstance().signIn().then(() => {
            const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            const now = new Date();
            const end = new Date(now.getTime() + 30 * 60000);
            const event = { summary: '即時予約', start: { dateTime: now.toISOString() }, end: { dateTime: end.toISOString() } };
            fetch(`${proxyUrl}/createEvent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ calendarId, event, accessToken: token })
            }).then(() => loadEvents());
          });
        });
      });
    });

    window.deleteEvent = function(eventId) {
      gapi.load('client:auth2', () => {
        gapi.client.init({ clientId, scope: 'https://www.googleapis.com/auth/calendar.events' }).then(() => {
          gapi.auth2.getAuthInstance().signIn().then(() => {
            const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            fetch(`${proxyUrl}/deleteEvent`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ calendarId, eventId, accessToken: token })
            }).then(() => loadEvents());
          });
        });
      });
    };

    document.getElementById('settingsBtn').addEventListener('click', () => window.location.href = 'settings.html');
  }
}

document.addEventListener('DOMContentLoaded', init);  // DOMロード後実行
