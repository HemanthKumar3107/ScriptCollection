// ==UserScript==
// @name         TradingView Metal Arbitrage
// @version      1.0
// @description  Arbitrage for gold and silver in USD and INR values
// @author       HemanthKumar3107
// @match        https://*.tradingview.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const renderGapUI = (label, gap, fairValue) => {
        if (gap === null || isNaN(gap) || fairValue <= 0) return `<div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;"></div>`;
        const isPremium = gap > 0;
        const color = isPremium ? '#ff4a68' : '#00ffa3';
        const sign = isPremium ? '+' : '';
        const gapPercent = ((gap / fairValue) * 100).toFixed(2);

        return `
            <div style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 10px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
                <div style="font-size: 9px; color: #868993; margin-bottom: 4px; letter-spacing: 1px; font-weight: bold; text-transform: uppercase;">${label} Basis</div>
                <div style="font-size: 20px; font-weight: 900; color: ${color}; line-height: 1;">${sign}${gapPercent}%</div>
                <div style="font-size: 11px; font-weight: 700; color: ${color}; margin-top: 4px; opacity: 0.9;">
                    ${sign}${Math.round(gap).toLocaleString()} <span style="font-size: 8px; opacity: 0.6;">INR</span>
                </div>
            </div>
        `;
    };

    const createDashboard = () => {
        let dash = document.getElementById('metal-fv-pro');
        if (!dash) {
            dash = document.createElement('div');
            dash.id = 'metal-fv-pro';
            const savedPos = JSON.parse(localStorage.getItem('metalDashPos') || '{"top":"100px","left":"60px"}');
            dash.style = `
                position: fixed; top: ${savedPos.top}; left: ${savedPos.left};
                background: rgba(10, 12, 18, 0.85); backdrop-filter: blur(25px) saturate(180%);
                color: #ffffff; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12);
                z-index: 999999; font-family: -apple-system, sans-serif;
                min-width: 340px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9); user-select: none; overflow: hidden;
                display: none;
            `;
            document.body.appendChild(dash);

            const makeDraggable = (el) => {
                let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
                el.onmousedown = (e) => {
                    if (e.target.closest('#dash-handle')) {
                        e.preventDefault();
                        p3 = e.clientX; p4 = e.clientY;
                        document.onmouseup = () => {
                            document.onmouseup = null; document.onmousemove = null;
                            localStorage.setItem('metalDashPos', JSON.stringify({top: el.style.top, left: el.style.left}));
                        };
                        document.onmousemove = (e) => {
                            e.preventDefault();
                            p1 = p3 - e.clientX; p2 = p4 - e.clientY;
                            p3 = e.clientX; p4 = e.clientY;
                            el.style.top = (el.offsetTop - p2) + "px"; el.style.left = (el.offsetLeft - p1) + "px";
                        };
                    }
                };
            };
            makeDraggable(dash);
        }
        return dash;
    };

    const update = () => {
        const dash = createDashboard();
        const tabTitle = document.title.toUpperCase();
        const legendItem = document.querySelector('[class*="title-wrapper-"]') || document.querySelector('[class*="legend-series-item"]');
        const legendText = legendItem ? legendItem.innerText.toUpperCase() : "";

        const isMetalChart = tabTitle.includes("GOLD") || tabTitle.includes("SILVER") ||
                            tabTitle.includes("XAU") || tabTitle.includes("XAG") ||
                            legendText.includes("GOLD") || legendText.includes("SILVER");

        if (!isMetalChart) {
            dash.style.display = "none";
            return;
        }

        const rows = document.querySelectorAll('[class*="symbol-"]');
        if (rows.length === 0) return;

        let d = { intG: 0, intS: 0, inr: 0, mcxG: 0, mcxS: 0, gOp: false, sOp: false, inrOp: false };

        rows.forEach(row => {
            const sym = row.getAttribute('data-symbol-short') || "";
            const full = row.getAttribute('data-symbol-full') || "";
            const priceEl = row.querySelector('[class*="last-"] [class*="inner-"]');
            if (!priceEl) return;

            const price = parseFloat(priceEl.innerText.replace(/,/g, ''));
            const isOpen = row.querySelector('[class*="tv-market-status--market"]') !== null;

            if (sym === "XAUUSD" || sym === "GOLD") { d.intG = price; d.gOp = isOpen; }
            if (sym === "XAGUSD" || sym === "SILVER") { d.intS = price; d.sOp = isOpen; }
            if (sym === "USDINR") { d.inr = price; d.inrOp = isOpen; }
            if (full.includes("MCX:GOLD")) d.mcxG = price;
            if (full.includes("MCX:SILVER")) d.mcxS = price;
        });

        if (d.inr > 0 && d.intG > 0) {
            dash.style.display = "block";
            const tax = 1.15 * 1.03;
            const gFV = ((d.intG * d.inr) / 31.1035 * 10) * tax;
            const sFV = ((d.intS * d.inr) / 31.1035 * 1000) * tax;
            const gGap = d.mcxG > 0 ? d.mcxG - gFV : null;
            const sGap = d.mcxS > 0 ? d.mcxS - sFV : null;

            dash.innerHTML = `
                <!-- USDINR badge is now significantly larger -->
                <div id="dash-handle" style="background: rgba(255,255,255,0.02); padding: 16px 20px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <span style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #5d606b; text-transform: uppercase;">Arbitrage Desk</span>
                    <div style="display: flex; align-items: center; background: rgba(41, 98, 255, 0.12); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(41, 98, 255, 0.3);">
                        <span style="height: 8px; width: 8px; background: ${d.inrOp ? '#00ffa3' : '#ff4a68'}; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 10px ${d.inrOp ? '#00ffa3' : '#ff4a68'};"></span>
                        <span style="color: #4a89ff; font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">INR ${d.inr.toFixed(2)}</span>
                    </div>
                </div>
                <div style="padding: 24px 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                        <div style="color: #FFD700; font-size: 32px; font-weight: 900; letter-spacing: -1px;">₹${Math.round(gFV).toLocaleString()}</div>
                        <div style="color: #E5E4E2; font-size: 32px; font-weight: 900; letter-spacing: -1px;">₹${Math.round(sFV).toLocaleString()}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 24px; font-weight: 800; color: #868993;">
                        <div style="display: flex; align-items: center; color: ${d.gOp ? '#00ffa3' : '#ff4a68'}">
                            <span style="height: 7px; width: 7px; background: currentColor; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px currentColor;"></span> GOLD SPOT
                        </div>
                        <div style="display: flex; align-items: center; color: ${d.sOp ? '#00ffa3' : '#ff4a68'}">
                            <span style="height: 7px; width: 7px; background: currentColor; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px currentColor;"></span> SILVER SPOT
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        ${renderGapUI("Gold", gGap, gFV)}
                        ${renderGapUI("Silver", sGap, sFV)}
                    </div>
                </div>
            `;
        }
    };

    setInterval(update, 1500);
})();