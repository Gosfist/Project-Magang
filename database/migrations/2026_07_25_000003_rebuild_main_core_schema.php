<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('fo_splice');
        Schema::dropIfExists('fo_splitter_output');
        Schema::dropIfExists('fo_splitter');
        Schema::dropIfExists('fo_core_endpoint');
        Schema::dropIfExists('fo_core');
        Schema::dropIfExists('fo_kabel');
        Schema::dropIfExists('fo_closure');
        Schema::dropIfExists('fo_cables');
        Schema::dropIfExists('fo_closures');

        Schema::create('main_server_core', function (Blueprint $table) {
            $table->id('main_server_core');
            $table->unsignedInteger('core');
            $table->date('tanggal')->nullable();
            $table->text('catatan')->nullable();
            $table->unique('core');
        });

        Schema::create('main_odp', function (Blueprint $table) {
            $table->id('main_odp');
            $table->string('nama_odp')->unique();
            $table->string('rasio_split', 8);
            $table->decimal('redaman', 8, 3)->nullable();
            $table->date('tanggal')->nullable();
            $table->text('catatan')->nullable();
        });

        Schema::create('main_odc', function (Blueprint $table) {
            $table->id('main_odc');
            $table->string('nama_odc')->unique();
            $table->foreignId('main_server_core')->constrained('main_server_core', 'main_server_core')->cascadeOnDelete();
            $table->string('rasio_split', 8);
            $table->decimal('redaman', 8, 3)->nullable();
            $table->date('tanggal')->nullable();
            $table->text('catatan')->nullable();
        });

        Schema::create('main_odc_output', function (Blueprint $table) {
            $table->id('main_odc_output');
            $table->foreignId('main_odc')->constrained('main_odc', 'main_odc')->cascadeOnDelete();
            $table->unsignedInteger('output_number');
            $table->foreignId('main_odp')->nullable()->constrained('main_odp', 'main_odp')->nullOnDelete();
            $table->decimal('redaman', 8, 3)->nullable();
            $table->date('tanggal')->nullable();
            $table->text('catatan')->nullable();
            $table->unique(['main_odc', 'output_number']);
        });

        Schema::create('main_odp_port', function (Blueprint $table) {
            $table->id('main_odp_port');
            $table->foreignId('main_odp')->constrained('main_odp', 'main_odp')->cascadeOnDelete();
            $table->unsignedInteger('port_number');
            $table->decimal('redaman', 8, 3)->nullable();
            $table->date('tanggal')->nullable();
            $table->text('catatan')->nullable();
            $table->unique(['main_odp', 'port_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('main_odp_port');
        Schema::dropIfExists('main_odc_output');
        Schema::dropIfExists('main_odc');
        Schema::dropIfExists('main_odp');
        Schema::dropIfExists('main_server_core');
    }
};
