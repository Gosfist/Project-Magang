<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fo_splitter', function (Blueprint $table) {
            $table->id('fo_splitter');
            $table->foreignId('fo_core')->constrained('fo_core', 'fo_core')->cascadeOnDelete();
            $table->foreignId('fo_closure')->constrained('fo_closure', 'fo_closure')->cascadeOnDelete();
            $table->string('rasio_split');
            $table->text('catatan')->nullable();
            $table->unique('fo_core');
        });

        Schema::create('fo_splitter_output', function (Blueprint $table) {
            $table->id('fo_splitter_output');
            $table->foreignId('fo_splitter')->constrained('fo_splitter', 'fo_splitter')->cascadeOnDelete();
            $table->unsignedInteger('nomor_output');
            $table->decimal('redaman', 8, 3)->nullable();
            $table->foreignId('target_closure')->nullable()->constrained('fo_closure', 'fo_closure')->nullOnDelete();
            $table->foreignId('target_core')->nullable()->constrained('fo_core', 'fo_core')->nullOnDelete();
            $table->text('catatan')->nullable();
            $table->unique(['fo_splitter', 'nomor_output']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fo_splitter_output');
        Schema::dropIfExists('fo_splitter');
    }
};
