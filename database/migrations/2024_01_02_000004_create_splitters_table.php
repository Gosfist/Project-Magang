<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('splitters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('network_point_id')->constrained('network_points')->onDelete('cascade');
            $table->foreignId('network_input_id')->constrained('network_inputs')->onDelete('cascade');
            $table->string('splitter_name');
            $table->string('splitter_ratio');
            $table->integer('total_ports')->unsigned();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('splitters');
    }
};
