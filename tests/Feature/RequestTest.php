<?php

/*
    ■テストの実行
    1．プロジェクトカレントディレクトリに移動
    2．下記コマンドで、テストコード実行
       ./vendor/bin/sail phpunit --display-skipped tests/Feature/RequestTest.php
*/

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

use App\Models\User;

class RequestTest extends TestCase
{
    use RefreshDatabase;

   /**
    * 事前準備
    * @return void
    */
    protected function setUp(): void
    {
        parent::setUp();

        // テスト用ユーザーを作成
        /** @var \App\Models\User $user */
        $user = User::factory()->create();

        // ログイン済み状態にする
        $this->actingAs($user);
    }

    /**
     * test get
     * @return void
     */
    public function testGet(): void
    {
        //クエリストリングに設定するデータ
        $data = [
            'param1' => "あ",
        ];
        $query = http_build_query($data);

        // $url = '/operation/test';
        
        if (isset($url)) {
            ////セッション情報設定
            //session()->put('ID',1);
            //GET ※第二引数はヘッダーのパラメータになってしまうので、以下の方法でクエリストリング設定
            $url = isset($query) ? sprintf('%s?%s', $url, $query) : $url;
            $response = $this->get($url);
            //$response->dumpHeaders();
            //$response->dump();
            //$response->dumpSession();
            $response->assertStatus(200);
        } else {
            $this->markTestSkipped('URLが設定されていません。');
        }
    }

    /**
     * test post
     * @return void
     */
    public function testPost(): void
    {
        // $url = '/operation/test';

        if (isset($url)) {
            //POST
            $response = $this->post($url,[
                'param1' => "あ",
            ]);
            //$response->dumpHeaders();
            //$response->dump();
            //$response->dumpSession();
            $response->assertStatus(200);
        } else {
            $this->markTestSkipped('URLが設定されていません。');
        }
    }
}
