<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ([
            'fo_core_endpoint',
            'fo_core',
            'fo_kabel',
            'fo_closure',
            'fiber_audit_logs',
            'fiber_connections',
            'splitter_ports',
            'fo_splitters',
            'fiber_core_endpoints',
            'fiber_cores',
            'fo_cables',
            'fo_closures',
            'splitter_outputs',
            'splitters',
            'network_inputs',
            'network_points',
            'main_cores',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::enableForeignKeyConstraints();

        Schema::create('fo_closure', function (Blueprint $table) {
            $table->id('fo_closure');
            $table->string('nama_cl');
            $table->text('alamat_cl')->nullable();
            $table->text('catatan')->nullable();
        });

        Schema::create('fo_kabel', function (Blueprint $table) {
            $table->id('fo_kabel');
            $table->string('nama_kabel');
            $table->unsignedInteger('jumlah_core');
            $table->text('catatan')->nullable();
        });

        Schema::create('fo_core', function (Blueprint $table) {
            $table->id('fo_core');
            $table->foreignId('fo_kabel')->constrained('fo_kabel', 'fo_kabel')->cascadeOnDelete();
            $table->decimal('redaman', 8, 3)->nullable();
            $table->unsignedInteger('nomer_core');
            $table->string('warna_core')->nullable();
            $table->foreignId('target_closure')->nullable()->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            $table->foreignId('target_core')->nullable()->constrained('fo_core', 'fo_core')->nullOnDelete();
            $table->decimal('direct_redaman_awal', 8, 3)->nullable();
            $table->text('catatan')->nullable();
            $table->unique(['fo_kabel', 'nomer_core']);
        });

        Schema::create('fo_core_endpoint', function (Blueprint $table) {
            $table->id('fo_core_endpoint');
            $table->foreignId('fo_core')->constrained('fo_core', 'fo_core')->cascadeOnDelete();
            $table->foreignId('fo_closure')->nullable()->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            $table->string('endpoint_side', 1);
            $table->unique(['fo_core', 'endpoint_side']);
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('fo_core_endpoint');
        Schema::dropIfExists('fo_core');
        Schema::dropIfExists('fo_kabel');
        Schema::dropIfExists('fo_closure');
        Schema::enableForeignKeyConstraints();
    }
};
