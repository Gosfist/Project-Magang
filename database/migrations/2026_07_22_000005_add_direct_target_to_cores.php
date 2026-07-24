<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fo_core', function (Blueprint $table) {
            if (! Schema::hasColumn('fo_core', 'target_closure')) {
                $table->foreignId('target_closure')->nullable()->after('warna_core')->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            }

            if (! Schema::hasColumn('fo_core', 'target_core')) {
                $table->foreignId('target_core')->nullable()->after('target_closure')->constrained('fo_core', 'fo_core')->nullOnDelete();
            }

            if (! Schema::hasColumn('fo_core', 'direct_redaman_awal')) {
                $table->decimal('direct_redaman_awal', 8, 3)->nullable()->after('target_core');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fo_core', function (Blueprint $table) {
            if (Schema::hasColumn('fo_core', 'target_core')) {
                $table->dropConstrainedForeignId('target_core');
            }

            if (Schema::hasColumn('fo_core', 'direct_redaman_awal')) {
                $table->dropColumn('direct_redaman_awal');
            }

            if (Schema::hasColumn('fo_core', 'target_closure')) {
                $table->dropConstrainedForeignId('target_closure');
            }
        });
    }
};
