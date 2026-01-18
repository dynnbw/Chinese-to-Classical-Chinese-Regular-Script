// ========== 核心數據與狀態 ==========

// 存储键名常量
const STORAGE_KEYS = {
    CUSTOM_MAPPINGS: 'seal-converter-custom-mappings',
    REVERSE_MAPPINGS: 'seal-converter-reverse-mappings',
    APP_SETTINGS: 'seal-converter-settings',
    CONVERSION_DIRECTION: 'seal-converter-direction'
};

// 應用狀態
const AppState = {
    conversionStats: {
        success: 0,
        total: 0
    },
    settings: {
        autoConvert: true,
        showCharCodes: false,
        autoCopy: true
    },
    lastUpdate: new Date().toLocaleString(),
    // 新增：转换方向
    conversionDirection: 'toSeal', // 'toSeal': 繁体→篆书, 'toTraditional': 篆书→繁体
    // 新增：存储最后一次转换的纯文本结果
    lastConversionResult: {
        text: '',
        pureText: '',
        direction: ''
    }
};

// 反向映射表（自动生成）
let ReverseSealMapping = {};

// ========== 新增：构建反向映射表 ==========

function buildReverseMapping() {
    ReverseSealMapping = {};

    // 遍历正向映射表，生成反向映射
    for (const [key, value] of Object.entries(SealMapping)) {
        // 确保值不为空且不是重复映射
        if (value && !ReverseSealMapping[value]) {
            ReverseSealMapping[value] = key;
        }
    }

    // 保存反向映射到 localStorage
    try {
        localStorage.setItem(STORAGE_KEYS.REVERSE_MAPPINGS, JSON.stringify(ReverseSealMapping));
        console.log(`反向映射表构建完成: ${Object.keys(ReverseSealMapping).length} 条映射`);
    } catch (e) {
        console.error('保存反向映射表失败:', e);
    }

    return ReverseSealMapping;
}

// ========== 新增：加载反向映射表 ==========

function loadReverseMappings() {
    try {
        // 尝试从 localStorage 加载已保存的反向映射
        const savedReverseMappings = localStorage.getItem(STORAGE_KEYS.REVERSE_MAPPINGS);
        if (savedReverseMappings) {
            ReverseSealMapping = JSON.parse(savedReverseMappings);
            console.log(`从 localStorage 加载了 ${Object.keys(ReverseSealMapping).length} 条反向映射`);
            return true;
        }
    } catch (error) {
        console.error('加载反向映射失败:', error);
    }

    // 如果本地没有保存，则重新构建
    buildReverseMapping();
    return false;
}

// ========== 修改：核心转换函数，支持双向转换 ==========

/**
 * 执行文字转换（支持双向）
 */
function convertText(text, direction = AppState.conversionDirection) {
    if (!text || text.trim() === '') {
        return {
            result: '',
            pureText: '',
            stats: { converted: 0, total: 0 }
        };
    }

    const safeText = safeString(text);
    let result = '';
    let pureText = '';
    let converted = 0;
    let total = 0;

    // 根据转换方向选择映射表
    const mapping = direction === 'toSeal' ? SealMapping : ReverseSealMapping;
    const mappingName = direction === 'toSeal' ? '正向映射' : '反向映射';

    for (let i = 0; i < safeText.length; i++) {
        let char = safeText[i];
        total++;

        const code = char.charCodeAt(0);
        if (code >= 0xD800 && code <= 0xDBFF && i + 1 < safeText.length) {
            const nextCode = safeText.charCodeAt(i + 1);
            if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                char = safeText.substring(i, i + 2);
                i++;
            }
        }

        if (mapping[char]) {
            result += mapping[char];
            pureText += mapping[char];
            converted++;
        } else {
            result += char;
            pureText += char;
        }
    }

    // 更新统计
    AppState.conversionStats.success += converted;
    AppState.conversionStats.total++;

    console.log(`${mappingName}转换完成: ${converted}/${total} 个字符被转换`);

    return {
        result: result,
        pureText: pureText,
        stats: { converted, total }
    };
}

// ========== 新增：切换转换方向 ==========

function toggleConversionDirection() {
    // 切换方向
    AppState.conversionDirection = AppState.conversionDirection === 'toSeal' ? 'toTraditional' : 'toSeal';

    // 保存方向设置
    try {
        localStorage.setItem(STORAGE_KEYS.CONVERSION_DIRECTION, AppState.conversionDirection);
    } catch (e) {
        console.error('保存转换方向失败:', e);
    }

    // 更新UI
    updateDirectionDisplay();

    // 如果有输入文本，自动重新转换
    const inputText = document.getElementById('inputText').value;
    if (inputText && inputText.trim()) {
        performConversion();
    }

    return AppState.conversionDirection;
}

// ========== 新增：更新方向显示 ==========

