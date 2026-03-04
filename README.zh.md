# Claw Office Template

中文 | [English](./README.md) | [日本語](./README.ja.md)

基于 **Vite + React + TypeScript + Phaser 3** 的配置驱动像素风虚拟办公室。Fork 后只需编辑一个 JSON 文件，即可部署到 GitHub Pages。

## 演示

https://github.com/user-attachments/assets/34f90267-0d97-4435-a0a7-90c4170756b7

## 特性

- 像素风办公室场景，包含动画家具、角色和特效
- 4 种视觉状态：休息中、工作中、午休中、修 Bug
- 多语言支持（中文 / 英文 / 日文）
- 完全由 `office.config.json` 配置驱动
- 纯静态部署，无需后端

## 快速开始

```bash
cd pixel-office-template
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

## 配置说明

编辑 `public/office.config.json` 即可自定义：

- **office** — 标题、背景图、画布尺寸
- **character** — 角色名称、默认状态
- **states** — 定义状态及标签
- **furniture** — 家具位置（x, y, depth, scale）
- **theme** — 颜色和字体
- **links** — 社交链接（Twitter 等）
- **locales** — 中英日多语言文案

## 构建 & 部署

```bash
npm run build
```

产物在 `dist/` 目录，上传到 GitHub Pages、Netlify、Vercel 或任意静态托管即可。

## 技术栈

- [Vite](https://vitejs.dev/) — 构建工具
- [React](https://react.dev/) — UI 外壳
- [Phaser 3](https://phaser.io/) — 像素场景游戏引擎
- [TypeScript](https://www.typescriptlang.org/) — 类型安全

## 致谢

本项目参考并基于 [@ringhyacinth](https://github.com/ringhyacinth) 的 [Star-Office-UI](https://github.com/ringhyacinth/star-office-ui) 开发。感谢原作者提供的精美像素素材和创意灵感！

## 链接

- Twitter: [@mobailabs](https://x.com/mobailabs)
- 原始项目: [star-office-ui](https://github.com/ringhyacinth/star-office-ui)
