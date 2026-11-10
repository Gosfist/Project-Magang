package main

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

type waLog struct {
	ID           int64     `json:"id"`
	Target       string    `json:"target"`
	Text         string    `json:"text"`
	Status       string    `json:"status"`
	ErrorMessage *string   `json:"errorMessage"`
	CreatedAt    time.Time `json:"createdAt"`
}

type repository interface {
	Ping(context.Context) error
	Settings(context.Context) (map[string]string, error)
	SaveSettings(context.Context, map[string]string) error
	InsertLog(context.Context, string, string, string, *string) error
	Logs(context.Context, int, string) ([]waLog, error)
	DeleteLogs(context.Context, int64) error
}

type mysqlRepository struct{ db *sql.DB }

func openMySQL(ctx context.Context, raw string) (*mysqlRepository, error) {
	c, err := mysqlConfig(raw)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", c.FormatDSN())
	if err != nil {
		return nil, errors.New("gagal menyiapkan MySQL")
	}
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(time.Minute)
	r := &mysqlRepository{db: db}
	if err = r.Ping(ctx); err != nil {
		db.Close()
		return nil, errors.New("koneksi MySQL gagal; periksa DATABASE_URL dan layanan MySQL")
	}
	_, err = db.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS bot_wa_logs (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, target VARCHAR(50) NOT NULL, text TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'berhasil', error_message TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_bot_wa_logs_created_at (created_at), INDEX idx_bot_wa_logs_target (target)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci")
	if err != nil {
		db.Close()
		return nil, errors.New("gagal menyiapkan tabel log WhatsApp")
	}
	return r, nil
}

func (r *mysqlRepository) Ping(ctx context.Context) error { return r.db.PingContext(ctx) }

func (r *mysqlRepository) Settings(ctx context.Context) (map[string]string, error) {
	keys := []any{"wa_bot_enabled"}
	for key := range templateDefaults {
		keys = append(keys, "wa_template_"+key)
	}
	rows, err := r.db.QueryContext(ctx, "SELECT `key`, `value` FROM website_settings WHERE `key` IN ("+strings.TrimSuffix(strings.Repeat("?,", len(keys)), ",")+")", keys...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var key string
		var value sql.NullString
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		result[key] = value.String
	}
	return result, rows.Err()
}

func (r *mysqlRepository) SaveSettings(ctx context.Context, values map[string]string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for key, value := range values {
		if _, err := tx.ExecContext(ctx, "INSERT INTO website_settings (`key`, `value`, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()", key, value); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *mysqlRepository) InsertLog(ctx context.Context, phone, text, status string, message *string) error {
	_, err := r.db.ExecContext(ctx, "INSERT INTO bot_wa_logs (target, text, status, error_message, created_at) VALUES (?, ?, ?, ?, NOW())", phone, text, status, message)
	return err
}

func (r *mysqlRepository) Logs(ctx context.Context, limit int, search string) ([]waLog, error) {
	query := "SELECT id, target, text, status, error_message, created_at FROM bot_wa_logs"
	args := []any{}
	if search != "" {
		query += " WHERE target LIKE ? OR text LIKE ?"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}
	query += " ORDER BY created_at DESC, id DESC LIMIT ?"
	args = append(args, limit)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	logs := make([]waLog, 0)
	for rows.Next() {
		var item waLog
		if err := rows.Scan(&item.ID, &item.Target, &item.Text, &item.Status, &item.ErrorMessage, &item.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, item)
	}
	return logs, rows.Err()
}

func (r *mysqlRepository) DeleteLogs(ctx context.Context, id int64) error {
	if id == 0 {
		_, err := r.db.ExecContext(ctx, "DELETE FROM bot_wa_logs")
		return err
	}
	_, err := r.db.ExecContext(ctx, "DELETE FROM bot_wa_logs WHERE id = ?", id)
	return err
}
