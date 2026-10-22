<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;

class ImageGetter extends Controller
{
    /**
     * Confirm the user's password.
     */
    public function imageGet(Request $request)
    {
        //if (! Auth::guard('web')->validate([
        //    'email' => $request->user()->email,
        //    'password' => $request->password,
        //])) {
        //    throw ValidationException::withMessages([
        //        'password' => __('auth.password'),
        //    ]);
        //}
//
        //$request->session()->put('auth.password_confirmed_at', time());

        $client = new Client();
        // APIのURL
        $urlServer = $request->get("url");

        Log::info('[imageGet:' . json_encode($request->all()) . ']');
        // Guzzle処理
        //$response = $client->request('GET', $urlServer);
        $response = Http::withHeaders([
            'Content-Type' => 'image/png'
        ])->withOptions([
            'proxy' => [
                'http' => env('PROXY_URL'),
                'https' => env('PROXY_URL')
            ],
        ])->get('https://' . $urlServer);
        //$response = Http::get('https://' . $urlServer);

        //return $response;
        $body = $response->getBody();
        $base64 = base64_encode($body);
        return response(base64_decode($base64))->header('Content-type','image/png');
    }
}
