<?php

return [
    'secret' => env('JWT_SECRET') ?: env('APP_KEY'),
    'algorithm' => 'HS256',
    'ttl' => (int) env('JWT_TTL', 10080),
];
