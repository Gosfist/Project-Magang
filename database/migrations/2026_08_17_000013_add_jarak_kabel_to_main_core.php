<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('main_core', function (Blueprint $table) {
            $table->decimal('jarak_kabel', 10, 2)->nullable()->after('redaman_in');
        });
    }

    public function down(): void
    {
        Schema::table('main_core', function (Blueprint $table) {
            $table->dropColumn('jarak_kabel');
        });
    }
};
