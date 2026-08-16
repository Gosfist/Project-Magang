<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use stdClass;

class JwtService
{
    /**
     * @return array{access_token: string, expires_at: string, expires_in: int}
     */
    public function issue(User $user): array
    {
        $issuedAt = now()->timestamp;
        $expiresIn = config('jwt.ttl') * 60;
        $expiresAt = $issuedAt + $expiresIn;

        $token = JWT::encode([
            'iss' => config('app.url'),
            'aud' => config('app.url'),
            'sub' => (string) $user->getKey(),
            'iat' => $issuedAt,
            'nbf' => $issuedAt,
            'exp' => $expiresAt,
            'jti' => (string) str()->uuid(),
        ], $this->secret(), config('jwt.algorithm'));

        return [
            'access_token' => $token,
            'expires_at' => now()->setTimestamp($expiresAt)->toIso8601String(),
            'expires_in' => $expiresIn,
        ];
    }

    public function decode(string $token): stdClass
    {
        $payload = JWT::decode($token, new Key($this->secret(), config('jwt.algorithm')));
        $issuer = (string) config('app.url');

        if (! isset($payload->iss, $payload->aud, $payload->sub)
            || ! hash_equals($issuer, (string) $payload->iss)
            || ! hash_equals($issuer, (string) $payload->aud)) {
            throw new RuntimeException('JWT claims are invalid.');
        }

        return $payload;
    }

    private function secret(): string
    {
        $secret = (string) config('jwt.secret');

        if ($secret === '') {
            throw new RuntimeException('JWT_SECRET atau APP_KEY belum dikonfigurasi.');
        }

        return $secret;
    }
}
