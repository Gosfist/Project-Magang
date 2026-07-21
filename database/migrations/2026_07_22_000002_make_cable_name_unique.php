<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $indexes = collect(Schema::getIndexes('fo_kabel'))->pluck('name');
        if (! $indexes->contains('fo_kabel_nama_kabel_unique')) {
            return;
        }

        Schema::table('fo_kabel', function (Blueprint $table) {
            $table->dropUnique(['nama_kabel']);
        });
    }

    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('fo_kabel'))->pluck('name');
        if ($indexes->contains('fo_kabel_nama_kabel_unique')) {
            return;
        }

        $duplicates = DB::table('fo_kabel')
            ->select('nama_kabel')
            ->groupBy('nama_kabel')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('nama_kabel');

        foreach ($duplicates as $name) {
            $rows = DB::table('fo_kabel')->where('nama_kabel', $name)->orderBy('fo_kabel')->get();
            foreach ($rows->skip(1) as $row) {
                DB::table('fo_kabel')
                    ->where('fo_kabel', $row->fo_kabel)
                    ->update(['nama_kabel' => $row->nama_kabel . '-' . $row->fo_kabel]);
            }
        }

        Schema::table('fo_kabel', function (Blueprint $table) {
            $table->unique('nama_kabel');
        });
    }
};
