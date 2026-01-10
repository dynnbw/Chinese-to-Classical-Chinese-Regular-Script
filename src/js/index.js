// ========== 核心數據與狀態 ==========

// 存储键名常量
const STORAGE_KEYS = {
    CUSTOM_MAPPINGS: 'seal-converter-custom-mappings',
    REVERSE_MAPPINGS: 'seal-converter-reverse-mappings',
    FONT_SETTINGS: 'seal-converter-font',
    CUSTOM_FONT_URL: 'seal-converter-custom-font-url',
    APP_SETTINGS: 'seal-converter-settings',
    CONVERSION_DIRECTION: 'seal-converter-direction',
    COMPATIBILITY_SETTINGS: 'seal-converter-compatibility-settings'
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
    fontSettings: {
        currentFont: 'system-default',
        fontFamily: '"Microsoft YaHei", "SimSun", serif'
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
    const totalCacheSize = FontManager.getCacheSize() + CompatibilityMode.getCacheSize();
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

    // 只有当兼容模式启用且当前字体是兼容模式时才使用图片模式
    const useCompatibilityMode = CompatibilityMode.enabled && 
        (FontManager.currentFont && 
         (FontManager.currentFont.type === 'compatibility' || 
          FontManager.currentFont.id === 'compatibility-mode'));

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

// ========== 字體管理功能 (帶LRU緩存清理機制) ==========

const FontManager = {
    currentFont: null,
    fontCache: new Map(), // 字体缓存
    maxCacheSize: 10, // 最大缓存字体数量
    localFontURLs: new Set(), // 本地字体URL集合
    
    // 初始化
    init() {
        const savedFont = localStorage.getItem(STORAGE_KEYS.FONT_SETTINGS);
        if (savedFont) {
            try {
                const fontData = JSON.parse(savedFont);
                this.applyFontSettings(fontData);
            } catch (e) {
                console.log('無法恢復字體設置:', e);
            }
        }
        
        // 定期清理过期缓存（每30分钟）
        setInterval(() => {
            this.cleanExpiredCache();
        }, 30 * 60 * 1000);
    },
    
    // 添加字体到缓存
    addToCache(key, fontFace, objectURL = null) {
        // 检查缓存大小，如果超过限制，移除最久未使用的字体
        if (this.fontCache.size >= this.maxCacheSize) {
            this.removeLRUCache();
        }
        
        const cacheEntry = {
            fontFace,
            objectURL,
            timestamp: Date.now(),
            lastUsed: Date.now()
        };
        
        this.fontCache.set(key, cacheEntry);
        
        // 如果有关联的objectURL，添加到集合中
        if (objectURL) {
            this.localFontURLs.add(objectURL);
        }
        
        console.log(`字体已添加到缓存: ${key} (缓存大小: ${this.fontCache.size})`);
        updateStatsDisplay();
    },
    
    // 从缓存获取字体
    getFromCache(key) {
        const cacheEntry = this.fontCache.get(key);
        if (cacheEntry) {
            // 更新最后使用时间
            cacheEntry.lastUsed = Date.now();
            this.fontCache.set(key, cacheEntry);
            return cacheEntry.fontFace;
        }
        return null;
    },
    
    // 移除最久未使用的缓存项
    removeLRUCache() {
        if (this.fontCache.size === 0) return;
        
        let lruKey = null;
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.fontCache.entries()) {
            if (entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                lruKey = key;
            }
        }
        
        if (lruKey) {
            this.removeFromCache(lruKey);
        }
    },
    
    // 从缓存移除字体
    removeFromCache(key) {
        const cacheEntry = this.fontCache.get(key);
        if (cacheEntry) {
            // 如果有关联的objectURL，释放它
            if (cacheEntry.objectURL) {
                URL.revokeObjectURL(cacheEntry.objectURL);
                this.localFontURLs.delete(cacheEntry.objectURL);
                console.log(`释放本地字体URL: ${key}`);
            }
            
            // 从document.fonts中移除字体
            try {
                document.fonts.delete(cacheEntry.fontFace);
            } catch (e) {
                console.warn(`无法从document.fonts中移除字体 ${key}:`, e);
            }
            
            this.fontCache.delete(key);
            console.log(`字体已从缓存移除: ${key}`);
            updateStatsDisplay();
        }
    },
    
    // 清理过期缓存（超过24小时）
    cleanExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.fontCache.entries()) {
            if (now - entry.timestamp > 24 * 60 * 60 * 1000) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => {
            this.removeFromCache(key);
        });
        
        if (expiredKeys.length > 0) {
            console.log(`清理了 ${expiredKeys.length} 个过期字体缓存`);
            updateStatus(`已自動清理 ${expiredKeys.length} 個過期字體緩存`, 'good');
        }
    },
    
    // 获取缓存大小
    getCacheSize() {
        return this.fontCache.size;
    },
    
    // 清理所有缓存
    clearAllCache() {
        const keys = Array.from(this.fontCache.keys());
        keys.forEach(key => {
            this.removeFromCache(key);
        });
        
        // 清理所有本地字体URL
        this.localFontURLs.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // 忽略错误
            }
        });
        this.localFontURLs.clear();
        
        console.log('所有字体缓存已清理');
        updateStatsDisplay();
    },

    async loadCloudFont(fontId, fontUrl, fontName) {
        try {
            updateStatus(`正在加載字體: ${fontName}...`, 'warning');
            
            // 检查缓存中是否已有该字体
            const cachedFont = this.getFromCache(fontId);
            if (cachedFont) {
                this.currentFont = {
                    id: fontId,
                    name: fontName,
                    family: fontName.includes('Noto Serif SC') ? 'Noto Serif SC' :
                        fontName.includes('MiSans_L3') ? 'MiSans_L3' : fontName,
                    type: 'cloud'
                };

                this.applyCurrentFont();
                updateStatus(`已從緩存加載字體: ${fontName}`, 'good');
                return true;
            }

            if (fontUrl.includes('css2?')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontUrl;
                document.head.appendChild(link);

                this.currentFont = {
                    id: fontId,
                    name: fontName,
                    family: fontName.includes('Noto Serif SC') ? 'Noto Serif SC' :
                        fontName.includes('MiSans_L3') ? 'MiSans_L3' : fontName,
                    type: 'cloud'
                };

                // 添加空缓存项（Web字体无法直接缓存FontFace对象）
                this.addToCache(fontId, null);

            } else {
                // 修复：使用正确的URL格式
                const fontFace = new FontFace(fontName, `url("${fontUrl}")`);
                const loadedFont = await fontFace.load();
                document.fonts.add(loadedFont);

                this.currentFont = {
                    id: fontId,
                    name: fontName,
                    family: fontName,
                    type: 'cloud'
                };
                
                // 添加到缓存
                this.addToCache(fontId, loadedFont);
            }

            this.applyCurrentFont();
            updateStatus(`字體加載成功: ${fontName}`, 'good');
            this.saveFontSettings();
            
            // 确保禁用兼容模式
            if (CompatibilityMode.enabled) {
                CompatibilityMode.disable();
                cleanupCompatibilityMode();
            }

            return true;
        } catch (error) {
            updateStatus(`字體加載失敗: ${error.message}`, 'error');
            return false;
        }
    },

    async loadLocalFont(file, fontName = 'Local Font') {
        try {
            updateStatus('正在加載本地字體...', 'warning');
            
            // 检查缓存中是否已有该字体
            const cacheKey = `local-${file.name}-${file.size}`;
            const cachedFont = this.getFromCache(cacheKey);
            if (cachedFont) {
                this.currentFont = {
                    id: cacheKey,
                    name: fontName + ' (' + file.name + ')',
                    family: fontName,
                    type: 'local',
                    file: file.name
                };

                this.applyCurrentFont();
                updateStatus(`已從緩存加載本地字體: ${file.name}`, 'good');
                this.saveFontSettings();
                return true;
            }

            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            // 创建ObjectURL
            const objectURL = URL.createObjectURL(file);
            
            // 修复：正确创建FontFace对象
            const fontFace = new FontFace(fontName, `url(${objectURL})`);

            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);

            this.currentFont = {
                id: cacheKey,
                name: fontName + ' (' + file.name + ')',
                family: fontName,
                type: 'local',
                file: file.name
            };

            // 添加到缓存，包含objectURL以便后续释放
            this.addToCache(cacheKey, loadedFont, objectURL);
            
            this.applyCurrentFont();
            updateStatus(`本地字體加載成功: ${file.name}`, 'good');
            this.saveFontSettings();
            
            // 确保禁用兼容模式
            if (CompatibilityMode.enabled) {
                CompatibilityMode.disable();
                cleanupCompatibilityMode();
            }

            return true;
        } catch (error) {
            updateStatus(`本地字體加載失敗: ${error.message}`, 'error');
            return false;
        }
    },

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    applySystemFont(fontId) {
        let fontFamily, fontName;

        switch (fontId) {
            case 'system-serif':
                fontFamily = 'serif';
                fontName = '襯線字體';
                break;
            case 'system-sans':
                fontFamily = 'sans-serif';
                fontName = '無襯線字體';
                break;
            default:
                fontFamily = '"Microsoft YaHei", "SimSun", serif';
                fontName = '系統默認';
        }

        this.currentFont = {
            id: fontId,
            name: fontName,
            family: fontFamily,
            type: 'system'
        };

        this.applyCurrentFont();
        updateStatus(`已切換到: ${fontName}`, 'good');
        this.saveFontSettings();
        
        // 确保禁用兼容模式
        if (CompatibilityMode.enabled) {
            CompatibilityMode.disable();
            cleanupCompatibilityMode();
        }
    },

    applyCurrentFont() {
        if (!this.currentFont) return;

        // 修复：添加空值检查
        const currentFontEl = document.getElementById('currentFont');
        if (currentFontEl) {
            currentFontEl.textContent = this.currentFont.name;
        }

        // 修复：避免字体family重复添加
        const baseFontFamily = `${this.currentFont.family}`;
        const fallbackFonts = '"Microsoft YaHei", "SimSun", serif';

        // 检查是否已经包含回退字体
        let fontFamily = baseFontFamily;
        if (!this.currentFont.family.includes('Microsoft YaHei')) {
            fontFamily = `${baseFontFamily}, ${fallbackFonts}`;
        }

        document.body.style.fontFamily = fontFamily;

        const testText = document.getElementById('fontTestText');
        const testText2 = document.getElementById('fontTestText2');
        if (testText) testText.style.fontFamily = fontFamily;
        if (testText2) testText2.style.fontFamily = fontFamily;
    },

    saveFontSettings() {
        if (this.currentFont) {
            const fontData = {
                id: this.currentFont.id,
                name: this.currentFont.name,
                family: this.currentFont.family,
                type: this.currentFont.type
            };
            localStorage.setItem(STORAGE_KEYS.FONT_SETTINGS, JSON.stringify(fontData));
        }
    },

    applyFontSettings(fontData) {
        if (!fontData) return;
        this.currentFont = fontData;
        this.applyCurrentFont();
    },
    
    // 兼容模式支持
    applyCompatibilityMode(provider = 'zdic') {
        CompatibilityMode.enabled = true;
        CompatibilityMode.currentProvider = provider;
        
        this.currentFont = {
            id: 'compatibility-mode',
            name: '圖片兼容模式',
            family: 'system-default',
            type: 'compatibility'
        };
        
        this.applyCurrentFont();
        CompatibilityMode.enable();
        
        updateStatus(`已啟用圖片兼容模式 (${provider})`, 'good');
        this.saveFontSettings();
    }
};

