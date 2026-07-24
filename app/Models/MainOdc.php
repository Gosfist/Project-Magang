<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainOdc extends Model
{
    public const RATIOS = ['1:2', '1:4', '1:8'];

    protected $table = 'main_odc';
    protected $primaryKey = 'main_odc';
    public $timestamps = false;

    protected $fillable = ['nama_odc', 'main_server_core', 'rasio_split', 'redaman', 'tanggal', 'catatan'];

    public function serverCore(): BelongsTo
    {
        return $this->belongsTo(MainServerCore::class, 'main_server_core', 'main_server_core');
    }

    public function outputs(): HasMany
    {
        return $this->hasMany(MainOdcOutput::class, 'main_odc', 'main_odc')->orderBy('output_number');
    }

    public function getSplitCountAttribute(): int
    {
        return (int) str_replace('1:', '', $this->rasio_split ?: '1:4');
    }
}
