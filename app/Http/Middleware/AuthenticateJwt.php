<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Firebase\JWT\ExpiredException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthenticateJwt
{
    public function __construct(private readonly JwtService $jwt) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return $this->unauthorized('Token tidak ditemukan.', 'token_missing');
        }

        try {
            $payload = $this->jwt->decode($token);
        } catch (ExpiredException) {
            return $this->unauthorized('Token telah kedaluwarsa. Silakan login kembali.', 'token_expired');
        } catch (Throwable) {
            return $this->unauthorized('Token tidak valid.', 'token_invalid');
        }

        $user = User::find($payload->sub);

        if (! $user || ! $user->isActive()) {
            return $this->unauthorized('Pengguna tidak ditemukan atau tidak aktif.', 'user_inactive');
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }

    private function unauthorized(string $message, string $code): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'code' => $code,
        ], 401);
    }
}
