<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MainOdcOutput extends Model
{
    protected $table = 'main_odc_output';
    protected $primaryKey = 'main_odc_output';
    public $timestamps = false;

    protected $fillable = ['main_odc', 'output_number', 'main_odp', 'redaman', 'tanggal', 'catatan'];

    public function odc(): BelongsTo
    {
        return $this->belongsTo(MainOdc::class, 'main_odc', 'main_odc');
    }

    public function odp(): BelongsTo
    {
        return $this->belongsTo(MainOdp::class, 'main_odp', 'main_odp');
    }
}