function updateDirectionDisplay() {
    const directionBtn = document.getElementById('toggleDirectionBtn');
    const inputPlaceholder = document.getElementById('inputText');
    const inputAreaTitle = document.querySelector('.input-area h2');
    const outputAreaTitle = document.querySelector('.output-area h2');

    if (!directionBtn) return;

    if (AppState.conversionDirection === 'toSeal') {
        // 繁体 → 篆书
        directionBtn.textContent = '繁→篆楷';
        directionBtn.title = '当前：繁体转篆书，点击切换为篆书转繁体';
        directionBtn.style.backgroundColor = '#e6dfc6';

        if (inputPlaceholder) {
            inputPlaceholder.placeholder = '請在此處輸入繁體字...';
        }
        if (inputAreaTitle) {
            inputAreaTitle.textContent = '繁體字輸入';
        }
        if (outputAreaTitle) {
            outputAreaTitle.textContent = '篆書楷化字結果';
        }

        updateStatus('當前轉換方向：繁體字 → 篆書楷化字', 'good');
    } else {
        // 篆书 → 繁体
        directionBtn.textContent = '篆楷→繁';
        directionBtn.title = '当前：篆书转繁体，点击切换为繁体转篆书';
        directionBtn.style.backgroundColor = '#b8a276';

        if (inputPlaceholder) {
            inputPlaceholder.placeholder = '請在此處輸入篆書楷化字...';
        }
        if (inputAreaTitle) {
            inputAreaTitle.textContent = '篆書楷化字輸入';
        }
        if (outputAreaTitle) {
            outputAreaTitle.textContent = '繁體字結果';
        }

        updateStatus('當前轉換方向：篆書楷化字 → 繁體字', 'good');
    }
}

// ========== 防抖函数 ==========

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== 字符處理工具 ==========

/**
 * 安全地處理字符串，防止字符被錯誤分割
 */
function safeString(str) {
    if (!str) return '';

    const chars = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);

        if (code >= 0xD800 && code <= 0xDBFF) {
            if (i + 1 < str.length) {
                const nextCode = str.charCodeAt(i + 1);
                if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                    chars.push(str.substring(i, i + 2));
                    i++;
                    continue;
                }
            }
        }

        chars.push(str.charAt(i));
    }

    return chars.join('');
}

/**
 * 獲取字符的Unicode碼點
 */
function getCharCodePoint(char) {
    if (!char) return '';

    try {
        const codePoint = char.codePointAt(0);
        return 'U+' + codePoint.toString(16).toUpperCase().padStart(4, '0');
    } catch (e) {
        return 'U+????';
    }
}

// ========== 顯示與渲染函數 ==========

/**
 * 更新狀態顯示
 */
function updateStatus(message, type = 'good') {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');

    if (!indicator || !text) return;

    indicator.className = 'status-indicator';
    if (type === 'good') {
        indicator.classList.add('status-good');
    } else if (type === 'warning') {
        indicator.classList.add('status-warning');
    } else if (type === 'error') {
        indicator.classList.add('status-error');
    }

    text.textContent = message;
}

/**
 * 更新統計顯示
 */
function updateStatsDisplay() {
    const mappingCountEl = document.getElementById('mappingCount');
    const mappingCountPanelEl = document.getElementById('mappingCountPanel');
    const successCountEl = document.getElementById('successCount');
    const totalConversionsEl = document.getElementById('totalConversions');
    const conversionCountEl = document.getElementById('conversionCount');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const cacheSizeEl = document.getElementById('cacheSize');
    const cacheSizeTextEl = document.getElementById('cacheSizeText');

    if (mappingCountEl) mappingCountEl.textContent = Object.keys(SealMapping).length;
    if (mappingCountPanelEl) mappingCountPanelEl.textContent = Object.keys(SealMapping).length;
    if (successCountEl) successCountEl.textContent = AppState.conversionStats.success;
    if (totalConversionsEl) totalConversionsEl.textContent = AppState.conversionStats.total;
    if (conversionCountEl) conversionCountEl.textContent = AppState.conversionStats.total;
    if (lastUpdateEl) lastUpdateEl.textContent = AppState.lastUpdate;
    
    // 更新缓存大小显示
    const fontCacheSize = FontManager ? FontManager.getCacheSize() : 0;
    const imgCacheSize = CompatibilityMode ? CompatibilityMode.getCacheSize() : 0;
    const totalCacheSize = fontCacheSize + imgCacheSize;
    if (cacheSizeEl) cacheSizeEl.textContent = totalCacheSize;
    if (cacheSizeTextEl) cacheSizeTextEl.textContent = totalCacheSize;
}

/**
 * 格式化轉換結果顯示
 */
