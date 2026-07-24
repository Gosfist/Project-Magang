<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('fo_splitter_output', 'target_core')) {
            return;
        }

        Schema::table('fo_splitter_output', function (Blueprint $table) {
            $table->foreignId('target_core')->nullable()->after('target_closure')->constrained('fo_core', 'fo_core')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('fo_splitter_output', 'target_core')) {
            return;
        }

        Schema::table('fo_splitter_output', function (Blueprint $table) {
            $table->dropConstrainedForeignId('target_core');
        });
    }
};
