<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('main_core')) {
            return;
        }

        DB::table('main_core')
            ->where('tipe_titik', 'rasio')
            ->orderBy('id')
            ->get(['id', 'spesifikasi'])
            ->each(function ($node) {
                $specification = json_decode($node->spesifikasi ?? '[]', true) ?: [];
                $ports = $specification['rasio_redaman_ports'] ?? [];

                if (! is_array($ports) || $ports === []) {
                    $specification['rasio_redaman_ports'] = [1 => '10%', 2 => '90%'];

                    DB::table('main_core')
                        ->where('id', $node->id)
                        ->update(['spesifikasi' => json_encode($specification)]);
                }
            });
    }

    public function down(): void
    {
        // Nilai default tidak dibuang agar data rasio yang sudah ada tetap aman.
    }
};
