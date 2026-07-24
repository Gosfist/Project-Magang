<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fo_closure', function (Blueprint $table) {
            $table->unique('nama_cl', 'fo_closure_nama_cl_unique');
        });
    }

    public function down(): void
    {
        Schema::table('fo_closure', function (Blueprint $table) {
            $table->dropUnique('fo_closure_nama_cl_unique');
        });
    }
};
