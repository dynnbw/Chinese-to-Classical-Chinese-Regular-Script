        // ========== 核心數據與狀態 ==========
        
        // 篆書楷化映射表
        const SealMapping = {
            '天': '𠀘',
            '地': '𡍑',
            '日': '𡆠',
            '月': '𡴑',
            '山': '𡴸',
            '水': '𣱱',
            '火': '𤆄',
            '木': '𣎳',
            '金': '𨤾',
            '土': '𡈽',
            '人': '𤯔',
            '心': '𢗀',
            '手': '𠦙',
            '口': '𠮚',
            '一': '𠀁',
            '二': '𠄠',
            '三': '𠦂',
            '四': '𦉭',
            '五': '𠄡',
            '六': '𠫪',
            '七': '𠀁',
            '八': '𠔁',
            '九': '𠃬',
            '十': '𠦄',
            '上': '𠄞',
            '下': '𠄟',
            '中': '𠁧',
            '大': '𠙶',
            '小': '𡮐',
            '王': '𠙻',
            '玉': '𤣩',
            '石': '𥐖',
            '田': '𤰝',
            '禾': '𥝦',
            '米': '𠧞',
            '雨': '𠕲',
            '雲': '𠧴',
            '風': '𠙐',
            '雷': '𤴐',
            '電': '𩃿',
            '龍': '竜',
            '虎': '𧆞',
            '馬': '𢒠',
            '牛': '𠂒',
            '羊': '𦍋',
            '犬': '𤝔',
            '鳥': '𠦒',
            '魚': '𤋳',
            '龜': '𤕣',
            '蟲': '𧏽',
            '貝': '𤣫',
            '車': '𠂤',
            '舟': '𦨅',
            '門': '𨳇',
            '戶': '𢆠',
            '刀': '𠚣',
            '弓': '𢎗',
            '矢': '𠂕',
            '戈': '𢦒',
            '矛': '𢦧',
            '鼎': '𣃦',
            '鼓': '𡔷',
            '旗': '𣄞',
            '網': '𦉸',
            '衣': '𧘇',
            '巾': '𠕦',
            '食': '𠊊',
            '酒': '𨠊',
            '肉': '𠕎',
            '血': '𠂋',
            '骨': '𠩠',
            '毛': '𣬐',
            '皮': '𠰋',
            '革': '𠩫',
            '絲': '𢇁',
            '糸': '𢆶',
            '竹': '𥫗',
            '草': '𦯑',
            '花': '𠌶',
            '樹': '𣗳',
            '林': '𣏞',
            '森': '𣡽',
            '春': '𦥑',
            '夏': '𡕻',
            '秋': '𥤯',
            '冬': '𠘰',
            '年': '𠦅',
            '歲': '𢧁',
            '東': '𣅘',
            '西': '𠧧',
            '南': '𡴂',
            '北': '𠦜',
            '左': '𠂇',
            '右': '𠮢',
            '前': '𠥎',
            '後': '𢔏',
            '內': '𠘨',
            '外': '𠖃',
            '高': '𦤎',
            '長': '𠑷',
            '白': '𤼽',
            '黑': '𪐗',
            '紅': '𠄞',
            '黃': '𤽎',
            '青': '𤯍',
            '樂': '𢡠',
            '書': '𦘠',
            '漢': '𤁉',
            '的': '㢧',
            '了': '𠄏',
            '在': '𡉄',
            '和': '𥤉',
            '是': '𣆪',
            '有': '𠂇',
            '我': '𢦓',
            '他': '𠈓',
            '你': '𠑵',
            '們': '𠈌',
            '國': '𢧢',
            '家': '𡩅',
            '學': '𦥯',
            '文': '𢘈',
            '字': '𡥜'
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
            lastUpdate: new Date().toLocaleString()
        };
        
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
        
        // ========== 核心轉換函數 ==========
        
        /**
         * 將繁體字轉換為篆書楷化字
         */
        function convertToSealKai(text) {
            if (!text || text.trim() === '') {
                return {
                    result: '',
                    stats: { converted: 0, total: 0 }
                };
            }
            
            const safeText = safeString(text);
            let result = '';
            let converted = 0;
            let total = 0;
            
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
                
                if (SealMapping[char]) {
                    result += SealMapping[char];
                    converted++;
                } else {
                    result += char;
                }
            }
            
            AppState.conversionStats.success += converted;
            AppState.conversionStats.total++;
            
            return {
                result: result,
                stats: { converted, total }
            };
        }
        
        // ========== 顯示與渲染函數 ==========
        
        /**
         * 更新狀態顯示
         */
        function updateStatus(message, type = 'good') {
            const indicator = document.getElementById('statusIndicator');
            const text = document.getElementById('statusText');
            
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
            document.getElementById('mappingCount').textContent = Object.keys(SealMapping).length;
            document.getElementById('mappingCountPanel').textContent = Object.keys(SealMapping).length;
            document.getElementById('successCount').textContent = AppState.conversionStats.success;
            document.getElementById('totalConversions').textContent = AppState.conversionStats.total;
            document.getElementById('conversionCount').textContent = AppState.conversionStats.total;
            document.getElementById('lastUpdate').textContent = AppState.lastUpdate;
        }
        
        /**
         * 格式化轉換結果顯示
         */
        function formatConversionResult(original, converted, stats) {
            if (!original || !converted) {
                return '轉換結果將在此處以豎排古籍樣式呈現。';
            }
            
            let html = '';
            
            if (AppState.settings.showCharCodes) {
                // 顯示碼點模式
                html += `<strong>轉換完成:</strong> ${stats.converted}/${stats.total} 個字符被轉換`;
                html += '<strong>轉換結果 (含碼點):</strong>';
                
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
                        <span class="converted-char seal-char">${char}</span>
                        <span style="font-size: 0.7em; color: #666;">${codePoint}</span>
                    </div>`;
                });
            } else {
                // 普通模式
                html += `<strong>轉換完成:</strong> ${stats.converted}/${stats.total} 個字符被轉換`;
                html += '<strong>轉換結果:</strong>';
                
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
                    html += `<span class="seal-char">${char}</span>`;
                });
            }
            
            return html;
        }
        
        // ========== 字體管理功能 ==========
        
        const FontManager = {
            currentFont: null,
            
            init() {
                const savedFont = localStorage.getItem('seal-converter-font');
                if (savedFont) {
                    try {
                        const fontData = JSON.parse(savedFont);
                        this.applyFontSettings(fontData);
                    } catch (e) {
                        console.log('無法恢復字體設置:', e);
                    }
                }
            },
            
            async loadCloudFont(fontId, fontUrl, fontName) {
                try {
                    updateStatus(`正在加載字體: ${fontName}...`, 'warning');
                    
                    if (fontUrl.includes('css2?')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = fontUrl;
                        document.head.appendChild(link);
                        
                        this.currentFont = {
                            id: fontId,
                            name: fontName,
                            family: fontName.includes('Noto Serif SC') ? 'Noto Serif SC' :
                                   fontName.includes('MiSans_L3') ? 'MiSans_L3' : 'MiSans_L3',
                            type: 'cloud'
                        };
                        
                    } else {
                        const fontFace = new FontFace(fontName, `url(${fontUrl})`);
                        const loadedFont = await fontFace.load();
                        document.fonts.add(loadedFont);
                        
                        this.currentFont = {
                            id: fontId,
                            name: fontName,
                            family: fontName,
                            type: 'cloud'
                        };
                    }
                    
                    this.applyCurrentFont();
                    updateStatus(`字體加載成功: ${fontName}`, 'good');
                    this.saveFontSettings();
                    
                    return true;
                } catch (error) {
                    updateStatus(`字體加載失敗: ${error.message}`, 'error');
                    return false;
                }
            },
            
            async loadLocalFont(file, fontName = 'Local Font') {
                try {
                    updateStatus('正在加載本地字體...', 'warning');
                    
                    const arrayBuffer = await this.readFileAsArrayBuffer(file);
                    const fontFace = new FontFace(fontName, arrayBuffer);
                    
                    const loadedFont = await fontFace.load();
                    document.fonts.add(loadedFont);
                    
                    this.currentFont = {
                        id: 'local-' + Date.now(),
                        name: fontName + ' (' + file.name + ')',
                        family: fontName,
                        type: 'local',
                        file: file.name
                    };
                    
                    this.applyCurrentFont();
                    updateStatus(`本地字體加載成功: ${file.name}`, 'good');
                    this.saveFontSettings();
                    
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
                
                switch(fontId) {
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
            },
            
            applyCurrentFont() {
                if (!this.currentFont) return;
                
                document.getElementById('currentFont').textContent = this.currentFont.name;
                document.body.style.fontFamily = `${this.currentFont.family}, "Microsoft YaHei", "SimSun", serif`;
                
                const testText = document.getElementById('fontTestText');
                const testText2 = document.getElementById('fontTestText2');
                if (testText) testText.style.fontFamily = `${this.currentFont.family}, "Microsoft YaHei", "SimSun", serif`;
                if (testText2) testText2.style.fontFamily = `${this.currentFont.family}, "Microsoft YaHei", "SimSun", serif`;
            },
            
            saveFontSettings() {
                if (this.currentFont) {
                    const fontData = {
                        id: this.currentFont.id,
                        name: this.currentFont.name,
                        family: this.currentFont.family,
                        type: this.currentFont.type
                    };
                    localStorage.setItem('seal-converter-font', JSON.stringify(fontData));
                }
            },
            
            applyFontSettings(fontData) {
                if (!fontData) return;
                this.currentFont = fontData;
                this.applyCurrentFont();
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
                Object.assign(SealMapping, data);
                AppState.lastUpdate = new Date().toLocaleString();
                
                const newCount = Object.keys(SealMapping).length;
                const addedCount = newCount - originalCount;
                
                updateStatsDisplay();
                updateStatus(`成功導入 ${addedCount} 條新映射`, 'good');
                
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
            const mappingList = Object.entries(SealMapping)
                .slice(0, 50)
                .map(([key, value]) => `${key} → ${value}`)
                .join('\n');
            
            const output = document.getElementById('outputText');
            output.innerHTML = `
                <h3>當前映射表 (${Object.keys(SealMapping).length} 條)</h3>
                <p>顯示前50條:</p>
                <div style="font-family: monospace; font-size: 0.9em;">
                    ${mappingList.replace(/\n/g, '<br>')}
                </div>
                ${Object.keys(SealMapping).length > 50 ? `<p>... 還有 ${Object.keys(SealMapping).length - 50} 條映射</p>` : ''}
            `;
        }
        
        // ========== 字體設置功能 ==========
        
        function initializeFontSettings() {
            const tabButtons = document.querySelectorAll('.font-tab-btn');
            tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.font-tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    
                    this.classList.add('active');
                    const tabId = this.getAttribute('data-tab');
                    document.getElementById(`${tabId}-tab`).classList.add('active');
                });
            });
            
            const fontOptions = document.querySelectorAll('.font-option');
            fontOptions.forEach(option => {
                option.addEventListener('click', function() {
                    fontOptions.forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                    
                    if (this.getAttribute('data-font') === 'custom-url') {
                        document.getElementById('customFontUrl').focus();
                    }
                });
            });
            
            const customUrlInput = document.getElementById('customFontUrl');
            if (customUrlInput) {
                customUrlInput.addEventListener('input', function() {
                    const preview = document.getElementById('customFontPreview');
                    preview.textContent = this.value ? '自定義字體預覽' : '預覽文字';
                });
            }
            
            const localFontFile = document.getElementById('localFontFile');
            const selectedFileName = document.getElementById('selectedFileName');
            
            if (localFontFile) {
                localFontFile.addEventListener('change', function() {
                    if (this.files && this.files[0]) {
                        const file = this.files[0];
                        selectedFileName.textContent = `已選擇: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                        previewLocalFont(file);
                    } else {
                        selectedFileName.textContent = '';
                    }
                });
            }
            
            document.getElementById('applyFontBtn').addEventListener('click', applySelectedFont);
        }
        
        function previewLocalFont(file) {
            const validTypes = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/vnd.ms-fontobject', 'application/x-font-ttf', 'application/x-font-otf'];
            const fileType = file.type;
            
            if (!validTypes.some(type => fileType.includes(type.replace('font/', ''))) && 
                !file.name.match(/\.(ttf|otf|woff|woff2|eot)$/i)) {
                updateStatus('不支持的字體文件格式', 'error');
                return;
            }
            
            const fontName = 'LocalPreviewFont-' + Date.now();
            const fontFace = new FontFace(fontName, `url(${URL.createObjectURL(file)})`);
            
            fontFace.load().then(loadedFont => {
                document.fonts.add(loadedFont);
                const preview = document.getElementById('localFontPreview');
                preview.style.fontFamily = `${fontName}, serif`;
                preview.textContent = `本地字體預覽: 天地日月山水木金火土`;
                
                const oldFonts = document.fonts.values();
                for (const font of oldFonts) {
                    if (font.family.startsWith('LocalPreviewFont-') && font.family !== fontName) {
                        document.fonts.delete(font);
                    }
                }
            }).catch(error => {
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
            const activeTab = document.querySelector('.font-tab-btn.active').getAttribute('data-tab');
            
            if (activeTab === 'cloud') {
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
                    
                    const fontName = 'CustomFont-' + Date.now();
                    await FontManager.loadCloudFont('custom', customUrl, fontName);
                    
                } else {
                    const fontUrl = selectedOption.getAttribute('data-url');
                    const fontName = fontId === 'Huiwen' ? 'Huiwen' :
                                   fontId === 'noto-serif' ? 'Noto Serif SC' :
                                   fontId === 'MiSans' ? 'MiSans_L3' : fontId;
                    
                    await FontManager.loadCloudFont(fontId, fontUrl, fontName);
                }
                
            } else if (activeTab === 'local') {
                const fileInput = document.getElementById('localFontFile');
                if (!fileInput.files || !fileInput.files[0]) {
                    updateStatus('請選擇一個字體文件', 'warning');
                    return;
                }
                
                const file = fileInput.files[0];
                const fontName = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, "");
                await FontManager.loadLocalFont(file, fontName);
                
            } else if (activeTab === 'system') {
                FontManager.applySystemFont(fontId);
            }
            
            closeFontSettings();
            performConversion();
        }
        
        function openFontSettings() {
            document.getElementById('fontSettingsPanel').style.display = 'block';
            document.getElementById('fontOverlay').style.display = 'block';
            updateStatus('字體設置面板已打開', 'good');
        }
        
        function closeFontSettings() {
            document.getElementById('fontSettingsPanel').style.display = 'none';
            document.getElementById('fontOverlay').style.display = 'none';
            updateStatus('字體設置面板已關閉', 'good');
        }
        
        // ========== 事件處理函數 ==========
        
        function performConversion() {
            const inputText = document.getElementById('inputText').value;
            
            if (!inputText.trim()) {
                updateStatus('請輸入要轉換的文字', 'warning');
                return;
            }
            
            const { result, stats } = convertToSealKai(inputText);
            const output = document.getElementById('outputText');
            output.innerHTML = formatConversionResult(inputText, result, stats);
            
            updateStatus(`轉換完成: ${stats.converted}/${stats.total} 個字符被轉換`, 'good');
            updateStatsDisplay();
            
            if (AppState.settings.autoCopy && result) {
                copyToClipboard(result);
            }
        }
        
        function testFontDisplay() {
            const output = document.getElementById('outputText');
            output.innerHTML = `
                <h3>字體顯示測試</h3>
                <p>當前字體: ${FontManager.currentFont ? FontManager.currentFont.name : '系統默認'}</p>
                <div class="font-test-area">
                    <p>常用漢字測試:</p>
                    <div class="font-test-text" style="font-size: 1.3em;">天地日月山水木金火土</div>
                    <p>篆書楷化字測試:</p>
                    <div class="font-test-text" style="font-size: 1.3em;">𠀘𡍑𡆠𡴑𡴸𣱱𤆄𣎳𨤾𡈽</div>
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
            const inputText = document.getElementById('inputText').value || '無輸入';
            let debugInfo = `<h3>系統調試信息</h3>`;
            debugInfo += `<p>當前時間: ${new Date().toLocaleString()}</p>`;
            debugInfo += `<p>映射表大小: ${Object.keys(SealMapping).length}</p>`;
            debugInfo += `<p>轉換統計: 成功 ${AppState.conversionStats.success}, 總次數 ${AppState.conversionStats.total}</p>`;
            debugInfo += `<p>當前輸入: "${inputText}" (長度: ${inputText.length})</p>`;
            
            const testChars = ['天', '地', '日', '月', '漢', '書', '樂'];
            debugInfo += `<p>關鍵字測試:</p>`;
            
            testChars.forEach(char => {
                const converted = SealMapping[char] || '無映射';
                debugInfo += `<div class="comparison">
                    <span class="original-char">${char}</span>
                    <span class="arrow">→</span>
                    <span class="converted-char">${converted}</span>
                    <small>${converted === char ? '(未變)' : '(已轉換)'}</small>
                </div>`;
            });
            
            document.getElementById('outputText').innerHTML = debugInfo;
            updateStatus('調試信息已顯示', 'good');
        }
        
        function copyToClipboard(text) {
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
        
        // ========== 初始化與事件綁定 ==========
        
        function initializeEventListeners() {
            // 转换相关按钮
            document.getElementById('convertBtn').addEventListener('click', performConversion);
            document.getElementById('sampleBtn').addEventListener('click', () => {
                document.getElementById('inputText').value = '天地日月山水木金火土人心中一二三四';
                updateStatus('示例文字已加载', 'good');
                if (AppState.settings.autoConvert) performConversion();
            });
            document.getElementById('clearBtn').addEventListener('click', () => {
                document.getElementById('inputText').value = '';
                document.getElementById('outputText').innerHTML = `
                    <p>轉換結果將在此處以豎排古籍樣式呈現。</p>
                    <div class="comparison">
                        <span class="original-char">天</span>
                        <span class="arrow">→</span>
                        <span class="converted-char seal-char">𠀘</span>
                    </div>
                    <div class="comparison">
                        <span class="original-char">地</span>
                        <span class="arrow">→</span>
                        <span class="converted-char seal-char">𡍑</span>
                    </div>
                    <div class="comparison">
                        <span class="original-char">日</span>
                        <span class="arrow">→</span>
                        <span class="converted-char seal-char">𡆠</span>
                    </div>
                    <p>請在左側輸入繁體字進行轉換。</p>
                `;
                updateStatus('已清空輸入和輸出', 'good');
            });
            
            // 输出相关按钮
            document.getElementById('copyBtn').addEventListener('click', () => {
                const outputText = document.getElementById('outputText').textContent;
                if (outputText && !outputText.includes('轉換結果將在此處以豎排古籍樣式呈現。')) {
                    copyToClipboard(outputText);
                } else {
                    updateStatus('沒有可複製的內容', 'warning');
                }
            });
            document.getElementById('saveBtn').addEventListener('click', () => {
                const outputText = document.getElementById('outputText').textContent;
                if (outputText && !outputText.includes('轉換結果將在此處以豎排古籍樣式呈現。')) {
                    exportData(outputText, `篆楷轉換_${new Date().toISOString().slice(0,10)}.txt`);
                    updateStatus('結果已保存為文本文件', 'good');
                } else {
                    updateStatus('沒有可保存的內容', 'warning');
                }
            });
            document.getElementById('fontTestBtn').addEventListener('click', testFontDisplay);
            document.getElementById('debugBtn').addEventListener('click', showDebugInfo);
            
            // 面板控制按钮
            document.getElementById('togglePanelBtn').addEventListener('click', () => {
                const panel = document.getElementById('conversionPanel');
                const overlay = document.getElementById('iframeOverlay');
                const closeBtn = document.getElementById('closePanelBtn');
                
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'block' : 'none';
                overlay.style.display = isHidden ? 'block' : 'none';
                closeBtn.style.display = isHidden ? 'flex' : 'none';
                updateStatus(isHidden ? '簡繁轉換工具已打開' : '簡繁轉換工具已關閉', 'good');
            });
            document.getElementById('fontSettingsBtn').addEventListener('click', openFontSettings);
            document.getElementById('closeFontBtn').addEventListener('click', closeFontSettings);
            document.getElementById('fontOverlay').addEventListener('click', closeFontSettings);
            
            // 数据管理按钮
            document.getElementById('importBtn').addEventListener('click', () => {
                const url = prompt('請輸入映射數據的URL（JSON格式）:', 'https://raw.githubusercontent.com/dynnbw/Chinese-to-Classical-Chinese-Regular-Script/refs/heads/main/%E8%BD%AC%E6%8D%A2.json');
                if (url) importMappingData(url);
            });
            document.getElementById('exportBtn').addEventListener('click', () => {
                const inputText = document.getElementById('inputText').value;
                if (inputText) {
                    const { result } = convertToSealKai(inputText);
                    exportData(`${inputText}\n↓\n${result}`, `篆楷轉換結果_${new Date().toISOString().slice(0,10)}.txt`);
                    updateStatus('轉換結果已導出', 'good');
                } else {
                    updateStatus('請先輸入文字進行轉換', 'warning');
                }
            });
            document.getElementById('viewMappingBtn').addEventListener('click', viewCurrentMapping);
            
            // 关闭iframe控制
            document.getElementById('closePanelBtn').addEventListener('click', () => {
                document.getElementById('conversionPanel').style.display = 'none';
                document.getElementById('iframeOverlay').style.display = 'none';
                document.getElementById('closePanelBtn').style.display = 'none';
                updateStatus('簡繁轉換工具已關閉', 'good');
            });
            document.getElementById('iframeOverlay').addEventListener('click', () => {
                document.getElementById('conversionPanel').style.display = 'none';
                document.getElementById('iframeOverlay').style.display = 'none';
                document.getElementById('closePanelBtn').style.display = 'none';
                updateStatus('簡繁轉換工具已關閉', 'good');
            });
            
            // 设置选项
            document.getElementById('autoConvert').addEventListener('change', function() {
                AppState.settings.autoConvert = this.checked;
                updateStatus(this.checked ? '已啟用實時轉換' : '已禁用實時轉換', 'good');
                if (this.checked && document.getElementById('inputText').value.trim()) {
                    performConversion();
                }
            });
            document.getElementById('showCharCodes').addEventListener('change', function() {
                AppState.settings.showCharCodes = this.checked;
                updateStatus(this.checked ? '已啟用碼點顯示' : '已禁用碼點顯示', 'good');
                const inputText = document.getElementById('inputText').value;
                if (inputText) {
                    const { result, stats } = convertToSealKai(inputText);
                    document.getElementById('outputText').innerHTML = formatConversionResult(inputText, result, stats);
                }
            });
            document.getElementById('autoCopy').addEventListener('change', function() {
                AppState.settings.autoCopy = this.checked;
                updateStatus(this.checked ? '已啟用自動複製' : '已禁用自動複製', 'good');
            });
            
            // 实时转换
            document.getElementById('inputText').addEventListener('input', function() {
                if (AppState.settings.autoConvert && this.value.trim()) {
                    performConversion();
                }
            });
        }
        
        function initializeApp() {
            console.log('古籍篆楷轉換工具初始化...');
            
            FontManager.init();
            initializeEventListeners();
            initializeFontSettings();
            updateStatsDisplay();
            
            document.getElementById('autoConvert').checked = AppState.settings.autoConvert;
            document.getElementById('showCharCodes').checked = AppState.settings.showCharCodes;
            document.getElementById('autoCopy').checked = AppState.settings.autoCopy;
            
            updateStatus('系統就緒，已修復生僻字顯示問題', 'good');
            
            setTimeout(() => {
                performConversion();
            }, 100);
            
            console.log('應用初始化完成');
        }
        
        window.addEventListener('DOMContentLoaded', initializeApp);
