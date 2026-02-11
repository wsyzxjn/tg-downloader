# TG Downloader

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-success)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<div align="center">
  <img src="icon.svg" width="120" height="120" alt="TG Downloader Logo" />
</div>

[🇨🇳 中文文档 (Chinese Documentation)](README_CN.md)

A powerful Telegram media downloader featuring a Web Console for easy management. This project combines a Telegram Bot with a User API client to provide high-speed downloading capabilities, accessible via a modern web interface.

## ✨ Features

- **Dual Interface**: Manage tasks via Telegram Bot commands or the Web Console.
- **High Performance**: Utilizes MTProto (via `telegram`) for direct media downloads.
- **Web Dashboard**:
  - Real-time task progress monitoring.
  - Task management (create, cancel).
  - System configuration.
  - **Bilingual Interface**: Toggle between English and Chinese.
- **Smart Queue**: Efficiently manages concurrent downloads.

### 🤖 Optional Feature: Telegram Bot Integration

This project includes a built-in Telegram Bot that you can choose to enable. Once active, you can interact directly within Telegram:

- **Forward & Download**: Simply forward messages containing media to the bot to create download tasks instantly.
- **Instant Feedback**: Receive task progress and status updates directly in chat.
- **Multilingual Support**: The Bot automatically responds in your language (English/Chinese).

## 🛠 Tech Stack

### Backend

- **Runtime**: [Node.js](https://nodejs.org/) (v24+)
- **Framework**: [Hono](https://hono.dev/) (Lightweight web framework)
- **Telegram Bot**: [Grammy](https://grammy.dev/)
- **Telegram Client**: [GramJS](https://github.com/gram-js/gramjs) (MTProto mobile client implementation)
- **Bundler**: [tsup](https://tsup.egoist.dev/)

### Frontend (Web Console)

- **Framework**: [React](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 24.0.0 or higher.
- **pnpm**: Version 10 or higher.

### Installation (Local)

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd tg-downloader
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    pnpm -C web install
    ```
    _Note: This project is not using a pnpm workspace, so frontend dependencies need to be installed separately._

3.  **Build the project**

    This command builds both the backend (using `tsup`) and the frontend (using `vite`).

    ```bash
    pnpm build
    ```

4.  **Start the application**

    ```bash
    pnpm start
    ```

    The server will start (default port is usually `3000` or defined in config).

### 🐳 Docker Deployment

1.  **Run the container**

    ```bash
    docker run -d \
      -p 3000:3000 \
      -v $(pwd)/downloads:/app/downloads \
      -v $(pwd)/config:/app/config \
      --name tg-downloader \
      ghcr.io/wsyzxjn/tg-downloader:latest
    ```

    - `/app/downloads`: Maps the download directory to host.
    - `/app/config`: Maps the configuration directory to host (persists settings).

2.  **Docker Compose**

    Create a `docker-compose.yml` file:

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

    Then run:

    ```bash
    docker-compose up -d
    ```

### Configuration

Upon the first launch, navigate to the web interface (e.g., `http://localhost:3000`). You will be guided through the initialization process to configure:

- **Telegram API ID & Hash**: Obtain these from [my.telegram.org](https://my.telegram.org).
- **Bot Token**: Obtain from [@BotFather](https://t.me/BotFather).
- **Download Path**: Directory where files will be saved.

## 💻 Development

### Backend Development

Start the backend in watch mode:

```bash
pnpm dev
```

### Frontend Development

Start the frontend dev server:

```bash
pnpm -C web dev
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
