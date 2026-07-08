<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Splitter extends Model
{
    use HasFactory;

    protected $fillable = [
        'network_point_id',
        'network_input_id',
        'splitter_name',
        'splitter_ratio',
        'total_ports',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'total_ports' => 'integer',
        ];
    }

    /**
     * Get the network point where this splitter is located.
     */
    public function networkPoint(): BelongsTo
    {
        return $this->belongsTo(NetworkPoint::class);
    }

    /**
     * Get the network input that feeds this splitter.
     */
    public function networkInput(): BelongsTo
    {
        return $this->belongsTo(NetworkInput::class);
    }

    /**
     * Get the output ports of this splitter.
     */
    public function outputs(): HasMany
    {
        return $this->hasMany(SplitterOutput::class)->orderBy('port_number');
    }
}
