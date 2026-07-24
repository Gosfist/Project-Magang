<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('main_odp', function (Blueprint $table) {
            if (Schema::hasColumn('main_odp', 'jumlah_pelanggan')) {
                $table->dropColumn('jumlah_pelanggan');
            }
        });
    }

    public function down(): void
    {
        Schema::table('main_odp', function (Blueprint $table) {
            if (! Schema::hasColumn('main_odp', 'jumlah_pelanggan')) {
                $table->unsignedInteger('jumlah_pelanggan')->default(0)->after('tanggal');
            }
        });
    }
};