// ========== 兼容模式管理器 (帶緩存清理機制) ==========

const CompatibilityMode = {
    enabled: false,
    currentProvider: 'zdic', // 'zdic' 或 'custom'
    settings: {
        cacheEnabled: true,
        lazyLoad: true,
        imgSize: 24,
        showCharInAlt: true,
        customUrlTemplate: '',
        maxCacheSize: 100 // 图片最大缓存数量
    },
    imgCache: new Map(), // 图片缓存
    imgCacheKeys: [], // LRU缓存键顺序
    
    // 初始化
    init() {
        this.loadSettings();
        this.initializeEventListeners();
        
        // 定期清理过期缓存（每15分钟）
        setInterval(() => {
            this.cleanExpiredCache();
        }, 15 * 60 * 1000);
    },
    
    // 加载设置
    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.COMPATIBILITY_SETTINGS);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
                
                // 如果之前启用了兼容模式，重新启用
                if (parsed.enabled) {
                    this.enabled = parsed.enabled;
                    this.currentProvider = parsed.currentProvider || 'zdic';
                }
            }
        } catch (e) {
            console.error('加载兼容模式设置失败:', e);
        }
    },
    
    // 保存设置
    saveSettings() {
        try {
            const settingsToSave = {
                enabled: this.enabled,
                currentProvider: this.currentProvider,
                ...this.settings
            };
            localStorage.setItem(STORAGE_KEYS.COMPATIBILITY_SETTINGS, JSON.stringify(settingsToSave));
        } catch (e) {
            console.error('保存兼容模式设置失败:', e);
        }
    },
    
    // 获取字符的Unicode码点（16进制）
    getCharCodeHex(char) {
        if (!char) return '';
        try {
            const codePoint = char.codePointAt(0);
            return codePoint.toString(16).toUpperCase().padStart(4, '0');
        } catch (e) {
            return '';
        }
    },
    
    // 生成图片URL
    generateImageUrl(char, provider = null) {
        const codeHex = this.getCharCodeHex(char);
        if (!codeHex) return '';
        
        const currentProvider = provider || this.currentProvider;
        
        if (currentProvider === 'zdic') {
            return `https://img.zdic.net/song/cn/${codeHex}.svg`;
        } else if (currentProvider === 'custom' && this.settings.customUrlTemplate) {
            return this.settings.customUrlTemplate.replace('{unicode}', codeHex);
        }
        
        return '';
    },
    
    // 添加图片到缓存
    addToCache(url, data) {
        if (!this.settings.cacheEnabled) return;
        
        // 检查缓存大小，如果超过限制，移除最久未使用的图片
        if (this.imgCache.size >= this.settings.maxCacheSize) {
            this.removeLRUCache();
        }
        
        const cacheEntry = {
            url: data,
            timestamp: Date.now(),
            lastUsed: Date.now()
        };
        
        this.imgCache.set(url, cacheEntry);
        this.updateLRUKey(url);
        
        console.log(`图片已添加到缓存: ${url} (缓存大小: ${this.imgCache.size}/${this.settings.maxCacheSize})`);
        updateStatsDisplay();
    },
    
    // 更新LRU键顺序
    updateLRUKey(key) {
        // 移除已存在的键
        const index = this.imgCacheKeys.indexOf(key);
        if (index > -1) {
            this.imgCacheKeys.splice(index, 1);
        }
        
        // 添加到末尾（最近使用）
        this.imgCacheKeys.push(key);
    },
    
    // 从缓存获取图片
    getFromCache(url) {
        const cacheEntry = this.imgCache.get(url);
        if (cacheEntry) {
            // 更新最后使用时间
            cacheEntry.lastUsed = Date.now();
            this.imgCache.set(url, cacheEntry);
            this.updateLRUKey(url);
            return cacheEntry.url;
        }
        return null;
    },
    
    // 移除最久未使用的缓存项
    removeLRUCache() {
        if (this.imgCacheKeys.length === 0) return;
        
        const lruKey = this.imgCacheKeys.shift(); // 第一个元素是最久未使用的
        if (lruKey) {
            this.imgCache.delete(lruKey);
            console.log(`移除LRU图片缓存: ${lruKey}`);
        }
    },
    
    // 清理过期缓存（超过1小时）
    cleanExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.imgCache.entries()) {
            if (now - entry.timestamp > 60 * 60 * 1000) { // 1小时
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => {
            this.imgCache.delete(key);
            const index = this.imgCacheKeys.indexOf(key);
            if (index > -1) {
                this.imgCacheKeys.splice(index, 1);
            }
        });
        
        if (expiredKeys.length > 0) {
            console.log(`清理了 ${expiredKeys.length} 个过期图片缓存`);
        }
    },
    
    // 获取缓存大小
    getCacheSize() {
        return this.imgCache.size;
    },
    
    // 清空缓存
    clearCache() {
        const oldSize = this.imgCache.size;
        this.imgCache.clear();
        this.imgCacheKeys = [];
        console.log(`清空了 ${oldSize} 个图片缓存`);
        updateStatsDisplay();
        return oldSize;
    },
    
    // 创建图片元素
    createCharImage(char, options = {}) {
        const imgUrl = this.generateImageUrl(char);
        if (!imgUrl) {
            // 如果无法生成图片URL，返回原字符
            const span = document.createElement('span');
            span.textContent = char;
            span.className = 'fallback-char';
            return span;
        }
        
        // 检查缓存
        if (this.settings.cacheEnabled) {
            const cachedUrl = this.getFromCache(imgUrl);
            if (cachedUrl) {
                const img = document.createElement('img');
                img.className = 'char-img';
                img.alt = this.settings.showCharInAlt ? char : '';
                img.title = `字符: ${char} (U+${this.getCharCodeHex(char)})`;
                img.src = cachedUrl;
                
                // 设置尺寸
                const size = options.size || this.settings.imgSize;
                img.style.width = `${size}px`;
                img.style.height = `${size}px`;
                
                return img;
            }
        }
        
        const img = document.createElement('img');
        img.className = 'char-img';
        img.alt = this.settings.showCharInAlt ? char : '';
        img.title = `字符: ${char} (U+${this.getCharCodeHex(char)})`;
        
        // 设置尺寸
        const size = options.size || this.settings.imgSize;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        
        // 设置加载状态
        img.classList.add('img-loading');
        
        // 加载图片
        if (this.settings.lazyLoad && options.lazy !== false) {
            img.dataset.src = imgUrl;
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiNGMEYwRjAiLz48L3N2Zz4='; // 透明占位符
        } else {
            img.src = imgUrl;
        }
        
        // 加载完成后的处理
        img.onload = () => {
            img.classList.remove('img-loading');
            if (this.settings.cacheEnabled) {
                this.addToCache(imgUrl, imgUrl);
            }
        };
        
        img.onerror = () => {
            img.classList.add('img-error');
            img.classList.remove('img-loading');
            // 显示原字符作为后备
            if (this.settings.showCharInAlt) {
                const fallback = document.createElement('span');
                fallback.textContent = char;
                fallback.style.fontSize = '0.8em';
                fallback.style.color = '#999';
                img.parentNode?.insertBefore(fallback, img.nextSibling);
            }
        };
        
        return img;
    },
    
    // 启用兼容模式
    enable() {
        this.enabled = true;
        AppState.fontSettings.currentFont = 'compatibility-mode';
        AppState.fontSettings.fontFamily = 'system-default'; // 重置字体
        
        // 更新UI
        const currentFontEl = document.getElementById('currentFont');
        if (currentFontEl) {
            currentFontEl.textContent = '圖片兼容模式';
        }
        
        // 保存设置
        this.saveSettings();
        FontManager.saveFontSettings();
        
        updateStatus('已啟用圖片兼容模式', 'good');
        return true;
    },
    
    // 禁用兼容模式
    disable() {
        this.enabled = false;
        updateStatus('已禁用圖片兼容模式', 'good');
        return false;
    },
    
    // 切换兼容模式
    toggle() {
        if (this.enabled) {
            return this.disable();
        } else {
            return this.enable();
        }
    },
    
    // 初始化事件监听器
    initializeEventListeners() {
        const testBtn = document.getElementById('testCompatibilityBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.testCompatibilityDisplay();
            });
        }
        
        const imgSizeSlider = document.getElementById('imgSize');
        const imgSizeValue = document.getElementById('imgSizeValue');
        if (imgSizeSlider && imgSizeValue) {
            imgSizeSlider.value = this.settings.imgSize;
            imgSizeValue.textContent = `${this.settings.imgSize}px`;
            
            imgSizeSlider.addEventListener('input', (e) => {
                const size = parseInt(e.target.value);
                this.settings.imgSize = size;
                imgSizeValue.textContent = `${size}px`;
                this.saveSettings();
            });
        }
        
        // 最大缓存数设置
        const imgCacheMaxSize = document.getElementById('imgCacheMaxSize');
        if (imgCacheMaxSize) {
            imgCacheMaxSize.value = this.settings.maxCacheSize;
            imgCacheMaxSize.addEventListener('change', (e) => {
                const size = parseInt(e.target.value);
                if (size >= 10 && size <= 25565) {
                    this.settings.maxCacheSize = size;
                    this.saveSettings();
                    
                    // 如果当前缓存超过新限制，移除多余的缓存
                    if (this.imgCache.size > size) {
                        const toRemove = this.imgCache.size - size;
                        for (let i = 0; i < toRemove; i++) {
                            this.removeLRUCache();
                        }
                        updateStatus(`已調整圖片緩存限制，移除了 ${toRemove} 個緩存項`, 'good');
                    }
                }
            });
        }
        
        // 其他设置选项
        const settingIds = ['imgCache', 'imgLazyLoad', 'showCharInAlt'];
        settingIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = this.settings[id] || false;
                el.addEventListener('change', (e) => {
                    this.settings[id] = e.target.checked;
                    this.saveSettings();
                });
            }
        });
        
        // 自定义URL模板
        const customUrlInput = document.getElementById('customImgUrl');
        if (customUrlInput) {
            customUrlInput.addEventListener('input', (e) => {
                this.settings.customUrlTemplate = e.target.value;
                this.saveSettings();
            });
        }
    },
    
    // 测试兼容模式显示
    testCompatibilityDisplay() {
        const testText = '天地日月山水木金火土';
        const container = document.getElementById('compatibilityTestText');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (const char of testText) {
            const img = this.createCharImage(char);
            const wrapper = document.createElement('div');
            wrapper.className = 'char-container';
            wrapper.appendChild(img);
            
            const codeSpan = document.createElement('span');
            codeSpan.textContent = ` U+${this.getCharCodeHex(char)}`;
            codeSpan.style.fontSize = '0.7em';
            codeSpan.style.color = '#666';
            wrapper.appendChild(codeSpan);
            
            container.appendChild(wrapper);
        }
        
        updateStatus('兼容模式測試已顯示', 'good');
    },
    
    // 格式化文本为图片（用于转换结果显示）
    formatTextAsImages(text, options = {}) {
        if (!this.enabled || !text) return '';
        
        const chars = Array.from(text);
        let html = '';
        
        chars.forEach(char => {
            const img = this.createCharImage(char, options);
            html += `<div class="char-container">${img.outerHTML}</div>`;
        });
        
        return html;
    }
};

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

