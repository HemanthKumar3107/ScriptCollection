// ==UserScript==
// @name         Ultra Enhancer for TimStreams™
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Premium video enhancement suite featuring dynamic visual profiles, persistent custom presets, real-time playback telemetry, before/after comparison, theater mode, and intelligent stream extraction for TimStreams.
// @author       HemanthKumar3107
// @match        https://*.timstreams.st/watch*
// @match        https://timstreams.st/watch*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Centralized Immutable Structural Selectors
    const SELECTORS = {
        TOOLBAR_ANCHOR: '.stream-toolbar',
        JW_CONTAINER: '#jwPlayerContainer',
        EMBED_FRAME: '#streamFrame',
        NATIVE_SELECTOR: '#streamSelect',
        NATIVE_SOURCE_BTNS: '.stream-source-btn',
        NATIVE_VIDEO: '#jwPlayerContainer video, video'
    };

    // Centralized Immutable Configuration Values & Constants
    const CONFIG = {
        TICKER_INTERVAL: 1000,          // Balanced polling rate for real-time telemetry updates
        COPY_RESET_TIMEOUT: 1800,       // Time before "Copied!" text reverts back
        DOM_CHECK_INTERVAL: 400,        // Pipeline acceleration speed to catch layout generation
        SLIDER_MIN: 50,
        SLIDER_MAX: 200,
        SATURATE_MIN: 0,
        Z_INDEX_PANEL: 2005,
        Z_INDEX_DIMMER: 1999,
        Z_INDEX_ELEVATED: 2001
    };

    // Storage Keys For Persistent Caching
    const STORAGE_KEYS = {
        CONFIG: 'ts_enhancer_config_v1',
        ACTIVE_PROFILE: 'ts_enhancer_profile_v2',
        THEATER_STATE: 'ts_enhancer_theater_v1',
        USER_PROFILES: 'ts_enhancer_user_profiles_v1'
    };

    // Style Sheets Layer Integration
    GM_addStyle(`
        #ts-enhancer-glass {
            display: flex;
            flex-direction: column;
            gap: 18px;
            background: rgba(18, 18, 26, 0.75) !important;
            backdrop-filter: blur(25px) saturate(210%);
            -webkit-backdrop-filter: blur(25px) saturate(210%);
            border: 1px solid rgba(255, 255, 255, 0.09);
            border-radius: 20px;
            padding: 22px;
            margin: 16px var(--card-padding, 0px);
            font-family: 'Inter', system-ui, sans-serif;
            color: #f1f5f9;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.15);
            z-index: ${CONFIG.Z_INDEX_PANEL} !important;
            position: relative;
        }
        .ts-section-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 16px;
        }
        .ts-slider-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 160px;
            flex: 1;
        }
        .ts-slider-label-zone {
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.6px;
            text-transform: uppercase;
        }
        .ts-custom-track {
            position: relative;
            width: 100%;
            height: 14px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 99px;
            cursor: ew-resize;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05);
            border: 1px solid rgba(255, 255, 255, 0.04);
            transition: border-color 0.2s;
        }
        .ts-custom-track:hover { border-color: rgba(59, 130, 246, 0.4); }
        .ts-custom-fill {
            position: absolute;
            left: 0; top: 0; height: 100%;
            background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);
            border-radius: 99px;
            pointer-events: none;
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.3), 0 0 12px rgba(59, 130, 246, 0.4);
        }
        .ts-custom-thumb {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            background: #ffffff;
            border-radius: 50%;
            pointer-events: none;
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5), 0 0 4px rgba(255, 255, 255, 0.8);
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ts-custom-track:hover .ts-custom-thumb { transform: translate(-50%, -50%) scale(1.1); }
        .ts-dd-container { position: relative; display: inline-block; min-width: 220px; }
        .ts-dd-trigger {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.09);
            color: #f1f5f9;
            padding: 9px 16px;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.82rem;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        .ts-dd-trigger:hover, .ts-dd-container.open .ts-dd-trigger {
            border-color: rgba(59, 130, 246, 0.5);
            background: rgba(59, 130, 246, 0.12);
            color: #60a5fa;
        }
        .ts-dd-trigger i.chevron { transition: transform 0.25s ease; font-size: 0.75rem; color: #94a3b8; }
        .ts-dd-container.open .ts-dd-trigger i.chevron { transform: rotate(180deg); color: #60a5fa; }
        .ts-dd-menu {
            position: absolute;
            top: calc(100% + 6px); left: 0; width: 100%;
            background: rgba(23, 23, 33, 0.98);
            backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 6px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            gap: 2px;
            z-index: 2100;
            max-height: 320px;
            overflow-y: auto;
        }
        .ts-dd-container.open .ts-dd-menu { display: flex; }
        .ts-dd-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 12px;
            color: #cbd5e1;
            font-size: 0.82rem;
            font-weight: 500;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .ts-dd-item i { width: 16px; text-align: center; font-size: 0.88rem; color: #94a3b8; }
        .ts-dd-item:hover { background: rgba(255, 255, 255, 0.06); color: #ffffff; }
        .ts-dd-item.selected {
            background: rgba(37, 99, 235, 0.2);
            color: #60a5fa;
            font-weight: 600;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .ts-dd-item .ts-delete-profile-btn {
            margin-left: auto;
            color: #ef4444;
            opacity: 0.4;
            padding: 2px 6px;
            border-radius: 4px;
            transition: all 0.15s;
        }
        .ts-dd-item .ts-delete-profile-btn:hover { opacity: 1; background: rgba(239, 68, 68, 0.15); }

        .ts-preset-save-row {
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 8px;
            margin-top: 4px;
            display: flex;
            gap: 6px;
        }
        .ts-preset-input {
            flex: 1;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            padding: 4px 8px;
            color: #fff;
            font-size: 0.75rem;
        }
        .ts-preset-input:focus { border-color: #3b82f6; outline: none; }

        .ts-glass-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.09);
            color: #f1f5f9;
            padding: 9px 16px;
            border-radius: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 0.82rem;
            font-weight: 600;
            transition: all 0.2s ease;
            user-select: none;
        }
        .ts-glass-btn:hover { border-color: rgba(59, 130, 246, 0.5); background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .ts-glass-btn.active { background: rgba(255, 255, 255, 0.15); border-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); color: #34d399; }
        .ts-glass-btn.ts-compare-active { border-color: #f59e0b !important; color: #fbbf24 !important; background: rgba(245, 158, 11, 0.15) !important; }

        .ts-extractor-box {
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .ts-url-display { font-family: 'Fira Code', monospace; font-size: 0.78rem; color: #34d399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

        .ts-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            background: rgba(0, 0, 0, 0.2);
            padding: 14px 16px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.02);
            font-size: 0.8rem;
            color: #94a3b8;
        }
        .ts-grid-item { display: flex; align-items: center; gap: 8px; }
        .ts-grid-item i { color: #64748b; width: 14px; text-align: center; }
        .ts-grid-item strong { color: #f1f5f9; font-variant-numeric: tabular-nums; margin-left: auto; }

        #ts-dimmer-screen {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(4, 4, 6, 0.88);
            z-index: ${CONFIG.Z_INDEX_DIMMER} !important;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        ${SELECTORS.JW_CONTAINER}, ${SELECTORS.EMBED_FRAME}, .player-wrap {
            position: relative;
            z-index: ${CONFIG.Z_INDEX_ELEVATED} !important;
        }
    `);

    // Load State Parameters Out of Cache Memory
    let config = GM_getValue(STORAGE_KEYS.CONFIG, { brightness: 100, contrast: 100, saturation: 100 });
    let activeProfileKey = GM_getValue(STORAGE_KEYS.ACTIVE_PROFILE, 'natural');
    let dimmerActive = GM_getValue(STORAGE_KEYS.THEATER_STATE, false);
    let userProfiles = GM_getValue(STORAGE_KEYS.USER_PROFILES, {});

    let isComparing = false;
    let discoveredStreamUrl = "";
    let sliders = {};

    // High-Performance Telemetry State Cache (Prevents DOM Thrashing)
    let telemetryMemory = {
        lastTotalFrames: 0,
        lastTimestamp: 0
    };

    // Standard Profiles Factory Base Configuration
    const baseProfiles = {
        natural: { name: "Natural Profile", icon: "fa-leaf", brightness: 100, contrast: 100, saturation: 100 },
        dynamic: { name: "Dynamic Mode", icon: "fa-bolt", brightness: 104, contrast: 114, saturation: 120 },
        hdr:     { name: "HDR Simulation", icon: "fa-sun", brightness: 90,  contrast: 135, saturation: 140 },
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

    function getVisualTarget() {
        const jwContainer = document.querySelector(SELECTORS.JW_CONTAINER);
        if (jwContainer && jwContainer.style.display !== 'none') return jwContainer;
        return document.querySelector(SELECTORS.EMBED_FRAME);
    }

    function applyVisualModifiers() {
        const activeElement = getVisualTarget();
        const jwContainer = document.querySelector(SELECTORS.JW_CONTAINER);
        const iframeContainer = document.querySelector(SELECTORS.EMBED_FRAME);

        // Before/After Bypass Switch Check
        const filterString = isComparing
            ? 'brightness(100%) contrast(100%) saturate(100%)'
            : `brightness(${config.brightness}%) contrast(${config.contrast}%) saturate(${config.saturation}%)`;

        if (activeElement) {
            activeElement.style.filter = filterString;
        }
        if (jwContainer && jwContainer !== activeElement) jwContainer.style.filter = 'none';
        if (iframeContainer && iframeContainer !== activeElement) iframeContainer.style.filter = 'none';
    }

    function saveCurrentState() {
        GM_setValue(STORAGE_KEYS.CONFIG, config);
        GM_setValue(STORAGE_KEYS.ACTIVE_PROFILE, activeProfileKey);
    }

    function pullSourceAddress() {
        let currentLink = "No active stream track loaded.";
        const jw = window._jwInstance;

        if (jw && typeof jw.getPlaylist === 'function') {
            const playlist = jw.getPlaylist();
            if (playlist && playlist[0]) {
                currentLink = playlist[0].file || (playlist[0].sources && playlist[0].sources[0]?.file) || currentLink;
            }
        }
        if (currentLink.startsWith("No") && window._streamData) {
            currentLink = window._streamData.url || currentLink;
        }
        if (currentLink.startsWith("No")) {
            const iframe = document.querySelector(SELECTORS.EMBED_FRAME);
            if (iframe && iframe.src && iframe.style.display !== 'none') currentLink = iframe.src;
        }

        if (discoveredStreamUrl !== currentLink) {
            discoveredStreamUrl = currentLink;
            const element = document.getElementById('ts-stream-link-str');
            if (element) {
                element.textContent = discoveredStreamUrl;
                element.style.color = (discoveredStreamUrl.includes('.m3u8') || discoveredStreamUrl.includes('tracks-v1a1')) ? '#34d399' : '#60a5fa';
            }
        }
    }

    // Polymorphic Real-Time Diagnostics Interface Engine
    function queryPlaybackTelemetry() {
        const jw = window._jwInstance;
        const video = document.querySelector(SELECTORS.NATIVE_VIDEO);
        const jwContainer = document.querySelector(SELECTORS.JW_CONTAINER);

        const nodes = {
            framework: document.getElementById('ts-telemetry-framework'),
            dimensions: document.getElementById('ts-telemetry-dimensions'),
            fps: document.getElementById('ts-telemetry-fps'),
            bitrate: document.getElementById('ts-telemetry-bitrate'),
            dropped: document.getElementById('ts-telemetry-dropped'),
            latency: document.getElementById('ts-telemetry-latency')
        };

        if (!nodes.framework) return;

        const targetElement = getVisualTarget();
        nodes.dimensions.textContent = targetElement ? `${targetElement.clientWidth}x${targetElement.clientHeight}` : 'Unknown';

        // 1. Native JWPlayer Tracking Route
        if (jw && typeof jw.getQualityLevels === 'function' && jwContainer && jwContainer.style.display !== 'none') {
            nodes.framework.textContent = 'JWPlayer Native';

            // Extract Quality Level & Estimated Bitrates Safely and combine into a unified UX string
            const levels = jw.getQualityLevels();
            const idx = jw.getCurrentQuality();
            if (levels && levels[idx]) {
                const currentLevel = levels[idx];
                let resolutionLabel = currentLevel.label || '';
                if (resolutionLabel && !isNaN(resolutionLabel)) resolutionLabel += 'p';

                const bitrateKbps = currentLevel.bitrate ? `${Math.round(currentLevel.bitrate / 1000)} kbps` : 'Adaptive';
                nodes.bitrate.textContent = resolutionLabel ? `${resolutionLabel} (${bitrateKbps})` : bitrateKbps;
            } else {
                nodes.bitrate.textContent = 'Unknown';
            }

            // Real-time Rendered FPS Calculation via high-precision closure memory state
            if (video && video.getVideoPlaybackQuality) {
                const quality = video.getVideoPlaybackQuality();
                if (quality.totalVideoFrames > 0) {
                    const currentFrames = quality.totalVideoFrames;
                    const now = performance.now();

                    if (telemetryMemory.lastTimestamp > 0 && now > telemetryMemory.lastTimestamp) {
                        const frameDelta = currentFrames - telemetryMemory.lastTotalFrames;
                        const timeDeltaSeconds = (now - telemetryMemory.lastTimestamp) / 1000;
                        const calculatedFps = Math.round(frameDelta / timeDeltaSeconds);

                        if (calculatedFps >= 0 && calculatedFps < 144) {
                            if (video.paused) {
                                nodes.fps.textContent = '0 FPS (Paused)';
                            } else if (frameDelta === 0 && video.readyState < 3) {
                                nodes.fps.textContent = 'Stalled / Buffering';
                            } else {
                                nodes.fps.textContent = `${calculatedFps} FPS`;
                            }
                        } else {
                            nodes.fps.textContent = 'Measuring...';
                        }
                    } else {
                        nodes.fps.textContent = 'Measuring...';
                    }

                    telemetryMemory.lastTotalFrames = currentFrames;
                    telemetryMemory.lastTimestamp = now;
                } else {
                    nodes.fps.textContent = 'Measuring...';
                }
                nodes.dropped.textContent = quality.droppedVideoFrames ?? '0';
            } else {
                nodes.fps.textContent = 'Not Exposed';
                nodes.dropped.textContent = 'Not Exposed';
            }

            // High-Precision Timeline Offset / Live Playhead Evaluation Engine
            if (typeof jw.getDuration === 'function' && typeof jw.getPosition === 'function') {
                const duration = jw.getDuration();
                const position = jw.getPosition();

                if (duration === Infinity || duration < 0) {
                    nodes.latency.textContent = '0s (Live Edge)';
                } else if (duration > 0 && position > 0) {
                    const offsetDistance = Math.max(0, Math.round(duration - position));
                    nodes.latency.textContent = offsetDistance > 0 ? `${offsetDistance}s Behind Live` : '0s (Live Edge)';
                } else {
                    nodes.latency.textContent = 'Measuring...';
                }
            } else {
                nodes.latency.textContent = 'Not Exposed';
            }
        }
        // 2. Direct Vanilla HTML5 Video Interrogation Tag Route
        else if (video && video.style.display !== 'none') {
            nodes.framework.textContent = 'HTML5 Native Tag';
            nodes.bitrate.textContent = video.videoHeight ? `${video.videoHeight}p (Direct)` : 'Unknown';
            nodes.latency.textContent = 'Not Exposed';

            if (video.getVideoPlaybackQuality) {
                const quality = video.getVideoPlaybackQuality();
                nodes.dropped.textContent = quality.droppedVideoFrames ?? '0';
                nodes.fps.textContent = video.paused ? '0 FPS (Paused)' : 'Exposed (Variable)';
            } else {
                nodes.dropped.textContent = 'Not Exposed';
                nodes.fps.textContent = 'Not Exposed';
            }
        }
        // 3. Cross-Origin Sandbox Iframe Proxy Secure Degrade Route
        else if (document.querySelector(SELECTORS.EMBED_FRAME)?.style.display !== 'none') {
            nodes.framework.textContent = 'IFrame Proxy';
            nodes.fps.textContent = 'Not Exposed (Secured)';
            nodes.bitrate.textContent = 'Not Exposed (Secured)';
            nodes.dropped.textContent = 'Not Exposed';
            nodes.latency.textContent = 'Not Exposed';
        }
        // 4. Engine Initialization Setup Matrix State
        else {
            nodes.framework.textContent = 'Interrogating...';
            nodes.fps.textContent = 'Searching...';
            nodes.bitrate.textContent = 'Searching...';
            nodes.dropped.textContent = '0';
            nodes.latency.textContent = 'Searching...';
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
            const direction = e.deltaY < 0 ? 4 : -4;
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
                <i class="fas ${combined[key].icon}"></i> ${combined[key].name}
                ${isUserPreset ? `<i class="fas fa-trash-alt ts-delete-profile-btn" data-delete="${key}"></i>` : ''}
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

        // Append Inline Save Form UI Directly Inside Options Matrix
        const formRow = document.createElement('div');
        formRow.className = 'ts-preset-save-row';
        formRow.innerHTML = `
            <input type="text" class="ts-preset-input" id="ts-preset-name-input" placeholder="Save as Preset..." maxlength="18">
            <button class="ts-glass-btn" id="ts-btn-save-preset" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 6px;"><i class="fas fa-plus"></i></button>
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
            labelEl.innerHTML = `<i class="fas ${data.icon}"></i> ${data.name}`;
        }
        document.querySelectorAll('.ts-dd-item').forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-value') === profileKey);
        });
    }

    function injectPrecisionSuite() {
        if (document.getElementById('ts-enhancer-glass')) return;

        const targetBar = document.querySelector(SELECTORS.TOOLBAR_ANCHOR);
        if (!targetBar) return;

        if (!document.getElementById('ts-dimmer-screen')) {
            const dimOverlay = document.createElement('div');
            dimOverlay.id = 'ts-dimmer-screen';
            document.body.appendChild(dimOverlay);
        }

        const panel = document.createElement('div');
        panel.id = 'ts-enhancer-glass';
        panel.innerHTML = `
            <div class="ts-section-row">
                <button class="ts-glass-btn" id="ts-btn-dimmer"><i class="fas fa-moon"></i> Lights Out</button>
                <button class="ts-glass-btn" id="ts-btn-compare"><i class="fas fa-eye"></i> Hold to Compare</button>

                <div style="margin-left: auto; display: flex; gap: 12px; align-items: center;">
                    <div class="ts-dd-container" id="ts-profile-dropdown">
                        <div class="ts-dd-trigger">
                            <span id="ts-dd-current-label"><i class="fas fa-leaf"></i> Natural Profile</span>
                            <i class="fas fa-chevron-down chevron"></i>
                        </div>
                        <div class="ts-dd-menu" id="ts-dropdown-menu-list">
                           </div>
                    </div>
                    <button class="ts-glass-btn" id="ts-reset-all"><i class="fas fa-undo"></i> Reset</button>
                </div>
            </div>

            <div class="ts-section-row" style="margin-top: 4px;">
                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>BRIGHTNESS</span><span id="ts-val-bright">100%</span></div>
                    <div class="ts-custom-track" id="ts-track-bright">
                        <div class="ts-custom-fill" id="ts-fill-bright"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-bright"></div>
                    </div>
                </div>

                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>CONTRAST</span><span id="ts-val-contrast">100%</span></div>
                    <div class="ts-custom-track" id="ts-track-contrast">
                        <div class="ts-custom-fill" id="ts-fill-contrast"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-contrast"></div>
                    </div>
                </div>

                <div class="ts-slider-wrapper">
                    <div class="ts-slider-label-zone"><span>SATURATION</span><span id="ts-val-saturate">100%</span></div>
                    <div class="ts-custom-track" id="ts-track-saturate">
                        <div class="ts-custom-fill" id="ts-fill-saturate"></div>
                        <div class="ts-custom-thumb" id="ts-thumb-saturate"></div>
                    </div>
                </div>
            </div>

            <div class="ts-extractor-box">
                <div style="font-size: 0.78rem; font-weight:800; color: #cbd5e1; display:flex; align-items:center; gap:6px; min-width:95px;">
                    <i class="fas fa-link" style="color:#34d399;"></i> STREAM LINK:
                </div>
                <div class="ts-url-display" id="ts-stream-link-str">Interrogating native streams...</div>
                <button class="ts-glass-btn" id="ts-btn-copy-link" style="padding: 5px 12px; font-size:0.72rem; border-radius:8px; background:rgba(52,211,153,0.06);">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>

            <div class="ts-stats-grid">
                <div class="ts-grid-item"><i class="fas fa-tv"></i> Framework: <strong id="ts-telemetry-framework">Auto</strong></div>
                <div class="ts-grid-item"><i class="fas fa-compress"></i> Dimensions: <strong id="ts-telemetry-dimensions">--</strong></div>
                <div class="ts-grid-item"><i class="fas fa-bolt"></i> Rendered FPS: <strong id="ts-telemetry-fps">Measuring...</strong></div>
                <div class="ts-grid-item"><i class="fas fa-signal"></i> Quality Profile: <strong id="ts-telemetry-bitrate">--</strong></div>
                <div class="ts-grid-item"><i class="fas fa-exclamation-triangle"></i> Dropped Frames: <strong id="ts-telemetry-dropped">0</strong></div>
                <div class="ts-grid-item"><i class="fas fa-clock"></i> Live Offset: <strong id="ts-telemetry-latency">--</strong></div>
            </div>
        `;

        targetBar.parentNode.insertBefore(panel, targetBar.nextSibling);

        sliders.bright = initCustomSlider('bright', 'brightness', CONFIG.SLIDER_MIN, CONFIG.SLIDER_MAX, 100);
        sliders.contrast = initCustomSlider('contrast', 'contrast', CONFIG.SLIDER_MIN, CONFIG.SLIDER_MAX, 100);
        sliders.saturate = initCustomSlider('saturate', 'saturation', CONFIG.SATURATE_MIN, CONFIG.SLIDER_MAX, 100);

        populateDropdownMenu();
        setDropdownActiveSelection(activeProfileKey);

        const ddContainer = document.getElementById('ts-profile-dropdown');
        const ddTrigger = ddContainer.querySelector('.ts-dd-trigger');

        ddTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ddContainer.classList.toggle('open');
        });

        window.addEventListener('click', () => ddContainer.classList.remove('open'));

        // Split-Second Before/After Engine Comparison Event Mapping
        const compareBtn = document.getElementById('ts-btn-compare');
        const triggerCompareOn = () => {
            isComparing = true;
            compareBtn.classList.add('ts-compare-active');
            applyVisualModifiers();
        };
        const triggerCompareOff = () => {
            isComparing = false;
            compareBtn.classList.remove('ts-compare-active');
            applyVisualModifiers();
        };

        compareBtn.addEventListener('mousedown', triggerCompareOn);
        compareBtn.addEventListener('mouseup', triggerCompareOff);
        compareBtn.addEventListener('mouseleave', triggerCompareOff);
        compareBtn.addEventListener('touchstart', triggerCompareOn, { passive: true });
        compareBtn.addEventListener('touchend', triggerCompareOff, { passive: true });

        // Initialize Theater Engine State
        const dimBtn = document.getElementById('ts-btn-dimmer');
        const screen = document.getElementById('ts-dimmer-screen');
        if (screen && dimmerActive) {
            screen.style.opacity = '1';
            dimBtn.classList.add('active');
        }

        dimBtn.addEventListener('click', () => {
            dimmerActive = !dimmerActive;
            if (screen) screen.style.opacity = dimmerActive ? '1' : '0';
            dimBtn.classList.toggle('active', dimmerActive);
            GM_setValue(STORAGE_KEYS.THEATER_STATE, dimmerActive);
        });

        document.getElementById('ts-reset-all').addEventListener('click', () => {
            sliders.bright.reset(); sliders.contrast.reset(); sliders.saturate.reset();
            activeProfileKey = 'natural';
            setDropdownActiveSelection('natural');
            saveCurrentState();
            populateDropdownMenu();
        });

        document.getElementById('ts-btn-copy-link').addEventListener('click', () => {
            if (!discoveredStreamUrl || discoveredStreamUrl.startsWith("No")) {
                alert("Stream source is currently unreachable.");
                return;
            }
            GM_setClipboard(discoveredStreamUrl);
            const copyBtn = document.getElementById('ts-btn-copy-link');
            copyBtn.innerHTML = `<i class="fas fa-check" style="color:#34d399;"></i> Copied!`;
            setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`; }, CONFIG.COPY_RESET_TIMEOUT);
        });

        // Event-driven Immediate Structural Response Hooks
        const selectorEl = document.querySelector(SELECTORS.NATIVE_SELECTOR);
        if (selectorEl) {
            selectorEl.addEventListener('change', () => setTimeout(applyVisualModifiers, 300));
        }
        document.querySelectorAll(SELECTORS.NATIVE_SOURCE_BTNS).forEach(btn => {
            btn.addEventListener('click', () => setTimeout(applyVisualModifiers, 300));
        });

        // Execution Timers Framework
        setInterval(queryPlaybackTelemetry, CONFIG.TICKER_INTERVAL);
        setInterval(pullSourceAddress, CONFIG.TICKER_INTERVAL);
        setInterval(applyVisualModifiers, CONFIG.TICKER_INTERVAL);

        if (window._jwInstance && typeof window._jwInstance.on === 'function') {
            window._jwInstance.on('levelsChanged', queryPlaybackTelemetry);
            window._jwInstance.on('visualQuality', queryPlaybackTelemetry);
        }
    }

    const verifyDomPipeline = setInterval(() => {
        if (document.querySelector(SELECTORS.TOOLBAR_ANCHOR)) {
            injectPrecisionSuite();
            clearInterval(verifyDomPipeline);
        }
    }, CONFIG.DOM_CHECK_INTERVAL);

})();