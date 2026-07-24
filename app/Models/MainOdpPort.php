<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MainOdpPort extends Model
{
    protected $table = 'main_odp_port';
    protected $primaryKey = 'main_odp_port';
    public $timestamps = false;

    protected $fillable = ['main_odp', 'port_number', 'redaman', 'tanggal', 'catatan'];

    public function odp(): BelongsTo
    {
        return $this->belongsTo(MainOdp::class, 'main_odp', 'main_odp');
    }
}
