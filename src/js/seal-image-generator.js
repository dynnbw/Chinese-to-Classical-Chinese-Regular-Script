// ========== 篆书图片生成器 ==========

(function() {
    'use strict';
    
    // ========== 状态管理 ==========
    const AppState = {
        currentText: '天地日月山水木金火土 𠀘𡍑𡆠𡴑𡴸',
        generatedImageData: null,
        isGenerating: false
    };
    
    // ========== DOM元素 ==========
    const elements = {
        // 文本输入
        textInput: document.getElementById('textInput'),
        clearBtn: document.getElementById('clearBtn'),
        sampleBtn: document.getElementById('sampleBtn'),
        
        // 字体设置
        fontTabBtns: document.querySelectorAll('.font-tab-btn'),
        fontTabs: {
            cloud: document.getElementById('cloud-tab'),
            local: document.getElementById('local-tab'),
            system: document.getElementById('system-tab')
        },
        fontOptions: document.querySelectorAll('.font-option'),
        localFontFile: document.getElementById('localFontFile'),
        selectedFileName: document.getElementById('selectedFileName'),
        applyFontBtn: document.getElementById('applyFontBtn'),
        
        // 布局设置
        fontSize: document.getElementById('fontSize'),
        lineHeight: document.getElementById('lineHeight'),
        marginSize: document.getElementById('marginSize'),
        showGrid: document.getElementById('showGrid'),
        paperTexture: document.getElementById('paperTexture'),
        bgColor: document.getElementById('bgColor'),
        textColor: document.getElementById('textColor'),
        sealColor: document.getElementById('sealColor'),
        layoutRadios: document.querySelectorAll('input[name="layout"]'),
        
        // 图片操作
        imageCanvas: document.getElementById('imageCanvas'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        generateBtn: document.getElementById('generateBtn'),
        downloadPngBtn: document.getElementById('downloadPngBtn'),
        downloadJpgBtn: document.getElementById('downloadJpgBtn'),
        copyImageBtn: document.getElementById('copyImageBtn'),
        
        // 状态栏
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText')
    };
    
    // ========== 工具函数 ==========
    
    // 检测是否为移动设备
    function isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768;
    }
    
    // 判断字符是否为扩展汉字（篆书）
    function isSealCharacter(char) {
        if (!char || char.length === 0) return false;
        
        try {
            const code = char.codePointAt(0);
            // 扩展汉字区范围
            return (code >= 0x20000 && code <= 0x2A6DF) ||  // 扩展B区
                   (code >= 0x2A700 && code <= 0x2B73F) ||  // 扩展C区
                   (code >= 0x2B740 && code <= 0x2B81F) ||  // 扩展D区
                   (code >= 0x2B820 && code <= 0x2CEAF);    // 扩展E区
        } catch (e) {
            return false;
        }
    }
    
    // 安全分割字符串，正确处理代理对
    function safeStringSplit(str) {
        const chars = [];
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
                const nextCode = str.charCodeAt(i + 1);
                if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                    chars.push(str.substring(i, i + 2));
                    i++;
                    continue;
                }
            }
            
            chars.push(str.charAt(i));
        }
        return chars;
    }
    
    // 更新状态
    function updateStatus(message, type = 'info') {
        if (elements.statusText) {
            elements.statusText.textContent = message;
        }
        
        if (elements.statusIndicator) {
            elements.statusIndicator.className = 'status-indicator';
            if (type === 'success') {
                elements.statusIndicator.style.backgroundColor = '#4CAF50';
            } else if (type === 'warning') {
                elements.statusIndicator.style.backgroundColor = '#FFC107';
            } else if (type === 'error') {
                elements.statusIndicator.style.backgroundColor = '#F44336';
            } else {
                elements.statusIndicator.style.backgroundColor = '#2196F3';
            }
        }
    }
    
    // 显示/隐藏加载动画
    function showLoading(show) {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        AppState.isGenerating = show;
    }
    
    // ========== 字体管理 (使用FontManager) ==========
    
    // 初始化字体选项卡
    function initFontTabs() {
        if (!elements.fontTabBtns || elements.fontTabBtns.length === 0) return;
        
        elements.fontTabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // 移除所有活动状态
                elements.fontTabBtns.forEach(b => b.classList.remove('active'));
                Object.values(elements.fontTabs).forEach(tab => {
                    if (tab) tab.classList.remove('active');
                });
                
                // 设置当前活动状态
                this.classList.add('active');
                const tabId = this.dataset.tab;
                if (elements.fontTabs[tabId]) {
                    elements.fontTabs[tabId].classList.add('active');
                }
                
                updateStatus(`切換到${this.textContent}選項卡`, 'info');
            });
        });
    }
    
    // 初始化字体选项
    function initFontOptions() {
        if (!elements.fontOptions || elements.fontOptions.length === 0) return;
        
        elements.fontOptions.forEach(option => {
            option.addEventListener('click', function() {
                // 移除所有选中状态
                elements.fontOptions.forEach(opt => opt.classList.remove('selected'));
                
                // 设置当前选中状态
                this.classList.add('selected');
            });
        });
        
        // 本地字体文件选择监听
        if (elements.localFontFile) {
            elements.localFontFile.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    const file = this.files[0];
                    if (elements.selectedFileName) {
                        elements.selectedFileName.textContent = `已選擇: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                    }
                    // 预览本地字体
                    previewLocalFont(file);
                } else {
                    if (elements.selectedFileName) {
                        elements.selectedFileName.textContent = '未選擇文件';
                    }
                }
            });
        }
    }
    
    // 预览本地字体
    function previewLocalFont(file) {
        // 使用FontManager中的预览逻辑
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
            updateStatus('本地字體預覽加載成功', 'success');
            
            // 释放预览字体资源（延迟释放）
            setTimeout(() => {
                try {
                    URL.revokeObjectURL(objectURL);
                    document.fonts.delete(loadedFont);
                } catch (e) {
                    console.warn('清理预览字体资源失败:', e);
                }
            }, 5000);
            
        }).catch(error => {
            try {
                URL.revokeObjectURL(objectURL);
            } catch (e) {
                // 忽略错误
            }
            updateStatus(`字體預覽失敗: ${error.message}`, 'error');
        });
    }
    
    // 应用字体
    async function applyFont() {
        const selectedOption = document.querySelector('.font-option.selected');
        if (!selectedOption) {
            updateStatus('請選擇一個字體', 'warning');
            return;
        }
        
        const activeTab = document.querySelector('.font-tab-btn.active');
        if (!activeTab) {
            updateStatus('無法確定當前選項卡', 'error');
            return;
        }
        
        const activeTabId = activeTab.dataset.tab;
        
        try {
            showLoading(true);
            
            if (activeTabId === 'cloud') {
                await applyCloudFont(selectedOption);
            } else if (activeTabId === 'local') {
                await applyLocalFont();
            } else if (activeTabId === 'system') {
                applySystemFont(selectedOption);
            }
            
            updateStatus(`已應用字體: ${FontManager.currentFont.name}`, 'success');
            
            // 重新生成图片
            setTimeout(generateImage, 100);
            
        } catch (error) {
            updateStatus(`字體應用失敗: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // 应用云端字体
    async function applyCloudFont(option) {
        const fontId = option.dataset.font;
        const fontUrl = option.dataset.url;
        const fontName = option.querySelector('.font-name').textContent;
        
        if (!fontUrl) {
            throw new Error('字體URL無效');
        }
        
        // 使用FontManager加载云端字体
        await FontManager.loadCloudFont(fontId, fontUrl, fontName, updateStatus);
    }
    
    // 应用本地字体
    async function applyLocalFont() {
        if (!elements.localFontFile || !elements.localFontFile.files || !elements.localFontFile.files[0]) {
            throw new Error('請選擇一個字體文件');
        }
        
        const file = elements.localFontFile.files[0];
        const fontName = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, "");
        
        // 使用FontManager加载本地字体
        await FontManager.loadLocalFont(file, fontName, updateStatus);
    }
    
    // 应用系统字体
    function applySystemFont(option) {
        const fontId = option.dataset.font;
        
        // 使用FontManager应用系统字体
        FontManager.applySystemFont(fontId, updateStatus);
    }
    
    // ========== 图片生成功能 ==========
    
    // 生成图片
    async function generateImage() {
        if (AppState.isGenerating) {
            updateStatus('正在生成圖片，請稍候...', 'warning');
            return;
        }
        
        const text = elements.textInput ? elements.textInput.value.trim() : AppState.currentText;
        if (!text) {
            updateStatus('請輸入文字', 'warning');
            return;
        }
        
        showLoading(true);
        updateStatus('正在生成圖片...', 'info');
        
        try {
            // 等待字体加载完成
            await document.fonts.ready;
            
            const canvas = elements.imageCanvas;
            if (!canvas) {
                throw new Error('找不到畫布元素');
            }
            
            const ctx = canvas.getContext('2d');
            
            // 获取设置
            const fontSize = elements.fontSize ? parseInt(elements.fontSize.value) : 36;
            const lineHeightRatio = elements.lineHeight ? parseFloat(elements.lineHeight.value) : 1.8;
            const margin = elements.marginSize ? parseInt(elements.marginSize.value) : 40;
            const showGrid = elements.showGrid ? elements.showGrid.checked : true;
            const paperTexture = elements.paperTexture ? elements.paperTexture.checked : false;
            const bgColor = elements.bgColor ? elements.bgColor.value : '#fefaf0';
            const textColor = elements.textColor ? elements.textColor.value : '#3c2f23';
            const sealColor = elements.sealColor ? elements.sealColor.value : '#8B4513';
            
            // 获取布局设置
            let layout = 'vertical';
            if (elements.layoutRadios && elements.layoutRadios.length > 0) {
                const selectedLayout = document.querySelector('input[name="layout"]:checked');
                if (selectedLayout) {
                    layout = selectedLayout.value;
                }
            }
            
            // 使用FontManager获取当前字体
            const fontFamily = FontManager.currentFont ? 
                `${FontManager.currentFont.family}, "Microsoft YaHei", "SimSun", serif` :
                '"Microsoft YaHei", "SimSun", serif';
            
            const lineHeight = fontSize * lineHeightRatio;
            const isVertical = layout === 'vertical';
            const isMobile = isMobileDevice();
            
            // 安全分割文本
            const chars = safeStringSplit(text);
            
            if (isVertical) {
                // 竖排布局 - 从右到左，从上到下
                
                // 计算每列字符数
                const charsPerColumn = Math.max(1, Math.floor((500 - margin * 2) / lineHeight));
                const totalColumns = Math.max(1, Math.ceil(chars.length / charsPerColumn));
                
                // 计算画布尺寸
                const columnWidth = fontSize + 40;
                const canvasWidth = Math.max(totalColumns * columnWidth + margin * 2, 600);
                const canvasHeight = Math.max(charsPerColumn * lineHeight + margin * 2, 400);
                
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // 绘制背景
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 绘制纸张纹理
                if (paperTexture) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
                    ctx.filter = 'url(#noise-filter-1)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.filter = 'none';
                }
                
                // 绘制网格
                if (showGrid) {
                    ctx.strokeStyle = 'rgba(224, 214, 194, 0.3)';
                    ctx.lineWidth = 1;
                    
                    // 竖线（从右到左）
                    for (let i = 0; i <= totalColumns; i++) {
                        const x = canvas.width - margin - i * columnWidth;
                        ctx.beginPath();
                        ctx.moveTo(x, margin);
                        ctx.lineTo(x, canvas.height - margin);
                        ctx.stroke();
                    }
                    
                    // 横线
                    for (let i = 0; i <= charsPerColumn; i++) {
                        const y = margin + i * lineHeight;
                        ctx.beginPath();
                        ctx.moveTo(canvas.width - margin - totalColumns * columnWidth, y);
                        ctx.lineTo(canvas.width - margin, y);
                        ctx.stroke();
                    }
                }
                
                // 设置字体
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // 绘制文字 - 从右到左，从上到下
                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];
                    
                    // 计算列和行
                    const column = Math.floor(i / charsPerColumn);
                    const row = i % charsPerColumn;
                    
                    // x坐标：从右边开始
                    const x = canvas.width - margin - column * columnWidth - fontSize / 2;
                    // y坐标：从上边开始
                    const y = margin + row * lineHeight + lineHeight / 2;
                    
                    // 设置颜色
                    ctx.fillStyle = isSealCharacter(char) ? sealColor : textColor;
                    
                    // 根据设备类型调整文字方向
                    if (isMobile) {
                        // 手机端：竖排文字需要旋转90度
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.fillText(char, 0, 0);
                        ctx.restore();
                    } else {
                        // 电脑端：竖排文字旋转90度
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(Math.PI / 2);
                        ctx.fillText(char, 0, 0);
                        ctx.restore();
                    }
                }
            } else {
                // 横排布局
                const maxWidth = 800 - margin * 2;
                
                // 设置字体以计算宽度
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                
                // 计算换行
                let lines = [];
                let currentLine = '';
                let currentWidth = 0;
                
                for (const char of chars) {
                    const charWidth = ctx.measureText(char).width;
                    if (currentWidth + charWidth > maxWidth && currentLine !== '') {
                        lines.push(currentLine);
                        currentLine = char;
                        currentWidth = charWidth;
                    } else {
                        currentLine += char;
                        currentWidth += charWidth;
                    }
                }
                if (currentLine) lines.push(currentLine);
                
                // 计算画布尺寸
                const canvasWidth = Math.min(maxWidth + margin * 2, 1200);
                const canvasHeight = lines.length * lineHeight + margin * 2;
                
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // 绘制背景
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 绘制纸张纹理
                if (paperTexture) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
                    ctx.filter = 'url(#noise-filter-1)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.filter = 'none';
                }
                
                // 重新设置字体
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                // 绘制每一行
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const y = margin + i * lineHeight + lineHeight / 2;
                    let x = margin;
                    
                    // 绘制每个字符
                    for (const char of safeStringSplit(line)) {
                        ctx.fillStyle = isSealCharacter(char) ? sealColor : textColor;
                        
                        // 横排布局下，根据设备类型调整文字方向
                        if (isMobile) {
                            // 手机端：横排文字正常绘制
                            ctx.fillText(char, x, y);
                        } else {
                            // 电脑端：横排文字正常绘制（不旋转）
                            ctx.fillText(char, x, y);
                        }
                        
                        x += ctx.measureText(char).width;
                    }
                }
            }
            
            // 保存图片数据
            AppState.generatedImageData = canvas.toDataURL('image/png');
            
            updateStatus('圖片生成完成', 'success');
            
        } catch (error) {
            console.error('生成图片失败:', error);
            updateStatus(`圖片生成失敗: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // 下载PNG图片
    function downloadPng() {
        if (!AppState.generatedImageData) {
            updateStatus('請先生成圖片', 'warning');
            return;
        }
        
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
        link.href = AppState.generatedImageData;
        link.download = `篆書圖片_${timestamp}.png`;
        link.click();
        
        updateStatus('PNG圖片已下載', 'success');
    }
    
    // 下载JPG图片
    function downloadJpg() {
        if (!AppState.generatedImageData) {
            updateStatus('請先生成圖片', 'warning');
            return;
        }
        
        const canvas = elements.imageCanvas;
        if (!canvas) {
            updateStatus('找不到畫布元素', 'error');
            return;
        }
        
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
        
        // 转换为JPG格式
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        link.href = jpgDataUrl;
        link.download = `篆書圖片_${timestamp}.jpg`;
        link.click();
        
        updateStatus('JPG圖片已下載', 'success');
    }
    
    // 复制图片到剪贴板
    async function copyImage() {
        if (!AppState.generatedImageData) {
            updateStatus('請先生成圖片', 'warning');
            return;
        }
        
        const canvas = elements.imageCanvas;
        if (!canvas) {
            updateStatus('找不到畫布元素', 'error');
            return;
        }
        
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
            updateStatus('圖片已複製到剪貼板', 'success');
        } catch (error) {
            updateStatus(`複製失敗: ${error.message}`, 'error');
        }
    }
    
    // ========== 其他功能 ==========
    
    // 从URL参数加载文字
    function loadTextFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const textParam = urlParams.get('text');
        
        if (textParam && elements.textInput) {
            try {
                // 解码URL参数
                let decodedText = decodeURIComponent(textParam);
                
                // 清理可能的编码问题
                decodedText = decodedText.replace(/\+/g, ' ');
                decodedText = decodedText.replace(/%20/g, ' ');
                
                // 过滤掉统计信息和说明文字
                const patterns = [
                    '轉換完成:',
                    '個字符被轉換',
                    '轉換結果',
                    '請在左側輸入',
                    '繁體字.*篆書楷化字',
                    '篆書楷化字.*繁體字',
                    '→'
                ];
                
                patterns.forEach(pattern => {
                    const regex = new RegExp(pattern, 'g');
                    decodedText = decodedText.replace(regex, '');
                });
                
                // 移除数字和特殊符号，保留中文字符和扩展字符
                const cleanedText = decodedText.replace(/[^\u4e00-\u9fa5\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\s]/g, '');
                
                if (cleanedText.trim()) {
                    elements.textInput.value = cleanedText.trim();
                    AppState.currentText = cleanedText.trim();
                    updateStatus(`從URL參數加載了 ${cleanedText.length} 個字符`, 'success');
                    
                    // 自动生成图片
                    setTimeout(generateImage, 500);
                }
                
            } catch (e) {
                console.error('URL參數解碼失敗:', e);
            }
        }
    }
    
    // 检测设备并设置布局
    function detectDeviceAndSetLayout() {
        const isMobile = isMobileDevice();
        const layoutRadios = document.querySelectorAll('input[name="layout"]');
        
        if (isMobile && layoutRadios.length > 0) {
            // 手机端：强制横排布局
            layoutRadios.forEach(radio => {
                if (radio.value === 'horizontal') {
                    radio.checked = true;
                }
            });
            updateStatus('手機端已自動切換為橫排佈局', 'info');
        } else if (layoutRadios.length > 0) {
            // 桌面端：默认竖排布局
            layoutRadios.forEach(radio => {
                if (radio.value === 'vertical') {
                    radio.checked = true;
                }
            });
            updateStatus('桌面端已自動切換為豎排佈局', 'info');
        }
    }
    
    // 防抖函数
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
    
    // ========== 初始化事件监听器 ==========
    
    function initEventListeners() {
        // 文本输入相关
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', () => {
                if (elements.textInput) {
                    elements.textInput.value = '';
                }
                updateStatus('已清空輸入', 'info');
            });
        }
        
        if (elements.sampleBtn) {
            elements.sampleBtn.addEventListener('click', () => {
                if (elements.textInput) {
                    elements.textInput.value = '天地日月山水木金火土 𠀘𡍑𡆠𡴑𡴸\n人心中一二三四五六七八九十\n篆書楷化字展示示例';
                }
                updateStatus('已加載示例文字', 'info');
                setTimeout(generateImage, 100);
            });
        }
        
        // 应用字体
        if (elements.applyFontBtn) {
            elements.applyFontBtn.addEventListener('click', applyFont);
        }
        
        // 图片生成相关
        if (elements.generateBtn) {
            elements.generateBtn.addEventListener('click', generateImage);
        }
        
        if (elements.downloadPngBtn) {
            elements.downloadPngBtn.addEventListener('click', downloadPng);
        }
        
        if (elements.downloadJpgBtn) {
            elements.downloadJpgBtn.addEventListener('click', downloadJpg);
        }
        
        if (elements.copyImageBtn) {
            elements.copyImageBtn.addEventListener('click', copyImage);
        }
        
        // 图片选项变化时重新生成
        const optionInputs = [
            elements.fontSize,
            elements.lineHeight,
            elements.marginSize,
            elements.showGrid,
            elements.paperTexture,
            elements.bgColor,
            elements.textColor,
            elements.sealColor
        ];
        
        optionInputs.forEach(input => {
            if (input) {
                input.addEventListener('change', generateImage);
            }
        });
        
        if (elements.layoutRadios && elements.layoutRadios.length > 0) {
            elements.layoutRadios.forEach(radio => {
                radio.addEventListener('change', generateImage);
            });
        }
        
        // 从URL参数加载文字
        loadTextFromUrl();
        
        // 实时生成图片（防抖）
        let generateTimeout;
        if (elements.textInput) {
            elements.textInput.addEventListener('input', () => {
                clearTimeout(generateTimeout);
                generateTimeout = setTimeout(() => {
                    AppState.currentText = elements.textInput.value;
                    if (AppState.currentText.trim()) {
                        generateImage();
                    }
                }, 500);
            });
        }
        
        // 窗口大小变化时重新检测布局
        window.addEventListener('resize', debounce(() => {
            detectDeviceAndSetLayout();
            generateImage();
        }, 300));
    }
    
    // ========== 初始化应用 ==========
    
    function init() {
        console.log('篆書圖片生成器初始化...');
        
        // 初始化FontManager
        if (window.FontManager) {
            FontManager.init();
        }
        
        // 检测设备并设置默认布局
        detectDeviceAndSetLayout();
        
        // 初始化字体相关
        initFontTabs();
        initFontOptions();
        
        // 初始化事件监听器
        initEventListeners();
        
        // 初始生成图片
        setTimeout(generateImage, 1000);
        
        updateStatus('圖片生成器就緒', 'success');
    }
    
    // ========== 页面加载时初始化 ==========
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();