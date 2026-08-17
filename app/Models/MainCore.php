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

    public const RASIO_SPLITTER = '1:2';

    public const ODC_RATIOS = ['1:2', '1:4', '1:8'];

    public const ODP_RATIOS = ['1:2', '1:4', '1:8'];

    public const CABLE_LOSS_DB_PER_KM = 0.35; // 1310 nm

    public const CONNECTOR_LOSS_DB_PER_PAIR = 0.5;

    public const ODC_TO_ODP_CONNECTOR_PAIRS = 2;

    protected $table = 'main_core';

    protected $fillable = [
        'parent_id',
        'parent_port_out',
        'nama_titik',
        'tipe_titik',
        'redaman_in',
        'jarak_kabel',
        'alamat',
        'spesifikasi',
    ];

    protected $casts = [
        'spesifikasi' => 'array',
        'redaman_in' => 'decimal:2',
        'jarak_kabel' => 'decimal:2',
        'tanggal' => 'date',
    ];

    protected static function booted(): void
    {
        static::creating(function (MainCore $node) {
            $node->tanggal = today('Asia/Jakarta')->toDateString();

            if ($node->tipe_titik === 'rasio') {
                $specification = is_array($node->spesifikasi) ? $node->spesifikasi : [];
                $ports = $specification['rasio_redaman_ports'] ?? [];

                $specification['jenis_splitter'] = self::RASIO_SPLITTER;
                $specification['rasio_redaman_ports'] = is_array($ports) && $ports !== []
                    ? $ports
                    : [1 => '10%', 2 => '90%'];
                $node->spesifikasi = $specification;
            }
        });

        static::updating(function (MainCore $node) {
            $changedFields = collect($node->getDirty())->except(['tanggal', 'updated_at']);

            if ($changedFields->isNotEmpty()) {
                $node->tanggal = today('Asia/Jakarta')->toDateString();
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

    public function splitterLossForPort(?int $port): float
    {
        if ($this->tipe_titik === 'server') {
            return 0.0;
        }

        if ($this->tipe_titik === 'rasio' && $port) {
            $percentage = $this->ratioPercentageForPort($port);

            if ($percentage !== null) {
                return -10 * log10($percentage / 100);
            }
        }

        return $this->jumlah_output
            ? 10 * log10($this->jumlah_output)
            : 0.0;
    }

    private function ratioPercentageForPort(int $port): ?float
    {
        $value = $this->rasio_redaman_ports[$port] ?? null;

        return self::parsePercentage($value);
    }

    public static function parsePercentage(mixed $value): ?float
    {
        if (! is_scalar($value)) {
            return null;
        }

        $normalized = str_replace(',', '.', trim((string) $value));

        if (! preg_match('/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%?$/', $normalized)) {
            return null;
        }

        $percentage = (float) rtrim($normalized, '%');

        return $percentage > 0 && $percentage <= 100 ? $percentage : null;
    }
}
