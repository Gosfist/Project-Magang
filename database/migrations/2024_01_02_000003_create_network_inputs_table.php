<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('network_point_id')->constrained('network_points')->onDelete('cascade');
            $table->foreignId('main_core_id')->nullable()->constrained('main_cores')->onDelete('set null');
            $table->string('source_name');
            $table->string('cable_color')->nullable();
            $table->integer('core_number')->nullable();
            $table->decimal('input_attenuation', 8, 2);
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_inputs');
    }
};
