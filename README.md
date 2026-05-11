# 見積フロー デモ（静的サイト）

設備メンテ向けの **見積取得〜比較〜承認〜客先提示** を、**AIアシスタント** と **自分** の役割が分かる UI で体験するコンセプトデモです。  
**外部送信・実データ連携は一切ありません**（`web/` 内はすべてフロントのみ）。

## クライアントに URL だけ渡して試してもらう（GitHub Pages）

1. このフォルダ `facility-quote-agent-demo` を **GitHub リポジトリのルート** として新規作成し、`web` フォルダがリポジトリ直下にある状態で push します。
2. GitHub リポジトリの **Settings → Pages** を開き、**Build and deployment** の **Source** を **GitHub Actions** に設定します。
3. `main`（または `master`）ブランチへ push すると、`.github/workflows/deploy-pages.yml` が動き、`web/` の内容が Pages に公開されます。
4. 数分後、次の形式の URL を共有できます（`<user>` `<repo>` は置き換え）。

   `https://<user>.github.io/<repo>/`

5. 以降、`web/` 以下を更新して `main` に push するたびにサイトが更新されます。

### 注意

- 初回のみ Pages の有効化と Actions の完了待ちが必要です。
- プライベートリポジトリの場合、Pages の閲覧権限は GitHub のプラン・設定に依存します。社外に広く見せる場合は **Public リポジトリ** か、別ホスト（Cloudflare Pages 等）も検討してください。
- このデモは **提案・UI検証用** です。実務の契約・法務判断には使わないでください。

## ローカルで確認

```bash
cd web
python3 -m http.server 8899 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8899/` を開きます。

## フォルダ構成（抜粋）

| パス | 内容 |
|------|------|
| `web/` | デモ本体（HTML / CSS / JS） |
| `docs/legal-it-checklist.md` | PoC 前の法務・情シス用チェックリスト案 |
| `demo_agent.py` | 同じ架空データの CLI サンプル（`pydantic` が必要） |
