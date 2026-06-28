// ==UserScript==
// @name         NSE ETF Fair Value - Smart Ticker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Updated for 2026 NSE layout. Correctly finds LTP and i-NAV across tabs.
// @author       HemanthKumar3107
// @match        *://*.nseindia.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Improved label search to handle nested spans/divs better
    const findValueByLabel = (label) => {
        const items = document.querySelectorAll('.symbol-item, .symbol-label, div, span');
        for (let el of items) {
            if (el.innerText && el.innerText.trim().toLowerCase() === label.toLowerCase()) {
                // Look for the value in common sibling/parent patterns
                let valEl = el.nextElementSibling ||
                            el.parentElement.querySelector('.symbol-val') ||
                            el.parentElement.querySelector('.val') ||
                            el.parentElement.children[1];

                if (valEl) {
                    let num = parseFloat(valEl.innerText.replace(/,/g, '').trim());
                    if (!isNaN(num)) return num;
                }
            }
        }
        return null;
    };

    const getSymbol = () => {
        const symbolEl = document.querySelector('.symbol-text') || document.querySelector('.companyName');
        return symbolEl ? symbolEl.innerText.split('\n')[0].trim() : "ETF";
    };

    const getLTP = () => {
        // 1. Try Live Price (New 2026 Layout)
        const livePriceEl = document.querySelector('.symbol-value .val') || document.querySelector('.index-highlight');
        if (livePriceEl) {
            const val = parseFloat(livePriceEl.innerText.replace(/,/g, '').trim());
            if (!isNaN(val) && val > 0) return val;
        }

        // 2. Try Today's Close (Market Closed) - Targeted logic for your red_txt asterisk
        const labels = document.querySelectorAll('.symbol-label');
        for (let label of labels) {
            const text = label.innerText.trim();
            if (text.includes('Close') && (text.includes('*') || label.querySelector('.red_txt'))) {
                const valEl = label.parentElement.querySelector('.symbol-val');
                if (valEl) {
                    const val = parseFloat(valEl.innerText.replace(/,/g, '').trim());
                    if (!isNaN(val)) return val;
                }
            }
        }
        return null;
    };

    const updateUI = () => {
        const ltp = getLTP();
        const inav = findValueByLabel('i-NAV');
        const symbol = getSymbol();
        const badge = document.getElementById('nse-pro-ui');

        // Logic Check: Only show if we have both values
        if (!inav || !ltp) {
            if (badge) badge.style.display = "none";
            return;
        }

        const diff = ((ltp - inav) / inav) * 100;
        const isPremium = diff > 0;
        const color = isPremium ? "#ff4d4d" : "#00ff88";
        const shadow = isPremium ? "rgba(255, 77, 77, 0.4)" : "rgba(0, 255, 136, 0.4)";

        if (!badge) {
            const newBadge = document.createElement('div');
            newBadge.id = 'nse-pro-ui';
            newBadge.style = `
                position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px);
                color: white; padding: 12px 20px; border-radius: 12px;
                font-family: 'Segoe UI', Roboto, sans-serif; display: flex;
                align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 15px ${shadow};
                transition: all 0.3s ease;
            `;
            document.body.appendChild(newBadge);
        } else {
            badge.style.display = "flex";
            badge.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 15px ${shadow}`;
        }

        const currentBadge = document.getElementById('nse-pro-ui');
        currentBadge.style.borderLeft = `5px solid ${color}`;

        currentBadge.innerHTML = `
            <div style="display:flex; flex-direction:column; min-width: 80px;">
                <span style="font-size: 10px; color: ${color}; font-weight: 900; letter-spacing: 1px;">${symbol}</span>
                <span style="font-size: 16px; font-weight: 800;">₹${ltp.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.1);"></div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-size: 10px; color: #94a3b8; font-weight: bold; letter-spacing: 1px;">i-NAV</span>
                <span style="font-size: 16px; font-weight: 800;">₹${inav.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.1);"></div>
            <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: ${color};">${diff > 0 ? '+' : ''}${diff.toFixed(2)}%</div>
                <div style="font-size: 9px; font-weight: bold; color: ${color}; opacity: 0.8;">${isPremium ? 'PREMIUM' : 'DISCOUNT'}</div>
            </div>
        `;
    };

    // Run every second
    setInterval(updateUI, 1000);
})();