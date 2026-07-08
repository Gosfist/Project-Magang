<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NetworkPoint extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'type',
        'location',
        'latitude',
        'longitude',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    /**
     * Type labels for display.
     */
    public const TYPE_LABELS = [
        'odc' => 'ODC',
        'odp' => 'ODP',
        'closure' => 'Closure',
        'distribution_box' => 'Box Distribusi',
        'other' => 'Lainnya',
    ];

    /**
     * Get readable type label.
     */
    public function getTypeLabelAttribute(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }

    /**
     * Get the network inputs for this point.
     */
    public function networkInputs(): HasMany
    {
        return $this->hasMany(NetworkInput::class);
    }

    /**
     * Get the splitters at this point.
     */
    public function splitters(): HasMany
    {
        return $this->hasMany(Splitter::class);
    }

    /**
     * Get splitter outputs that point to this network point as destination.
     */
    public function incomingOutputs(): HasMany
    {
        return $this->hasMany(SplitterOutput::class, 'destination_network_point_id');
    }
}
