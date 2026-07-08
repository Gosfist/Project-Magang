<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NetworkInput extends Model
{
    use HasFactory;

    protected $fillable = [
        'network_point_id',
        'main_core_id',
        'source_name',
        'cable_color',
        'core_number',
        'input_attenuation',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'core_number' => 'integer',
            'input_attenuation' => 'decimal:2',
        ];
    }

    /**
     * Get the network point that receives this input.
     */
    public function networkPoint(): BelongsTo
    {
        return $this->belongsTo(NetworkPoint::class);
    }

    /**
     * Get the main core (if applicable).
     */
    public function mainCore(): BelongsTo
    {
        return $this->belongsTo(MainCore::class);
    }

    /**
     * Get splitters fed by this input.
     */
    public function splitters(): HasMany
    {
        return $this->hasMany(Splitter::class);
    }
}
