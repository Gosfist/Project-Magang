<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Administrator',
            'email' => 'admin@unzanet.com',
            'password' => '123',
            'role' => 'admin',
            'status' => 'active',
        ]);

        User::create([
            'name' => 'Petugas Demo',
            'email' => 'petugas@unzanet.com',
            'password' => 'password',
            'role' => 'petugas',
            'status' => 'active',
        ]);
    }
}
