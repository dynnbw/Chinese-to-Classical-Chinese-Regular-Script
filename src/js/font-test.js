// ========== Font Test Refactor ==========

const FONT_CONFIG = {
    "HuiWenFangSong": {
        name: "汇文仿宋",
        family: "HuiWenFangSong",
        type: "cloud",
        url: "./fonts/HuiWenFangSong.ttf"
    },
    "noto-serif": {
        name: "Unicode17_CJK",
        family: "Unicode17_CJK",
        type: "cloud",
        url: "./fonts/Unicode17_CJK_0.ttf"
    },
    "LaoSongTi": {
        name: "老宋体",
        family: "LaoSongTi",
        type: "cloud",
        url: "./fonts/LaoSongTi.ttf"
    },
    "system-default": {
        name: "系統默認",
        family: "inherit",
        type: "system"
    },
    "system-serif": {
        name: "襯線 (Serif)",
        family: "serif",
        type: "system"
    }
};

const App = {
    currentFont: null,
    categories: [],
    rangeStart: 0x0000,
    rangeEnd: 0x10FFFF,
    totalCount: 0,
    itemHeight: 140,
    cols: 16,
    bufferRows: 3,
    scrollBound: false
};

const INIT_FONT_TIMEOUT_MS = 2500;

function getDefaultFontState() {
    return {
        id: "system-default",
        name: "系統默認",
        family: "inherit",
        type: "system"
    };
}

async function initializeFontTest() {
    if (!App.currentFont) {
        App.currentFont = getDefaultFontState();
    }

    renderFontButtons();
    initRangeSelect();
    bindEvents();

    const preferred = localStorage.getItem("font-test-last-range") || "4E00-9FFF";
    const select = document.getElementById("rangeSelect");
    if (select && hasOptionValue(select, preferred)) {
        select.value = preferred;
    }

    setRange((select && select.value) || preferred);

    // Do not block UI rendering on remote font loading.
    initFont().then(() => {
        renderFontButtons();
        renderViewport();
        ensureUiFallback();
        updateStatus("系統就緒", "good");
    }).catch((e) => {
        console.warn("字體初始化失敗，使用回退配置:", e);
        ensureUiFallback();
        updateStatus("字體初始化失敗，已使用回退配置", "warning");
    });

    ensureUiFallback();
}

function hasOptionValue(selectEl, value) {
    return Array.from(selectEl.options).some((opt) => opt.value === value);
}

async function initFont() {
    try {
        const saved = localStorage.getItem("seal-converter-font");
        if (saved) {
            App.currentFont = JSON.parse(saved);
        }
    } catch (e) {
        console.warn("讀取字體配置失敗:", e);
    }

    if (!App.currentFont) {
        App.currentFont = getDefaultFontState();
    }

    if (FONT_CONFIG[App.currentFont.id]) {
        await Promise.race([
            applyFontById(App.currentFont.id, true),
            new Promise((resolve) => setTimeout(resolve, INIT_FONT_TIMEOUT_MS))
        ]);
    } else {
        applyFontStyle(App.currentFont.family);
    }
}

function ensureUiFallback() {
    const fontSelector = document.getElementById("fontSelector");
    if (fontSelector && !fontSelector.children.length) {
        renderFontButtons();
    }

    const rangeSelect = document.getElementById("rangeSelect");
    if (rangeSelect && !rangeSelect.options.length) {
        initRangeSelect();
    }

    if (App.totalCount <= 0 && rangeSelect && rangeSelect.value) {
        setRange(rangeSelect.value);
    }
}

function renderFontButtons() {
    const container = document.getElementById("fontSelector");
    if (!container) return;

    container.innerHTML = "";
    Object.entries(FONT_CONFIG).forEach(([fontId, cfg]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "font-btn";
        btn.dataset.fontId = fontId;
        btn.textContent = cfg.name;
        if (App.currentFont && App.currentFont.id === fontId) {
            btn.classList.add("active");
        }

        btn.addEventListener("click", async () => {
            setFontButtonActive(fontId);
            await applyFontById(fontId, false);
        });

        container.appendChild(btn);
    });
}

function setFontButtonActive(fontId) {
    document.querySelectorAll(".font-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.fontId === fontId);
    });
}

