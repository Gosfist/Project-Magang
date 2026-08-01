<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('main_core') || ! Schema::hasColumn('main_core', 'parent_port_out')) {
            return;
        }

        DB::table('main_core')
            ->whereIn('tipe_titik', ['rasio', 'odc'])
            ->orderBy('id')
            ->get(['id', 'spesifikasi'])
            ->each(function ($parent) {
                $outputCount = $this->outputCount($parent->spesifikasi);

                if ($outputCount < 1) {
                    return;
                }

                $usedPorts = DB::table('main_core')
                    ->where('parent_id', $parent->id)
                    ->whereNotNull('parent_port_out')
                    ->pluck('parent_port_out')
                    ->map(fn ($port) => (int) $port)
                    ->all();

                $availablePorts = array_values(array_diff(range(1, $outputCount), $usedPorts));

                DB::table('main_core')
                    ->where('parent_id', $parent->id)
                    ->whereNull('parent_port_out')
                    ->orderBy('id')
                    ->get(['id'])
                    ->each(function ($child) use (&$availablePorts) {
                        $port = array_shift($availablePorts);

                        if (! $port) {
                            return;
                        }

                        DB::table('main_core')
                            ->where('id', $child->id)
                            ->update(['parent_port_out' => $port]);
                    });
            });
    }

    public function down(): void
    {
        //
    }

    private function outputCount(?string $specification): int
    {
        $specification = json_decode($specification ?? '[]', true) ?: [];
        $splitter = $specification['jenis_splitter'] ?? null;

        if (! is_string($splitter) || ! preg_match('/^1:(\d+)$/', $splitter, $matches)) {
            return 0;
        }

        return (int) $matches[1];
    }
};
