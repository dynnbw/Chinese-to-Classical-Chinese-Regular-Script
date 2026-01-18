// ========== 字体管理功能模块 ==========

// 存储键名常量
const FONT_STORAGE_KEYS = {
    FONT_SETTINGS: 'seal-converter-font',
    CUSTOM_FONT_URL: 'seal-converter-custom-font-url',
    COMPATIBILITY_SETTINGS: 'seal-converter-compatibility-settings'
};

// 字体管理器 (带LRU缓存清理机制)
const FontManager = {
    currentFont: null,
    fontCache: new Map(), // 字体缓存
    maxCacheSize: 10, // 最大缓存字体数量
    localFontURLs: new Set(), // 本地字体URL集合
    
    // 初始化
    init() {
        const savedFont = localStorage.getItem(FONT_STORAGE_KEYS.FONT_SETTINGS);
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
        // 注意：需要外部调用更新统计显示
        return cacheEntry;
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
            // 注意：需要外部调用更新统计显示
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
            return expiredKeys.length;
        }
        return 0;
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
        return keys.length;
    },

    async loadCloudFont(fontId, fontUrl, fontName, updateStatusCallback = null) {
        try {
            if (updateStatusCallback) {
                updateStatusCallback(`正在加載字體: ${fontName}...`, 'warning');
            }
            
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
                if (updateStatusCallback) {
                    updateStatusCallback(`已從緩存加載字體: ${fontName}`, 'good');
                }
                
                // 确保禁用兼容模式
                if (CompatibilityMode.enabled) {
                    CompatibilityMode.disable(updateStatusCallback);
                }
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
            if (updateStatusCallback) {
                updateStatusCallback(`字體加載成功: ${fontName}`, 'good');
            }
            this.saveFontSettings();
            
            // 确保禁用兼容模式
            if (CompatibilityMode.enabled) {
                CompatibilityMode.disable(updateStatusCallback);
            }

            return true;
        } catch (error) {
            if (updateStatusCallback) {
                updateStatusCallback(`字體加載失敗: ${error.message}`, 'error');
            }
            return false;
        }
    },

    async loadLocalFont(file, fontName = 'Local Font', updateStatusCallback = null) {
        try {
            if (updateStatusCallback) {
                updateStatusCallback('正在加載本地字體...', 'warning');
            }
            
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
                if (updateStatusCallback) {
                    updateStatusCallback(`已從緩存加載本地字體: ${file.name}`, 'good');
                }
                this.saveFontSettings();
                
                // 确保禁用兼容模式
                if (CompatibilityMode.enabled) {
                    CompatibilityMode.disable(updateStatusCallback);
                }
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
            if (updateStatusCallback) {
                updateStatusCallback(`本地字體加載成功: ${file.name}`, 'good');
            }
            this.saveFontSettings();
            
            // 确保禁用兼容模式
            if (CompatibilityMode.enabled) {
                CompatibilityMode.disable(updateStatusCallback);
            }

            return true;
        } catch (error) {
            if (updateStatusCallback) {
                updateStatusCallback(`本地字體加載失敗: ${error.message}`, 'error');
            }
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

    applySystemFont(fontId, updateStatusCallback = null) {
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
        if (updateStatusCallback) {
            updateStatusCallback(`已切換到: ${fontName}`, 'good');
        }
        this.saveFontSettings();
        
        // 确保禁用兼容模式
        if (CompatibilityMode.enabled) {
            CompatibilityMode.disable(updateStatusCallback);
        }
    },

    applyCurrentFont() {
        if (!this.currentFont) return;

        // 更新当前字体显示
        const currentFontEl = document.getElementById('currentFont');
        if (currentFontEl) {
            currentFontEl.textContent = this.currentFont.name;
        }

        // 设置页面字体
        const baseFontFamily = `${this.currentFont.family}`;
        const fallbackFonts = '"Microsoft YaHei", "SimSun", serif';

        // 检查是否已经包含回退字体
        let fontFamily = baseFontFamily;
        if (!this.currentFont.family.includes('Microsoft YaHei')) {
            fontFamily = `${baseFontFamily}, ${fallbackFonts}`;
        }

        document.body.style.fontFamily = fontFamily;

        // 更新测试文本
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
            localStorage.setItem(FONT_STORAGE_KEYS.FONT_SETTINGS, JSON.stringify(fontData));
        }
    },

    applyFontSettings(fontData) {
        if (!fontData) return;
        this.currentFont = fontData;
        this.applyCurrentFont();
    },

    // 兼容模式支持
    applyCompatibilityMode(provider = 'svgfonts', updateStatusCallback = null) {
        CompatibilityMode.enabled = true;
        CompatibilityMode.currentProvider = provider;
        
        this.currentFont = {
            id: 'compatibility-mode',
            name: '圖片兼容模式',
            family: 'system-default',
            type: 'compatibility'
        };
        
        this.applyCurrentFont();
        CompatibilityMode.enable(updateStatusCallback);
        
        if (updateStatusCallback) {
            updateStatusCallback(`已啟用圖片兼容模式 (${provider})`, 'good');
        }
        this.saveFontSettings();
    }
};

