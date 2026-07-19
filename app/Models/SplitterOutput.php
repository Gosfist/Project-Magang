<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SplitterOutput extends Model
{
    use HasFactory;

    protected $fillable = [
        'splitter_id',
        'port_number',
        'destination_network_point_id',
        'destination_main_core_id',
        'output_attenuation',
        'attenuation_difference',
        'status',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'port_number' => 'integer',
            'output_attenuation' => 'decimal:2',
            'attenuation_difference' => 'decimal:2',
        ];
    }

    /**
     * Status labels for display.
     */
    public const STATUS_LABELS = [
        'empty' => 'Kosong',
        'active' => 'Aktif',
        'damaged' => 'Rusak',
    ];

    /**
     * Status colors for badges.
     */
    public const STATUS_COLORS = [
        'empty' => 'gray',
        'active' => 'blue',
        'damaged' => 'red',
    ];

    /**
     * Get readable status label.
     */
    public function getStatusLabelAttribute(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /**
     * Get status color for badge.
     */
    public function getStatusColorAttribute(): string
    {
        return self::STATUS_COLORS[$this->status] ?? 'gray';
    }

    /**
     * Get the splitter this output belongs to.
     */
    public function splitter(): BelongsTo
    {
        return $this->belongsTo(Splitter::class);
    }

    /**
     * Get the destination network point.
     */
    public function destinationNetworkPoint(): BelongsTo
    {
        return $this->belongsTo(NetworkPoint::class, 'destination_network_point_id');
    }

    public function destinationMainCore(): BelongsTo
    {
        return $this->belongsTo(MainCore::class, 'destination_main_core_id');
    }

    /**
     * Calculate attenuation difference automatically.
     */
    public static function boot()
    {
        parent::boot();

        static::saving(function ($output) {
            if ($output->output_attenuation !== null && $output->splitter) {
                $input = $output->splitter->networkInput;
                if ($input) {
                    $output->attenuation_difference = $output->output_attenuation - $input->input_attenuation;
                }
            }
        });
    }
}
