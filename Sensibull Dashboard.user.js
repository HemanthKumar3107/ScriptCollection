// ==UserScript==
// @name         Sensibull Dashboard
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Real-time Sensibull dashboard overlay for TradingView with PCR, Max Pain, ATM, VIX, IVP, and expected move.
// @author       HemanthKumar3107
// @match        https://web.sensibull.com/*
// @match        https://in.tradingview.com/chart*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const DATA_KEY = "sensibull_bridge_active";
    const POS_KEY = "sensibull_dash_pos_active";

    const cleanup = () => {
        const oldBoxes = document.querySelectorAll('#sb-unified-dash');
        if (oldBoxes.length > 1) {
            oldBoxes.forEach((box, index) => { if (index > 0) box.remove(); });
        }
    };

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes glow-mp { 0% { box-shadow: 0 0 5px #ff9800; } 50% { box-shadow: 0 0 20px #ff9800; } 100% { box-shadow: 0 0 5px #ff9800; } }
        @keyframes glow-atm { 0% { box-shadow: 0 0 5px #00bcd4; } 50% { box-shadow: 0 0 25px #00bcd4; } 100% { box-shadow: 0 0 5px #00bcd4; } }
        .glow-maxpain { animation: glow-mp 1.5s infinite !important; border-color: #ff9800 !important; }
        .glow-atm-cross { animation: glow-atm 0.8s infinite !important; border-color: #00bcd4 !important; }
    `;
    document.head.appendChild(style);

    // --- SCRAPER (SENSIBULL) ---
    if (window.location.hostname.includes('sensibull.com')) {
        setInterval(() => {
            const data = { pcr: "--", maxPain: "--", price: "--", atm: "--", vix: "--", ivp: "--", dayOpen: "--", ts: "", lastUpdate: 0 };

            document.querySelectorAll('span, p').forEach((el) => {
                const text = el.innerText.trim();
                if (text === "PCR") data.pcr = el.parentElement.nextElementSibling?.innerText.split('\n')[0].trim() || "--";
                if (text === "Max Pain") data.maxPain = el.parentElement.nextElementSibling?.innerText.split('\n')[0].trim() || "--";
                if (text === "ATM Strike") data.atm = el.parentElement.nextElementSibling?.innerText.split('\n')[0].trim() || "--";
                if (text === "IndiaVIX") data.vix = el.parentElement.nextElementSibling?.innerText.split('\n')[0].trim() || "--";
                if (text === "IV Percentile") data.ivp = el.parentElement.nextElementSibling?.innerText.split('\n')[0].trim() || "--";
            });

            const ticker = document.querySelector('.ticker-wrapper');
            if (ticker) {
                const ltpEl = ticker.querySelector('p.cZiqXB');
                if (ltpEl) data.price = ltpEl.innerText.replace(/,/g, '').trim();

                const allJeudvo = Array.from(ticker.querySelectorAll('p.jeudvo'));
                const openLabelIdx = allJeudvo.findIndex(p => p.innerText.trim() === "O:");
                if (openLabelIdx !== -1 && allJeudvo[openLabelIdx + 1]) {
                    data.dayOpen = allJeudvo[openLabelIdx + 1].innerText.replace(/,/g, '').trim();
                }
            }

            data.ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            data.lastUpdate = Date.now();
            GM_setValue(DATA_KEY, data);
        }, 500);
    }

    // --- DISPLAY (TRADINGVIEW) ---
    if (window.location.hostname.includes('tradingview.com')) {
        if (!document.getElementById('sb-unified-dash')) {
            const box = document.createElement('div');
            box.id = "sb-unified-dash";
            const savedPos = GM_getValue(POS_KEY, { top: "10px", left: "85%" });

            box.style = `
                position: fixed; top: ${savedPos.top}; left: ${savedPos.left}; z-index: 9999;
                padding: 14px; background: #131722; color: #d1d4dc;
                border: 1px solid #363a45; border-radius: 10px;
                font-family: 'Inter', sans-serif; min-width: 210px;
                box-shadow: 0 12px 32px rgba(0,0,0,0.6); display: none; cursor: move;
            `;

            box.innerHTML = `
                <div style="border-bottom: 1px solid #363a45; padding-bottom: 8px; margin-bottom: 10px; text-align: center;">
                    <div id="tv-bias" style="font-weight: 900; font-size: 13px; letter-spacing: 0.3px; background: #1e222d; padding: 5px; border-radius: 4px;">BIAS: --</div>
                    <div id="tv-range-display" style="font-size: 14px; font-weight: bold; color: #fff; margin-top: 7px;">-- - --</div>
                    <div id="tv-move-pct" style="font-size: 11px; color: #ce93d8;">(EXP. MOVE: --%)</div>
                </div>
                <div style="font-size: 14px; margin-bottom: 6px; color: #b2b5be;">ATM: <span id="tv-atm" style="float:right; font-weight:bold; color:#00bcd4;">--</span></div>
                <div style="font-size: 14px; margin-bottom: 6px; color: #b2b5be;">PCR: <span id="tv-pcr" style="float:right; font-weight:bold;">--</span></div>
                <div style="font-size: 14px; margin-bottom: 6px; color: #b2b5be;">MAX PAIN: <span id="tv-maxpain" style="float:right; font-weight:bold; color:#ff9800;">--</span></div>
                <div style="font-size: 14px; margin-bottom: 6px; color: #b2b5be;">VIX / IVP: <span style="float:right;"><span id="tv-vix" style="color:#ce93d8;">--</span> / <span id="tv-ivp">--</span></span></div>
                <div style="font-size: 14px; margin-bottom: 11px; color: #b2b5be;">LTP: <span id="tv-price" style="float:right; font-weight:bold; color:#fff;">--</span></div>
                <div id="tv-sync-container" style="font-size: 10px; text-align: center; color: #5d606b; border-top: 1px solid #2a2e39; padding-top: 7px;">
                    SYNC: <span id="tv-ts" style="color:#00ffcc;">--</span>
                </div>
            `;
            document.body.appendChild(box);

            let isDragging = false, ox, oy;
            box.onmousedown = (e) => { isDragging = true; ox = e.clientX - box.offsetLeft; oy = e.clientY - box.offsetTop; };
            document.onmousemove = (e) => { if (isDragging) { box.style.left = (e.clientX - ox) + 'px'; box.style.top = (e.clientY - oy) + 'px'; } };
            document.onmouseup = () => { if (isDragging) { isDragging = false; GM_setValue(POS_KEY, { top: box.style.top, left: box.style.left }); } };
        }

        setInterval(() => {
            cleanup();
            const box = document.getElementById('sb-unified-dash');
            if (!/NIFTY/i.test(document.title)) { box.style.display = "none"; return; }
            box.style.display = "block";

            const data = GM_getValue(DATA_KEY, { pcr: "--", maxPain: "--", price: "--", atm: "--", vix: "--", ivp: "--", dayOpen: "--", ts: "--", lastUpdate: 0 });

            // Sync Alert
            const syncLabel = document.getElementById('tv-sync-container');
            const syncTime = document.getElementById('tv-ts');
            if (Date.now() - data.lastUpdate > 10000) {
                syncLabel.style.color = "#ff4d4d"; syncTime.style.color = "#ff4d4d";
            } else {
                syncLabel.style.color = "#5d606b"; syncTime.style.color = "#00ffcc";
            }

            // Update UI Fields
            document.getElementById('tv-atm').innerText = data.atm;
            document.getElementById('tv-pcr').innerText = data.pcr;
            document.getElementById('tv-maxpain').innerText = data.maxPain;
            document.getElementById('tv-price').innerText = data.price;
            document.getElementById('tv-vix').innerText = data.vix;
            document.getElementById('tv-ivp').innerText = data.ivp;
            document.getElementById('tv-ts').innerText = data.ts;

            const prVal = parseFloat(data.price), opVal = parseFloat(data.dayOpen), vixVal = parseFloat(data.vix), pcrVal = parseFloat(data.pcr), mpVal = parseFloat(data.maxPain.replace(/,/g, ''));

            if (!isNaN(vixVal) && !isNaN(opVal)) {
                const movePct = (vixVal / 16).toFixed(2);
                const upper = Math.round(opVal * (1 + (movePct/100))), lower = Math.round(opVal * (1 - (movePct/100)));

                document.getElementById('tv-range-display').innerText = `${lower} - ${upper}`;
                document.getElementById('tv-move-pct').innerText = `(EXP. MOVE: ${movePct}%)`;

                const biasEl = document.getElementById('tv-bias');
                if (prVal >= upper) { biasEl.innerText = "BIAS: OVEREXTENDED ↘"; biasEl.style.color = "#f23645"; }
                else if (prVal <= lower) { biasEl.innerText = "BIAS: EXHAUSTION ↗"; biasEl.style.color = "#089981"; }
                else {
                    biasEl.innerText = prVal > opVal ? "BIAS: BULLISH ↗" : "BIAS: BEARISH ↘";
                    biasEl.style.color = prVal > opVal ? "#089981" : "#f23645";
                }
            }

            // Pulse effects
            box.classList.toggle('glow-maxpain', !isNaN(prVal) && Math.abs(prVal - mpVal) <= 15);
            const atmVal = parseFloat(data.atm.replace(/,/g, ''));
            box.classList.toggle('glow-atm-cross', !isNaN(atmVal) && !isNaN(prVal) && Math.abs(prVal - atmVal) <= 10);

        }, 1000);
    }
})();