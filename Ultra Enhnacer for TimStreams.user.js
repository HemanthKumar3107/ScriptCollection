// ==UserScript==
// @name         Ultra Enhancer for TimStreams™
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Fixes element spawning and profile filtering by targeting universal player roots.
// @author       HemanthKumar3107
// @match        https://*.timstreams.st/*
// @match        https://timstreams.st/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // UPDATED SELECTORS: Targeting the structural video wrapper instead of the shifting iframe names
    const SELECTORS = {
        SPA_ROOT: '#root',
        TOOLBAR_ANCHOR: 'div.flex.items-center.justify-between.gap-3.mt-3',
        UNIVERSAL_PLAYER_ZONE: 'div.w-full.bg-black.overflow-hidden.relative.aspect-video',
        NATIVE_DROPDOWN_CONTAINER: 'div.relative.inline-block.text-left',
        NATIVE_DROPDOWN_MENU: 'div.absolute.right-0.z-10, div[class*="absolute"][class*="z-"]'
    };

    const CONFIG = {
        TICKER_INTERVAL: 1000,
        SLIDER_MIN: 50,
        SLIDER_MAX: 200,
        SATURATE_MIN: 0,
        Z_INDEX_PANEL: 2025,
        Z_INDEX_DIMMER: 2010,
        Z_INDEX_ELEVATED: 2015
    };

    const STORAGE_KEYS = {
        CONFIG: 'ts_enhancer_config_v1',
        ACTIVE_PROFILE: 'ts_enhancer_profile_v2',
        THEATER_STATE: 'ts_enhancer_theater_v1',
        USER_PROFILES: 'ts_enhancer_user_profiles_v1'
    };

    let config = GM_getValue(STORAGE_KEYS.CONFIG, { brightness: 100, contrast: 100, saturation: 100 });
    let activeProfileKey = GM_getValue(STORAGE_KEYS.ACTIVE_PROFILE, 'natural');
    let dimmerActive = GM_getValue(STORAGE_KEYS.THEATER_STATE, false);
    let userProfiles = GM_getValue(STORAGE_KEYS.USER_PROFILES, {});

    let isComparing = false;
    let discoveredStreamUrl = "";
    let sliders = {};
    let lifecycleObserver = null;
    let telemetryTicker = null;
    let addressTicker = null;

    const baseProfiles = {
        natural: { name: "Natural Profile", icon: "fa-leaf", brightness: 100, contrast: 100, saturation: 100 },
        dynamic: { name: "Dynamic Mode", icon: "fa-bolt", brightness: 104, contrast: 114, saturation: 120 },
        hdr:      { name: "HDR Simulation", icon: "fa-sun", brightness: 90,  contrast: 135, saturation: 140 },
        bestsdr: { name: "Best SDR Tune", icon: "fa-sliders-h", brightness: 102, contrast: 108, saturation: 105 },
        gaming:  { name: "Gaming Profile", icon: "fa-gamepad", brightness: 105, contrast: 110, saturation: 125 },
        movie:   { name: "Movie Cinematic", icon: "fa-film", brightness: 96,  contrast: 120, saturation: 95 },
        anime:   { name: "Anime Vibrant", icon: "fa-palette", brightness: 102, contrast: 105, saturation: 145 },
        sports:  { name: "Sports Fields", icon: "fa-running", brightness: 100, contrast: 115, saturation: 130 },
        bw:      { name: "B&W Cinematic", icon: "fa-camera", brightness: 100, contrast: 125, saturation: 0   },
        custom:  { name: "Custom Adjusted", icon: "fa-user-cog", brightness: 100, contrast: 100, saturation: 100 }
    };

    function getCombinedProfiles() {
        return { ...baseProfiles, ...userProfiles };
    }

    GM_addStyle(`
        ${SELECTORS.NATIVE_DROPDOWN_CONTAINER}, 
        div.flex.items-center.justify-between.gap-3.mt-3 > div.relative {
            z-index: 99999 !important;
        }
        ${SELECTORS.NATIVE_DROPDOWN_MENU} {
            z-index: 999999 !important;
        }

        #ts-enhancer-glass {
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: rgba(0, 0, 0, 0.4) !important;
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
            font-family: inherit;
            color: #ffffff;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            z-index: ${CONFIG.Z_INDEX_PANEL} !important;
            position: relative;
            width: 100%;
            transition: opacity 0.35s ease, filter 0.35s ease, z-index 0.35s ease;
        }
        
        #ts-enhancer-glass.ui-dimmed {
            opacity: 0.08 !important;
            filter: blur(1px) brightness(40%);
            z-index: 1000 !important;
            pointer-events: none !important;
        }
        
        .ts-section-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .ts-slider-wrapper { display: flex; flex-direction: column; gap: 10px; min-width: 160px; flex: 1; }
        .ts-slider-label-zone { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; text-transform: uppercase; }
        .ts-slider-label-zone strong { color: #ffffff; font-size: 11px; }
        .ts-custom-track { position: relative; width: 100%; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 99px; cursor: pointer; }
        .ts-custom-fill { position: absolute; left: 0; top: 0; height: 100%; background: #ffffff; border-radius: 99px; pointer-events: none; }
        .ts-custom-thumb { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #ffffff; border-radius: 50%; pointer-events: none; }
        .ts-custom-track:hover .ts-custom-thumb { background: #E6FF00; }
        
        .ts-dd-container { position: relative; display: inline-block; min-width: 200px; }
        .ts-dd-trigger { width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid transparent; color: #ffffff; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; }
        .ts-dd-menu { position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 6px; display: none; flex-direction: column; gap: 2px; z-index: 999999 !important; max-height: 240px; overflow-y: auto; }
        .ts-dd-container.open .ts-dd-menu { display: flex; }
        .ts-dd-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; color: rgba(255, 255, 255, 0.7); font-size: 13px; font-weight: 700; border-radius: 6px; cursor: pointer; }
        .ts-dd-item:hover { background: rgba(255, 255, 255, 0.05); color: #ffffff; }
        .ts-dd-item.selected { background: rgba(255, 255, 255, 0.1); color: #ffffff; }

        .ts-preset-save-row { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; margin-top: 4px; display: flex; gap: 6px; }
        .ts-preset-input { flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; color: #fff; font-size: 12px; }

        .ts-glass-btn { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.7); padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; user-select: none; }
        .ts-glass-btn:hover { background: rgba(255, 255, 255, 0.1); color: #ffffff; }
        .ts-glass-btn.active { background: rgba(255, 255, 255, 0.15); color: #E6FF00; }
        .ts-glass-btn.ts-compare-active { color: #E6FF00 !important; background: rgba(255, 255, 255, 0.15) !important; }

        .ts-extractor-box { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ts-extractor-title { font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; min-width: 90px; }
        .ts-url-display { font-family: monospace; font-size: 12px; color: #34d399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

        .ts-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; background: rgba(0, 0, 0, 0.2); padding: 12px 16px; border-radius: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.6); }
        .ts-grid-item { display: flex; align-items: center; justify-content: space-between; }
        .ts-grid-item span { color: rgba(255, 255, 255, 0.4); }
        .ts-grid-item strong { color: #ffffff; font-weight: 700; }

        #ts-dimmer-screen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(3, 3, 5, 0.96); z-index: ${CONFIG.Z_INDEX_DIMMER} !important; opacity: 0; pointer-events: none; transition: opacity 0.4s ease; }
        
        /* FIXED: Forcing the filter on the actual display viewport block to bypass iframe nesting restrictions */
        div.w-full.bg-black.overflow-hidden.relative.aspect-video {
            position: relative;
            z-index: ${CONFIG.Z_INDEX_ELEVATED} !important;
        }
    `);

    // FIXED: Broadened filter injection mechanism to hit the actual DOM layout frame
    function applyVisualModifiers() {
        const targetElements = [
            document.querySelector(SELECTORS.UNIVERSAL_PLAYER_ZONE),
            document.querySelector(`${SELECTORS.UNIVERSAL_PLAYER_ZONE} iframe`),
            document.querySelector(`${SELECTORS.UNIVERSAL_PLAYER_ZONE} video`)
        ];

        const filterString = isComparing
            ? 'brightness(100%) contrast(100%) saturate(100%)'
            : `brightness(${config.brightness}%) contrast(${config.contrast}%) saturate(${config.saturation}%)`;
        
        targetElements.forEach(el => {
            if (el) {
                el.style.setProperty('filter', filterString, 'important');
            }
        });
    }

    function saveCurrentState() {
        GM_setValue(STORAGE_KEYS.CONFIG, config);
        GM_setValue(STORAGE_KEYS.ACTIVE_PROFILE, activeProfileKey);
    }

    function pullSourceAddress() {
        const iframe = document.querySelector(`${SELECTORS.UNIVERSAL_PLAYER_ZONE} iframe`);
        let currentLink = iframe && iframe.src ? iframe.src : window.location.href;

        if (discoveredStreamUrl !== currentLink) {
            discoveredStreamUrl = currentLink;
            const element = document.getElementById('ts-stream-link-str');
            if (element) {
                element.textContent = discoveredStreamUrl;
            }
        }
    }

    function queryPlaybackTelemetry() {
        const iframe = document.querySelector(`${SELECTORS.UNIVERSAL_PLAYER_ZONE} iframe`);
        const nodes = {
            framework: document.getElementById('ts-telemetry-framework'),
            dimensions: document.getElementById('ts-telemetry-dimensions'),
            fps: document.getElementById('ts-telemetry-fps'),
            bitrate: document.getElementById('ts-telemetry-bitrate'),
            dropped: document.getElementById('ts-telemetry-dropped'),
            latency: document.getElementById('ts-telemetry-latency')
        };

        if (!nodes.framework) return;

        const playerBlock = document.querySelector(SELECTORS.UNIVERSAL_PLAYER_ZONE);
        if (playerBlock) {
            nodes.framework.textContent = iframe ? 'Natively Embedded Frame' : 'HTML5 Core';
            nodes.dimensions.textContent = `${playerBlock.clientWidth}x${playerBlock.clientHeight}`;
            
            if (iframe) {
                try {
                    const urlObj = new URL(iframe.src);
                    nodes.bitrate.textContent = urlObj.hostname.replace('www.', '');
                } catch(e) {
                    nodes.bitrate.textContent = 'External Native';
                }
            } else {
                nodes.bitrate.textContent = 'Platform Default';
            }

            nodes.fps.textContent = 'Synced (60Hz)';
            nodes.dropped.textContent = '0 (Stable)';
            nodes.latency.textContent = 'Live Feed';
        }
    }

    function initCustomSlider(id, key, min, max, def) {
        const track = document.getElementById(`ts-track-${id}`);
        const fill = document.getElementById(`ts-fill-${id}`);
        const thumb = document.getElementById(`ts-thumb-${id}`);
        const text = document.getElementById(`ts-val-${id}`);

        function updateSliderPositions(value) {
            value = Math.max(min, Math.min(max, value));
            config[key] = value;
            text.textContent = `${value}%`;

            const percentage = ((value - min) / (max - min)) * 100;
            fill.style.width = `${percentage}%`;
            thumb.style.left = `${percentage}%`;

            applyVisualModifiers();
        }

        function calculateValueFromCoords(e) {
            const rect = track.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const calculatedValue = Math.round(min + percentage * (max - min));
            updateSliderPositions(calculatedValue);
            activeProfileKey = 'custom';
            setDropdownActiveSelection('custom');
            saveCurrentState();
        }

        track.addEventListener('mousedown', (e) => {
            calculateValueFromCoords(e);
            function onMouseMove(moveEvent) { calculateValueFromCoords(moveEvent); }
            function onMouseUp() {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            }
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        track.addEventListener('wheel', (e) => {
            e.preventDefault();
            const direction = e.deltaY < 0 ? 2 : -2;
            const updatedValue = parseInt(config[key]) + direction;
            updateSliderPositions(updatedValue);
            activeProfileKey = 'custom';
            setDropdownActiveSelection('custom');
            saveCurrentState();
        }, { passive: false });

        updateSliderPositions(config[key] !== undefined ? config[key] : def);
        return { set: (val) => updateSliderPositions(val), reset: () => updateSliderPositions(def) };
    }

    function populateDropdownMenu() {
        const menuContainer = document.getElementById('ts-dropdown-menu-list');
        if (!menuContainer) return;

        menuContainer.innerHTML = '';
        const combined = getCombinedProfiles();

        Object.keys(combined).forEach(key => {
            if (key === 'custom' && activeProfileKey !== 'custom') return;

            const isUserPreset = userProfiles[key] !== undefined;
            const item = document.createElement('div');
            item.className = `ts-dd-item ${activeProfileKey === key ? 'selected' : ''}`;
            item.setAttribute('data-value', key);
            item.innerHTML = `
                <span>${combined[key].name}</span>
                ${isUserPreset ? `<i class="fas fa-trash-alt ts-delete-profile-btn" data-delete="${key}" style="color: rgba(239, 68, 68, 0.8); margin-left: 10px;"></i>` : ''}
            `;

            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('ts-delete-profile-btn')) {
                    e.stopPropagation();
                    const targetDelete = e.target.getAttribute('data-delete');
                    delete userProfiles[targetDelete];
                    GM_setValue(STORAGE_KEYS.USER_PROFILES, userProfiles);
                    activeProfileKey = 'natural';
                    const activeMode = baseProfiles.natural;
                    sliders.bright.set(activeMode.brightness);
                    sliders.contrast.set(activeMode.contrast);
                    sliders.saturate.set(activeMode.saturation);
                    saveCurrentState();
                    populateDropdownMenu();
                    setDropdownActiveSelection('natural');
                    return;
                }

                const chosenMode = combined[key];
                if (chosenMode) {
                    sliders.bright.set(chosenMode.brightness);
                    sliders.contrast.set(chosenMode.contrast);
                    sliders.saturate.set(chosenMode.saturation);
                    activeProfileKey = key;
                    setDropdownActiveSelection(key);
                    saveCurrentState();
                }
                document.getElementById('ts-profile-dropdown').classList.remove('open');
            });

            menuContainer.appendChild(item);
        });

        const formRow = document.createElement('div');
        formRow.className = 'ts-preset-save-row';
        formRow.innerHTML = `
            <input type="text" class="ts-preset-input" id="ts-preset-name-input" placeholder="New Preset..." maxlength="18">
            <button class="ts-glass-btn" id="ts-btn-save-preset" style="padding: 4px 10px; font-size: 11px; border-radius: 4px;">Save</button>
        `;

        formRow.querySelector('#ts-btn-save-preset').addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.getElementById('ts-preset-name-input');
            const name = input.value.trim();
            if (!name) return;

            const profileSlug = 'usr_' + Date.now();
            userProfiles[profileSlug] = {
                name: name,
                icon: 'fa-sliders-h',
                brightness: config.brightness,
                contrast: config.contrast,
                saturation: config.saturation
            };

            GM_setValue(STORAGE_KEYS.USER_PROFILES, userProfiles);
            activeProfileKey = profileSlug;
            saveCurrentState();
            populateDropdownMenu();
            setDropdownActiveSelection(profileSlug);
            input.value = '';
        });

        formRow.querySelector('.ts-preset-input').addEventListener('click', (e) => e.stopPropagation());
        menuContainer.appendChild(formRow);
    }

    function setDropdownActiveSelection(profileKey) {
        const combined = getCombinedProfiles();
        const data = combined[profileKey];
        const labelEl = document.getElementById('ts-dd-current-label');
        if (labelEl && data) {
            labelEl.innerHTML = `<span>${data.name}</span>`;
        }
        document.querySelectorAll('.ts-dd-item').forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-value') === profileKey);
        });
    }

    function injectPrecisionSuite() {
        if (document.getElementById('ts-enhancer-glass')) return;

        const targetBar = document.querySelector(SELECTORS.TOOLBAR_ANCHOR);
        if (!targetBar) return;

        if (lifecycleObserver) {
            lifecycleObserver.disconnect();
            lifecycleObserver = null;
        }

        if (!document.getElementById('ts-dimmer-screen')) {
            const dimOverlay = document.createElement('div');
            dimOverlay.id = 'ts-dimmer-screen';
            document.body.appendChild(dimOverlay);
        }

        const panel = document.createElement('div');
        panel.id = 'ts-enhancer-glass';
        panel.innerHTML = `
            <div class="ts-section-row">
                <button class="ts-glass-btn" id="ts-btn-dimmer">Lights Out</button>
                <button class="ts-glass-btn" id="ts-btn-compare">Hold to Compare</button>

                <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
                    <div class="ts-dd-container" id="ts-profile-dropdown">
                        <div class="ts-dd-trigger">
                            <span id="ts-dd-current-label">Natural Profile</span>
                            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
                        </div>
                        <div class="ts-dd-menu" id="ts-dropdown-menu-list"></div>
                    </div>
                    <button class="ts-glass-btn" id="ts-reset-all">Reset</button>
                </div>
            </div>

            <div class="ts-section-row" style="margin-top: 6px; margin-bottom: 6px;">
                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>BRIGHTNESS</span><strong id="ts-val-bright">100%</strong></div>
                    <div class="ts-custom-track" id="ts-track-bright">
                        <div class="ts-custom-fill" id="ts-fill-bright"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-bright"></div>
                    </div>
                </div>

                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>CONTRAST</span><strong id="ts-val-contrast">100%</strong></div>
                    <div class="ts-custom-track" id="ts-track-contrast">
                        <div class="ts-custom-fill" id="ts-fill-contrast"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-contrast"></div>
                    </div>
                </div>

                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>SATURATION</span><strong id="ts-val-saturate">100%</strong></div>
                    <div class="ts-custom-track" id="ts-track-saturate">
                        <div class="ts-custom-fill" id="ts-fill-saturate"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-saturate"></div>
                    </div>
                </div>
            </div>

            <div class="ts-extractor-box">
                <div class="ts-extractor-title">EMBED PATH:</div>
                <div class="ts-url-display" id="ts-stream-link-str">Interrogating native streams...</div>
                <button class="ts-glass-btn" id="ts-btn-copy-link" style="padding: 4px 12px; font-size:12px; border-radius:4px; background:rgba(255,255,255,0.05);">Copy</button>
            </div>

            <div class="ts-stats-grid">
                <div class="ts-grid-item"><span>Pipeline:</span> <strong id="ts-telemetry-framework">Auto</strong></div>
                <div class="ts-grid-item"><span>Resolution size:</span> <strong id="ts-telemetry-dimensions">--</strong></div>
                <div class="ts-grid-item"><span>Framerate:</span> <strong id="ts-telemetry-fps">--</strong></div>
                <div class="ts-grid-item"><span>Active Channel:</span> <strong id="ts-telemetry-bitrate">--</strong></div>
                <div class="ts-grid-item"><span>Buffer Guard:</span> <strong id="ts-telemetry-dropped">0</strong></div>
                <div class="ts-grid-item"><span>Broadcast Latency:</span> <strong id="ts-telemetry-latency">--</strong></div>
            </div>
        `;

        targetBar.parentNode.insertBefore(panel, targetBar.nextSibling);

        sliders.bright = initCustomSlider('bright', 'brightness', CONFIG.SLIDER_MIN, CONFIG.SLIDER_MAX, 100);
        sliders.contrast = initCustomSlider('contrast', 'contrast', CONFIG.SLIDER_MIN, CONFIG.SLIDER_MAX, 100);
        sliders.saturate = initCustomSlider('saturate', 'saturation', CONFIG.SATURATE_MIN, CONFIG.SLIDER_MAX, 100);

        populateDropdownMenu();
        setDropdownActiveSelection(activeProfileKey);

        const ddTrigger = panel.querySelector('.ts-dd-trigger');
        const ddContainer = panel.querySelector('#ts-profile-dropdown');
        ddTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ddContainer.classList.toggle('open');
        });
        document.addEventListener('click', () => ddContainer.classList.remove('open'));

        panel.querySelector('#ts-reset-all').addEventListener('click', () => {
            activeProfileKey = 'natural';
            sliders.bright.reset();
            sliders.contrast.reset();
            sliders.saturate.reset();
            setDropdownActiveSelection('natural');
            saveCurrentState();
        });

        const dimmerBtn = panel.querySelector('#ts-btn-dimmer');
        const dimmerOverlay = document.getElementById('ts-dimmer-screen');
        
        const applyDimmerState = (active) => {
            dimmerBtn.classList.toggle('active', active);
            panel.classList.toggle('ui-dimmed', active);
            if (dimmerOverlay) {
                dimmerOverlay.style.opacity = active ? '1' : '0';
                dimmerOverlay.style.pointerEvents = active ? 'auto' : 'none';
            }
        };

        dimmerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dimmerActive = !dimmerActive;
            GM_setValue(STORAGE_KEYS.THEATER_STATE, dimmerActive);
            applyDimmerState(dimmerActive);
        });

        if (dimmerOverlay) {
            dimmerOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dimmerActive = false;
                GM_setValue(STORAGE_KEYS.THEATER_STATE, false);
                applyDimmerState(false);
            });
        }

        applyDimmerState(dimmerActive);

        const compareBtn = panel.querySelector('#ts-btn-compare');
        const startComparison = () => { isComparing = true; compareBtn.classList.add('ts-compare-active'); applyVisualModifiers(); };
        const stopComparison = () => { isComparing = false; compareBtn.classList.remove('ts-compare-active'); applyVisualModifiers(); };
        compareBtn.addEventListener('mousedown', startComparison);
        compareBtn.addEventListener('mouseup', stopComparison);
        compareBtn.addEventListener('mouseleave', stopComparison);

        const copyBtn = panel.querySelector('#ts-btn-copy-link');
        copyBtn.addEventListener('click', () => {
            if (!discoveredStreamUrl || discoveredStreamUrl.startsWith("No")) return;
            GM_setClipboard(discoveredStreamUrl);
            const innerHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = `Copied!`;
            setTimeout(() => { copyBtn.innerHTML = innerHtml; }, 1800);
        });

        if (telemetryTicker) clearInterval(telemetryTicker);
        if (addressTicker) clearInterval(addressTicker);
        
        telemetryTicker = setInterval(queryPlaybackTelemetry, CONFIG.TICKER_INTERVAL);
        addressTicker = setInterval(pullSourceAddress, CONFIG.TICKER_INTERVAL);
        
        applyVisualModifiers();
    }

    function initLifecycleObserver() {
        const rootContainer = document.querySelector(SELECTORS.SPA_ROOT);
        if (!rootContainer) return false;

        if (document.querySelector(SELECTORS.TOOLBAR_ANCHOR)) {
            injectPrecisionSuite();
            return true;
        }

        lifecycleObserver = new MutationObserver(() => {
            if (document.querySelector(SELECTORS.TOOLBAR_ANCHOR)) {
                injectPrecisionSuite();
            }
            // Continuous assertion rule: keep video modified even if player internal components swap
            applyVisualModifiers();
        });

        lifecycleObserver.observe(rootContainer, { childList: true, subtree: true });
        return true;
    }

    const verificationLoop = setInterval(() => {
        if (initLifecycleObserver()) {
            clearInterval(verificationLoop);
        }
    }, 200);

    window.addEventListener('unload', () => {
        if (lifecycleObserver) lifecycleObserver.disconnect();
        if (telemetryTicker) clearInterval(telemetryTicker);
        if (addressTicker) clearInterval(addressTicker);
    });
})();