function formatConversionResult(original, converted, stats) {
    if (!original || !converted) {
        return {
            html: '轉換結果將在此處以豎排古籍樣式呈現。',
            pureText: ''
        };
    }

    const direction = AppState.conversionDirection;
    const fromLabel = direction === 'toSeal' ? '繁體字' : '篆書楷化字';
    const toLabel = direction === 'toSeal' ? '篆書楷化字' : '繁體字';

    // 只有当兼容模式启用时才使用图片模式
    const useCompatibilityMode = CompatibilityMode && CompatibilityMode.enabled;

    console.log('使用兼容模式显示:', useCompatibilityMode);
    console.log('兼容模式状态:', CompatibilityMode ? CompatibilityMode.enabled : 'CompatibilityMode not loaded');
    console.log('当前字体:', FontManager ? FontManager.currentFont : 'FontManager not loaded');

    if (useCompatibilityMode) {
        let html = `<div class="compatibility-result">`;
        html += CompatibilityMode.formatTextAsImages(converted, { 
            size: CompatibilityMode.settings.imgSize 
        });
        
        // 在兼容模式下，添加隐藏的纯文本版本
        html += `<div style="display: none;" id="compatibility-pure-text">${converted}</div>`;
        html += `</div>`;
        
        return {
            html: html,
            pureText: converted
        };
    }

    let html = '';

    if (AppState.settings.showCharCodes) {
        // 顯示碼點模式
        html += `<strong>${fromLabel} → ${toLabel} 轉換完成:</strong> ${stats.converted}/${stats.total} 個字符被轉換<br>`;
        html += `<strong>轉換結果 (含碼點):</strong><br>`;

        const safeConverted = safeString(converted);
        const chars = [];

        for (let i = 0; i < safeConverted.length; i++) {
            const code = safeConverted.charCodeAt(i);

            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < safeConverted.length) {
                const nextCode = safeConverted.charCodeAt(i + 1);
                if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                    chars.push(safeConverted.substring(i, i + 2));
                    i++;
                    continue;
                }
            }

            chars.push(safeConverted.charAt(i));
        }

        chars.forEach(char => {
            const codePoint = getCharCodePoint(char);
            html += `<div class="comparison">
                <span class="converted-char ${direction === 'toSeal' ? 'seal-char' : ''}">${char}</span>
                <span style="font-size: 0.7em; color: #666;">${codePoint}</span>
            </div>`;
        });
        
        return {
            html: html,
            pureText: converted
        };
    } else {
        // 普通模式
        const safeConverted = safeString(converted);
        const chars = [];

        for (let i = 0; i < safeConverted.length; i++) {
            const code = safeConverted.charCodeAt(i);

            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < safeConverted.length) {
                const nextCode = safeConverted.charCodeAt(i + 1);
                if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                    chars.push(safeConverted.substring(i, i + 2));
                    i++;
                    continue;
                }
            }

            chars.push(safeConverted.charAt(i));
        }

        // 为每个字符创建span，添加pure-char类以便提取
        chars.forEach(char => {
            html += `<span class="pure-char ${direction === 'toSeal' ? 'seal-char' : ''}">${char}</span>`;
        });
        
        return {
            html: html,
            pureText: converted
        };
    }
}

// ========== 數據管理功能 ==========

