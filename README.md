# Claw Office Template

[中文](./README.zh.md) | English | [日本語](./README.ja.md)

A config-driven pixel art virtual office built with **Vite + React + TypeScript + Phaser 3**. Fork it, edit one JSON file, deploy to GitHub Pages.

## Features

- Pixel art office scene with animated furniture, characters, and effects
- 4 visual states: Resting, Working, Napping, Debugging
- i18n support (Chinese / English / Japanese)
- Fully config-driven via single `office.config.json`
- Pure static — zero backend, deploy anywhere

## Quick Start

```bash
cd pixel-office-template
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Configuration

Edit `public/office.config.json` to customize:

- **office** — title, background image, canvas size
- **character** — name, default state
- **states** — define states with labels and areas
- **furniture** — position every furniture item (x, y, depth, scale)
- **theme** — colors and font
- **links** — social links (Twitter, etc.)
- **locales** — i18n strings for zh/en/ja

## Build & Deploy

```bash
npm run build
```

Output is in `dist/` — upload to GitHub Pages, Netlify, Vercel, or any static host.

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool
- [React](https://react.dev/) — UI shell
- [Phaser 3](https://phaser.io/) — game engine for pixel scene
- [TypeScript](https://www.typescriptlang.org/) — type safety

## Acknowledgements

This project is inspired by and based on [Star-Office-UI](https://github.com/ringhyacinth/star-office-ui) by [@ringhyacinth](https://github.com/ringhyacinth). Thanks for the beautiful pixel art assets and the original idea!

## Links

- Twitter: [@mobailabs](https://x.com/mobailabs)
- Original project: [star-office-ui](https://github.com/ringhyacinth/star-office-ui)
