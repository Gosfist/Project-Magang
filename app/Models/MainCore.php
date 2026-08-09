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

    private const GENERAL_CHANGE_FIELDS = [
        'parent_id',
        'parent_port_out',
        'nama_titik',
        'tipe_titik',
        'alamat',
    ];

    protected $table = 'main_core';

    protected $fillable = [
        'parent_id',
        'parent_port_out',
        'nama_titik',
        'tipe_titik',
        'redaman_in',
        'alamat',
        'spesifikasi',
        'tanggal_perubahan',
        'tanggal_redaman',
    ];

    protected $casts = [
        'spesifikasi' => 'array',
        'redaman_in' => 'decimal:2',
        'tanggal_perubahan' => 'date',
        'tanggal_redaman' => 'date',
    ];

    protected static function booted(): void
    {
        static::creating(function (MainCore $node) {
            $today = today('Asia/Jakarta')->toDateString();

            $node->tanggal_perubahan ??= $today;

            if ($node->redaman_in !== null || $node->rasio_redaman_ports !== []) {
                $node->tanggal_redaman ??= $today;
            }
        });

        static::updating(function (MainCore $node) {
            $today = today('Asia/Jakarta')->toDateString();
            $oldSpecification = $node->getOriginal('spesifikasi') ?? [];
            $newSpecification = $node->spesifikasi ?? [];
            $oldRedamanPorts = $oldSpecification['rasio_redaman_ports'] ?? [];
            $newRedamanPorts = $newSpecification['rasio_redaman_ports'] ?? [];
            $generalSpecificationChanged = collect($oldSpecification)
                ->except('rasio_redaman_ports')
                ->all() !== collect($newSpecification)
                ->except('rasio_redaman_ports')
                ->all();

            if ($node->isDirty('redaman_in') || $oldRedamanPorts !== $newRedamanPorts) {
                $node->tanggal_redaman = $today;
            }

            if ($node->isDirty(self::GENERAL_CHANGE_FIELDS) || $generalSpecificationChanged) {
                $node->tanggal_perubahan = $today;
            }
        });
    }

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

    public function getRasioRedamanAttribute(): ?string
    {
        $ports = $this->rasio_redaman_ports;

        if ($ports === []) {
            return null;
        }

        return collect($ports)
            ->filter(fn ($value) => $value !== null && $value !== '')
            ->map(fn ($value, $port) => "Port {$port}: {$value}")
            ->implode(' Dan ');
    }

    public function getRasioRedamanPortsAttribute(): array
    {
        $ports = $this->spesifikasi['rasio_redaman_ports'] ?? [];

        if (is_array($ports)) {
            return $ports;
        }

        return [];
    }

}
