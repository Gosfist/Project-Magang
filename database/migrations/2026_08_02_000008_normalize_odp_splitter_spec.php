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
            ->where('tipe_titik', 'odp')
            ->orderBy('id')
            ->get(['id', 'spesifikasi'])
            ->each(function ($node) {
                $specification = json_decode($node->spesifikasi ?? '[]', true) ?: [];

                if (isset($specification['jenis_splitter'])) {
                    unset($specification['kapasitas_port'], $specification['port_terpakai']);
                } elseif (isset($specification['kapasitas_port'])) {
                    $specification['jenis_splitter'] = '1:'.(int) $specification['kapasitas_port'];
                    unset($specification['kapasitas_port'], $specification['port_terpakai']);
                }

                DB::table('main_core')
                    ->where('id', $node->id)
                    ->update(['spesifikasi' => $specification === [] ? null : json_encode($specification)]);
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('main_core')) {
            return;
        }

        DB::table('main_core')
            ->where('tipe_titik', 'odp')
            ->orderBy('id')
            ->get(['id', 'spesifikasi'])
            ->each(function ($node) {
                $specification = json_decode($node->spesifikasi ?? '[]', true) ?: [];

                if (isset($specification['jenis_splitter']) && preg_match('/^1:(\d+)$/', $specification['jenis_splitter'], $matches)) {
                    $specification['kapasitas_port'] = (int) $matches[1];
                    unset($specification['jenis_splitter']);

                    DB::table('main_core')
                        ->where('id', $node->id)
                        ->update(['spesifikasi' => json_encode($specification)]);
                }
            });
    }
};
