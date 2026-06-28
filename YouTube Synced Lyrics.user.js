// ==UserScript==
// @name         YouTube Synced Lyrics
// @version      1.0
// @description  Advanced synced lyrics overlay for YouTube and YouTube Music featuring live auto-sync, draggable floating UI, lyric source selection, and timing adjustment controls.
// @author       HemanthKumar3107
// @match        *://www.youtube.com/*
// @match        *://music.youtube.com/*
// @grant        GM_xmlhttpRequest
// @connect      lrclib.net
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let ttPolicy;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        ttPolicy = window.trustedTypes.createPolicy('yslPolicy', {
            createHTML: (string) => string
        });
    }

    const API_ROOT = 'https://lrclib.net';
    let lyricsData = [];
    let searchResults = [];
    let isPanelVisible = false;
    let wasAutomaticallyHidden = false;
    let lastVideoId = null;
    let currentTrackInfo = { title: '', artist: '', duration: 0 };
    let uiTimeout;
    let currentOffset = 0.0;

    const css = `
        #ysl-container {
            position: fixed;
            right: 20px;
            top: 70px;
            width: 350px;
            height: 500px;
            min-width: 250px;
            min-height: 200px;
            background: transparent !important;
            border: none !important;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            pointer-events: none;
        }
        #ysl-container.hidden { display: none !important; }

        #ysl-header {
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #fff;
            cursor: move;
            user-select: none;
            border-radius: 10px;
            opacity: 0;
            transition: opacity 0.4s ease;
            pointer-events: auto;
            margin-bottom: 5px;
            font-family: sans-serif;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }

        #ysl-header-btns { display: flex; gap: 10px; align-items: center; }
        .ysl-icon-btn { cursor: pointer; opacity: 0.7; font-size: 16px; transition: 0.2s; }
        .ysl-icon-btn:hover { opacity: 1; transform: scale(1.1); }

        #ysl-offset-ctrl {
            display: flex;
            align-items: center;
            gap: 5px;
            background: rgba(255,255,255,0.1);
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
        }

        #ysl-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px 10px;
            text-align: center;
            scrollbar-width: none;
            pointer-events: auto;
        }

        .ysl-line {
            padding: 15px 5px;
            font-size: 19px;
            color: #ffffff;
            cursor: pointer;
            line-height: 1.5;
            text-shadow: 2px 2px 4px #000, -1px -1px 4px #000, 0 0 12px #000;
            transition: all 0.2s ease;
            opacity: 0.4;
        }

        .ysl-line.active {
            color: #ffffff;
            opacity: 1;
            font-weight: 900;
            font-size: 24px;
            transform: scale(1.05);
            text-shadow: 0 0 15px rgba(255,255,255,0.6), 2px 2px 8px #000;
        }

        #ysl-search-box {
            width: 90%;
            padding: 10px;
            margin: 0 auto 15px auto;
            display: block;
            background: rgba(30,30,30,0.95);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            border-radius: 8px;
            outline: none;
        }

        .ysl-result-item {
            text-align: left;
            padding: 12px;
            margin-bottom: 10px;
            background: rgba(0,0,0,0.85);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            color: #eee;
        }
        .ysl-res-meta { font-size: 11px; opacity: 0.6; margin-top: 4px; display: block; }
        .ysl-synced-badge { color: #50e3c2; font-weight: bold; margin-left: 5px; }

        #ysl-resizer {
            width: 30px; height: 6px;
            position: absolute; right: 10px; bottom: 10px;
            cursor: se-resize;
            background: rgba(255,255,255,0.3);
            border-radius: 10px;
            opacity: 0;
            transition: opacity 0.4s ease;
            pointer-events: auto;
        }
    `;

    function setSafeHTML(el, htmlString) {
        if (ttPolicy) {
            el.innerHTML = ttPolicy.createHTML(htmlString);
        } else {
            el.innerHTML = htmlString;
        }
    }

    const styleSheet = document.createElement('style');
    styleSheet.textContent = css;
    document.head.appendChild(styleSheet);

    function formatTime(secs) {
        if (!secs) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function cleanTitle(title) {
        return title.replace(/\(Official.*?\)|\[Official.*?\]|\(Lyric.*?\)|\[Lyric.*?\]|\(feat.*?\)/gi, '').trim();
    }

    function updateOffsetDisplay() {
        const el = document.getElementById('ysl-offset-val');
        if (el) el.innerText = (currentOffset >= 0 ? '+' : '') + currentOffset.toFixed(1) + 's';
    }

    function triggerSearch(customQuery = null) {
        const contentDiv = document.getElementById('ysl-content');
        if (contentDiv && !customQuery) setSafeHTML(contentDiv, '<div style="color:rgba(255,255,255,0.5); margin-top:20px;">Searching...</div>');

        const { title, artist, duration } = currentTrackInfo;
        const query = customQuery || `${artist} ${title}`;
        currentOffset = 0.0;
        updateOffsetDisplay();

        GM_xmlhttpRequest({
            method: 'GET',
            url: `${API_ROOT}/api/search?q=${encodeURIComponent(query)}`,
            onload: (res) => {
                try {
                    const hits = JSON.parse(res.responseText);
                    searchResults = hits || [];
                    if (customQuery) {
                        renderSourceSelector();
                    } else if (searchResults.length > 0) {
                        let best = searchResults.find(h => h.syncedLyrics && Math.abs(h.duration - duration) < 10) || searchResults[0];
                        processMatch(best);
                    } else {
                        if (contentDiv) setSafeHTML(contentDiv, '<div style="color:#aaa; margin-top:20px;">No lyrics found.</div>');
                    }
                } catch(e) {}
            }
        });
    }

    function processMatch(data) {
        const div = document.getElementById('ysl-content');
        if (!div) return;
        setSafeHTML(div, '');
        lyricsData = [];
        if (data.syncedLyrics) {
            data.syncedLyrics.split('\n').forEach((line) => {
                const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
                if (match) {
                    const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseFloat('0.' + match[3]);
                    const text = match[4].trim();
                    if (text) {
                        const lEl = document.createElement('div');
                        lEl.className = 'ysl-line';
                        lEl.innerText = text;
                        lEl.onclick = () => { document.querySelector('video').currentTime = time - currentOffset; };
                        div.appendChild(lEl);
                        lyricsData.push({ time, el: lEl });
                    }
                }
            });
        } else {
            setSafeHTML(div, `<div style="color:#eee; padding:20px;">${data.plainLyrics || "No Synced Lyrics."}</div>`);
        }
    }

    function renderSourceSelector() {
        const div = document.getElementById('ysl-content');
        setSafeHTML(div, `<input type="text" id="ysl-search-box" placeholder="Search song..." autocomplete="off">`);
        const box = document.getElementById('ysl-search-box');
        box.focus();
        box.onkeydown = (e) => { if (e.key === 'Enter') triggerSearch(box.value); };

        searchResults.forEach(h => {
            const item = document.createElement('div');
            item.className = 'ysl-result-item';
            const syncedTag = h.syncedLyrics ? `<span class="ysl-synced-badge">✨ Synced</span>` : '';
            setSafeHTML(item, `
                <strong>${h.trackName}</strong>
                <span class="ysl-res-meta">${h.artistName} (${formatTime(h.duration)}) ${syncedTag}</span>
            `);
            item.onclick = () => processMatch(h);
            div.appendChild(item);
        });
    }

    function createUI() {
        if (document.getElementById('ysl-container')) return;
        const container = document.createElement('div');
        container.id = 'ysl-container';
        container.className = 'hidden';

        const uiHTML = `
            <div id="ysl-header">
                <div id="ysl-offset-ctrl">
                    <span class="ysl-icon-btn" id="ysl-off-minus">−</span>
                    <span id="ysl-offset-val">0.0s</span>
                    <span class="ysl-icon-btn" id="ysl-off-plus">+</span>
                </div>
                <div id="ysl-header-btns">
                    <span class="ysl-icon-btn" id="ysl-retry">↻</span>
                    <span class="ysl-icon-btn" id="ysl-list-trigger">≡</span>
                    <span class="ysl-icon-btn" id="ysl-close">✕</span>
                </div>
            </div>
            <div id="ysl-content"></div>
            <div id="ysl-resizer"></div>
        `;

        setSafeHTML(container, uiHTML);
        document.body.appendChild(container);

        const header = document.getElementById('ysl-header');
        const resizer = document.getElementById('ysl-resizer');
        container.onmouseenter = () => { clearTimeout(uiTimeout); header.style.opacity = '1'; resizer.style.opacity = '1'; };
        container.onmouseleave = () => { uiTimeout = setTimeout(() => { header.style.opacity = '0'; resizer.style.opacity = '0'; }, 2000); };

        let p1=0, p2=0, p3=0, p4=0;
        header.onmousedown = (e) => {
            if (e.target.classList.contains('ysl-icon-btn')) return;
            p3 = e.clientX; p4 = e.clientY;
            document.onmousemove = (e) => {
                p1 = p3 - e.clientX; p2 = p4 - e.clientY;
                p3 = e.clientX; p4 = e.clientY;
                container.style.top = (container.offsetTop - p2) + "px";
                container.style.left = (container.offsetLeft - p1) + "px";
                container.style.right = 'auto';
            };
            document.onmouseup = () => { document.onmousemove = null; };
        };

        resizer.onmousedown = (e) => {
            let sW = container.offsetWidth, sH = container.offsetHeight, sX = e.clientX, sY = e.clientY;
            document.onmousemove = (e) => {
                container.style.width = sW + (e.clientX - sX) + 'px';
                container.style.height = sH + (e.clientY - sY) + 'px';
            };
            document.onmouseup = () => { document.onmousemove = null; };
        };

        document.getElementById('ysl-off-plus').onclick = () => { currentOffset += 0.1; updateOffsetDisplay(); };
        document.getElementById('ysl-off-minus').onclick = () => { currentOffset -= 0.1; updateOffsetDisplay(); };
        document.getElementById('ysl-close').onclick = () => { isPanelVisible = false; wasAutomaticallyHidden = false; container.classList.add('hidden'); };
        document.getElementById('ysl-list-trigger').onclick = renderSourceSelector;
        document.getElementById('ysl-retry').onclick = () => triggerSearch();
    }

    function injectToggle() {
        if (document.getElementById('ysl-toggle-btn')) return;
        const target = document.querySelector('.ytp-right-controls') || document.querySelector('.right-controls-buttons');
        if (target) {
            const btn = document.createElement('button');
            btn.id = 'ysl-toggle-btn';
            btn.className = 'ytp-button';
            btn.innerText = 'LYRICS';
            btn.style.width = 'auto'; btn.style.padding = '0 10px'; btn.style.fontWeight = 'bold';
            btn.onclick = (e) => {
                e.preventDefault();
                isPanelVisible = !isPanelVisible;
                wasAutomaticallyHidden = false;
                document.getElementById('ysl-container').classList.toggle('hidden', !isPanelVisible);
            };
            target.insertBefore(btn, target.firstChild);
        }
    }

    setInterval(() => {
        const isWatchPage = window.location.search.includes('v=') || window.location.pathname.includes('/watch');
        const container = document.getElementById('ysl-container');
        const video = document.querySelector('video');

        if (!isWatchPage && container) {
            isPanelVisible = false;
            container.classList.add('hidden');
        }

        injectToggle();
        createUI();

        if (video && container) {
            const isPlaying = !video.paused && !video.ended;
            if (isPanelVisible && !isPlaying) {
                isPanelVisible = false;
                wasAutomaticallyHidden = true;
                container.classList.add('hidden');
            }
            else if (!isPanelVisible && isPlaying && wasAutomaticallyHidden) {
                isPanelVisible = true;
                wasAutomaticallyHidden = false;
                container.classList.remove('hidden');
            }
        }

        const player = document.getElementById('movie_player');
        if (player && player.getVideoData) {
            const data = player.getVideoData();
            if (data.video_id !== lastVideoId && data.video_id) {
                lastVideoId = data.video_id;
                lyricsData = [];
                const contentDiv = document.getElementById('ysl-content');
                if (contentDiv) setSafeHTML(contentDiv, '');
                currentTrackInfo = { title: cleanTitle(data.title), artist: data.author, duration: player.getDuration() };
                triggerSearch();
            }
        }

        if (isPanelVisible && lyricsData.length) {
            if (!video) return;
            const curTime = video.currentTime + currentOffset;
            lyricsData.forEach((line, i) => {
                line.el.classList.remove('active');
                if (curTime >= line.time && (!lyricsData[i+1] || curTime < lyricsData[i+1].time)) {
                    line.el.classList.add('active');
                    line.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }, 500);
})();
