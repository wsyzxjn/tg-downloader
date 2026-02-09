# TG Download Bot

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-success)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[🇨🇳 中文文档 (Chinese Documentation)](README_CN.md)

A powerful Telegram media downloader featuring a Web Console for easy management. This project combines a Telegram Bot with a User API client to provide high-speed downloading capabilities, accessible via a modern web interface.

## ✨ Features

- **Dual Interface**: Manage tasks via Telegram Bot commands or the Web Console.
- **High Performance**: Utilizes MTProto (via `telegram`) for direct media downloads.
- **Web Dashboard**:
  - Real-time task progress monitoring.
  - Task management (cancel, retry).
  - System configuration.
- **Smart Queue**: Efficiently manages concurrent downloads.

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

### Installation & Deployment

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd tg-download-bot
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

    _Note: This will also install dependencies for the frontend (`web` directory) if configured correctly in the workspace._

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
