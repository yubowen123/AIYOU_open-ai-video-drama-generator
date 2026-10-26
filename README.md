<div align="center">

# 🎬 AIYOU - AI-Powered Short Drama Production Platform

**One Person, One Team | Complete AI Solution from Idea to Final Video**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vite.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[English](#english) | 简体中文

</div>

---

## ✨ 项目简介

**AIYOU** 是一个革命性的AI驱动漫剧创作平台，让创作者能够通过简单的节点式操作，完成从创意构思到最终视频成片的全流程制作。
<img width="2547" height="1305" alt="image" src="https://github.com/user-attachments/assets/23950855-b596-43e1-8b8a-cfd73b12d008" />

先看看效果，这一段成本在2块钱不到（之前sora2稳定时候）
<video src="https://github.com/user-attachments/assets/cdc2a60d-7c41-43c2-9fb9-fd64b7947521" width="900" controls></video>



### 🎯 核心优势

- 🚀 **极致效率**：传统需要一周的制作流程，现在2小时完成
- 🎨 **专业品质**：支持2K高清输出，媲美专业制作团队
- 🤖 **全流程AI**：12个智能节点覆盖剧本、角色、分镜、视频全流程
- 🔗 **节点联动**：拖拽连线即可自动生成，像搭积木一样简单
- 💰 **成本极低**：无需外包，一个人就能完成所有工作
- 🔒 **数据安全**：本地部署，创作隐私有保障

---
跟你唠唠嗑：这个项目本身是为了锻炼自己vibe coding能力的，因此这个项目完善度不足，会有很多小BUG请见谅，但在这个项目中从短剧知识的学习，到整体流程的搭建，都是一点一滴揣摩出来；系统我只能给30分，提示词我觉得还是可以的能给50分，这个产品只能作为交流学习的工具，不能作为生产力工具
当然通过这个产品也学习了很多，准备重构这一款产品，将未完善，未构建的能力都补充尽量，真正的作为一个生产力工具去使用，所以如果你是从业者或者对产品有建议可以随时沟通，欢迎拍砖指点
针对产品有任何问题可以添加我然后进入开源群一起交流沟通

  <img src="https://github.com/user-attachments/assets/efe47326-2a4d-4074-8d78-d0eb8aa10743" height="300"/> <img src="https://github.com/user-attachments/assets/a25a8fa7-4ee0-47f6-a3f6-6e078f5553eb" height="300"/>



## 🎨 功能模块

### 📝 剧本创作

| 节点 | 功能 | 价值 |
|------|------|------|
| **剧本大纲** | 一键生成5-50集剧本框架，包含世界观、角色设定 | 省去数天的剧本构思时间 |
| **剧本分集** | 自动拆分每集剧情，生成人物对白和场景描写 | 对白、场景自动完成，专业级质量 |

### 🎭 角色与分镜

| 节点 | 功能 | 价值 |
|------|------|------|
| **角色设计** | AI自动设计角色形象，生成三视图+九宫格表情包 | 无需美术基础，主角配角都能设计 |
| **分镜生成** | 根据剧本自动生成分镜脚本，景别、角度、运镜、时长全专业 | 专业镜头语言，导演级分镜 |
| **分镜图设计** | 文字直接生成2K高清分镜画面，支持九宫格/六宫格布局 | 每一帧都是壁纸级别，快速可视化 |


### 🎬 视频与音频

| 节点 | 功能 | 价值 |
|------|------|------|
| **Sora视频** | 将分镜自动化的组合成标准的sora可适配结构，智能化构建prompt | 自动化生成连贯视频 |
| **分镜视频** | 通过自由组合分镜实现分镜图片及prompt智能构建，支持多视频模型生成 | 自定义视频生成 |


### 📊 剧集优化

| 节点 | 功能 | 价值 |
|------|------|------|
| **剧集分析** | 分析爆款剧的世界观、逻辑性、角色弧光、受众共鸣点 | 学习爆款的成功秘诀 |

---

## 💡 适用场景

- 🎬 **短视频创作者** - 批量生产高质量内容，提升粉丝增长
- 📚 **漫画工作室** - 快速出分镜，大幅提升制作效率
- 🎮 **游戏开发者** - 角色设计、剧情CG、宣传视频一站式搞定
- 🎨 **设计师** - 灵感爆发，创意快速落地
- 📱 **自媒体运营** - 内容创作自动化，效率提升10倍

---

## 🏗️ Architecture

```
aiyou/
├── frontend/          # React + TypeScript + Vite (Port 4000)
├── server/            # Express + Tencent COS (Port 3001)
└── docs/              # Documentation
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator.git
cd AIYOU_open-ai-video-drama-generator
```

2. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

3. **Configure environment variables**

Create `.env.local` in root directory:
```env
GEMINI_API_KEY=your_api_key_here
```

Create `server/.env`:
```env
OSS_BUCKET=your_bucket_name
OSS_REGION=ap-guangzhou
OSS_SECRET_ID=your_secret_id
OSS_SECRET_KEY=your_secret_key
PORT=3001
```

> 💡 Get API keys: [Google AI Studio](https://ai.google.dev/) | [Tencent Cloud COS](https://console.cloud.tencent.com/cos)

4. **Start the development servers**

Terminal 1 (Backend):
```bash
cd server
npm start
```

Terminal 2 (Frontend):
```bash
npm run dev
```

5. **Open your browser**

Visit [http://localhost:4000](http://localhost:4000)

---

## 🛠️ Tech Stack

### Frontend
- **React 19.2** - UI Framework
- **TypeScript 5.8** - Type Safety
- **Vite 6.2** - Build Tool
- **Zustand** - State Management
- **React Flow** - Node-based Editor
- **Tailwind CSS** - Styling

### Backend
- **Node.js 18+** - Runtime
- **Express** - Web Framework
- **Tencent COS SDK** - File Storage
- **Multer** - File Upload

### AI Integration
- **Google Gemini API** - Image/Video/Script Generation
- **DeepSeek** - Backup AI Model
- **Multi-model Support** - Sora, Runway, Veo, Luma, MiniMax
- **Auto Fallback** - Automatic model switching

---

## 📖 Documentation

- [Backend Architecture](docs/BACKEND_ARCHITECTURE.md)
- [Code Splitting Guide](docs/CODE_SPLITTING_GUIDE.md)
- [Error Boundaries](docs/ERROR_BOUNDARIES.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## 📖 使用指南

### 基础工作流

```
创意描述 → 剧本大纲 → 剧本分集 → 角色设计 → 分镜图设计 → 文生视频
```

### 典型创作流程

1. **输入创意** - 使用「创意描述」节点写下故事想法
2. **生成剧本** - 连接「剧本大纲」和「剧本分集」生成完整剧本
3. **设计角色** - 使用「角色设计」节点创建角色三视图和表情包
4. **制作分镜** - 连接「分镜图设计」节点，生成分镜画面
5. **生成视频** - 使用「文生视频」节点生成最终视频


---

## 🎯 核心特性

### 节点式创作
- 拖拽节点到画布
- 连线建立数据流
- 自动执行生成任务
- 实时预览结果

### 智能联动
- 剧本自动传递给分镜
- 角色信息共享到所有节点
- 分镜图直接生成视频
- 全流程无缝衔接

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

**Important**: Commercial resale requires explicit written permission from the original author.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

<!-- aiyou-contact:start -->

## 联系作者 / Contact

扫码添加作者微信，交流使用体验与项目合作。

<img src="docs/assets/wechat-contact.jpg" alt="Glimmer · 光波的个人微信二维码" width="280" />

- GitHub Issues: [Submit Issues](https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator/issues)
- Email: a@ggbo.com

<!-- aiyou-contact:end -->

---

<div align="center">

**If this project helps you, please give us a ⭐️!**

Made with ❤️ by [光波](https://github.com/yubowen123)

</div>

---

## English

### Features

- 🎬 **12 Intelligent Nodes**: Cover scriptwriting, character design, storyboard, video generation
- 🚀 **Extreme Efficiency**: Complete in 2 hours what traditionally takes a week
- 🎨 **Professional Quality**: 2K HD output, comparable to professional production
- 🔗 **Node-based Workflow**: Drag-and-drop interface, connect nodes to automate
- 💰 **Ultra-Low Cost**: No outsourcing needed, one person can do it all
- 🔒 **Data Security**: Local deployment, full privacy control

### AI Models Supported

- **Video Generation**: Sora, Runway Gen-3, Veo, Luma Dream Machine
- **Image Generation**: Gemini, Midjourney, Flux, DALL-E
- **Script & Story**: Gemini 2.5 Pro, DeepSeek V3
- **Audio Generation**: Suno V4

### Typical Workflow

```
Idea Description → Script Outline → Character Design → Storyboard → Video Generation → Music
```

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ 支持一下！**

Made with ❤️ by [光波](https://github.com/yubowen123)

</div>