// ========== 兼容模式管理器 (带缓存清理机制) ==========

const CompatibilityMode = {
    enabled: false,
    currentProvider: 'svgfonts', // 'svgfonts' 或 'custom'
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
            const saved = localStorage.getItem(FONT_STORAGE_KEYS.COMPATIBILITY_SETTINGS);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
                
                // 如果之前启用了兼容模式，重新启用
                if (parsed.enabled) {
                    this.enabled = parsed.enabled;
                    this.currentProvider = parsed.currentProvider || 'svgfonts';
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
            localStorage.setItem(FONT_STORAGE_KEYS.COMPATIBILITY_SETTINGS, JSON.stringify(settingsToSave));
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
        
        if (currentProvider === 'svgfonts') {
            return `https://zhs.glyphwiki.org/glyph/u${codeHex.toLowerCase()}.svg`;
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
        return cacheEntry;
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
        return expiredKeys.length;
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
    enable(updateStatusCallback = null) {
        this.enabled = true;
        
        // 更新当前字体显示
        const currentFontEl = document.getElementById('currentFont');
        if (currentFontEl) {
            currentFontEl.textContent = '圖片兼容模式';
        }
        
        // 保存设置
        this.saveSettings();
        
        if (updateStatusCallback) {
            updateStatusCallback('已啟用圖片兼容模式', 'good');
        }
        return true;
    },
    
    // 禁用兼容模式
    disable(updateStatusCallback = null) {
        this.enabled = false;
        if (updateStatusCallback) {
            updateStatusCallback('已禁用圖片兼容模式', 'good');
        }
        return false;
    },
    
    // 切换兼容模式
    toggle(updateStatusCallback = null) {
        if (this.enabled) {
            return this.disable(updateStatusCallback);
        } else {
            return this.enable(updateStatusCallback);
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

// ========== 字体设置相关功能 ==========

// 字体设置面板初始化
function initializeFontSettings(updateStatusCallback = null) {
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
                previewLocalFont(file, updateStatusCallback);
            } else {
                selectedFileName.textContent = '';
            }
        });
    }

    const applyFontBtn = document.getElementById('applyFontBtn');
    if (applyFontBtn) {
        applyFontBtn.addEventListener('click', () => {
            applySelectedFont(updateStatusCallback);
        });
    }
}

// 预览本地字体
function previewLocalFont(file, updateStatusCallback = null) {
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
        if (updateStatusCallback) {
            updateStatusCallback('不支持的字體文件格式，請使用TTF、OTF、WOFF、WOFF2或EOT格式', 'error');
        }
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
        if (updateStatusCallback) {
            updateStatusCallback(`字體預覽失敗: ${error.message}`, 'error');
        }
    });
}

