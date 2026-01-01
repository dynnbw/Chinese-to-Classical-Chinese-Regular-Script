# Classical Script Conversion Platform

An online tool for converting Traditional Chinese to seal script regularized characters, allowing your "counterparts" to experience the beauty of ancient writing.

## Project Overview

This project is a web-based tool for converting seal script to regularized characters. It supports real-time conversion, font customization, data import/export, and is designed for enthusiasts of "Traditional Chinese characters".

## Important Note: On Glyphs and Pronunciation

**Please note carefully**: The seal script regularized characters converted by this tool do not necessarily correspond to the standard pronunciation of modern Chinese characters. Conversion is based on glyph structure, not pronunciation.

### Glyph Sources and Conversion Principles

The seal script glyphs used in this tool are primarily sourced from the following ancient dictionaries and literature:
- *Shuowen Jiezi* (說文解字)
- *Shuowen Jiezi Zhu* (說文解字注)
- *Kangxi Dictionary* (康熙字典)
- *Zhengzitong* (正字通)

**Conversion principles are as follows**:
1.  **Primary Principle**: Prioritize glyphs from the small seal script收录ed in *Shuowen Jiezi*.
2.  **Secondary Principle**: If no corresponding glyph exists in *Shuowen Jiezi*, use the "ancient script" (usually referring to large seal script or older forms) from its appendices.
3.  **Auxiliary Principle**: If the above are unavailable, refer to glyphs from other credible ancient texts.
4.  **Ancient-Based Principle**: When different modern characters share the same radical, the conversion of that radical should uniformly use its ancient form.
5.  **Modern-Based Principle**: If an ancient glyph has no corresponding character in the current Unicode standard, select the closest existing Chinese character as its regularized form.

**Example**:
- "𤁉" and "僅" share the radical "堇", so the conversion of this radical should use the ancient glyph uniformly. Since there is no corresponding radical character, the closest existing character is adopted.

### Therefore, the output text is primarily for glyph research, reference, and artistic design purposes. **Do not equate it directly with standard modern Chinese character writing or pronunciation.**

## Features

### Core Functions
- **Seal Script Regularization Conversion**: Convert Traditional Chinese characters to corresponding seal script regularized characters.
- **Real-Time Conversion**: Supports automatic real-time conversion during input.
- **Simplified-Traditional Conversion**: Integrates third-party simplified-to-traditional conversion tools.
- **Character Code Point Display**: Optional display of Unicode code point information.

### Font Support
- **Cloud Fonts**: Pre-installed multiple fonts supporting extended Chinese characters.
- **System Fonts**: Use system default fonts.
- **Custom Fonts**: Support loading custom fonts via URL.

### Data Management
- **Mapping Table Import**: Support importing JSON format mapping data from URLs.
- **Result Export**: Export conversion results as text files.

### Statistics
- Display total mapping count, successful conversion count, and other statistics.
- Conversion statistics.

## Quick Start

### Online Use
Directly visit https://dynnbw.github.io/Chinese-to-Classical-Chinese-Regular-Script/ to use it.

# Usage Instructions

## Interface Design and Display Differences

## Mobile Interface (Width ≤ 768px)
### Layout Adjustments
- **Horizontal Mode**: Automatically switches to traditional left-to-right horizontal layout.

- **Flexible Layout**: Control panel adjusted to horizontal arrangement, buttons displayed horizontally.

- **Touch Optimization**: Button sizes increased for finger-friendly operation.

- **Full-Screen Panels**: Font settings and simplified-traditional conversion panels occupy most of the screen.

### Interaction Features
- Vertical text area converted to horizontal input.

- Button text direction adjusted to horizontal.

- Tooltip positions adjusted to below buttons.

- Comparison results displayed horizontally (original text → conversion result).

- Size Optimization
- Main title font size reduced to 1.5em.

- Input area height fixed at 8em.

- Control panel buttons compactly arranged.

- Status bar information simplified.

## Desktop Interface (Width > 768px)
### Traditional Style
- **Vertical Mode**: Right-to-left vertical writing style.

- **Classical Layout**: Simulates the reading experience of ancient books.

- **Precise Control**: Buttons and tooltips use vertical text.

### Professional Interface Design
- Control panel fixed on the right, width 9em.

- Main content area occupies most space.

- Font settings panel centered on screen, moderate size.

- Simplified-traditional conversion tool embedded as iframe.

- Input area width adjusted to 12em.

- Panel positions finely adjusted for better touch interaction.

- Font sizes and spacing appropriately reduced.

- Fluid Layout: Automatically adjusts layout based on screen width.

- Font Size Scaling: Ensures readability on different devices.

- Touch/Mouse Optimization: Optimized interactions for different input methods.

- Smart Panel Positioning: Avoids obscuring main content.

### Basic Conversion
1. Enter Traditional Chinese in the left input box.
2. Click the "Execute Conversion" button or enable real-time conversion.
3. View the conversion result on the right.

### Font Settings
1. Click the "Font Settings" button in the control panel.
2. Select cloud or system fonts.
3. Preview and apply the selected font.

### Data Import
1. Click the "Import Data" button.
2. Enter the URL of a JSON file containing mapping data.
3. The system will automatically load and merge the mapping table.

## Character Mapping Principle

The project uses a predefined mapping table to convert modern Chinese characters to seal script regularized characters.
- Example:
```javascript
{
"天": "𠀘",
"地": "𡍑",
"日": "𡆠",
"月": "𡴑"
}
```
## Browser Compatibility
- Recommended:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

**Note**: Some extended Chinese characters require supported fonts to display correctly.

## Font Copyright Statement
The font resources used in this tool belong to their respective copyright owners:

- Source Han Serif: https://adobe.ly/SourceHanSerif

- MiSans_L3: https://hyperos.mi.com/font/about

- Huiwen Fangsong: https://tieba.baidu.com/home/main?un=%E5%A4%A9%E7%8E%8B%E5%B8%9D%E5%BB%B7&fr=home&id=tb.1.3ae0f0a7.jWVk_ZGhi3FTJbd8beY_Ng, https://tieba.baidu.com/p/9339425294?pid=151397441713&cid=#151397441713

- Other fonts: Custom fonts provided by users, copyright belongs to the respective font designers or companies.

# Acknowledgments
### Thanks to Baidu Translate for simplified-traditional conversion
### Thanks to Google for the open-source Source Han Serif font
### Thanks to Xiaomi Technology Co., Ltd. for the MiSans font
### Thanks to the designer of Huiwen Fangsong