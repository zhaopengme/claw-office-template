# Claw Office Template

[中文](./README.zh.md) | [English](./README.md) | 日本語

**Vite + React + TypeScript + Phaser 3** で構築された、設定駆動のピクセルアート仮想オフィス。フォークして JSON ファイルを1つ編集するだけで、GitHub Pages にデプロイできます。

## デモ

https://github.com/user-attachments/assets/34f90267-0d97-4435-a0a7-90c4170756b7

## 機能

- アニメーション付きの家具、キャラクター、エフェクトを含むピクセルアートオフィスシーン
- 4つのビジュアル状態：休憩中、作業中、昼寝中、デバッグ中
- 多言語対応（中国語 / 英語 / 日本語）
- `office.config.json` 一つで完全に設定可能
- 純粋な静的サイト — バックエンド不要

## クイックスタート

```bash
cd pixel-office-template
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 設定

`public/office.config.json` を編集してカスタマイズ：

- **office** — タイトル、背景画像、キャンバスサイズ
- **character** — キャラクター名、デフォルト状態
- **states** — 状態の定義とラベル
- **furniture** — 家具の位置（x, y, depth, scale）
- **theme** — カラーとフォント
- **links** — SNSリンク（Twitter等）
- **locales** — 中英日の多言語テキスト

## ビルド & デプロイ

```bash
npm run build
```

出力は `dist/` ディレクトリに生成されます。GitHub Pages、Netlify、Vercel などにアップロードしてください。

## 技術スタック

- [Vite](https://vitejs.dev/) — ビルドツール
- [React](https://react.dev/) — UIシェル
- [Phaser 3](https://phaser.io/) — ピクセルシーン用ゲームエンジン
- [TypeScript](https://www.typescriptlang.org/) — 型安全

## 謝辞

本プロジェクトは [@ringhyacinth](https://github.com/ringhyacinth) の [Star-Office-UI](https://github.com/ringhyacinth/star-office-ui) を参考に開発されました。素晴らしいピクセルアート素材とオリジナルのアイデアに感謝します！

## リンク

- Twitter: [@mobailabs](https://x.com/mobailabs)
- オリジナルプロジェクト: [star-office-ui](https://github.com/ringhyacinth/star-office-ui)
