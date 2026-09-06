<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pppoe_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedInteger('download_mbps');
            $table->unsignedInteger('upload_mbps');
            $table->unsignedBigInteger('price')->default(0);
            $table->string('address_pool')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('pppoe_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pppoe_package_id')->constrained('pppoe_packages')->restrictOnDelete();
            $table->string('customer_name');
            $table->string('username', 64)->unique();
            $table->text('password');
            $table->string('phone', 30)->nullable();
            $table->text('address')->nullable();
            $table->date('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Nama dan struktur tabel mengikuti skema SQL bawaan FreeRADIUS.
        Schema::create('radcheck', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('==');
            $table->string('value', 253)->default('');
        });

        Schema::create('radreply', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('=');
            $table->string('value', 253)->default('');
        });

        Schema::create('radgroupcheck', function (Blueprint $table) {
            $table->increments('id');
            $table->string('groupname', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('==');
            $table->string('value', 253)->default('');
        });

        Schema::create('radgroupreply', function (Blueprint $table) {
            $table->increments('id');
            $table->string('groupname', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('=');
            $table->string('value', 253)->default('');
        });

        Schema::create('radusergroup', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('groupname', 64)->default('');
            $table->integer('priority')->default(1);
        });

        Schema::create('radacct', function (Blueprint $table) {
            $table->bigIncrements('radacctid');
            $table->string('acctsessionid', 64)->default('')->index();
            $table->string('acctuniqueid', 32)->default('')->unique();
            $table->string('username', 64)->default('')->index();
            $table->string('groupname', 64)->default('');
            $table->string('realm', 64)->nullable();
            $table->string('nasipaddress', 45)->default('')->index();
            $table->string('nasportid', 32)->nullable();
            $table->string('nasporttype', 32)->nullable();
            $table->dateTime('acctstarttime')->nullable()->index();
            $table->dateTime('acctupdatetime')->nullable();
            $table->dateTime('acctstoptime')->nullable()->index();
            $table->integer('acctinterval')->nullable();
            $table->unsignedInteger('acctsessiontime')->nullable();
            $table->string('acctauthentic', 32)->nullable();
            $table->string('connectinfo_start', 50)->nullable();
            $table->string('connectinfo_stop', 50)->nullable();
            $table->unsignedBigInteger('acctinputoctets')->nullable();
            $table->unsignedBigInteger('acctoutputoctets')->nullable();
            $table->string('calledstationid', 50)->default('');
            $table->string('callingstationid', 50)->default('');
            $table->string('acctterminatecause', 32)->default('');
            $table->string('servicetype', 32)->nullable();
            $table->string('framedprotocol', 32)->nullable();
            $table->string('framedipaddress', 45)->default('')->index();
            $table->string('framedipv6address', 45)->default('')->index();
            $table->string('framedipv6prefix', 45)->default('')->index();
            $table->string('framedinterfaceid', 44)->default('')->index();
            $table->string('delegatedipv6prefix', 45)->default('')->index();
            $table->string('class', 64)->nullable();
        });

        Schema::create('radpostauth', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('username', 64)->default('');
            $table->string('pass', 64)->default('');
            $table->string('reply', 32)->default('');
            $table->timestamp('authdate')->useCurrent();
            $table->string('class', 64)->default('');
        });

        Schema::create('nas', function (Blueprint $table) {
            $table->increments('id');
            $table->string('nasname', 128)->index();
            $table->string('shortname', 32)->nullable();
            $table->string('type', 30)->default('other');
            $table->unsignedSmallInteger('ports')->nullable();
            $table->string('secret', 60)->default('secret');
            $table->string('server', 64)->nullable();
            $table->string('community', 50)->nullable();
            $table->string('description', 200)->default('RADIUS Client');
            $table->string('require_ma', 4)->default('auto');
            $table->string('limit_proxy_state', 4)->default('auto');
        });

        Schema::create('nasreload', function (Blueprint $table) {
            $table->string('nasipaddress', 45)->primary();
            $table->dateTime('reloadtime');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nasreload');
        Schema::dropIfExists('nas');
        Schema::dropIfExists('radpostauth');
        Schema::dropIfExists('radacct');
        Schema::dropIfExists('radusergroup');
        Schema::dropIfExists('radgroupreply');
        Schema::dropIfExists('radgroupcheck');
        Schema::dropIfExists('radreply');
        Schema::dropIfExists('radcheck');
        Schema::dropIfExists('pppoe_accounts');
        Schema::dropIfExists('pppoe_packages');
    }
};
