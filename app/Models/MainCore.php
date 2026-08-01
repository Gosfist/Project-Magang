<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MainCore extends Model
{
    use SoftDeletes;

    public const TYPES = ['server', 'rasio', 'odc', 'odp'];
    public const SPLITTER_RATIOS = ['1:2', '1:4'];
    public const ODP_RATIOS = ['1:2', '1:4', '1:8'];

    protected $table = 'main_core';

    protected $fillable = [
        'parent_id',
        'parent_port_out',
        'nama_titik',
        'tipe_titik',
        'redaman_in',
        'alamat',
        'spesifikasi',
    ];

    protected $casts = [
        'spesifikasi' => 'array',
        'redaman_in' => 'decimal:2',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('parent_port_out')->orderBy('nama_titik');
    }

    public function scopeType($query, string $type)
    {
        return $query->where('tipe_titik', $type);
    }

    public function getJenisSplitterAttribute(): ?string
    {
        return $this->spesifikasi['jenis_splitter'] ?? null;
    }

    public function getJumlahOutputAttribute(): ?int
    {
        if (! $this->jenis_splitter) {
            return null;
        }

        return (int) str_replace('1:', '', $this->jenis_splitter);
    }

}
