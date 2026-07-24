<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('fo_core', 'direct_redaman_awal')) {
            return;
        }

        Schema::table('fo_core', function (Blueprint $table) {
            $table->decimal('direct_redaman_awal', 8, 3)->nullable()->after('target_core');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('fo_core', 'direct_redaman_awal')) {
            return;
        }

        Schema::table('fo_core', function (Blueprint $table) {
            $table->dropColumn('direct_redaman_awal');
        });
    }
};
