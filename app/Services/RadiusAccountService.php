<?php

namespace App\Services;

use App\Models\PppoeAccount;
use Illuminate\Support\Facades\DB;

class RadiusAccountService
{
    public function sync(PppoeAccount $account, ?string $oldUsername = null): void
    {
        $oldUsername ??= $account->username;

        DB::table('radcheck')->where('username', $oldUsername)->delete();
        DB::table('radreply')->where('username', $oldUsername)->delete();

        $account->loadMissing('package');

        // Akun nonaktif tidak diberi kredensial RADIUS sehingga login langsung ditolak.
        if (! $account->is_active || ! $account->package->is_active) {
            return;
        }

        $checks = [
            [
                'username' => $account->username,
                'attribute' => 'Cleartext-Password',
                'op' => ':=',
                'value' => $account->password,
            ],
            [
                'username' => $account->username,
                'attribute' => 'Simultaneous-Use',
                'op' => ':=',
                // Satu akun PPPoE selalu hanya boleh memiliki satu sesi aktif.
                'value' => '1',
            ],
        ];

        if ($account->expires_at) {
            $checks[] = [
                'username' => $account->username,
                'attribute' => 'Expiration',
                'op' => ':=',
                'value' => $account->expires_at->endOfDay()->format('d M Y H:i:s'),
            ];
        }

        DB::table('radcheck')->insert($checks);

        $replies = [[
            'username' => $account->username,
            'attribute' => 'Mikrotik-Rate-Limit',
            'op' => ':=',
            'value' => $account->package->rate_limit,
        ]];

        if ($account->package->address_pool) {
            $replies[] = [
                'username' => $account->username,
                'attribute' => 'Framed-Pool',
                'op' => ':=',
                'value' => $account->package->address_pool,
            ];
        }

        DB::table('radreply')->insert($replies);
    }

    public function remove(string $username): void
    {
        DB::table('radcheck')->where('username', $username)->delete();
        DB::table('radreply')->where('username', $username)->delete();
    }
}