function initRangeSelect() {
    const select = document.getElementById("rangeSelect");
    if (!select) return;

    const categories = Array.isArray(window.UNICODE_CATEGORIES) ? window.UNICODE_CATEGORIES : [];
    const sortedCategories = [...categories].sort((a, b) => {
        const aStart = parseInt(a.start, 16);
        const bStart = parseInt(b.start, 16);
        return aStart - bStart;
    });
    App.categories = sortedCategories;

    if (!sortedCategories.length) {
        select.innerHTML = '<option value="0000-10FFFF">完整 Unicode (U+0000-U+10FFFF)</option>';
        updateStatus("分類數據未加載，使用完整範圍", "warning");
        return;
    }

    select.innerHTML = "";
    sortedCategories.forEach((entry) => {
        const opt = document.createElement("option");
        opt.value = entry.value;
        opt.textContent = `${entry.name} (U+${entry.start}-U+${entry.end})`;
        select.appendChild(opt);
    });

    updateStatus(`已加載 ${sortedCategories.length} 個 Unicode 區段（按碼點排序，未分組）`, "good");
}

function bindEvents() {
    const select = document.getElementById("rangeSelect");
    if (select) {
        select.addEventListener("change", (e) => {
            const value = e.target.value;
            try {
                localStorage.setItem("font-test-last-range", value);
            } catch (err) {
                console.warn("保存範圍設置失敗:", err);
            }
            setRange(value);
        });
    }

    if (!App.scrollBound) {
        const scroller = document.querySelector(".main-container");
        if (scroller) {
            scroller.addEventListener("scroll", renderViewport, { passive: true });
            window.addEventListener("resize", handleResize, { passive: true });
            App.scrollBound = true;
        }
    }
}

function handleResize() {
    const scroller = document.querySelector(".main-container");
    const grid = document.getElementById("unicodeGrid");
    if (!scroller || !grid) return;

    const nextCols = calcColumns(scroller.clientWidth || window.innerWidth);
    if (nextCols !== App.cols) {
        App.cols = nextCols;
        const totalRows = Math.ceil(App.totalCount / App.cols);
        grid.style.height = `${totalRows * App.itemHeight}px`;
    }
    renderViewport();
}

async function applyFontById(fontId, silent) {
    const cfg = FONT_CONFIG[fontId];
    if (!cfg) return;

    const onStatus = (msg, level) => {
        if (!silent) updateStatus(msg || `已切換字體: ${cfg.name}`, level || "good");
    };

    if (window.FontManager) {
        try {
            if (cfg.type === "cloud") {
                await window.FontManager.loadCloudFont(fontId, cfg.url, cfg.family, onStatus);
            } else {
                window.FontManager.applySystemFont(fontId, onStatus);
            }

            if (window.FontManager.currentFont) {
                App.currentFont = {
                    id: window.FontManager.currentFont.id,
                    name: window.FontManager.currentFont.name,
                    family: window.FontManager.currentFont.family,
                    type: window.FontManager.currentFont.type
                };
            } else {
                App.currentFont = { id: fontId, name: cfg.name, family: cfg.family, type: cfg.type };
            }

            applyFontStyle(App.currentFont.family);
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            localStorage.setItem("seal-converter-font", JSON.stringify(App.currentFont));
            renderViewport();
            if (!silent) updateStatus(`已切換字體: ${cfg.name}`, "good");
            return;
        } catch (e) {
            console.warn("FontManager 字體加載失敗，使用回退樣式:", e);
        }
    }

    App.currentFont = { id: fontId, name: cfg.name, family: cfg.family, type: cfg.type };
    applyFontStyle(App.currentFont.family);
    try {
        localStorage.setItem("seal-converter-font", JSON.stringify(App.currentFont));
    } catch (err) {
        console.warn("保存字體設置失敗:", err);
    }
    renderViewport();
    if (!silent) updateStatus(`已切換字體: ${cfg.name}`, "good");
}

function getEffectiveFamily(family) {
    if (!family || family === "inherit") return '"Microsoft YaHei", "SimSun", serif';
    if (family === "serif" || family === "sans-serif") return family;
    return `${family}, "Microsoft YaHei", "SimSun", serif`;
}

function applyFontStyle(family) {
    let styleEl = document.getElementById("fontTestDynamicStyle");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "fontTestDynamicStyle";
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = `.unicode-item-char { font-family: ${getEffectiveFamily(family)}; }`;
}

function parseRange(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 2) return null;

    const start = parseInt(parts[0], 16);
    const end = parseInt(parts[1], 16);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end > 0x10FFFF || start > end) {
        return null;
    }
    return { start, end };
}

