<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('splitter_outputs')
            ->whereIn('status', ['backup', 'maintenance'])
            ->update(['status' => 'empty']);
    }

    public function down(): void
    {
        //
    }
};
