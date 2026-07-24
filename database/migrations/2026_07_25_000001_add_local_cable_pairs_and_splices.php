<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fo_kabel', function (Blueprint $table) {
            if (! Schema::hasColumn('fo_kabel', 'fo_closure')) {
                $table->foreignId('fo_closure')->nullable()->after('fo_kabel')->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            }
            if (! Schema::hasColumn('fo_kabel', 'target_closure')) {
                $table->foreignId('target_closure')->nullable()->after('fo_closure')->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            }
            if (! Schema::hasColumn('fo_kabel', 'paired_cable')) {
                $table->foreignId('paired_cable')->nullable()->after('target_closure')->constrained('fo_kabel', 'fo_kabel')->nullOnDelete();
            }
        });

        Schema::table('fo_core', function (Blueprint $table) {
            if (! Schema::hasColumn('fo_core', 'paired_core')) {
                $table->foreignId('paired_core')->nullable()->after('target_core')->constrained('fo_core', 'fo_core')->nullOnDelete();
            }
            if (Schema::hasColumn('fo_core', 'warna_core')) {
                $table->dropColumn('warna_core');
            }
        });

        Schema::create('fo_splice', function (Blueprint $table) {
            $table->id('fo_splice');
            $table->foreignId('fo_closure')->constrained('fo_closure', 'fo_closure')->cascadeOnDelete();
            $table->foreignId('core_a')->constrained('fo_core', 'fo_core')->cascadeOnDelete();
            $table->foreignId('core_b')->constrained('fo_core', 'fo_core')->cascadeOnDelete();
            $table->text('catatan')->nullable();
            $table->unique(['fo_closure', 'core_a', 'core_b']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fo_splice');

        Schema::table('fo_core', function (Blueprint $table) {
            if (Schema::hasColumn('fo_core', 'paired_core')) {
                $table->dropConstrainedForeignId('paired_core');
            }
            if (! Schema::hasColumn('fo_core', 'warna_core')) {
                $table->string('warna_core')->nullable();
            }
        });

        Schema::table('fo_kabel', function (Blueprint $table) {
            if (Schema::hasColumn('fo_kabel', 'paired_cable')) {
                $table->dropConstrainedForeignId('paired_cable');
            }
            if (Schema::hasColumn('fo_kabel', 'target_closure')) {
                $table->dropConstrainedForeignId('target_closure');
            }
            if (Schema::hasColumn('fo_kabel', 'fo_closure')) {
                $table->dropConstrainedForeignId('fo_closure');
            }
        });
    }
};
