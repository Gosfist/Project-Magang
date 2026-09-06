<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('pppoe_packages', 'shared_users')) {
            Schema::table('pppoe_packages', function (Blueprint $table) {
                $table->dropColumn('shared_users');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('pppoe_packages', 'shared_users')) {
            Schema::table('pppoe_packages', function (Blueprint $table) {
                $table->unsignedSmallInteger('shared_users')->default(1);
            });
        }
    }
};
