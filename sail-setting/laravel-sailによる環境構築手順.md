# laravel-sailによる開発環境構築

## [前提]

WSL内のUbuntuに導入するので、こちらの手順を参考に記載してます。  
https://laravel.com/docs/11.x/installation#sail-on-linux

※windowsにwslでubuntuを構築し、ubuntu内でdockerエンジンの構築が済んでいる前提  

※また、dockerコマンドを一般ユーザーでも使えるようにしておく必要あり（これをしないで無理に構築すると権限周りでいろいろ問題おきます。。）  
https://docs.docker.com/engine/install/linux-postinstall/

my-wikiの参考リンク：https://github.com/naonex/my-wiki/blob/master/00_Note/docker%E6%A7%8B%E7%AF%89%E6%89%8B%E9%A0%86%20(win%26wsl).md


## [gitクローンして構築する場合]

1. wsl内にクローンしたディレクトリを配置

2. sail-settingの.env.sampleを参考にして.envファイルを作成し、プロジェクトカレントディレクトリに配置

3. プロジェクトカレントディレクトリで `composer install` を実行

   ※↑はPHPバージョンが揃ってない（8.3ではない）と失敗する。その場合はdocker経由で実行すればOK。（ChatGPTに聞いて解決しましたｗ）

   ```
   docker run --rm \
     -v "$PWD:/app" \
     -w /app \
     --entrypoint sh \
     php:8.3-cli \
     -c 'apt-get update && apt-get install -y git unzip libxml2-dev libzip-dev curl && docker-php-ext-install dom xml zip && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && git config --global --add safe.directory /app && composer install'
   ```

   docker経由だとroot権限で作成されるので、自ユーザーに変更しておく  
   `sudo chown -fR ${USER}:${USER} ./*`

4. 初回手順の3以降を実施


## [初回構築手順]

0. dockerコマンドが使えるユーザーで、外部通信可能な状態にする（プロキシ設定するなど）

1. `docker context use default`  ...デフォなら不要っぽい。手順にはあるので実施しておく。

2. アプリ作りたい階層で以下コマンド実行(「laravel-app」を変更して作成するプロジェクト名変更可能)  
   `curl -s https://laravel.build/laravel-app | bash`

   ※最後のほうでsudoのパスワード求められるので入力すること。  
   上手く実行できてる場合、上記のコマンドのみでイメージ作成～ビルドまで自動実行可能。

3. 2まで上手くいったら、コンテナ稼働させ、初回のDBマイグレーションを行う。
   ```
   # プロジェクトカレントディレクトリに移動
   cd laravel-app
   # コンテナをデーモン起動
   ./vendor/bin/sail up -d
   # DBマイグレーション
   ./vendor/bin/sail artisan migrate
   ```

4. viteの初回構築＆本番ビルドを行う
   ```
   # 必要なライブラリインストール
   ./vendor/bin/sail npm install

   # 本番ビルド（jsソース修正の度に実行が必要）
   ./vendor/bin/sail npm run build
   
   # 開発用（jsソース修正が即時反映され、ブラウザ開発ツールで生ソースが確認できるようになる）
   ./vendor/bin/sail npm run dev
   ```

5. `localhost:8080(.envのAPP_PORT)` にアクセスし、laravelデフォのwelcomeページに行けたらOK。  
   右上のログインから確認してね！アカウントはローカルDB管理なので適当に作成してもらってOKです！

NOTE: 何回か手順にミスがあると、mysqlが立ち上がらなくなるケースあり。ボリューム削除してやり直すとうまくいきました。  
参考URL：https://yuuu-daily.com/docker_error/


---
# その他のsailコマンド
cd laravel-app

## 普段の起動・停止
./vendor/bin/sail start
./vendor/bin/sail stop

## コンテナ入りたい時
### こっちはroot
./vendor/bin/sail root-shell
### こっちはアプリ起動ユーザー
./vendor/bin/sail shell

## コンテナ削除
./vendor/bin/sail down

# デバッグ設定
1. `vendor/laravel/sail/runtimes/8.3` のphp.iniにxdebug設定追加（sail-setting内のサンプル参考）
2. `.env` にSAIL_XDEBUG_MODE設定を追加（sail-setting内のサンプル参考）
3. `.vscode\launch.json` を作成（sail-setting内のサンプル参考）
4. sailコンテナを一度潰してイメージ再作成してから再起動する
   ```
   ./vendor/bin/sail down
   ./vendor/bin/sail build
   ./vendor/bin/sail up -d

   # ※再起動後、sessionsテーブル周りでエラーが発生するケースに遭遇した（本件に起因するかは不明）。再度DBマイグレーションを行うことで解決できた。
   ```
5. 後はvsCodeの実行とデバッグから利用可能（PHP Debugの拡張機能の導入も必要）
