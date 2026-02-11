# TG Downloader

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-success)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<div align="center">
  <img src="icon.svg" width="120" height="120" alt="TG Downloader Logo" />
</div>

[🇺🇸 English Documentation](README.md)

一个功能强大的 Telegram 媒体下载机器人，配备完善的 Web 控制台。该项目结合了 Telegram Bot 与用户 API 客户端（MTProto），提供便捷的高速下载体验。

## ✨ 核心特性

- **双重交互界面**：支持通过 Telegram Bot 命令或 Web 控制台管理任务。
- **高性能下载**：基于 MTProto 协议（通过 `telegram` 库）直接下载媒体文件，速度极快。
- **Web 管理面板**：
  - 实时查看任务进度与下载速度。
  - 任务管理（添加、取消）。
  - 系统参数可视化配置。
  - **双语支持**：界面支持中文与英文一键切换。
- **智能队列**：优化的并发管理机制，确保下载任务有序进行。

### 🤖 可选功能：Telegram Bot 集成

本项目内置了一个 Telegram Bot，您可以选择性开启。开启后，您可以直接在 Telegram 中与 Bot 交互：

- **便携下载**：直接将包含媒体文件的消息转发给 Bot，即可自动添加到下载队列，无需打开 Web 控制台。
- **即时反馈**：Bot 会实时回复下载进度和任务状态。
- **多语言适配**：Bot 会自动识别用户的语言设置回复中文或英文。

## 🛠 技术栈

### 后端 (Backend)

- **运行环境**: [Node.js](https://nodejs.org/) (v24+)
- **Web 框架**: [Hono](https://hono.dev/) (极速轻量的 Web 标准框架)
- **Telegram Bot 框架**: [Grammy](https://grammy.dev/)
- **Telegram 客户端协议**: [GramJS](https://github.com/gram-js/gramjs) (MTProto 移动端协议实现)
- **构建工具**: [tsup](https://tsup.egoist.dev/)

### 前端 (Web Console)

- **框架**: [React](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式方案**: [Tailwind CSS](https://tailwindcss.com/)
- **UI 组件库**: [Shadcn/ui](https://ui.shadcn.com/)
- **图标库**: [Lucide React](https://lucide.dev/)

## 🚀 部署指南

### 环境要求

- **Node.js**: 版本需 >= 24.0.0。
- **pnpm**: 推荐使用 v10 或更高版本。

### 安装与运行（源码部署）

1.  **克隆项目代码**

    ```bash
    git clone <repository-url>
    cd tg-downloader
    ```

2.  **安装依赖**

    执行以下命令安装项目根目录及前端所需的依赖包：

    ```bash
    pnpm install
    pnpm -C web install
    ```

    _说明：当前项目未使用 pnpm workspace，因此前端依赖需要单独安装。_

3.  **构建项目**

    此命令将同时构建后端服务（生成 `dist` 目录）和前端页面（生成 Web 静态资源）：

    ```bash
    pnpm build
    ```

4.  **启动服务**

    构建完成后，启动应用程序：

    ```bash
    pnpm start
    ```

    服务启动后，通常会监听 `3000` 端口（或根据您的配置而定）。

### 🐳 Docker 部署（推荐）

1.  **运行容器**

    ```bash
    docker run -d \
      -p 3000:3000 \
      -v $(pwd)/downloads:/app/downloads \
      -v $(pwd)/config:/app/config \
      --name tg-downloader \
      ghcr.io/wsyzxjn/tg-downloader:latest
    ```

    - `/app/downloads`: 映射宿主机的下载目录。
    - `/app/config`: 映射宿主机的配置目录（持久化保存配置信息）。

2.  **使用 Docker Compose**

    创建 `docker-compose.yml` 文件：

    ```yaml
    version: "3"
    services:
      tg-downloader:
        image: ghcr.io/wsyzxjn/tg-downloader:latest
        container_name: tg-downloader
        ports:
          - "3000:3000"
        volumes:
          - ./downloads:/app/downloads
          - ./config:/app/config
        restart: unless-stopped
    ```

    然后运行：

    ```bash
    docker-compose up -d
    ```

### 初始化配置

首次启动后，请在浏览器中访问 Web 界面（例如 `http://localhost:3000`）。系统会引导您进入初始化设置向导，您需要配置以下信息：

- **API ID & API Hash**: 请前往 [my.telegram.org](https://my.telegram.org) 申请获取。
- **Bot Token**: 请通过 Telegram 的 [@BotFather](https://t.me/BotFather) 获取。
- **下载存储路径**: 指定文件保存的本地目录。

配置完成后，服务将自动重启并生效。

## 💻 本地开发

### 后端开发

以监听模式启动后端服务，代码变动时会自动热重载：

```bash
pnpm dev
```

### 前端开发

启动前端开发服务器（Vite）：

```bash
pnpm -C web dev
```

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 许可证。