// 应用选中的字体
async function applySelectedFont(updateStatusCallback = null) {
    const selectedOption = document.querySelector('.font-option.selected');
    if (!selectedOption) {
        if (updateStatusCallback) {
            updateStatusCallback('請選擇一個字體', 'warning');
        }
        return;
    }

    const fontId = selectedOption.getAttribute('data-font');
    const activeTab = document.querySelector('.font-tab-btn.active');
    if (!activeTab) {
        if (updateStatusCallback) {
            updateStatusCallback('無法確定當前選項卡', 'error');
        }
        return;
    }

    const activeTabId = activeTab.getAttribute('data-tab');

    if (activeTabId === 'cloud') {
        if (fontId === 'custom-url') {
            const customUrl = document.getElementById('customFontUrl').value.trim();
            if (!customUrl) {
                if (updateStatusCallback) {
                    updateStatusCallback('請輸入字體URL', 'warning');
                }
                return;
            }

            if (!customUrl.match(/^https?:\/\//)) {
                if (updateStatusCallback) {
                    updateStatusCallback('請輸入有效的URL', 'warning');
                }
                return;
            }

            // 保存自定义字体URL
            try {
                localStorage.setItem(FONT_STORAGE_KEYS.CUSTOM_FONT_URL, customUrl);
            } catch (e) {
                console.error('保存字体URL失败:', e);
            }

            const fontName = 'CustomFont-' + Date.now();
            await FontManager.loadCloudFont('custom', customUrl, fontName, updateStatusCallback);

        } else {
            const fontUrl = selectedOption.getAttribute('data-url');
            const fontName = fontId === 'Huiwen' ? 'Huiwen' :
                fontId === 'noto-serif' ? 'Noto Serif SC' :
                    fontId === 'MiSans' ? 'MiSans_L3' : fontId;

            await FontManager.loadCloudFont(fontId, fontUrl, fontName, updateStatusCallback);
        }

    } else if (activeTabId === 'local') {
        const fileInput = document.getElementById('localFontFile');
        if (!fileInput.files || !fileInput.files[0]) {
            if (updateStatusCallback) {
                updateStatusCallback('請選擇一個字體文件', 'warning');
            }
            return;
        }

        const file = fileInput.files[0];
        const fontName = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, "");
        await FontManager.loadLocalFont(file, fontName, updateStatusCallback);

    } else if (activeTabId === 'system') {
        FontManager.applySystemFont(fontId, updateStatusCallback);
        
    } else if (activeTabId === 'compatibility') {
        // 处理兼容模式
        if (fontId === 'svgfonts-compatibility') {
            FontManager.applyCompatibilityMode('svgfonts', updateStatusCallback);
        } else if (fontId === 'custom-compatibility') {
            const customUrl = document.getElementById('customImgUrl').value.trim();
            if (customUrl) {
                CompatibilityMode.settings.customUrlTemplate = customUrl;
                CompatibilityMode.saveSettings();
                FontManager.applyCompatibilityMode('custom', updateStatusCallback);
            } else {
                if (updateStatusCallback) {
                    updateStatusCallback('請輸入自定義圖片URL模板', 'warning');
                }
                return;
            }
        }
    }

    // 如果不是兼容模式，确保禁用兼容模式
    if (activeTabId !== 'compatibility') {
        if (CompatibilityMode.enabled) {
            CompatibilityMode.disable(updateStatusCallback);
            cleanupCompatibilityMode(updateStatusCallback);
        }
    }

    closeFontSettings(updateStatusCallback);
    
    // 延迟执行转换，确保字体已加载
    setTimeout(() => {
        const forceReconvertCallback = () => {
            const inputTextEl = document.getElementById('inputText');
            if (inputTextEl && inputTextEl.value.trim()) {
                const inputText = inputTextEl.value;
                if (inputText && inputText.trim()) {
                    // 清除输出区域
                    const output = document.getElementById('outputText');
                    if (output) {
                        output.innerHTML = '正在重新轉換...';
                    }
                    
                    // 延迟执行以确保DOM更新
                    setTimeout(() => {
                        // 这里需要调用主应用的转换函数
                        if (window.performConversion) {
                            window.performConversion();
                        }
                    }, 50);
                }
            }
        };
        
        forceReconvertCallback();
    }, 800);
}

