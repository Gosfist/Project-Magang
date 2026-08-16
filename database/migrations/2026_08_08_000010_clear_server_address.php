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
            ->where('tipe_titik', 'server')
            ->update(['alamat' => null]);
    }

    public function down(): void
    {
        // Alamat Server yang lama tidak dapat dipulihkan setelah dikosongkan.
    }
};
