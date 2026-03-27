import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import requests
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup
import re
from urllib.parse import quote
from threading import Thread, Lock, Event
from concurrent.futures import ThreadPoolExecutor, Future
import webbrowser
import io
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple
import json
import time
import os
# SVG解析依赖
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
from PIL import Image, ImageTk

RE_SVG_EXT = re.compile(r"\.svg$")
RE_HANS_LINK = re.compile(r"/hans/")
RE_HTML_TAG = re.compile(r"<[^>]+>")
RE_SPACES = re.compile(r"\s+")
RE_MAPPING_LINE = re.compile(r"'([^']+)'\s*:\s*'([^']+)'")
STATE_FILE_NAME = ".mapping_tool_state.json"
CJK_UNICODE_RANGES = [
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2A6DF),
    (0x2A700, 0x2B73F),
    (0x2B740, 0x2B81F),
    (0x2B820, 0x2CEAF),
    (0x2CEB0, 0x2EBEF),
    (0x2EBF0, 0x2EE5F),
    (0x2F800, 0x2FA1F),
    (0x30000, 0x3134F),
    (0x31350, 0x323AF),
]

class SealCharacterTool:
    def __init__(self, root):
        self.root = root
        self.root.title("汉典篆书筛选工具")
        self.root.geometry("1800x1200")
        self.root.resizable(True, True)
        
        # 核心数据
        self.current_unicode = 0x4E00
        self.seal_mapping: Dict[str, str] = {}
        self.is_fetching = False
        self.current_swjz_svg_url = ""
        self.swjz_image = None
        self.swjz_note_svg_urls: List[str] = []
        self.current_note_svg_index = 0
        self.mapping_edit_active = False
        self.state_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), STATE_FILE_NAME)

        # 复用HTTP连接，减少频繁请求带来的连接开销
        self.http = requests.Session()
        self.http.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.zdic.net/",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        adapter = HTTPAdapter(pool_connections=8, pool_maxsize=8, max_retries=1)
        self.http.mount("http://", adapter)
        self.http.mount("https://", adapter)
        
        # 缓存优化（减少锁竞争，增大缓存过期时间）
        self.text_cache: Dict[str, Dict] = {}
        self.svg_cache: OrderedDict[str, ImageTk.PhotoImage] = OrderedDict()
        self.svg_cache_max_size = 80  # 适度减小缓存，避免内存占用过高
        self.cache_lock = Lock()
        
        # 线程优化（关键：限制线程数+添加任务取消机制）
        self.executor = ThreadPoolExecutor(max_workers=2)  # 从4减到2，减少CPU上下文切换
        self.futures: List[Future] = []
        self.fetch_event = Event()  # 用于取消正在进行的抓取任务
        
        # 防抖优化（窗口resize防抖）
        self.resize_timer = None
        self.resize_delay = 100  # 降低防抖延迟到100ms，提升响应速度
        
        # 界面优化（减少重绘）
        self.variant_displayed = False  # 标记异体字是否已渲染
        self.last_variant_count = 0     # 记录上次异体字数量，避免重复渲染
        self.last_width = 0             # 记录窗口宽度，用于resize判断
        
        # 界面布局
        self.setup_ui()
        self.load_app_state()
        
        # 绑定事件（优化事件触发）
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.bind("<Configure>", self.on_window_resize_debounced)  # 防抖resize
        
        # 初始加载第一个字（异步加载，不阻塞UI）
        self.root.after(100, lambda: self.update_char_display(self.current_unicode))
    
    def setup_ui(self):
        """界面布局优化：减少不必要的组件、降低重绘频率"""
        main_container = ttk.Frame(self.root)
        main_container.pack(fill=tk.BOTH, expand=True)
        main_container.columnconfigure(0, weight=1)
        main_container.rowconfigure(1, weight=1)
        
        # 顶部控制区（简化布局，减少组件数量）
        control_frame = ttk.Frame(main_container, padding="10")
        control_frame.grid(row=0, column=0, sticky="ew", padx=5, pady=5)
        control_frame.columnconfigure(1, weight=1)
        control_frame.columnconfigure(5, weight=1)
        control_frame.columnconfigure(0, minsize=70)
        control_frame.columnconfigure(4, minsize=55)
        
        # 第1组：万国码控制
        ttk.Label(control_frame, text="万国码：").grid(row=0, column=0, padx=(0, 5))
        self.unicode_entry = ttk.Entry(control_frame, width=16)
        self.unicode_entry.grid(row=0, column=1, padx=(0, 10), sticky="ew")
        ttk.Button(control_frame, text="◀ 上一字", width=8, 
                  command=self.prev_char).grid(row=0, column=2, padx=2)
        ttk.Button(control_frame, text="下一字 ▶", width=8,
                  command=self.next_char).grid(row=0, column=3, padx=(0, 20))
        
        # 第2组：手动查询
        ttk.Label(control_frame, text="查询：").grid(row=0, column=4, padx=(0, 5))
        self.char_entry = ttk.Entry(control_frame, width=14)
        self.char_entry.grid(row=0, column=5, padx=(0, 5), sticky="ew")
        ttk.Button(control_frame, text="查汉字", width=8,
                  command=self.query_char).grid(row=0, column=6, padx=2)
        ttk.Button(control_frame, text="查码", width=8,
                  command=self.query_unicode).grid(row=0, column=7, padx=(0, 0))
        
        # 第3组：导入导出功能按钮
        ttk.Button(control_frame, text="导入JS", width=8,
                  command=self.import_js).grid(row=1, column=0, padx=2, pady=(8, 0), sticky="w")
        ttk.Button(control_frame, text="导出JS", width=8,
                  command=self.export_js).grid(row=1, column=1, padx=2, pady=(8, 0), sticky="w")
        ttk.Button(control_frame, text="清空映射", width=8,
                  command=self.clear_mapping).grid(row=1, column=2, padx=2, pady=(8, 0), sticky="w")
        ttk.Button(control_frame, text="清除缓存", width=8,
                  command=self.clear_cache).grid(row=1, column=3, padx=2, pady=(8, 0), sticky="w")

        self.skip_mapped_var = tk.BooleanVar(value=False)
        self.skip_mapped_check = ttk.Checkbutton(
            control_frame,
            text="跳过已映射",
            variable=self.skip_mapped_var,
            command=self.on_skip_mapped_toggle
        )
        self.skip_mapped_check.grid(row=1, column=4, columnspan=2, padx=(12, 2), pady=(8, 0), sticky="w")
        
        # 中间内容区（优化列权重，减少不必要的最小尺寸限制）
        content_frame = ttk.Frame(main_container)
        content_frame.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        content_frame.columnconfigure(0, weight=1)
        content_frame.columnconfigure(1, weight=2)
        content_frame.columnconfigure(2, weight=2)
        content_frame.columnconfigure(3, weight=1)
        content_frame.rowconfigure(0, weight=1)
        
        # 左栏：汉字+SVG显示（减少Canvas重绘）
        left_frame = ttk.LabelFrame(content_frame, text="当前汉字", padding="10")
        left_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        left_frame.rowconfigure([2,3], weight=1)
        left_frame.columnconfigure(0, weight=1)
        
        self.current_char_label = tk.Label(
            left_frame, text="", font=("微软雅黑", 64),  # 适度减小字体，降低渲染开销
            bg="#f0f8ff", relief=tk.RIDGE
        )
        self.current_char_label.grid(row=0, column=0, sticky="nsew", pady=(0, 10), padx=5)
        
        info_frame = ttk.Frame(left_frame)
        info_frame.grid(row=1, column=0, sticky="ew", pady=(0, 15), padx=5)
        ttk.Label(info_frame, text="万国码：", font=("微软雅黑", 12)).pack(side=tk.LEFT)
        self.unicode_label = ttk.Label(info_frame, text="U+4E00", font=("Consolas", 12, "bold"))
        self.unicode_label.pack(side=tk.LEFT, padx=5)
        
        # 说文解字SVG显示区（固定初始尺寸，减少resize重绘）
        swjz_frame = ttk.LabelFrame(left_frame, text="说文解字字形", padding="10")
        swjz_frame.grid(row=2, column=0, sticky="nsew", pady=(0, 10))
        swjz_frame.rowconfigure(0, weight=1)
        swjz_frame.columnconfigure(0, weight=1)
        
        self.swjz_svg_canvas = tk.Canvas(
            swjz_frame, bg="white", relief=tk.SUNKEN,
            highlightthickness=1,
            width=400, height=300  # 适度减小初始尺寸
        )
        self.swjz_svg_canvas.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
        
        # 说文解字注SVG显示区
        note_svg_frame = ttk.LabelFrame(left_frame, text="《说文解字注》字形（多图）", padding="10")
        note_svg_frame.grid(row=3, column=0, sticky="nsew", pady=(0, 10))
        note_svg_frame.rowconfigure(1, weight=1)
        note_svg_frame.columnconfigure(0, weight=1)
        
        note_svg_control = ttk.Frame(note_svg_frame)
        note_svg_control.grid(row=0, column=0, sticky="ew", pady=5)
        
        self.prev_note_svg_btn = ttk.Button(
            note_svg_control, text="◀ 上一张", width=10,
            command=self.prev_note_svg, state=tk.DISABLED
        )
        self.prev_note_svg_btn.pack(side=tk.LEFT, padx=5)
        
        self.note_svg_status = ttk.Label(note_svg_control, text="0/0")
        self.note_svg_status.pack(side=tk.LEFT, padx=10)
        
        self.next_note_svg_btn = ttk.Button(
            note_svg_control, text="下一张 ▶", width=10,
            command=self.next_note_svg, state=tk.DISABLED
        )
        self.next_note_svg_btn.pack(side=tk.LEFT, padx=5)
        
        self.open_note_svg_btn = ttk.Button(
            note_svg_control, text="浏览器打开", width=10,
            command=self.open_current_note_svg, state=tk.DISABLED
        )
        self.open_note_svg_btn.pack(side=tk.RIGHT, padx=5)
        
        self.note_svg_canvas = tk.Canvas(
            note_svg_frame, bg="white", relief=tk.SUNKEN,
            highlightthickness=1,
            width=400, height=300
        )
        self.note_svg_canvas.grid(row=1, column=0, sticky="nsew", pady=5, padx=5)
        
        self.swjz_svg_btn = ttk.Button(
            left_frame, text="浏览器打开SVG（备用）",
            command=self.open_swjz_svg, state=tk.DISABLED
        )
        self.swjz_svg_btn.grid(row=4, column=0, sticky="ew", pady=5, padx=5)
        
        # 中左栏：说文解字+康熙字典（减少文本框重绘）
        middle_left_frame = ttk.Frame(content_frame)
        middle_left_frame.grid(row=0, column=1, sticky="nsew", padx=5)
        middle_left_frame.rowconfigure([0,1], weight=1)
        middle_left_frame.columnconfigure(0, weight=1)
        
        swjz_text_frame = ttk.LabelFrame(middle_left_frame, text="《说文解字》原文", padding="10")
        swjz_text_frame.grid(row=0, column=0, sticky="nsew", pady=(0, 10))
        swjz_text_frame.rowconfigure(0, weight=1)
        swjz_text_frame.columnconfigure(0, weight=1)
        
        self.swjz_text = scrolledtext.ScrolledText(
            swjz_text_frame, font=("宋体", 11), wrap=tk.WORD  # 减小字体，降低渲染开销
        )
        self.swjz_text.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.swjz_text.config(state=tk.DISABLED)  # 默认禁用，减少重绘
        
        kangxi_frame = ttk.LabelFrame(middle_left_frame, text="《康熙字典》原文", padding="10")
        kangxi_frame.grid(row=1, column=0, sticky="nsew")
        kangxi_frame.rowconfigure(0, weight=1)
        kangxi_frame.columnconfigure(0, weight=1)
        
        self.kangxi_text = scrolledtext.ScrolledText(
            kangxi_frame, font=("宋体", 11), wrap=tk.WORD
        )
        self.kangxi_text.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.kangxi_text.config(state=tk.DISABLED)
        
        # 中右栏：说文解字注文本
        middle_right_frame = ttk.Frame(content_frame)
        middle_right_frame.grid(row=0, column=2, sticky="nsew", padx=5)
        middle_right_frame.rowconfigure(0, weight=1)
        middle_right_frame.columnconfigure(0, weight=1)
        
        note_text_frame = ttk.LabelFrame(middle_right_frame, text="《说文解字注》注释", padding="10")
        note_text_frame.grid(row=0, column=0, sticky="nsew", pady=(0, 10))
        note_text_frame.rowconfigure(0, weight=1)
        note_text_frame.columnconfigure(0, weight=1)
        
        self.swjz_note_text = scrolledtext.ScrolledText(
            note_text_frame, font=("宋体", 11), wrap=tk.WORD
        )
        self.swjz_note_text.grid(row=0, column=0, sticky="nsew", padx=2, pady=2)
        self.swjz_note_text.config(state=tk.DISABLED)
        
        # 右栏：异体字+映射表（优化Canvas渲染）
        right_frame = ttk.Frame(content_frame)
        right_frame.grid(row=0, column=3, sticky="nsew", padx=(5, 0))
        right_frame.rowconfigure([0,1], weight=1)
        right_frame.columnconfigure(0, weight=1)
        
        variant_lf = ttk.LabelFrame(right_frame, text="异体字/篆书（点击选择/跳转）", padding="10")
        variant_lf.grid(row=0, column=0, sticky="nsew", pady=(0, 10))
        variant_lf.rowconfigure(0, weight=1)
        variant_lf.columnconfigure(0, weight=1)
        
        variant_canvas_container = ttk.Frame(variant_lf)
        variant_canvas_container.grid(row=0, column=0, sticky="nsew")
        variant_canvas_container.rowconfigure(0, weight=1)
        variant_canvas_container.columnconfigure(0, weight=1)
        
        self.variant_canvas = tk.Canvas(variant_canvas_container, bg="white", highlightthickness=0)
        scrollbar_y = ttk.Scrollbar(variant_canvas_container, orient="vertical", command=self.variant_canvas.yview)
        scrollbar_x = ttk.Scrollbar(variant_canvas_container, orient="horizontal", command=self.variant_canvas.xview)
        self.variant_frame = ttk.Frame(self.variant_canvas)
        
        self.variant_canvas.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        self.variant_canvas.grid(row=0, column=0, sticky="nsew")
        scrollbar_y.grid(row=0, column=1, sticky="ns")
        scrollbar_x.grid(row=1, column=0, sticky="ew")
        
        self.variant_canvas.create_window((0, 0), window=self.variant_frame, anchor="nw")
        # 优化：仅在内容变化时更新scrollregion
        self.variant_frame.bind("<Configure>", self._update_variant_scrollregion)
        
        # 映射表区域（新增编辑按钮）
        mapping_lf = ttk.LabelFrame(right_frame, text="当前映射表", padding="10")
        mapping_lf.grid(row=1, column=0, sticky="nsew")
        mapping_lf.rowconfigure(2, weight=1)
        mapping_lf.columnconfigure(0, weight=1)
        
        # 新增映射表操作按钮
        mapping_btn_frame = ttk.Frame(mapping_lf)
        mapping_btn_frame.grid(row=0, column=0, sticky="ew", pady=5)
        
        self.edit_mapping_btn = ttk.Button(
            mapping_btn_frame, text="编辑映射", width=10,
            command=self.toggle_mapping_edit
        )
        self.edit_mapping_btn.pack(side=tk.LEFT, padx=5)
        
        self.save_mapping_btn = ttk.Button(
            mapping_btn_frame, text="保存修改", width=10,
            command=self.save_mapping_edit,
            state=tk.DISABLED
        )
        self.save_mapping_btn.pack(side=tk.LEFT, padx=5)

        quick_edit_frame = ttk.Frame(mapping_lf)
        quick_edit_frame.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        quick_edit_frame.columnconfigure(3, weight=1)

        ttk.Label(quick_edit_frame, text="当前字：").grid(row=0, column=0, padx=(0, 4), sticky="w")
        self.mapping_source_label = ttk.Label(quick_edit_frame, text="-", font=("Consolas", 11, "bold"))
        self.mapping_source_label.grid(row=0, column=1, padx=(0, 10), sticky="w")

        ttk.Label(quick_edit_frame, text="映射到：").grid(row=0, column=2, padx=(0, 4), sticky="w")
        self.current_mapping_entry = ttk.Entry(quick_edit_frame, width=8)
        self.current_mapping_entry.grid(row=0, column=3, padx=(0, 8), sticky="ew")
        self.current_mapping_entry.bind("<Return>", lambda e: self.apply_current_mapping())

        self.apply_current_mapping_btn = ttk.Button(
            quick_edit_frame, text="保存当前字", width=10,
            command=self.apply_current_mapping
        )
        self.apply_current_mapping_btn.grid(row=0, column=4, padx=4)

        self.remove_current_mapping_btn = ttk.Button(
            quick_edit_frame, text="删除当前字", width=10,
            command=self.remove_current_mapping
        )
        self.remove_current_mapping_btn.grid(row=0, column=5, padx=(4, 0))
        
        self.mapping_text = scrolledtext.ScrolledText(
            mapping_lf, font=("Consolas", 9), wrap=tk.NONE
        )
        self.mapping_text.grid(row=2, column=0, sticky="nsew", padx=2, pady=2)
        self.mapping_text.config(state=tk.DISABLED)
        
        # 状态栏
        self.status_var = tk.StringVar(value="就绪 - 高效模式 | CPU占用优化 | 窗口防抖 | 支持跳过已映射与快捷映射编辑")
        status_bar = ttk.Label(
            main_container, textvariable=self.status_var,
            relief=tk.SUNKEN, padding=(10, 5), font=("微软雅黑", 10)
        )
        status_bar.grid(row=2, column=0, sticky="ew", pady=(5, 0))
        
        # 绑定键盘快捷键（简化）
        self.setup_shortcuts()
    
    # ========== 核心优化1：窗口resize防抖 ==========
    def on_window_resize_debounced(self, event):
        """防抖处理窗口resize事件，避免频繁触发重绘"""
        if event.widget != self.root:
            return
        
        # 取消之前的定时器
        if self.resize_timer:
            self.root.after_cancel(self.resize_timer)
        
        # 延迟100ms执行实际的resize处理（降低延迟提升响应）
        self.resize_timer = self.root.after(self.resize_delay, self.on_window_resize_actual)
    
    def on_window_resize_actual(self):
        """实际的窗口resize处理（仅执行必要的缩放）"""
        try:
            # 1. 动态调整汉字显示字体大小（仅在窗口宽度变化超过50px时执行）
            current_width = self.root.winfo_width()
            if hasattr(self, 'last_width') and abs(current_width - self.last_width) < 50:
                return
            self.last_width = current_width
            
            char_font_size = max(40, min(80, current_width // 35))
            self.current_char_label.config(font=("微软雅黑", char_font_size))
            
            # 2. 优化SVG画布显示（仅在SVG已加载且画布尺寸变化明显时执行）
            if self.swjz_image:
                canvas_width = self.swjz_svg_canvas.winfo_width()
                canvas_height = self.swjz_svg_canvas.winfo_height()
                if canvas_width > 100 and canvas_height > 100:
                    img_width = self.swjz_image.width()
                    img_height = self.swjz_image.height()
                    scale = min(canvas_width * 0.8 / img_width, canvas_height * 0.8 / img_height)
                    new_width = int(img_width * scale)
                    new_height = int(img_height * scale)
                    subsample_x = max(1, int(round(img_width / new_width)))
                    subsample_y = max(1, int(round(img_height / new_height)))
                    resized_img = self.swjz_image._PhotoImage__photo.subsample(subsample_x, subsample_y)
                    self.swjz_svg_canvas.delete("all")
                    x = canvas_width // 2
                    y = canvas_height // 2
                    self.swjz_svg_canvas.create_image(x, y, image=resized_img, anchor=tk.CENTER)
                    self.swjz_svg_canvas.image = resized_img
            
            # 3. 自适应调整异体字列数（强制刷新）
            if self.last_variant_count > 0:
                self._update_variants_display(self.last_variant_list)
        
        except Exception as e:
            # 忽略resize中的异常，避免卡顿
            pass
    
    # ========== 核心优化2：异体字渲染优化（修复刷新不及时） ==========
    def _update_variant_scrollregion(self, event):
        """仅在异体字区域内容变化时更新scrollregion，减少Canvas重绘"""
        self.variant_canvas.configure(scrollregion=self.variant_canvas.bbox("all"))
    
    def _update_variants_display(self, variants):
        """修复异体字刷新不及时：移除不必要的刷新限制，确保内容变化时强制更新"""
        self.last_variant_list = variants
        current_count = len(variants)
        
        # 移除原有的计数/状态判断，确保每次调用都刷新
        self.last_variant_count = current_count
        self.variant_displayed = True
        
        # 清空现有内容（批量删除，减少重绘）
        for widget in self.variant_frame.winfo_children():
            widget.destroy()
        
        if not variants:
            ttk.Label(self.variant_frame, text="无异体字", 
                     font=("微软雅黑", 11)).pack(pady=20)
            # 强制更新滚动区域
            self.root.after(0, self._update_variant_scrollregion, None)
            return
        
        # 优化列数计算（减少网格布局重绘）
        canvas_width = self.variant_canvas.winfo_width() or 400
        cols = max(2, min(3, canvas_width // 160))
        
        # 批量创建组件，减少UI更新次数
        for i, variant in enumerate(variants):
            row = i // cols
            col = i % cols
            
            frame = ttk.Frame(self.variant_frame, padding=6, relief=tk.RIDGE, borderwidth=1)
            frame.grid(row=row, column=col, padx=6, pady=6, sticky="nsew")
            
            char_unicode = self.char_to_unicode(variant["char"])
            char_frame = ttk.Frame(frame)
            char_frame.pack(pady=(0, 4))
            
            # 简化按钮样式，减少渲染开销
            btn = tk.Button(
                char_frame, text=variant["char"], 
                font=("微软雅黑", 28), width=2,
                command=lambda c=variant["char"]: self.select_variant(c),
                bg="#e8f4f8", relief=tk.RAISED,
                cursor="hand2",
                activebackground="#d0e8f0"
            )
            btn.pack(side=tk.LEFT, padx=4)
            
            unicode_label = tk.Label(
                char_frame, text=f"U+{char_unicode:04X}", 
                font=("Consolas", 9), fg="blue", cursor="hand2"
            )
            unicode_label.pack(side=tk.LEFT, padx=4, pady=12)
            unicode_label.bind("<Button-1>", lambda e, c=variant["char"]: self.jump_to_variant(c))
            
            if variant["svg"]:
                btn_frame = ttk.Frame(frame)
                btn_frame.pack(pady=4)
                
                ttk.Button(
                    btn_frame, text="看字形", width=9,
                    command=lambda u=variant["svg"], c=variant["char"]: self.show_variant_svg(u, c)
                ).pack(side=tk.LEFT, padx=2)
                
                ttk.Button(
                    btn_frame, text="跳转", width=9,
                    command=lambda c=variant["char"]: self.jump_to_variant(c)
                ).pack(side=tk.LEFT, padx=2)
        
        # 强制更新滚动区域（关键：确保刷新）
        self.root.after(0, self._update_variant_scrollregion, None)
    
    # ========== 核心优化3：映射表编辑功能 ==========
    def toggle_mapping_edit(self):
        """切换映射表编辑状态"""
        if self.mapping_text["state"] == tk.DISABLED:
            self.mapping_edit_active = True
            self.mapping_text.config(state=tk.NORMAL)
            self.edit_mapping_btn.config(text="取消编辑")
            self.save_mapping_btn.config(state=tk.NORMAL)
            self.current_mapping_entry.config(state=tk.DISABLED)
            self.apply_current_mapping_btn.config(state=tk.DISABLED)
            self.remove_current_mapping_btn.config(state=tk.DISABLED)
            self.status_var.set("映射表已进入整表编辑状态 | 可直接修改文本 | 保存前会校验格式")
        else:
            self.mapping_edit_active = False
            self.mapping_text.config(state=tk.DISABLED)
            self.edit_mapping_btn.config(text="编辑映射")
            self.save_mapping_btn.config(state=tk.DISABLED)
            self.current_mapping_entry.config(state=tk.NORMAL)
            self.apply_current_mapping_btn.config(state=tk.NORMAL)
            self.remove_current_mapping_btn.config(state=tk.NORMAL)
            # 恢复原始内容
            self.update_mapping_display()
            self.update_current_mapping_editor()
            self.status_var.set("已退出整表编辑 | 未保存的文本修改已丢弃")
    
    def save_mapping_edit(self):
        """保存映射表编辑内容"""
        try:
            # 获取编辑后的文本
            raw_text = self.mapping_text.get("1.0", tk.END).strip()
            if not raw_text:
                self.seal_mapping.clear()
                self.update_mapping_display()
                self.status_var.set("映射表已清空 | 保存成功")
                return
            
            # 解析映射内容（兼容格式：'原字': '篆字', # 注释）
            new_mapping = {}
            lines = raw_text.split("\n")
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # 匹配核心映射格式
                match = RE_MAPPING_LINE.match(line)
                if match:
                    original = match.group(1)
                    seal = match.group(2)
                    if len(original) == 1 and len(seal) == 1:
                        new_mapping[original] = seal
                    else:
                        raise ValueError(f"第{line_num}行：原字/篆字必须为单个字符")
                else:
                    raise ValueError(f"第{line_num}行：格式错误（正确示例：'一': '壹', # U+4E00）")
            
            # 更新映射表
            self.seal_mapping = new_mapping
            self.update_mapping_display()
            # 切换回不可编辑状态
            self.toggle_mapping_edit()
            self.update_current_mapping_editor()
            self.status_var.set(f"映射表保存成功 | 共{len(new_mapping)}条映射")
        
        except Exception as e:
            messagebox.showerror("保存失败", f"解析映射表出错：{str(e)}")
            self.status_var.set(f"映射表保存失败：{str(e)}")
    
    # ========== 核心优化4：线程任务管理 ==========
    def fetch_zdic_data(self, char: str):
        """优化数据抓取：取消重复任务，减少CPU占用"""
        # 取消正在进行的抓取任务
        self.fetch_event.set()
        for future in self.futures[:]:
            if not future.done():
                future.cancel()
        self.futures.clear()
        
        if self.is_fetching:
            return
        
        # 检查缓存（优先使用缓存，避免重复抓取）
        cached = self.get_cached_data(char)
        if cached:
            self._update_ui_from_cache(cached, char)
            return
        
        self.is_fetching = True
        self.fetch_event.clear()
        self.status_var.set(f"🔄 正在抓取「{char}」...")
        
        # 提交新任务（限制并发）
        future = self.executor.submit(self._fetch_data_thread, char)
        future.add_done_callback(self._fetch_data_callback)
        self.futures.append(future)
    
    def _fetch_data_thread(self, char: str) -> Dict:
        """优化抓取线程：添加取消机制，减少无效请求"""
        try:
            # 如果任务被取消，直接返回
            if self.fetch_event.is_set():
                return {'error': '任务已取消'}
            
            url = f"https://www.zdic.net/hans/{quote(char)}"
            headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Cache-Control": "max-age=300",  # 启用请求缓存，减少重复请求
                "Pragma": "no-cache"
            }
            
            # 使用连接池，并区分连接超时与读取超时
            response = self.http.get(url, headers=headers, timeout=(4, 10))
            response.raise_for_status()
            response.encoding = "utf-8"
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 解析数据（简化逻辑，减少不必要的正则匹配）
            result = {
                'swjz_content': "未找到《说文解字》原文",
                'swjz_note_content': "未找到《说文解字注》注释",
                'kangxi_content': "未找到《康熙字典》原文",
                'variants': [],
                'swjz_svg_url': None,
                'swjz_note_svg_urls': []
            }
            
            swjz_section = soup.find("div", class_="swjz")
            if swjz_section:
                svg_img = swjz_section.find("img", {"data-original": RE_SVG_EXT})
                if svg_img and "data-original" in svg_img.attrs:
                    result['swjz_svg_url'] = self.fix_svg_url(svg_img["data-original"])
                
                swnr_blocks = swjz_section.find_all("div", class_="swnr")
                if swnr_blocks:
                    result['swjz_content'] = self.clean_text(swnr_blocks[0].get_text(separator='\n'))
                    if len(swnr_blocks) > 1:
                        result['swjz_note_content'] = self.clean_text(swnr_blocks[1].get_text(separator='\n'))
            
            # 简化康熙字典解析，减少CPU开销
            result['kangxi_content'] = self._parse_kangxi_content_simple(soup, char)
            result['swjz_note_svg_urls'] = self._parse_swjz_note_svgs_simple(soup)
            
            # 简化异体字解析，减少循环次数
            ytz_section = soup.find("div", class_="ytz_b")
            if ytz_section:
                all_variants = []
                seen_chars = set()
                for link in ytz_section.find_all("a", href=RE_HANS_LINK, limit=50):  # 限制数量
                    variant_char = link.text.strip()
                    if len(variant_char) != 1 or variant_char in seen_chars:
                        continue
                    seen_chars.add(variant_char)
                    svg_img = link.find("img", {"data-original": RE_SVG_EXT})
                    svg_url = svg_img["data-original"] if svg_img else ""
                    all_variants.append({"char": variant_char, "svg": svg_url})
                result['variants'] = all_variants
            
            return result
            
        except Exception as e:
            return {
                'error': str(e),
                'swjz_content': f"抓取失败：{str(e)}",
                'swjz_note_content': f"抓取失败：{str(e)}",
                'kangxi_content': f"抓取失败：{str(e)}",
                'variants': [],
                'swjz_svg_url': None,
                'swjz_note_svg_urls': []
            }
    
    # ========== 核心优化5：简化解析逻辑 ==========
    def _parse_kangxi_content_simple(self, soup: BeautifulSoup, char: str) -> str:
        """简化康熙字典解析，减少正则匹配和文本处理"""
        try:
            kangxi_box = soup.find('div', class_='kxzd')
            if not kangxi_box:
                return f"未找到「{char}」的《康熙字典》原文"
            
            knr_content = kangxi_box.find('div', class_='knr')
            if not knr_content:
                return f"未找到「{char}」的《康熙字典》原文"
            
            # 简化文本清理，减少循环和正则
            raw_text = knr_content.get_text(separator='\n', strip=True)
            # 仅过滤明显的广告/无关内容
            filter_lines = [line for line in raw_text.split('\n') if len(line) > 2 and not any(key in line for key in ['广告', '返回顶部', '汉典'])]
            return '\n'.join(filter_lines[:50])  # 限制显示行数，减少渲染
            
        except Exception as e:
            return f"解析失败：{str(e)[:50]}"
    
    def _parse_swjz_note_svgs_simple(self, soup: BeautifulSoup) -> List[str]:
        """简化SVG链接解析，减少遍历次数"""
        svg_urls = []
        try:
            note_sections = soup.find_all("div", class_="swjz", limit=2)
            seen_urls = set()
            for section in note_sections:
                svg_imgs = section.find_all("img", {"data-original": RE_SVG_EXT}, limit=5)
                for img in svg_imgs:
                    svg_url = self.fix_svg_url(img.get("data-original", ""))
                    if svg_url and svg_url not in seen_urls:
                        seen_urls.add(svg_url)
                        svg_urls.append(svg_url)
            return svg_urls[:3]  # 限制数量，减少内存占用
        except Exception:
            return []
    
    # ========== 核心优化6：批量更新UI，减少重绘 ==========
    def _update_ui_from_cache(self, cached_data, char):
        """从缓存批量更新UI，减少多次UI操作"""
        self.root.after(0, self._batch_update_ui, 
                       cached_data['swjz_content'],
                       cached_data['swjz_note_content'],
                       cached_data['kangxi_content'],
                       cached_data['variants'],
                       cached_data.get('swjz_svg_url'),
                       cached_data.get('swjz_note_svg_urls'),
                       char)
    
    def _batch_update_ui(self, swjz_content, swjz_note_content, kangxi_content, variants, swjz_svg_url, note_svg_urls, char):
        """批量更新所有UI组件，减少重绘次数"""
        # 1. 更新文本区域（批量启用/禁用，减少重绘）
        self.swjz_text.config(state=tk.NORMAL)
        self.swjz_text.delete("1.0", tk.END)
        self.swjz_text.insert("1.0", swjz_content)
        self.swjz_text.config(state=tk.DISABLED)
        
        self.swjz_note_text.config(state=tk.NORMAL)
        self.swjz_note_text.delete("1.0", tk.END)
        self.swjz_note_text.insert("1.0", swjz_note_content)
        self.swjz_note_text.config(state=tk.DISABLED)
        
        self.kangxi_text.config(state=tk.NORMAL)
        self.kangxi_text.delete("1.0", tk.END)
        self.kangxi_text.insert("1.0", kangxi_content)
        self.kangxi_text.config(state=tk.DISABLED)
        
        # 2. 更新异体字（强制刷新，忽略缓存）
        self._update_variants_display(variants)
        # 强制刷新滚动区域
        self.root.after(0, self._update_variant_scrollregion, None)
        
        # 3. 更新SVG（仅在URL变化时执行）
        if swjz_svg_url != self.current_swjz_svg_url:
            self.update_swjz_svg_info(swjz_svg_url)
        
        # 4. 更新注SVG
        if note_svg_urls != self.swjz_note_svg_urls:
            self.update_note_svg_data(note_svg_urls)
        
        # 5. 更新状态栏
        self.status_var.set(f"✅ 已加载「{char}」| 异体字{len(variants)}个 | 缓存命中")
    
    # ========== 其他优化：查码/切换字逻辑 ==========
    def parse_unicode_input(self, value: str) -> int:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("empty input")

        prefixes = ("U+", "0X", "\\U", "\\X")
        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
                break

        normalized = normalized.strip()
        if not normalized:
            raise ValueError("empty input")

        return int(normalized, 16)

    def is_cjk_codepoint(self, unicode_val: int) -> bool:
        return any(start <= unicode_val <= end for start, end in CJK_UNICODE_RANGES)

    def query_unicode(self):
        """优化查码逻辑：减少不必要的验证，快速跳转"""
        code_str = self.unicode_entry.get().strip().upper()
        if not code_str:
            messagebox.showwarning("输入错误", "请输入有效的万国码（如：4E00 或 U+4E00）！")
            return
        
        try:
            unicode_val = self.parse_unicode_input(code_str)
            
            if self.is_cjk_codepoint(unicode_val):
                # 取消当前抓取任务，快速跳转
                self.fetch_event.set()
                self.current_unicode = unicode_val
                self.root.after(50, self.update_char_display, unicode_val)  # 延迟50ms，避免UI阻塞
                self.status_var.set(f"🔍 查码成功：U+{unicode_val:04X}")
            else:
                messagebox.showwarning("输入无效", f"万国码 U+{unicode_val:04X} 不在支持的 CJK 汉字区段内！")
        
        except ValueError:
            messagebox.showwarning("输入错误", "无效的万国码格式（示例：U+4E00、4E00、0x4E00）")
    
    def prev_char(self):
        """优化上一字：取消当前任务，快速切换"""
        target_unicode = self.get_adjacent_unicode(-1)
        if target_unicode is not None:
            self.fetch_event.set()
            self.current_unicode = target_unicode
            self.root.after(50, self.update_char_display, self.current_unicode)
    
    def next_char(self):
        """优化下一字：取消当前任务，快速切换"""
        target_unicode = self.get_adjacent_unicode(1)
        if target_unicode is not None:
            self.fetch_event.set()
            self.current_unicode = target_unicode
            self.root.after(50, self.update_char_display, self.current_unicode)
    
    # ========== 资源释放优化 ==========
    def clear_cache(self):
        """优化缓存清理：彻底释放内存"""
        with self.cache_lock:
            self.text_cache.clear()
            # 显式删除SVG缓存，释放Image引用
            for key in list(self.svg_cache.keys()):
                del self.svg_cache[key]
            self.svg_cache.clear()
        self.status_var.set("缓存已清空 | 内存已释放")

    def build_app_state(self) -> Dict:
        mapping_text_content = self.mapping_text.get("1.0", tk.END).rstrip("\n")
        current_mapping_input = self.current_mapping_entry.get().strip()
        geometry = self.root.winfo_geometry()

        return {
            "version": 1,
            "current_unicode": self.current_unicode,
            "seal_mapping": self.seal_mapping,
            "skip_mapped": self.skip_mapped_var.get(),
            "mapping_edit_active": self.mapping_edit_active,
            "mapping_text_content": mapping_text_content,
            "current_mapping_input": current_mapping_input,
            "window_geometry": geometry,
        }

    def save_app_state(self):
        state = self.build_app_state()
        with open(self.state_file_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def load_app_state(self):
        if not os.path.exists(self.state_file_path):
            return

        try:
            with open(self.state_file_path, "r", encoding="utf-8") as f:
                state = json.load(f)

            current_unicode = state.get("current_unicode", self.current_unicode)
            if isinstance(current_unicode, int) and 0x4E00 <= current_unicode <= 0x2FA1F:
                self.current_unicode = current_unicode

            seal_mapping = state.get("seal_mapping", {})
            if isinstance(seal_mapping, dict):
                self.seal_mapping = {
                    str(key): str(value)
                    for key, value in seal_mapping.items()
                    if len(str(key)) == 1 and len(str(value)) == 1
                }

            self.skip_mapped_var.set(bool(state.get("skip_mapped", False)))

            window_geometry = state.get("window_geometry", "")
            if isinstance(window_geometry, str) and window_geometry:
                self.root.geometry(window_geometry)

            self.update_mapping_display()
            self.update_current_mapping_editor()

            current_mapping_input = state.get("current_mapping_input", "")
            if isinstance(current_mapping_input, str) and not self.mapping_edit_active:
                self.current_mapping_entry.delete(0, tk.END)
                if current_mapping_input:
                    self.current_mapping_entry.insert(0, current_mapping_input[:1])

            if state.get("mapping_edit_active"):
                self.toggle_mapping_edit()
                mapping_text_content = state.get("mapping_text_content", "")
                if isinstance(mapping_text_content, str):
                    self.mapping_text.delete("1.0", tk.END)
                    self.mapping_text.insert("1.0", mapping_text_content)

            self.status_var.set(f"已恢复上次状态 | 当前字 U+{self.current_unicode:04X} | 映射 {len(self.seal_mapping)} 条")
        except Exception as e:
            self.status_var.set(f"恢复上次状态失败：{str(e)[:50]}")
    
    def on_closing(self):
        """优化关闭逻辑：正确释放所有资源"""
        try:
            self.save_app_state()
        except Exception as e:
            messagebox.showwarning("保存状态失败", f"关闭前保存状态失败：\n{str(e)}")

        # 取消所有任务
        self.fetch_event.set()
        for future in self.futures:
            if not future.done():
                future.cancel()
        
        # 优雅关闭线程池
        self.executor.shutdown(wait=True, cancel_futures=True)

        # 关闭HTTP会话连接池
        self.http.close()
        
        # 清空缓存，释放内存
        self.clear_cache()
        
        # 销毁窗口
        self.root.destroy()
    
    # ========== 其他基础函数（简化/保留） ==========
    def setup_shortcuts(self):
        self.root.bind("<Left>", lambda e: self.prev_char())
        self.root.bind("<Right>", lambda e: self.next_char())
        self.char_entry.bind("<Return>", lambda e: self.query_char())
        self.unicode_entry.bind("<Return>", lambda e: self.query_unicode())
        self.root.bind("<Control-i>", lambda e: self.import_js())
        self.root.bind("<Control-e>", lambda e: self.export_js())
    
    def unicode_to_char(self, unicode_val: int) -> str:
        try:
            return chr(unicode_val)
        except ValueError:
            return " "
    
    def char_to_unicode(self, char: str) -> int:
        return ord(char) if char else 0
    
    def clean_text(self, text: str) -> str:
        """简化文本清理，减少正则操作"""
        if not text:
            return ""
        text = RE_HTML_TAG.sub('', text)
        text = RE_SPACES.sub(' ', text)
        return text.strip()[:1000]  # 限制文本长度，减少渲染
    
    def fix_svg_url(self, raw_url: str) -> str:
        if not raw_url:
            return ""
        if raw_url.startswith("http"):
            return raw_url
        elif raw_url.startswith("//"):
            return f"https:{raw_url}"
        elif raw_url.startswith("/"):
            return f"https://www.zdic.net{raw_url}"
        return raw_url
    
    def download_and_convert_svg(self, svg_url: str, target_size: Tuple[int, int] = (500, 350)) -> Optional[ImageTk.PhotoImage]:
        """优化SVG转换：减少尺寸，加快处理"""
        cached_img = self.get_cached_svg(svg_url)
        if cached_img:
            return cached_img
        
        try:
            headers = {
                "Accept": "image/svg+xml,image/*,*/*;q=0.8"
            }
            
            response = self.http.get(svg_url, headers=headers, timeout=(4, 8))
            response.raise_for_status()
            
            if 'svg' not in response.headers.get('Content-Type', '') and not svg_url.endswith('.svg'):
                return None
            
            svg_data = io.BytesIO(response.content)
            drawing = svg2rlg(svg_data)
            
            if not drawing or drawing.width <= 0 or drawing.height <= 0:
                return None
            
            img_buffer = io.BytesIO()
            renderPM.drawToFile(drawing, img_buffer, fmt="PNG", dpi=100)  # 降低DPI，加快转换
            img_buffer.seek(0)
            img = Image.open(img_buffer)
            
            # 简化缩放逻辑
            img.thumbnail(target_size, Image.Resampling.LANCZOS)
            photo_img = ImageTk.PhotoImage(img)
            
            self.set_cached_svg(svg_url, photo_img)
            return photo_img
            
        except Exception as e:
            print(f"SVG处理失败 [{svg_url}]: {str(e)[:80]}")
            return None
    
    def get_cached_data(self, char: str) -> Optional[Dict]:
        with self.cache_lock:
            return self.text_cache.get(char)
    
    def set_cached_data(self, char: str, data: Dict):
        with self.cache_lock:
            self.text_cache[char] = data
    
    def get_cached_svg(self, svg_url: str) -> Optional[ImageTk.PhotoImage]:
        with self.cache_lock:
            if svg_url in self.svg_cache:
                self.svg_cache.move_to_end(svg_url)
                return self.svg_cache[svg_url]
        return None
    
    def set_cached_svg(self, svg_url: str, img: ImageTk.PhotoImage):
        with self.cache_lock:
            self.svg_cache[svg_url] = img
            self.svg_cache.move_to_end(svg_url)
            if len(self.svg_cache) > self.svg_cache_max_size:
                self.svg_cache.popitem(last=False)
    
    # ========== 基础功能函数 ==========
    def update_char_display(self, unicode_val):
        self.current_unicode = unicode_val
        char = self.unicode_to_char(unicode_val)
        
        self.current_char_label.config(text=char)
        self.unicode_label.config(text=f"U+{unicode_val:04X}")
        self.unicode_entry.delete(0, tk.END)
        self.unicode_entry.insert(0, f"U+{unicode_val:04X}")
        self.char_entry.delete(0, tk.END)
        self.char_entry.insert(0, char)
        
        self.update_mapping_display()
        self.update_current_mapping_editor()
        self.fetch_zdic_data(char)
    
    def update_mapping_display(self):
        self.mapping_text.config(state=tk.NORMAL)
        self.mapping_text.delete("1.0", tk.END)
        
        if not self.seal_mapping:
            self.mapping_text.insert("1.0", "映射表为空\n# 编辑格式示例：\n# '一': '壹', # U+4E00\n# '二': '贰', # U+4E8C")
        else:
            sorted_items = sorted(self.seal_mapping.items(), key=lambda x: self.char_to_unicode(x[0]))
            for original, seal in sorted_items:
                self.mapping_text.insert(tk.END, f"'{original}': '{seal}',  # U+{self.char_to_unicode(original):04X}\n")
        
        self.mapping_text.config(state=tk.DISABLED)

    def update_current_mapping_editor(self):
        current_char = self.unicode_to_char(self.current_unicode)
        mapped_char = self.seal_mapping.get(current_char, "")

        self.mapping_source_label.config(text=f"{current_char} (U+{self.current_unicode:04X})")
        if self.current_mapping_entry["state"] != tk.DISABLED:
            self.current_mapping_entry.delete(0, tk.END)
            if mapped_char:
                self.current_mapping_entry.insert(0, mapped_char)

    def on_skip_mapped_toggle(self):
        state_text = "已开启" if self.skip_mapped_var.get() else "已关闭"
        self.status_var.set(f"跳过已有映射字码 {state_text}")

    def get_adjacent_unicode(self, step: int) -> Optional[int]:
        min_unicode = 0x4E00
        max_unicode = 0x2FA1F
        candidate = self.current_unicode + step

        while min_unicode <= candidate <= max_unicode:
            if not self.skip_mapped_var.get():
                return candidate

            candidate_char = self.unicode_to_char(candidate)
            if candidate_char not in self.seal_mapping:
                return candidate

            candidate += step

        self.status_var.set("已到达可浏览范围边界，没有更多未映射字码")
        return None

    def apply_current_mapping(self, candidate_char: Optional[str] = None, confirm_replace: bool = True):
        original_char = self.unicode_to_char(self.current_unicode)
        seal_char = (candidate_char if candidate_char is not None else self.current_mapping_entry.get().strip())

        if not seal_char or len(seal_char) != 1:
            messagebox.showwarning("提示", "请输入单个映射字符")
            return False

        existing = self.seal_mapping.get(original_char)
        if existing == seal_char:
            self.status_var.set(f"当前映射未变化：{original_char} → {seal_char}")
            self.update_current_mapping_editor()
            return True

        if existing and confirm_replace:
            should_replace = messagebox.askyesno(
                "确认替换",
                f"「{original_char}」当前已映射为「{existing}」\n是否替换为「{seal_char}」？"
            )
            if not should_replace:
                self.update_current_mapping_editor()
                return False

        self.seal_mapping[original_char] = seal_char
        self.update_mapping_display()
        self.update_current_mapping_editor()
        self.status_var.set(f"已保存当前映射：{original_char} → {seal_char}")
        return True

    def remove_current_mapping(self):
        original_char = self.unicode_to_char(self.current_unicode)
        existing = self.seal_mapping.get(original_char)
        if not existing:
            self.status_var.set(f"当前字「{original_char}」尚未建立映射")
            return

        if not messagebox.askyesno("确认删除", f"是否删除当前映射：{original_char} → {existing}？"):
            return

        del self.seal_mapping[original_char]
        self.update_mapping_display()
        self.update_current_mapping_editor()
        self.status_var.set(f"已删除当前映射：{original_char}")
    
    def query_char(self):
        char = self.char_entry.get().strip()
        if not char or len(char) != 1:
            messagebox.showwarning("提示", "请输入单个汉字")
            return
        
        self.fetch_event.set()
        unicode_val = self.char_to_unicode(char)
        self.current_unicode = unicode_val
        self.root.after(50, self.update_char_display, unicode_val)
    
    def select_variant(self, seal_char: str):
        if self.mapping_edit_active:
            self.status_var.set("当前处于整表编辑状态，请先保存或取消后再通过异体字快捷映射")
            return

        self.current_mapping_entry.delete(0, tk.END)
        self.current_mapping_entry.insert(0, seal_char)
        self.apply_current_mapping(candidate_char=seal_char, confirm_replace=True)
    
    def show_variant_svg(self, svg_url: str, char: str):
        fixed_url = self.fix_svg_url(svg_url)
        if not fixed_url:
            messagebox.showinfo("提示", f"「{char}」无SVG数据")
            return
        
        top = tk.Toplevel(self.root)
        top.title(f"篆书字形：{char}")
        top.geometry("300x300")  # 减小弹窗尺寸
        top.transient(self.root)
        top.grab_set()
        
        ttk.Label(top, text=char, font=("微软雅黑", 40)).pack(pady=10)
        
        canvas = tk.Canvas(top, bg="white", width=250, height=200)
        canvas.pack(pady=10)
        canvas.create_text(125, 100, text="加载中...", font=("微软雅黑", 12))
        
        btn_frame = ttk.Frame(top)
        btn_frame.pack(pady=5)
        
        def open_browser():
            webbrowser.open(fixed_url)
        
        ttk.Button(btn_frame, text="浏览器打开", command=open_browser).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="选择", command=lambda: self._select_from_popup(char, top)).pack(side=tk.LEFT, padx=5)
        
        def load_variant():
            img = self.download_and_convert_svg(fixed_url, (250, 180))
            top.after(0, lambda: self._update_popup_canvas(canvas, img))
        
        Thread(target=load_variant, daemon=True).start()
    
    def _update_popup_canvas(self, canvas, img):
        canvas.delete("all")
        if img:
            canvas.create_image(125, 100, image=img, anchor=tk.CENTER)
            canvas.image = img
        else:
            canvas.create_text(125, 100, text="加载失败", font=("微软雅黑", 12), fill="red")
    
    def _select_from_popup(self, char: str, top: tk.Toplevel):
        top.destroy()
        self.select_variant(char)
    
    def update_swjz_svg_info(self, svg_url: str):
        self.current_swjz_svg_url = svg_url
        self.display_swjz_svg(svg_url)
    
    def display_swjz_svg(self, svg_url: str):
        if not svg_url:
            self.swjz_svg_canvas.delete("all")
            self.swjz_svg_canvas.create_text(200, 150, text="无SVG数据", font=("微软雅黑", 12), fill="gray")
            self.swjz_svg_btn.config(state=tk.DISABLED)
            return
        
        self.swjz_svg_canvas.delete("all")
        self.swjz_svg_canvas.create_text(200, 150, text="加载中...", font=("微软雅黑", 12), fill="gray")
        
        def load_and_display():
            img = self.download_and_convert_svg(svg_url)
            self.root.after(0, lambda: self._update_svg_canvas(img, svg_url))
        
        Thread(target=load_and_display, daemon=True).start()
    
    def _update_svg_canvas(self, img, svg_url):
        self.swjz_svg_canvas.delete("all")
        self.swjz_image = img
        
        if img:
            canvas_width = self.swjz_svg_canvas.winfo_width()
            canvas_height = self.swjz_svg_canvas.winfo_height()
            x = canvas_width // 2
            y = canvas_height // 2
            self.swjz_svg_canvas.create_image(x, y, image=img, anchor=tk.CENTER)
            self.swjz_svg_btn.config(state=tk.NORMAL)
        else:
            self.swjz_svg_canvas.create_text(200, 150, text="SVG加载失败\n使用备用按钮",
                                           font=("微软雅黑", 10), fill="red", justify=tk.CENTER)
            self.swjz_svg_btn.config(state=tk.NORMAL)
    
    def open_swjz_svg(self):
        if self.current_swjz_svg_url:
            webbrowser.open(self.current_swjz_svg_url)
    
    def update_note_svg_data(self, svg_urls):
        self.swjz_note_svg_urls = svg_urls
        self.current_note_svg_index = 0
        
        if not svg_urls:
            self.note_svg_canvas.delete("all")
            self.note_svg_canvas.create_text(200, 150, text="无注字形数据", font=("微软雅黑", 12), fill="gray")
            self.prev_note_svg_btn.config(state=tk.DISABLED)
            self.next_note_svg_btn.config(state=tk.DISABLED)
            self.open_note_svg_btn.config(state=tk.DISABLED)
            self.note_svg_status.config(text="0/0")
            return
        
        self.note_svg_status.config(text=f"{self.current_note_svg_index+1}/{len(svg_urls)}")
        self.prev_note_svg_btn.config(state=tk.NORMAL if self.current_note_svg_index > 0 else tk.DISABLED)
        self.next_note_svg_btn.config(state=tk.NORMAL if self.current_note_svg_index < len(svg_urls)-1 else tk.DISABLED)
        self.open_note_svg_btn.config(state=tk.NORMAL)
        
        self.display_note_svg()
    
    def display_note_svg(self):
        if not self.swjz_note_svg_urls or self.current_note_svg_index >= len(self.swjz_note_svg_urls):
            return
        
        svg_url = self.swjz_note_svg_urls[self.current_note_svg_index]
        self.note_svg_canvas.delete("all")
        self.note_svg_canvas.create_text(200, 150, text="加载中...", font=("微软雅黑", 12), fill="gray")
        
        def load_note_svg():
            img = self.download_and_convert_svg(svg_url)
            self.root.after(0, lambda: self._update_note_svg_canvas(img))
        
        Thread(target=load_note_svg, daemon=True).start()
    
    def _update_note_svg_canvas(self, img):
        self.note_svg_canvas.delete("all")
        if img:
            canvas_width = self.note_svg_canvas.winfo_width()
            canvas_height = self.note_svg_canvas.winfo_height()
            x = canvas_width // 2
            y = canvas_height // 2
            self.note_svg_canvas.create_image(x, y, image=img, anchor=tk.CENTER)
            self.note_svg_canvas.image = img
        else:
            self.note_svg_canvas.create_text(200, 150, text="加载失败", font=("微软雅黑", 12), fill="red")
    
    def prev_note_svg(self):
        if self.current_note_svg_index > 0:
            self.current_note_svg_index -= 1
            self.note_svg_status.config(text=f"{self.current_note_svg_index+1}/{len(self.swjz_note_svg_urls)}")
            self.prev_note_svg_btn.config(state=tk.NORMAL if self.current_note_svg_index > 0 else tk.DISABLED)
            self.next_note_svg_btn.config(state=tk.NORMAL)
            self.display_note_svg()
    
    def next_note_svg(self):
        if self.current_note_svg_index < len(self.swjz_note_svg_urls)-1:
            self.current_note_svg_index += 1
            self.note_svg_status.config(text=f"{self.current_note_svg_index+1}/{len(self.swjz_note_svg_urls)}")
            self.next_note_svg_btn.config(state=tk.NORMAL if self.current_note_svg_index < len(self.swjz_note_svg_urls)-1 else tk.DISABLED)
            self.prev_note_svg_btn.config(state=tk.NORMAL)
            self.display_note_svg()
    
    def open_current_note_svg(self):
        if self.swjz_note_svg_urls and self.current_note_svg_index < len(self.swjz_note_svg_urls):
            webbrowser.open(self.swjz_note_svg_urls[self.current_note_svg_index])
    
    def jump_to_variant(self, char):
        self.fetch_event.set()
        unicode_val = self.char_to_unicode(char)
        self.current_unicode = unicode_val
        self.root.after(50, self.update_char_display, unicode_val)
    
    def import_js(self):
        file_path = filedialog.askopenfilename(
            title="选择JS映射文件",
            filetypes=[("JavaScript文件", "*.js"), ("所有文件", "*.*")],
            defaultextension=".js"
        )
        
        if not file_path:
            return
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                js_content = f.read()
            
            mapping_data = self.parse_js_mapping(js_content)
            
            if not mapping_data:
                messagebox.showwarning("解析失败", "未找到有效的SealMapping映射表")
                return
            
            if self.seal_mapping:
                choice = messagebox.askyesnocancel(
                    "导入选项",
                    f"当前已有 {len(self.seal_mapping)} 个映射关系\n"
                    f"即将导入 {len(mapping_data)} 个新映射关系\n\n"
                    "是否覆盖原有数据？"
                )
                
                if choice is None:
                    return
                elif choice:
                    self.seal_mapping = mapping_data
                else:
                    self.seal_mapping.update(mapping_data)
            else:
                self.seal_mapping = mapping_data
            
            self.update_mapping_display()
            messagebox.showinfo(
                "导入成功",
                f"成功导入 {len(mapping_data)} 个映射关系\n当前总映射数：{len(self.seal_mapping)}"
            )
            
            self.status_var.set(f"已导入 {len(mapping_data)} 个映射（总计 {len(self.seal_mapping)} 个）")
            
        except Exception as e:
            messagebox.showerror("导入失败", f"解析JS文件出错：\n{str(e)}")
            self.status_var.set(f"导入失败：{str(e)[:50]}")
    
    def parse_js_mapping(self, js_content: str) -> Dict[str, str]:
        pattern = r'(?:const|var|let)\s+SealMapping\s*=\s*\{([\s\S]*?)\};'
        match = re.search(pattern, js_content)
        
        if not match:
            return {}
        
        mapping_content = match.group(1).strip()
        mapping_content = re.sub(r'//.*?$', '', mapping_content, flags=re.MULTILINE)
        mapping_content = re.sub(r'/\*[\s\S]*?\*/', '', mapping_content)
        mapping_content = re.sub(r'\s+', ' ', mapping_content)
        
        kv_pattern = r"'([^']+)'\s*:\s*'([^']+)'|\"([^\"]+)\"\s*:\s*\"([^\"]+)\""
        kv_matches = re.findall(kv_pattern, mapping_content)
        
        mapping = {}
        for match in kv_matches:
            key = match[0] if match[0] else match[2]
            value = match[1] if match[1] else match[3]
            
            if key and value and len(key) == 1 and len(value) == 1:
                mapping[key] = value
        
        return mapping
    
    def export_js(self):
        if not self.seal_mapping:
            messagebox.showwarning("提示", "映射表为空，无法导出")
            return
        
        default_dir = os.path.dirname(os.path.abspath(__file__))
        default_path = os.path.join(default_dir, "CtoChin.js")
        
        file_path = filedialog.asksaveasfilename(
            title="保存JS映射文件",
            initialfile="CtoChin.js",
            initialdir=default_dir,
            filetypes=[("JavaScript文件", "*.js"), ("所有文件", "*.*")],
            defaultextension=".js"
        )
        
        if not file_path:
            return
        
        try:
            lines = [
                "// 篆书楷化映射表",
                "// 生成时间: " + time.strftime("%Y-%m-%d %H:%M:%S"),
                "// 数据来源: 汉典（www.zdic.net）",
                "",
                "const SealMapping = {"
            ]
            
            sorted_items = sorted(self.seal_mapping.items(), key=lambda x: self.char_to_unicode(x[0]))
            
            for i, (k, v) in enumerate(sorted_items):
                comma = "," if i < len(sorted_items) - 1 else ""
                unicode_hex = f"{self.char_to_unicode(k):04X}"
                lines.append(f"    // U+{unicode_hex}")
                lines.append(f"    '{k}': '{v}'{comma}")
            
            lines.append("};")
            lines.append("")
            lines.append("// 使用示例:")
            lines.append("// function convertToSeal(char) {")
            lines.append("//     return SealMapping[char] || char;")
            lines.append("// }")
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            
            messagebox.showinfo(
                "导出成功",
                f"已成功导出 {len(self.seal_mapping)} 个映射关系\n文件保存路径：\n{file_path}"
            )
            
            self.status_var.set(f"已导出 {len(self.seal_mapping)} 个映射到：{os.path.basename(file_path)}")
            
        except Exception as e:
            messagebox.showerror("导出失败", f"写入文件出错：\n{str(e)}")
            self.status_var.set(f"导出失败：{str(e)[:50]}")
    
    def clear_mapping(self):
        if not self.seal_mapping:
            return
        
        if messagebox.askyesno("确认", f"确认清空 {len(self.seal_mapping)} 个映射？"):
            self.seal_mapping.clear()
            self.update_mapping_display()
            self.status_var.set("映射表已清空")
    
    def show_error(self, msg: str):
        messagebox.showerror("错误", msg)
        self.status_var.set(f"错误：{msg[:50]}...")
    
    def _fetch_data_callback(self, future: Future):
        self.is_fetching = False
        
        try:
            result = future.result()
            
            if 'error' in result:
                self.root.after(0, self.show_error, f"抓取失败：{result['error']}")
                self.root.after(0, lambda: self.status_var.set(f"❌ {result['error'][:50]}..."))
                return
            
            char = self.unicode_to_char(self.current_unicode)
            self.set_cached_data(char, result)
            self._update_ui_from_cache(result, char)
            
        except Exception as e:
            error_msg = f"处理数据失败：{str(e)}"
            self.root.after(0, self.show_error, error_msg)
            self.root.after(0, lambda: self.status_var.set(f"❌ {error_msg[:50]}..."))

def check_dependencies():
    required = {
        'requests': 'requests',
        'beautifulsoup4': 'bs4',
        'svglib': 'svglib',
        'reportlab': 'reportlab',
        'pillow': 'PIL'
    }
    
    missing = []
    for lib, import_name in required.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(lib)
    
    return missing

def main():
    missing = check_dependencies()
    if missing:
        msg = "缺少必要的Python库：\n\n"
        msg += "\n".join(f"• {lib}" for lib in missing)
        msg += "\n\n请使用以下命令安装：\n"
        msg += "pip install " + " ".join(missing)
        
        try:
            tk.messagebox.showerror("依赖缺失", msg)
        except:
            print(msg)
        return
    
    try:
        root = tk.Tk()
        app = SealCharacterTool(root)
        root.mainloop()
    except Exception as e:
        tk.messagebox.showerror("启动错误", f"程序启动失败：\n{str(e)}")

if __name__ == "__main__":
    main()