function setRange(rangeValue) {
    const parsed = parseRange(rangeValue);
    if (!parsed) {
        updateStatus("Unicode 範圍無效", "error");
        return;
    }

    App.rangeStart = parsed.start;
    App.rangeEnd = parsed.end;
    App.totalCount = App.rangeEnd - App.rangeStart + 1;

    const grid = document.getElementById("unicodeGrid");
    const scroller = document.querySelector(".main-container");
    if (!grid || !scroller) return;

    App.cols = calcColumns(scroller.clientWidth || window.innerWidth);
    const totalRows = Math.ceil(App.totalCount / App.cols);

    grid.style.position = "relative";
    grid.style.height = `${totalRows * App.itemHeight}px`;
    grid.innerHTML = "";

    scroller.scrollTop = 0;
    renderViewport();

    updateStatus(`顯示範圍: ${formatCodePoint(parsed.start)} - ${formatCodePoint(parsed.end)}（共 ${App.totalCount} 碼點）`, "good");
}

function calcColumns(width) {
    if (width < 480) return 4;
    if (width < 768) return 6;
    if (width < 1024) return 8;
    if (width < 1440) return 12;
    return 16;
}

function renderViewport() {
    const grid = document.getElementById("unicodeGrid");
    const scroller = document.querySelector(".main-container");
    if (!grid || !scroller || App.totalCount <= 0) return;

    const scrollTop = scroller.scrollTop;
    const viewportHeight = scroller.clientHeight;

    const firstRow = Math.max(0, Math.floor(scrollTop / App.itemHeight) - App.bufferRows);
    const rowCount = Math.ceil(viewportHeight / App.itemHeight) + App.bufferRows * 2;
    const lastRow = firstRow + rowCount;

    const startIndex = firstRow * App.cols;
    const endIndex = Math.min(App.totalCount, (lastRow + 1) * App.cols);

    let layer = grid.querySelector("[data-virtual-layer]");
    if (!layer) {
        layer = document.createElement("div");
        layer.setAttribute("data-virtual-layer", "true");
        grid.appendChild(layer);
    }

    layer.style.position = "absolute";
    layer.style.left = "0";
    layer.style.right = "0";
    layer.style.top = `${firstRow * App.itemHeight}px`;
    layer.style.display = "grid";
    layer.style.gridTemplateColumns = `repeat(${App.cols}, minmax(80px, 1fr))`;
    layer.style.gap = "0.8em";
    layer.style.padding = "0.8em";
    layer.style.boxSizing = "border-box";

    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
        const codePoint = App.rangeStart + i;
        frag.appendChild(createUnicodeItem(codePoint));
    }

    layer.innerHTML = "";
    layer.appendChild(frag);
}

function createUnicodeItem(codePoint) {
    const char = safeCodePointToChar(codePoint);

    const item = document.createElement("div");
    item.className = "unicode-item";

    const charEl = document.createElement("div");
    charEl.className = "unicode-item-char";
    charEl.textContent = displayChar(codePoint, char);

    const codeEl = document.createElement("div");
    codeEl.className = "unicode-item-code";
    codeEl.textContent = formatCodePoint(codePoint);

    item.appendChild(charEl);
    item.appendChild(codeEl);
    return item;
}

function safeCodePointToChar(codePoint) {
    try {
        return String.fromCodePoint(codePoint);
    } catch {
        return "";
    }
}

function displayChar(codePoint, char) {
    if (codePoint === 0x20) return "␠";

    const isControl = (codePoint <= 0x1F) || (codePoint >= 0x7F && codePoint <= 0x9F);
    const isSurrogate = codePoint >= 0xD800 && codePoint <= 0xDFFF;
    if (isControl || isSurrogate) return "□";
    if (!char || /^\s$/.test(char)) return "·";

    return char;
}

function formatCodePoint(codePoint) {
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function updateStatus(message, level) {
    const textEl = document.getElementById("statusText");
    const dotEl = document.getElementById("statusIndicator");

    if (textEl) textEl.textContent = message;
    if (dotEl) dotEl.className = `status-indicator status-${level || "good"}`;
}

document.addEventListener("DOMContentLoaded", () => {
    initializeFontTest().catch((err) => {
        console.error("初始化失敗:", err);
        updateStatus("初始化失敗，請刷新重試", "error");
    });
});
