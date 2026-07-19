<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('splitter_outputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('splitter_id')->constrained('splitters')->onDelete('cascade');
            $table->integer('port_number')->unsigned();
            $table->foreignId('destination_network_point_id')->nullable()->constrained('network_points')->onDelete('set null');
            $table->foreignId('destination_main_core_id')->nullable()->constrained('main_cores')->onDelete('set null');
            $table->decimal('output_attenuation', 8, 2)->nullable();
            $table->decimal('attenuation_difference', 8, 2)->nullable();
            $table->string('status')->default('empty');
            $table->text('description')->nullable();
            $table->timestamps();

            // Port number must be unique within a splitter
            $table->unique(['splitter_id', 'port_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('splitter_outputs');
    }
};