async function importMappingData(url) {
    if (!url) {
        updateStatus('請輸入有效的URL', 'warning');
        return false;
    }

    try {
        updateStatus('正在加載映射數據...', 'warning');

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP錯誤: ${response.status}`);

        const data = await response.json();
        if (typeof data !== 'object' || data === null) {
            throw new Error('無效的數據格式');
        }

        const originalCount = Object.keys(SealMapping).length;

        // 合并数据
        Object.assign(SealMapping, data);

        // 保存自定义映射到 localStorage
        try {
            const existingCustomMappings = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_MAPPINGS) || '{}');
            const mergedMappings = { ...existingCustomMappings, ...data };
            localStorage.setItem(STORAGE_KEYS.CUSTOM_MAPPINGS, JSON.stringify(mergedMappings));
            console.log('已保存自定义映射到 localStorage');
        } catch (e) {
            console.error('保存映射数据失败:', e);
        }

        // 重新构建反向映射表
        buildReverseMapping();

        AppState.lastUpdate = new Date().toLocaleString();

        const newCount = Object.keys(SealMapping).length;
        const addedCount = newCount - originalCount;

        updateStatsDisplay();
        updateStatus(`成功導入 ${addedCount} 條新映射，已更新雙向映射表`, 'good');

        return true;
    } catch (error) {
        updateStatus(`導入失敗: ${error.message}`, 'error');
        return false;
    }
}

function exportData(data, filename, type = 'text/plain') {
    const blob = new Blob([data], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function viewCurrentMapping() {
    const direction = AppState.conversionDirection;
    const mappingToShow = direction === 'toSeal' ? SealMapping : ReverseSealMapping;
    const mappingName = direction === 'toSeal' ? '正向映射表（繁體→篆書）' : '反向映射表（篆書→繁體）';

    const mappingList = Object.entries(mappingToShow)
        .slice(0, 50)
        .map(([key, value]) => `${key} → ${value}`)
        .join('\n');

    const output = document.getElementById('outputText');
    output.innerHTML = `
        <h3>${mappingName} (${Object.keys(mappingToShow).length} 條)</h3>
        <p>顯示前50條:</p>
        <div style="font-family: monospace; font-size: 0.9em;">
            ${mappingList.replace(/\n/g, '<br>')}
        </div>
        ${Object.keys(mappingToShow).length > 50 ? `<p>... 還有 ${Object.keys(mappingToShow).length - 50} 條映射</p>` : ''}
        <p><small>當前轉換方向: ${direction === 'toSeal' ? '繁體→篆書' : '篆書→繁體'}</small></p>
    `;
}

// ========== 事件處理函數 ==========

/**
 * 强制重新转换当前文本
 */
function forceReconvert() {
    const inputTextEl = document.getElementById('inputText');
    if (!inputTextEl) return;
    
    const inputText = inputTextEl.value;
    if (!inputText.trim()) return;
    
    // 清除输出区域
    const output = document.getElementById('outputText');
    if (output) {
        output.innerHTML = '正在重新轉換...';
    }
    
    // 延迟执行以确保DOM更新
    setTimeout(() => {
        performConversion();
    }, 50);
}

function performConversion() {
    const inputTextEl = document.getElementById('inputText');
    if (!inputTextEl) return;

    const inputText = inputTextEl.value;

    if (!inputText.trim()) {
        updateStatus('請輸入要轉換的文字', 'warning');
        return;
    }

    const { result, pureText, stats } = convertText(inputText);
    const output = document.getElementById('outputText');
    if (output) {
        const formattedResult = formatConversionResult(inputText, result, stats);
        output.innerHTML = formattedResult.html;
        
        // 存储最后一次转换的结果
        AppState.lastConversionResult = {
            text: result,
            pureText: pureText,
            direction: AppState.conversionDirection
        };
    }

    const directionLabel = AppState.conversionDirection === 'toSeal' ? '繁體→篆書' : '篆書→繁體';
    updateStatus(`${directionLabel} 轉換完成: ${stats.converted}/${stats.total} 個字符被轉換`, 'good');
    updateStatsDisplay();

    if (AppState.settings.autoCopy && pureText) {
        copyToClipboard(pureText);
    }
}

/**
 * 從輸出區域提取純文本
 */
function extractPureTextFromOutput() {
    const outputTextEl = document.getElementById('outputText');
    if (!outputTextEl) return '';
    
    // 如果存在隐藏的纯文本元素，直接使用
    const hiddenPureText = outputTextEl.querySelector('#compatibility-pure-text');
    if (hiddenPureText) {
        return hiddenPureText.textContent;
    }
    
    // 否则尝试提取其他纯文本
    const pureChars = outputTextEl.querySelectorAll('.pure-char, .seal-char, .converted-char');
    if (pureChars.length > 0) {
        let pureText = '';
        pureChars.forEach(char => {
            const text = char.textContent.trim();
            if (text && !text.includes('轉換') && !text.includes('字符')) {
                pureText += text;
            }
        });
        return pureText;
    }
    
    // 最后返回存储的结果
    return AppState.lastConversionResult.pureText || '';
}

/**
 * 測試字體顯示效果
 * 用途：顯示當前字體的顯示效果，特別是篆書楷化字的顯示情況
 */
function testFontDisplay() {
    // 确保禁用兼容模式
    if (CompatibilityMode && CompatibilityMode.enabled) {
        CompatibilityMode.disable(updateStatus);
        if (window.cleanupCompatibilityMode) {
            cleanupCompatibilityMode(updateStatus);
        }
    }
    
    const output = document.getElementById('outputText');
    if (!output) return;

    const directionLabel = AppState.conversionDirection === 'toSeal' ? '繁體→篆書' : '篆書→繁體';

    output.innerHTML = `
        <h3>字體顯示測試 (${directionLabel})</h3>
        <p>當前字體: ${FontManager && FontManager.currentFont ? FontManager.currentFont.name : '系統默認'}</p>
        <div class="font-test-area">
            <p>常用漢字測試:</p>
            <div class="font-test-text" style="font-size: 1.3em;">天地日月山水木金火土</div>
            <p>篆書楷化字測試:</p>
            <div class="font-test-text" style="font-size: 1.3em;">𠀘𡍑𡆠𡴑𡴸𣱱𤆄𣎳𨤾𡈽</div>
            <p>雙向轉換測試:</p>
            <div class="font-test-text" style="font-size: 1em;">繁體→篆書: 天→𠀘, 地→𡍑, 日→𡆠</div>
            <div class="font-test-text" style="font-size: 1em;">篆書→繁體: 𠀘→天, 𡍑→地, 𡆠→日</div>
        </div>
        <p>如果某些字符顯示為方框或問號，請更換字體。</p>
    `;

    const testTexts = output.querySelectorAll('.font-test-text');
    testTexts.forEach(text => {
        if (FontManager && FontManager.currentFont && FontManager.currentFont.family) {
            text.style.fontFamily = `${FontManager.currentFont.family}, "Microsoft YaHei", "SimSun", serif`;
        }
    });

    updateStatus('字體測試已顯示', 'good');
}

function showDebugInfo() {
    const inputTextEl = document.getElementById('inputText');
    const output = document.getElementById('outputText');
    if (!inputTextEl || !output) return;

    const inputText = inputTextEl.value || '無輸入';
    const directionLabel = AppState.conversionDirection === 'toSeal' ? '繁體→篆書' : '篆書→繁體';

    let debugInfo = `<h3>系統調試信息 (${directionLabel})</h3>`;
    debugInfo += `<p>當前時間: ${new Date().toLocaleString()}</p>`;
    debugInfo += `<p>正向映射表大小: ${Object.keys(SealMapping).length}</p>`;
    debugInfo += `<p>反向映射表大小: ${Object.keys(ReverseSealMapping).length}</p>`;
    debugInfo += `<p>轉換統計: 成功 ${AppState.conversionStats.success}, 總次數 ${AppState.conversionStats.total}</p>`;
    debugInfo += `<p>字體緩存大小: ${FontManager ? FontManager.getCacheSize() : 0}</p>`;
    debugInfo += `<p>圖片緩存大小: ${CompatibilityMode ? CompatibilityMode.getCacheSize() : 0}</p>`;
    debugInfo += `<p>當前輸入: "${inputText}" (長度: ${inputText.length})</p>`;
    debugInfo += `<p>兼容模式: ${CompatibilityMode && CompatibilityMode.enabled ? '已啟用' : '已禁用'}</p>`;

    const testChars = AppState.conversionDirection === 'toSeal'
        ? ['天', '地', '日', '月', '漢', '書', '樂']
        : ['𠀘', '𡍑', '𡆠', '𡴑', '𤁉', '𦘠', '𢡠'];

    debugInfo += `<p>關鍵字測試 (${directionLabel}):</p>`;

    testChars.forEach(char => {
        const converted = AppState.conversionDirection === 'toSeal'
            ? (SealMapping[char] || '無映射')
            : (ReverseSealMapping[char] || '無映射');

        debugInfo += `<div class="comparison">
            <span class="original-char">${char}</span>
            <span class="arrow">→</span>
            <span class="converted-char">${converted}</span>
            <small>${converted === char ? '(未變)' : '(已轉換)'}</small>
        </div>`;
    });

    output.innerHTML = debugInfo;
    updateStatus('調試信息已顯示', 'good');
}

function copyToClipboard(text) {
    if (!text || text.trim() === '') {
        updateStatus('沒有可複製的內容', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(text)
        .then(() => updateStatus('已複製到剪貼板', 'good'))
        .catch(err => {
            console.error('複製失敗:', err);
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            updateStatus('已複製到剪貼板（降級方案）', 'good');
        });
}

// ========== 清理所有缓存功能 ==========

function clearAllCache() {
    if (window.clearAllFontCache) {
        clearAllFontCache(updateStatus, forceReconvert, updateStatsDisplay);
    } else {
        updateStatus('字体管理器未加载', 'error');
    }
}

// ========== 新增：加载自定义映射 ==========

function loadCustomMappings() {
    try {
        const customMappings = localStorage.getItem(STORAGE_KEYS.CUSTOM_MAPPINGS);
        if (customMappings) {
            const parsedMappings = JSON.parse(customMappings);
            if (typeof parsedMappings === 'object' && parsedMappings !== null) {
                Object.assign(SealMapping, parsedMappings);
                console.log(`从 localStorage 加载了 ${Object.keys(parsedMappings).length} 条自定义映射`);
                return true;
            }
        }
    } catch (error) {
        console.error('加载自定义映射失败:', error);
    }
    return false;
}

// ========== 新增：保存应用设置 ==========

function saveAppSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(AppState.settings));
        console.log('应用设置已保存');
    } catch (e) {
        console.error('保存应用设置失败:', e);
    }
}

// ========== 新增：加载应用设置 ==========

function loadAppSettings() {
    try {
        const savedSettings = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            AppState.settings = { ...AppState.settings, ...settings };
            console.log('应用设置已加载');
        }
    } catch (e) {
        console.error('加载应用设置失败:', e);
    }
}

// ========== 新增：加载转换方向 ==========

function loadConversionDirection() {
    try {
        const savedDirection = localStorage.getItem(STORAGE_KEYS.CONVERSION_DIRECTION);
        if (savedDirection && (savedDirection === 'toSeal' || savedDirection === 'toTraditional')) {
            AppState.conversionDirection = savedDirection;
            console.log(`转换方向已加载: ${savedDirection}`);
            return true;
        }
    } catch (e) {
        console.error('加载转换方向失败:', e);
    }
    return false;
}

// ========== 新增：图片生成器功能 ==========

/**
 * 提取纯文字从输出区域
 */
function extractPureTextForImageGenerator() {
    // 优先使用存储的纯文本结果
    if (AppState.lastConversionResult.pureText) {
        return AppState.lastConversionResult.pureText;
    }
    
    // 否则从输出区域提取
    return extractPureTextFromOutput();
}

/**
 * 打开图片生成器并传递纯文字
 */
function openImageGenerator() {
    const inputTextEl = document.getElementById('inputText');
    if (!inputTextEl || !inputTextEl.value.trim()) {
        updateStatus('請先輸入要轉換的文字', 'warning');
        return;
    }

    // 优先使用存储的纯文本结果
    let resultText = extractPureTextForImageGenerator();

    // 如果提取失败或太短，执行转换
    if (!resultText || resultText.length < 2) {
        const { pureText } = convertText(inputTextEl.value);
        resultText = pureText || inputTextEl.value;
    }

    // 最终清理
    resultText = resultText.replace(/\s+/g, '');

    // 如果还是空，使用输入文本
    if (!resultText.trim()) {
        resultText = inputTextEl.value.trim();
    }

    console.log('传递给图片生成器的文字:', resultText);
    console.log('文字长度:', resultText.length);

    // 编码并打开图片生成器
    const encodedText = encodeURIComponent(resultText);
    const imagePageUrl = `seal-image-generator.html?text=${encodedText}`;

    window.open(imagePageUrl, '_blank', 'width=1200,height=800');
    updateStatus('圖片生成器已打開', 'good');

    return resultText;
}

// ========== 初始化與事件綁定 ==========

function initializeEventListeners() {
    // 转换方向切换按钮
    const toggleDirectionBtn = document.getElementById('toggleDirectionBtn');
    if (toggleDirectionBtn) {
        toggleDirectionBtn.addEventListener('click', toggleConversionDirection);
    }
    
    // 清理缓存按钮
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearAllCache);
    }

    // 转换相关按钮
    const convertBtn = document.getElementById('convertBtn');
    const sampleBtn = document.getElementById('sampleBtn');
    const clearBtn = document.getElementById('clearBtn');

    if (convertBtn) convertBtn.addEventListener('click', performConversion);
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
        const inputText = document.getElementById('inputText');
        if (inputText) {
            // 根据当前方向加载不同的示例
            if (AppState.conversionDirection === 'toSeal') {
                inputText.value = '天地日月山水木金火土人心中一二三四';
            } else {
                inputText.value = '𠀘𡍑𡆠𡴑𡴸𣱱𤆄𣎳𨤾𡈽';
            }
            updateStatus('示例文字已加载', 'good');
            if (AppState.settings.autoConvert) performConversion();
        }
    });
    if (clearBtn) clearBtn.addEventListener('click', () => {
        const inputText = document.getElementById('inputText');
        const outputText = document.getElementById('outputText');

        if (inputText) inputText.value = '';
        if (outputText) {
            outputText.innerHTML = `
                <p>轉換結果將在此處以豎排古籍樣式呈現。</p>
                <div class="comparison">
                    <span class="original-char">${AppState.conversionDirection === 'toSeal' ? '天' : '𠀘'}</span>
                    <span class="arrow">→</span>
                    <span class="converted-char ${AppState.conversionDirection === 'toSeal' ? 'seal-char' : ''}">${AppState.conversionDirection === 'toSeal' ? '𠀘' : '天'}</span>
                </div>
                <div class="comparison">
                    <span class="original-char">${AppState.conversionDirection === 'toSeal' ? '地' : '𡍑'}</span>
                    <span class="arrow">→</span>
                    <span class="converted-char ${AppState.conversionDirection === 'toSeal' ? 'seal-char' : ''}">${AppState.conversionDirection === 'toSeal' ? '𡍑' : '地'}</span>
                </div>
                <div class="comparison">
                    <span class="original-char">${AppState.conversionDirection === 'toSeal' ? '日' : '𡆠'}</span>
                    <span class="arrow">→</span>
                    <span class="converted-char ${AppState.conversionDirection === 'toSeal' ? 'seal-char' : ''}">${AppState.conversionDirection === 'toSeal' ? '𡆠' : '日'}</span>
                </div>
                <p>請在左側輸入${AppState.conversionDirection === 'toSeal' ? '繁體字' : '篆書楷化字'}進行轉換。</p>
            `;
        }
        
        // 清除存储的转换结果
        AppState.lastConversionResult = {
            text: '',
            pureText: '',
            direction: ''
        };
        
        updateStatus('已清空輸入和輸出', 'good');
    });
    const imageGeneratorBtn = document.getElementById('imageGeneratorBtn');
    if (imageGeneratorBtn) {
        imageGeneratorBtn.addEventListener('click', openImageGenerator);
    }
    // 输出相关按钮
    const copyBtn = document.getElementById('copyBtn');
    const saveBtn = document.getElementById('saveBtn');
    const fontTestBtn = document.getElementById('fontTestBtn');
    const debugBtn = document.getElementById('debugBtn');

    if (copyBtn) copyBtn.addEventListener('click', () => {
        // 优先使用存储的纯文本结果
        const textToCopy = AppState.lastConversionResult.pureText || extractPureTextFromOutput();
        
        if (textToCopy && textToCopy.trim()) {
            copyToClipboard(textToCopy);
        } else {
            updateStatus('沒有可複製的內容', 'warning');
        }
    });
    
    if (saveBtn) saveBtn.addEventListener('click', () => {
        // 优先使用存储的纯文本结果
        const textToSave = AppState.lastConversionResult.pureText || extractPureTextFromOutput();
        
        if (textToSave && textToSave.trim()) {
            const direction = AppState.conversionDirection === 'toSeal' ? '繁轉篆' : '篆轉繁';
            exportData(textToSave, `篆楷轉換_${direction}_${new Date().toISOString().slice(0, 10)}.txt`);
            updateStatus('結果已保存為文本文件', 'good');
        } else {
            updateStatus('沒有可保存的內容', 'warning');
        }
    });
    
    if (fontTestBtn) fontTestBtn.addEventListener('click', testFontDisplay);
    if (debugBtn) debugBtn.addEventListener('click', showDebugInfo);

    // 面板控制按钮
    const togglePanelBtn = document.getElementById('togglePanelBtn');
    const fontSettingsBtn = document.getElementById('fontSettingsBtn');
    const closeFontBtn = document.getElementById('closeFontBtn');
    const fontOverlay = document.getElementById('fontOverlay');

    if (togglePanelBtn) togglePanelBtn.addEventListener('click', () => {
        const panel = document.getElementById('conversionPanel');
        const overlay = document.getElementById('iframeOverlay');
        const closeBtn = document.getElementById('closePanelBtn');

        if (panel && overlay && closeBtn) {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            overlay.style.display = isHidden ? 'block' : 'none';
            closeBtn.style.display = isHidden ? 'flex' : 'none';
            updateStatus(isHidden ? '簡繁轉換工具已打開' : '簡繁轉換工具已關閉', 'good');
        }
    });
    if (fontSettingsBtn) fontSettingsBtn.addEventListener('click', () => {
        if (window.openFontSettings) {
            openFontSettings(updateStatus);
        } else {
            updateStatus('字体设置功能未加载', 'error');
        }
    });
    if (closeFontBtn) closeFontBtn.addEventListener('click', () => {
        if (window.closeFontSettings) {
            closeFontSettings(updateStatus);
        }
    });
    if (fontOverlay) fontOverlay.addEventListener('click', () => {
        if (window.closeFontSettings) {
            closeFontSettings(updateStatus);
        }
    });

    // 数据管理按钮
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const viewMappingBtn = document.getElementById('viewMappingBtn');

    if (importBtn) importBtn.addEventListener('click', () => {
        const url = prompt('請輸入映射數據的URL（JSON格式）:', 'https://raw.githubusercontent.com/dynnbw/Chinese-to-Classical-Chinese-Regular-Script/refs/heads/main/%E8%BD%AC%E6%8D%A2.json');
        if (url) importMappingData(url);
    });
    if (exportBtn) exportBtn.addEventListener('click', () => {
        const inputText = document.getElementById('inputText');
        if (inputText && inputText.value) {
            const { pureText } = convertText(inputText.value);
            const direction = AppState.conversionDirection === 'toSeal' ? '繁轉篆' : '篆轉繁';
            exportData(`${inputText.value}\n↓\n${pureText}`, `篆楷轉換_${direction}_${new Date().toISOString().slice(0, 10)}.txt`);
            updateStatus('轉換結果已導出', 'good');
        } else {
            updateStatus('請先輸入文字進行轉換', 'warning');
        }
    });
    if (viewMappingBtn) viewMappingBtn.addEventListener('click', viewCurrentMapping);

    // 关闭iframe控制
    const closePanelBtn = document.getElementById('closePanelBtn');
    const iframeOverlay = document.getElementById('iframeOverlay');

    if (closePanelBtn) closePanelBtn.addEventListener('click', () => {
        const panel = document.getElementById('conversionPanel');
        const overlay = document.getElementById('iframeOverlay');
        const closeBtn = document.getElementById('closePanelBtn');

        if (panel && overlay && closeBtn) {
            panel.style.display = 'none';
            overlay.style.display = 'none';
            closeBtn.style.display = 'none';
            updateStatus('簡繁轉換工具已關閉', 'good');
        }
    });
    if (iframeOverlay) iframeOverlay.addEventListener('click', () => {
        const panel = document.getElementById('conversionPanel');
        const overlay = document.getElementById('iframeOverlay');
        const closeBtn = document.getElementById('closePanelBtn');

        if (panel && overlay && closeBtn) {
            panel.style.display = 'none';
            overlay.style.display = 'none';
            closeBtn.style.display = 'none';
            updateStatus('簡繁轉換工具已關閉', 'good');
        }
    });

    // 设置选项
    const autoConvert = document.getElementById('autoConvert');
    const showCharCodes = document.getElementById('showCharCodes');
    const autoCopy = document.getElementById('autoCopy');

    if (autoConvert) autoConvert.addEventListener('change', function () {
        AppState.settings.autoConvert = this.checked;
        saveAppSettings();
        updateStatus(this.checked ? '已啟用實時轉換' : '已禁用實時轉換', 'good');
        if (this.checked) {
            const inputText = document.getElementById('inputText');
            if (inputText && inputText.value.trim()) {
                performConversion();
            }
        }
    });
    if (showCharCodes) showCharCodes.addEventListener('change', function () {
        AppState.settings.showCharCodes = this.checked;
        saveAppSettings();
        updateStatus(this.checked ? '已啟用碼點顯示' : '已禁用碼點顯示', 'good');
        const inputText = document.getElementById('inputText');
        if (inputText && inputText.value) {
            performConversion();
        }
    });
    if (autoCopy) autoCopy.addEventListener('change', function () {
        AppState.settings.autoCopy = this.checked;
        saveAppSettings();
        updateStatus(this.checked ? '已啟用自動複製' : '已禁用自動複製', 'good');
    });

    // 实时转换 - 使用防抖优化
    const inputTextEl = document.getElementById('inputText');
    if (inputTextEl) {
        // 使用防抖函数，延迟300毫秒
        const debouncedPerformConversion = debounce(() => {
            if (AppState.settings.autoConvert && inputTextEl.value.trim()) {
                performConversion();
            }
        }, 300);

        inputTextEl.addEventListener('input', debouncedPerformConversion);
    }
}

function initializeApp() {
    console.log('古籍篆楷轉換工具初始化...');

    // 加载应用设置
    loadAppSettings();

    // 加载自定义映射
    loadCustomMappings();

    // 构建反向映射表
    buildReverseMapping();

    // 加载转换方向
    loadConversionDirection();

    // 初始化字体管理器 (从外部模块)
    if (window.FontManager) {
        FontManager.init();
    }
    
    // 初始化兼容模式 (从外部模块)
    if (window.CompatibilityMode) {
        CompatibilityMode.init();
    }

    // 绑定事件监听器
    initializeEventListeners();

    // 初始化字体设置界面 (从外部模块)
    if (window.initializeFontSettings) {
        initializeFontSettings(updateStatus);
    }

    // 更新转换方向显示
    updateDirectionDisplay();

    // 恢复自定义字体URL
    try {
        const savedFontUrl = localStorage.getItem('seal-converter-custom-font-url');
        if (savedFontUrl) {
            const customFontUrlInput = document.getElementById('customFontUrl');
            if (customFontUrlInput) {
                customFontUrlInput.value = savedFontUrl;
                // 自动选择自定义字体选项
                const customFontOption = document.querySelector('.font-option[data-font="custom-url"]');
                if (customFontOption) {
                    customFontOption.classList.add('selected');
                }
            }
        }
        
        // 恢复兼容模式设置
        const savedCompatibility = localStorage.getItem('seal-converter-compatibility-settings');
        if (savedCompatibility) {
            const parsed = JSON.parse(savedCompatibility);
            // 如果之前启用了兼容模式，重新启用
            if (parsed.enabled && window.CompatibilityMode) {
                CompatibilityMode.enabled = parsed.enabled;
                CompatibilityMode.currentProvider = parsed.currentProvider || 'svgfonts';
                CompatibilityMode.settings = { ...CompatibilityMode.settings, ...parsed };
                
                // 更新UI显示
                const currentFontEl = document.getElementById('currentFont');
                if (currentFontEl) {
                    currentFontEl.textContent = '圖片兼容模式';
                }
            }
        }
    } catch (e) {
        console.error('恢复设置失败:', e);
    }

    // 更新统计显示
    updateStatsDisplay();

    // 根据加载的设置更新复选框
    const autoConvertEl = document.getElementById('autoConvert');
    const showCharCodesEl = document.getElementById('showCharCodes');
    const autoCopyEl = document.getElementById('autoCopy');

    if (autoConvertEl) autoConvertEl.checked = AppState.settings.autoConvert;
    if (showCharCodesEl) showCharCodesEl.checked = AppState.settings.showCharCodes;
    if (autoCopyEl) autoCopyEl.checked = AppState.settings.autoCopy;

    // 步骤12: 更新状态提示
    const directionLabel = AppState.conversionDirection === 'toSeal' ? '繁體→篆書' : '篆書→繁體';
    const modeLabel = (window.CompatibilityMode && CompatibilityMode.enabled) ? ' (圖片兼容模式)' : '';
    updateStatus(`系統就緒，已加載雙向轉換功能${modeLabel} (${directionLabel})`, 'good');

    // 步骤13: 自动执行一次转换（如果有输入内容）
    setTimeout(() => {
        const inputText = document.getElementById('inputText');
        if (inputText && inputText.value.trim()) {
            performConversion();
        }
    }, 100);

    console.log('應用初始化完成，雙向轉換功能已啟用');
}

// 页面卸载前清理资源
window.addEventListener('beforeunload', () => {
    // 清理本地字体URL
    if (window.FontManager) {
        FontManager.localFontURLs.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // 忽略错误
            }
        });
        FontManager.localFontURLs.clear();
    }
    
    console.log('页面卸载，已清理字体资源');
});

window.addEventListener('DOMContentLoaded', initializeApp);