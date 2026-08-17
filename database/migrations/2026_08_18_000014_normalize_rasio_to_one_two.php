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

                $specification['jenis_splitter'] = '1:2';
                $specification['rasio_redaman_ports'] = is_array($ports)
                    ? array_intersect_key($ports, array_flip([1, 2]))
                    : [];

                DB::table('main_core')
                    ->where('id', $node->id)
                    ->update(['spesifikasi' => json_encode($specification)]);
            });
    }

    public function down(): void
    {
        // Normalisasi 1:2 tidak dapat mengembalikan nilai port 3-4 yang sudah dibuang.
    }
};
