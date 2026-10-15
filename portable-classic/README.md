# 形色 XINGSE · 智能摄影导演与提示词生图工作台

<p align="center">
  <img src="app.png" alt="形色 XINGSE Logo" width="108" height="108" style="border-radius:24px; box-shadow:0 8px 24px rgba(0,0,0,0.3);" />
</p>

<p align="center">
  <strong>将专业摄影美学转化为极致 AI 提示词 · 全可视化控制台 · 独创核心锁定池 · 纯本地私有运行</strong>
</p>

<p align="center">
  <a href="https://github.com/ww18477160599-hash/XINGSE/releases"><img src="https://img.shields.io/github/v/release/ww18477160599-hash/XINGSE?color=d4af37&label=Release" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Platform-Windows%2010%2F11-informational.svg" alt="Platform"></a>
  <img src="https://img.shields.io/badge/Architecture-Tauri%202.0%20%7C%20Node.js-orange.svg" alt="Architecture"></a>
</p>

---

## 📖 项目简介

每次用 AI 生图，都要在对话框里从头思考：焦段用 85mm 还是 35mm？光线用伦勃朗光还是侧逆光？服装材质是真丝还是粗纺？构图用三分法还是居中对称？想一遍脑细胞死一大片，出来的图还经常带着浓浓的“塑料 AI 味”。

**「形色 XINGSE」正是为了彻底消灭这种思考成本而生。**

我们将专业级摄影棚与高级时装摄影的审美法则系统化，提炼为 **7 大维度、85 个精细字段、1200+ 专业细分选项库**。配合独创的**「核心锁定池」**与**「大模型摄影导演系统」**，让你用鼠标点选就能精准指挥 AI 创作出具备电影级光影质感、真实皮肤毛孔光学和物理自然垂坠感的大师级人像摄影作品。

---

## ✨ 核心特性

- 🎬 **AI 摄影导演核心**：
  拒绝粗糙无意义的画质玄学堆词。大模型扮演具有极高审美的摄影导演，严格遵循真实物理光学、旗舰中画幅相机（如哈苏/索尼 A7R5）的景深虚化、微透次表面散射（SSS）和面料重力物理。
- 🔒 **独创“核心锁定池”**：
  所选即所锁！锁死你最在乎的创意（如：特定脸型、85mm 镜头、酒红真丝衬衫），其他未锁维度一键交给大模型导演自由挥洒、和谐搭配，绝不改动你的核心要求。
- ⚡ **双版本形态发布（开箱即用）**：
  - **原生安装版（Tauri 2.0）**：极度轻量，**无需在电脑上预装 Node.js 环境**，安装后双击秒开，极简原生体验。
  - **绿色免安装版（Classic Portable）**：随拷随用，解压即可直接双击运行，适合自由搬运或二次开发。
- 🛡️ **100% 隐私安全与纯本地直连**：
  - **零中转服务器**：没有任何中间服务器收集你的提示词与图片，所有历史记录与自建选项全存在你自己的电脑本地。
  - **自带 Key 运行（BYOK）**：支持 DeepSeek、硅基流动（SiliconFlow）、阿里云百炼、以及任何标准 OpenAI 兼容中转站。你的 API Key 仅保存在本机，请求直连官方，安全透明。
- 📐 **画幅全比例自适应**：
  支持 1:1、9:16、16:9、3:2、4:3、16:10 等主流画幅，并自动适配不同生图模型（如 FLUX、通义万相、DALL-E 3、Midjourney 比例映射）的最佳出图分辨率。
- 🗂️ **本地暗房与历史回溯**：
  生成的作品自动以企划标题命名妥善存入本地硬盘，支持一键在文件管理器打开所在文件夹，并可随时一键“复原当时作品”重新微调参数。

---

## 🚀 快速上手

### 1. 下载运行
前往项目的 [Releases 页面](https://github.com/ww18477160599-hash/XINGSE/releases) 下载最新发行版：
- **普通用户（推荐）**：下载 `形色 XINGSE_x.x.x_x64-setup.exe`，安装后即可在桌面直接启动。
- **便携玩家**：下载绿色便携压缩包，解压后双击运行 `形色.exe` 即可。

> 💡 **Windows 安装提示**：
> 本项目为独立开源作品，未购买昂贵的大企业代码签名证书。Windows SmartScreen 可能会弹出蓝底提示「未知发布者」，点击 **【更多信息】➔【仍要运行】** 即可。源码 100% 开源透明、纯本地运行，请放心使用。

### 2. 配置 API Key
首次打开软件，点击右上角 **「API 接口设置」** 填入你的专属凭证（只需填一次，保存在你本地）：
* **LLM 提示词导演推荐**：
  - **DeepSeek（强烈推荐）**：官网注册并获取 Key，便宜好用、极具审美。
  - **硅基流动 / OpenAI / 自定义中转** 均可自由切换。
* **生图通道推荐**：
  - **硅基流动（SiliconFlow）**：支持 `FLUX.1-schnell`（速度飞快且超高写实感）。
  - **阿里云百炼（DashScope）**：支持通义万相与 `qwen-image` 系列。
  - **OpenAI 兼容端点**：支持 DALL-E 3、GPT-Image 等任意标准接口。

### 3. 三步成片
1. **点选或抽签**：从左侧抽屉点选核心元素（例如风格、身材特征、服装或特定光影）。
2. **🎬 导演搭配**：大模型导演将基于你锁定的条件，在 1~2 秒内编排出一组极具摄影专业度的中英双语提示词。
3. **🚀 一键生图**：点击生图，大图实时渲染出炉，并自动归档到本地作品集！

---

## 🎨 视觉主题

工作台内置三款专业暗房视觉配色，可在顶部一键秒切：
- **黑金 / Obsidian**：沉浸深黑底色配经典雅金，专业电影导演暗房质感。
- **暖瓷 / Ceramic**：柔和燕麦暖白配温润橙色，长时间看屏舒适低对比。
- **暖木 / Crimson**：复古黑胡桃木配琥珀胶片光，浓郁复古沙龙氛围。

---

## 🛠️ 本地开发与构建

如果你想参与代码贡献或自行编译：

```bash
# 1. 克隆本仓库
git clone https://github.com/ww18477160599-hash/XINGSE.git
cd XINGSE

# 2. 安装开发依赖
npm install

# 3. 运行本地微服务调试版
npm start
# 浏览器访问 http://127.0.0.1:3721 即可

# 4. 构建 Tauri 原生桌面端 (需安装 Rust 工具链)
npm run tauri build
```

---

## 💬 交流与反馈 (Contact & Community)

- ✈️ **作者 Telegram (蓝飞机)**：`8923656260` [![Telegram](https://img.shields.io/badge/Telegram-8923656260-2CA5E0?style=flat&logo=telegram&logoColor=white)](https://t.me/8923656260)
- 欢迎交流摄影审美、提示词编排工程、模型接入或反馈 Bug 与改进建议！

---

## 📜 开源协议 (License)

本项目基于 **[MIT License](LICENSE)** 开源，欢迎自由学习、分享与二次开发。

> **免责声明**：本项目为摄影创作辅助与提示词工作台工具。所有 AI 模型推理均依赖用户自主配置的第三方服务商接口。请在遵循法律法规与各模型服务商用户协议的前提下合理使用。
