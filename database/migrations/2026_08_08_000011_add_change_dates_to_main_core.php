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
            $table->date('tanggal_perubahan')->nullable()->after('spesifikasi');
            $table->date('tanggal_redaman')->nullable()->after('tanggal_perubahan');
        });

        DB::table('main_core')->update([
            'tanggal_perubahan' => DB::raw('DATE(updated_at)'),
        ]);

        DB::table('main_core')
            ->whereNotNull('redaman_in')
            ->update([
                'tanggal_redaman' => DB::raw('DATE(updated_at)'),
            ]);
    }

    public function down(): void
    {
        Schema::table('main_core', function (Blueprint $table) {
            $table->dropColumn(['tanggal_perubahan', 'tanggal_redaman']);
        });
    }
};
