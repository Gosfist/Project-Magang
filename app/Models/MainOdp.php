<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainOdp extends Model
{
    public const RATIOS = ['1:2', '1:4', '1:8'];

    protected $table = 'main_odp';
    protected $primaryKey = 'main_odp';
    public $timestamps = false;

    protected $fillable = ['nama_odp', 'rasio_split', 'redaman', 'tanggal', 'catatan'];

    public function ports(): HasMany
    {
        return $this->hasMany(MainOdpPort::class, 'main_odp', 'main_odp')->orderBy('port_number');
    }

    public function odcOutputs(): HasMany
    {
        return $this->hasMany(MainOdcOutput::class, 'main_odp', 'main_odp');
    }

    public function getSplitCountAttribute(): int
    {
        return (int) str_replace('1:', '', $this->rasio_split ?: '1:8');
    }
}