// 更新兼容模式预览
function updateCompatibilityPreview() {
    const previewContainer = document.getElementById('svgfontsPreview');
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

// 清理兼容模式状态
function cleanupCompatibilityMode(updateStatusCallback = null) {
    // 更新状态显示
    const currentFontEl = document.getElementById('currentFont');
    if (currentFontEl && FontManager.currentFont) {
        currentFontEl.textContent = FontManager.currentFont.name;
    }
    
    // 强制重新转换
    const inputTextEl = document.getElementById('inputText');
    if (inputTextEl && inputTextEl.value.trim()) {
        const inputText = inputTextEl.value;
        if (inputText && inputText.trim()) {
            // 清除输出区域
            const output = document.getElementById('outputText');
            if (output) {
                output.innerHTML = '正在切換字體...';
            }
            
            // 延迟执行以确保DOM更新
            setTimeout(() => {
                // 调用主应用的转换函数
                if (window.performConversion) {
                    window.performConversion();
                }
            }, 100);
        }
    }
    
    if (updateStatusCallback) {
        updateStatusCallback('已切換回普通字體模式', 'good');
    }
}

// 清理所有字体和图片缓存
function clearAllFontCache(updateStatusCallback = null, forceReconvertCallback = null, updateStatsDisplayCallback = null) {
    const fontCacheSize = FontManager.getCacheSize();
    const imgCacheSize = CompatibilityMode.getCacheSize();
    
    // 清理字体缓存
    FontManager.clearAllCache();
    
    // 清理图片缓存
    const clearedImgCount = CompatibilityMode.clearCache();
    
    // 如果启用了兼容模式，强制禁用
    if (CompatibilityMode.enabled) {
        CompatibilityMode.disable();
        cleanupCompatibilityMode(updateStatusCallback);
    }
    
    // 更新显示
    if (updateStatsDisplayCallback) {
        updateStatsDisplayCallback();
    }
    
    const totalCleared = fontCacheSize + clearedImgCount;
    if (updateStatusCallback) {
        updateStatusCallback(`已清理 ${fontCacheSize} 個字體緩存和 ${clearedImgCount} 個圖片緩存，共 ${totalCleared} 項`, 'good');
    }
    
    return totalCleared;
}

// 字体设置面板控制
function openFontSettings(updateStatusCallback = null) {
    const fontPanel = document.getElementById('fontSettingsPanel');
    const fontOverlay = document.getElementById('fontOverlay');
    if (fontPanel && fontOverlay) {
        fontPanel.style.display = 'block';
        fontOverlay.style.display = 'block';
        if (updateStatusCallback) {
            updateStatusCallback('字體設置面板已打開', 'good');
        }
    }
}

function closeFontSettings(updateStatusCallback = null) {
    const fontPanel = document.getElementById('fontSettingsPanel');
    const fontOverlay = document.getElementById('fontOverlay');
    if (fontPanel && fontOverlay) {
        fontPanel.style.display = 'none';
        fontOverlay.style.display = 'none';
        if (updateStatusCallback) {
            updateStatusCallback('字體設置面板已關閉', 'good');
        }
    }
}

// 导出模块
window.FontManager = FontManager;
window.CompatibilityMode = CompatibilityMode;
window.initializeFontSettings = initializeFontSettings;
window.previewLocalFont = previewLocalFont;
window.applySelectedFont = applySelectedFont;
window.updateCompatibilityPreview = updateCompatibilityPreview;
window.cleanupCompatibilityMode = cleanupCompatibilityMode;
window.clearAllFontCache = clearAllFontCache;
window.openFontSettings = openFontSettings;
window.closeFontSettings = closeFontSettings;