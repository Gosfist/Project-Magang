<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FoSplitterOutput extends Model
{
    protected $table = 'fo_splitter_output';
    protected $primaryKey = 'fo_splitter_output';
    public $timestamps = false;

    protected $fillable = ['fo_splitter', 'nomor_output', 'redaman', 'target_closure', 'catatan'];

    protected function casts(): array
    {
        return ['nomor_output' => 'integer', 'redaman' => 'decimal:3'];
    }

    public function splitter(): BelongsTo
    {
        return $this->belongsTo(FoSplitter::class, 'fo_splitter', 'fo_splitter');
    }

    public function targetClosure(): BelongsTo
    {
        return $this->belongsTo(FoClosure::class, 'target_closure', 'fo_closure');
    }
}