// ========== 字體設置功能 ==========

function initializeFontSettings() {
    const tabButtons = document.querySelectorAll('.font-tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.font-tab-content').forEach(content => {
                content.classList.remove('active');
            });

            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // 如果是兼容模式选项卡，更新预览
            if (tabId === 'compatibility') {
                updateCompatibilityPreview();
            }
        });
    });

    const fontOptions = document.querySelectorAll('.font-option');
    fontOptions.forEach(option => {
        option.addEventListener('click', function () {
            fontOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');

            if (this.getAttribute('data-font') === 'custom-url') {
                document.getElementById('customFontUrl').focus();
            } else if (this.getAttribute('data-font') === 'custom-compatibility') {
                document.getElementById('customImgUrl').focus();
            }
        });
    });

    const customUrlInput = document.getElementById('customFontUrl');
    if (customUrlInput) {
        customUrlInput.addEventListener('input', function () {
            const preview = document.getElementById('customFontPreview');
            preview.textContent = this.value ? '自定義字體預覽' : '預覽文字';
        });
    }

    const localFontFile = document.getElementById('localFontFile');
    const selectedFileName = document.getElementById('selectedFileName');

    if (localFontFile) {
        localFontFile.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                selectedFileName.textContent = `已選擇: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                previewLocalFont(file);
            } else {
                selectedFileName.textContent = '';
            }
        });
    }

    const applyFontBtn = document.getElementById('applyFontBtn');
    if (applyFontBtn) {
        applyFontBtn.addEventListener('click', applySelectedFont);
    }
}

function previewLocalFont(file) {
    // 修复：更严格的字体文件类型检查
    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2', '.eot'];
    const validMimeTypes = [
        'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
        'application/vnd.ms-fontobject', 'application/x-font-ttf',
        'application/x-font-otf', 'application/x-font-woff'
    ];

    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const fileType = file.type.toLowerCase();

    // 检查文件扩展名和MIME类型
    const isValidExtension = validExtensions.includes(fileExtension);
    const isValidMimeType = validMimeTypes.includes(fileType) ||
        validMimeTypes.some(type => fileType.includes(type.replace('font/', '')));

    if (!isValidExtension && !isValidMimeType) {
        updateStatus('不支持的字體文件格式，請使用TTF、OTF、WOFF、WOFF2或EOT格式', 'error');
        return;
    }

    const fontName = 'LocalPreviewFont-' + Date.now();
    const objectURL = URL.createObjectURL(file);
    const fontFace = new FontFace(fontName, `url(${objectURL})`);

    fontFace.load().then(loadedFont => {
        document.fonts.add(loadedFont);
        const preview = document.getElementById('localFontPreview');
        if (preview) {
            preview.style.fontFamily = `${fontName}, serif`;
            preview.textContent = `本地字體預覽: 天地日月山水木金火土`;
        }

        // 释放预览字体资源（延迟释放，确保预览完成）
        setTimeout(() => {
            try {
                URL.revokeObjectURL(objectURL);
                document.fonts.delete(loadedFont);
            } catch (e) {
                console.warn('清理预览字体资源失败:', e);
            }
        }, 5000); // 5秒后清理预览资源

    }).catch(error => {
        // 释放失败的资源
        try {
            URL.revokeObjectURL(objectURL);
        } catch (e) {
            // 忽略错误
        }
        updateStatus(`字體預覽失敗: ${error.message}`, 'error');
    });
}

async function applySelectedFont() {
    const selectedOption = document.querySelector('.font-option.selected');
    if (!selectedOption) {
        updateStatus('請選擇一個字體', 'warning');
        return;
    }

    const fontId = selectedOption.getAttribute('data-font');
    const activeTab = document.querySelector('.font-tab-btn.active');
    if (!activeTab) {
        updateStatus('無法確定當前選項卡', 'error');
        return;
    }

    const activeTabId = activeTab.getAttribute('data-tab');

    if (activeTabId === 'cloud') {
        if (fontId === 'custom-url') {
            const customUrl = document.getElementById('customFontUrl').value.trim();
            if (!customUrl) {
                updateStatus('請輸入字體URL', 'warning');
                return;
            }

            if (!customUrl.match(/^https?:\/\//)) {
                updateStatus('請輸入有效的URL', 'warning');
                return;
            }

            // 保存自定义字体URL
            try {
                localStorage.setItem(STORAGE_KEYS.CUSTOM_FONT_URL, customUrl);
            } catch (e) {
                console.error('保存字体URL失败:', e);
            }

            const fontName = 'CustomFont-' + Date.now();
            await FontManager.loadCloudFont('custom', customUrl, fontName);

        } else {
            const fontUrl = selectedOption.getAttribute('data-url');
            const fontName = fontId === 'Huiwen' ? 'Huiwen' :
                fontId === 'noto-serif' ? 'Noto Serif SC' :
                    fontId === 'MiSans' ? 'MiSans_L3' : fontId;

            await FontManager.loadCloudFont(fontId, fontUrl, fontName);
        }

    } else if (activeTabId === 'local') {
        const fileInput = document.getElementById('localFontFile');
        if (!fileInput.files || !fileInput.files[0]) {
            updateStatus('請選擇一個字體文件', 'warning');
            return;
        }

        const file = fileInput.files[0];
        const fontName = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, "");
        await FontManager.loadLocalFont(file, fontName);

    } else if (activeTabId === 'system') {
        FontManager.applySystemFont(fontId);
        
    } else if (activeTabId === 'compatibility') {
        // 处理兼容模式
        if (fontId === 'zdic-compatibility') {
            FontManager.applyCompatibilityMode('zdic');
        } else if (fontId === 'custom-compatibility') {
            const customUrl = document.getElementById('customImgUrl').value.trim();
            if (customUrl) {
                CompatibilityMode.settings.customUrlTemplate = customUrl;
                CompatibilityMode.saveSettings();
                FontManager.applyCompatibilityMode('custom');
            } else {
                updateStatus('請輸入自定義圖片URL模板', 'warning');
                return;
            }
        }
    }

    // 如果不是兼容模式，确保禁用兼容模式
    if (activeTabId !== 'compatibility') {
        if (CompatibilityMode.enabled) {
            CompatibilityMode.disable();
            cleanupCompatibilityMode();
        }
    }

    closeFontSettings();
    
    // 延迟执行转换，确保字体已加载
    setTimeout(() => {
        performConversion();
    }, 800);
}

function openFontSettings() {
    const fontPanel = document.getElementById('fontSettingsPanel');
    const fontOverlay = document.getElementById('fontOverlay');
    if (fontPanel && fontOverlay) {
        fontPanel.style.display = 'block';
        fontOverlay.style.display = 'block';
        updateStatus('字體設置面板已打開', 'good');
    }
}

function closeFontSettings() {
    const fontPanel = document.getElementById('fontSettingsPanel');
    const fontOverlay = document.getElementById('fontOverlay');
    if (fontPanel && fontOverlay) {
        fontPanel.style.display = 'none';
        fontOverlay.style.display = 'none';
        updateStatus('字體設置面板已關閉', 'good');
    }
}

// ========== 更新兼容模式预览 ==========

function updateCompatibilityPreview() {
    const previewContainer = document.getElementById('zdicPreview');
    if (!previewContainer) return;
    
    const previewDiv = previewContainer.querySelector('.character-preview') || 
                      document.createElement('div');
    previewDiv.className = 'character-preview';
    
    // 预览字符
    const previewChars = ['天', '地', '日', '月', '山', '水', '木', '金', '火', '土'];
    previewDiv.innerHTML = '';
    
    previewChars.forEach(char => {
        const img = CompatibilityMode.createCharImage(char, { lazy: false, size: 20 });
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';
        wrapper.style.textAlign = 'center';
        wrapper.style.margin = '2px';
        wrapper.appendChild(img);
        
        const codeSpan = document.createElement('div');
        codeSpan.textContent = `U+${CompatibilityMode.getCharCodeHex(char)}`;
        codeSpan.style.fontSize = '0.6em';
        codeSpan.style.color = '#666';
        wrapper.appendChild(codeSpan);
        
        previewDiv.appendChild(wrapper);
    });
    
    if (!previewContainer.querySelector('.character-preview')) {
        previewContainer.appendChild(previewDiv);
    }
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
    if (CompatibilityMode.enabled) {
        CompatibilityMode.disable();
        cleanupCompatibilityMode();
    }
    
    const output = document.getElementById('outputText');
    if (!output) return;

    const directionLabel = AppState.conversionDirection === 'toSeal' ? '繁體→篆書' : '篆書→繁體';

    output.innerHTML = `
        <h3>字體顯示測試 (${directionLabel})</h3>
        <p>當前字體: ${FontManager.currentFont ? FontManager.currentFont.name : '系統默認'}</p>
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
        if (FontManager.currentFont && FontManager.currentFont.family) {
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
    debugInfo += `<p>字體緩存大小: ${FontManager.getCacheSize()}</p>`;
    debugInfo += `<p>圖片緩存大小: ${CompatibilityMode.getCacheSize()}</p>`;
    debugInfo += `<p>當前輸入: "${inputText}" (長度: ${inputText.length})</p>`;
    debugInfo += `<p>兼容模式: ${CompatibilityMode.enabled ? '已啟用' : '已禁用'}</p>`;

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

// ========== 清理兼容模式状态 ==========

/**
 * 清理兼容模式状态
 */
function cleanupCompatibilityMode() {
    // 更新状态显示
    const currentFontEl = document.getElementById('currentFont');
    if (currentFontEl && FontManager.currentFont) {
        currentFontEl.textContent = FontManager.currentFont.name;
    }
    
    // 强制重新转换
    forceReconvert();
    
    updateStatus('已切換回普通字體模式', 'good');
}

// ========== 清理緩存功能 ==========

function clearAllCache() {
    const fontCacheSize = FontManager.getCacheSize();
    const imgCacheSize = CompatibilityMode.getCacheSize();
    
    // 清理字体缓存
    FontManager.clearAllCache();
    
    // 清理图片缓存
    const clearedImgCount = CompatibilityMode.clearCache();
    
    // 如果启用了兼容模式，强制禁用
    if (CompatibilityMode.enabled) {
        CompatibilityMode.disable();
        cleanupCompatibilityMode();
    }
    
    // 更新显示
    updateStatsDisplay();
    
    const totalCleared = fontCacheSize + clearedImgCount;
    updateStatus(`已清理 ${fontCacheSize} 個字體緩存和 ${clearedImgCount} 個圖片緩存，共 ${totalCleared} 項`, 'good');
    
    // 重新转换以显示更新
    const inputText = document.getElementById('inputText');
    if (inputText && inputText.value.trim()) {
        setTimeout(() => performConversion(), 100);
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
    if (fontSettingsBtn) fontSettingsBtn.addEventListener('click', openFontSettings);
    if (closeFontBtn) closeFontBtn.addEventListener('click', closeFontSettings);
    if (fontOverlay) fontOverlay.addEventListener('click', closeFontSettings);

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

    // 初始化字体管理器
    FontManager.init();
    
    // 初始化兼容模式
    CompatibilityMode.init();

    // 绑定事件监听器
    initializeEventListeners();

    // 初始化字体设置界面
    initializeFontSettings();

    // 更新转换方向显示
    updateDirectionDisplay();

    // 确保事件监听器正确初始化
    initializeEventListeners();

    // 恢复自定义字体URL
    try {
        const savedFontUrl = localStorage.getItem(STORAGE_KEYS.CUSTOM_FONT_URL);
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
        const savedCompatibility = localStorage.getItem(STORAGE_KEYS.COMPATIBILITY_SETTINGS);
        if (savedCompatibility) {
            const parsed = JSON.parse(savedCompatibility);
            // 如果之前启用了兼容模式，重新启用
            if (parsed.enabled) {
                CompatibilityMode.enabled = parsed.enabled;
                CompatibilityMode.currentProvider = parsed.currentProvider || 'zdic';
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
    const modeLabel = CompatibilityMode.enabled ? ' (圖片兼容模式)' : '';
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
    FontManager.localFontURLs.forEach(url => {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            // 忽略错误
        }
    });
    FontManager.localFontURLs.clear();
    
    console.log('页面卸载，已清理字体资源');
});

window.addEventListener('DOMContentLoaded', initializeApp);