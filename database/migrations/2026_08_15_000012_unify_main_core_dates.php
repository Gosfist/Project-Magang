<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('main_core', function (Blueprint $table) {
            $table->date('tanggal')->nullable()->after('spesifikasi');
        });

        DB::table('main_core')
            ->select(['id', 'tanggal_perubahan', 'tanggal_redaman', 'updated_at'])
            ->orderBy('id')
            ->chunkById(100, function ($nodes) {
                foreach ($nodes as $node) {
                    $dates = array_filter([
                        $node->tanggal_perubahan,
                        $node->tanggal_redaman,
                        $node->updated_at ? substr((string) $node->updated_at, 0, 10) : null,
                    ]);

                    DB::table('main_core')
                        ->where('id', $node->id)
                        ->update(['tanggal' => $dates === [] ? null : max($dates)]);
                }
            });

        Schema::table('main_core', function (Blueprint $table) {
            $table->dropColumn(['tanggal_perubahan', 'tanggal_redaman']);
        });
    }

    public function down(): void
    {
        Schema::table('main_core', function (Blueprint $table) {
            $table->date('tanggal_perubahan')->nullable()->after('spesifikasi');
            $table->date('tanggal_redaman')->nullable()->after('tanggal_perubahan');
        });

        DB::table('main_core')->update([
            'tanggal_perubahan' => DB::raw('tanggal'),
            'tanggal_redaman' => DB::raw('tanggal'),
        ]);

        Schema::table('main_core', function (Blueprint $table) {
            $table->dropColumn('tanggal');
        });
    }
};
