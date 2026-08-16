<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('main_odp_port');
        Schema::dropIfExists('main_odc_output');
        Schema::dropIfExists('main_odc');
        Schema::dropIfExists('main_odp');
        Schema::dropIfExists('main_server_core');
        Schema::dropIfExists('main_core');

        Schema::create('main_core', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->index()->constrained('main_core')->nullOnDelete();
            $table->unsignedInteger('parent_port_out')->nullable()->index();
            $table->string('nama_titik')->index()->unique();
            $table->enum('tipe_titik', ['server', 'rasio', 'odc', 'odp'])->index();
            $table->decimal('redaman_in', 5, 2)->nullable();
            $table->text('alamat')->nullable();
            $table->json('spesifikasi')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('main_core');
    }
};
