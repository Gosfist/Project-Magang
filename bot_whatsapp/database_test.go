package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestMySQLQueriesAreParameterizedAndFailuresPropagate(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := &mysqlRepository{db: db}
	ctx := context.Background()
	needle := "' OR 1=1 --"
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, target, text, status, error_message, created_at FROM bot_wa_logs WHERE target LIKE ? OR text LIKE ? ORDER BY created_at DESC, id DESC LIMIT ?")).WithArgs("%"+needle+"%", "%"+needle+"%", 100).
		WillReturnRows(sqlmock.NewRows([]string{"id", "target", "text", "status", "error_message", "created_at"}).AddRow(1, "081234567890", "Tagihan", "berhasil", nil, time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)))
	logs, err := r.Logs(ctx, 100, needle)
	if err != nil || len(logs) != 1 || logs[0].ErrorMessage != nil || logs[0].CreatedAt.Location() != time.UTC {
		t.Fatal("log mapping failed", err)
	}
	mock.ExpectExec("DELETE FROM bot_wa_logs WHERE id = \\?").WithArgs(int64(5)).WillReturnError(errors.New("offline"))
	if r.DeleteLogs(ctx, 5) == nil {
		t.Fatal("DB error hidden")
	}
	mock.ExpectExec("INSERT INTO bot_wa_logs").WithArgs("081234567890", "Tagihan", "berhasil", nil).WillReturnResult(sqlmock.NewResult(1, 1))
	if err := r.InsertLog(ctx, "081234567890", "Tagihan", "berhasil", nil); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSettingsRollbackOnWriteFailure(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := &mysqlRepository{db: db}
	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO website_settings").WithArgs("wa_template_sales", "Halo").WillReturnError(errors.New("offline"))
	mock.ExpectRollback()
	if r.SaveSettings(context.Background(), map[string]string{"wa_template_sales": "Halo"}) == nil {
		t.Fatal("write failure hidden")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestEnvSecretsRemainLiteral(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("# test\nBOT_API_KEY=\"literal-$test&value\"\nDATABASE_URL='mysql://user:p%40ss@localhost/db'\nHOST=127.0.0.1 # local\n"), 0600); err != nil {
		t.Fatal(err)
	}
	values, err := readEnvFile(path)
	if err != nil || values["BOT_API_KEY"] != "literal-$test&value" || values["DATABASE_URL"] != "mysql://user:p%40ss@localhost/db" || values["HOST"] != "127.0.0.1" {
		t.Fatal("secret parsing changed", err)
	}
}
