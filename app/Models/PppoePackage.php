<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PppoePackage extends Model
{
    protected $fillable = [
        'name',
        'download_mbps',
        'upload_mbps',
        'price',
        'address_pool',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(PppoeAccount::class);
    }

    public function getRateLimitAttribute(): string
    {
        // RouterOS membaca RX/TX dari sisi router: upload pelanggan lebih dulu.
        return "{$this->upload_mbps}M/{$this->download_mbps}M";
    }
}
