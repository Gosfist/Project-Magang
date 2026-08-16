<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('main_core') || Schema::hasColumn('main_core', 'parent_port_out')) {
            return;
        }

        Schema::table('main_core', function (Blueprint $table) {
            $table->unsignedInteger('parent_port_out')->nullable()->after('parent_id')->index();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('main_core') || ! Schema::hasColumn('main_core', 'parent_port_out')) {
            return;
        }

        Schema::table('main_core', function (Blueprint $table) {
            $table->dropColumn('parent_port_out');
        });
    }
};
