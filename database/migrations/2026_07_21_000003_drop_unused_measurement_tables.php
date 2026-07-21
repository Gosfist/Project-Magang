<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('fiber_measurement_thresholds');
        Schema::dropIfExists('optical_measurements');
    }

    public function down(): void
    {
        //
    }
};
