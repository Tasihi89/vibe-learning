# 页面用的开源库

放在这里，页面从本机服务（`/_vendor/…`）取，不从网上的 CDN 取：网络慢、连不上 CDN 时页面照样能用。都是原样的官方文件，没改过。

| 文件 | 库 | 版本 | 协议 |
|---|---|---|---|
| `marked.min.js` | [marked](https://github.com/markedjs/marked)：把 Markdown 变成网页 | 15.0.6 | MIT（`marked.LICENSE.md`） |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify)：清理 AI 写的 HTML 和 SVG | 3.2.3 | Apache-2.0 或 MPL-2.0（`dompurify.LICENSE`） |
| `katex/` | [KaTeX](https://github.com/KaTeX/KaTeX)：显示公式（只带了 woff2 字体） | 0.16.11 | MIT（`katex/LICENSE`） |
