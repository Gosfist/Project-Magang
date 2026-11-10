package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

type config struct {
	Address, BackendURL, FrontendURL, APIKey, DatabaseURL, SessionFile string
}

func loadConfig() (config, error) {
	values, err := readEnvFile(".env")
	if err != nil && !os.IsNotExist(err) {
		return config{}, errors.New("file .env bot tidak valid")
	}
	for key, value := range values {
		if _, present := os.LookupEnv(key); !present {
			os.Setenv(key, value)
		}
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		values, err := readEnvFile(filepath.Join("..", "backend", ".env"))
		if err == nil {
			dbURL = values["DATABASE_URL"]
		}
	}
	c := config{
		Address:     net.JoinHostPort(env("HOST", "127.0.0.1"), env("PORT", "3002")),
		BackendURL:  strings.TrimRight(env("BACKEND_URL", "http://127.0.0.1:3001"), "/"),
		FrontendURL: env("FRONTEND_URL", "http://localhost:3000"),
		APIKey:      os.Getenv("BOT_API_KEY"), DatabaseURL: dbURL,
		SessionFile: env("WA_SESSION_FILE", "data/whatsmeow.db"),
	}
	if c.APIKey == "" {
		return c, errors.New("BOT_API_KEY wajib diisi")
	}
	if _, err := mysqlConfig(c.DatabaseURL); err != nil {
		return c, err
	}
	u, err := url.Parse(c.BackendURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return c, errors.New("BACKEND_URL tidak valid")
	}
	return c, nil
}

// Like the previous Node dotenv loader, values are literal, without $ expansion.
func readEnvFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	values := make(map[string]string)
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), "\ufeff"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, raw, ok := strings.Cut(line, "=")
		if !ok {
			return nil, errors.New("baris env tidak valid")
		}
		key, raw = strings.TrimSpace(key), strings.TrimSpace(raw)
		if key == "" {
			return nil, errors.New("nama env kosong")
		}
		value := raw
		if strings.HasPrefix(raw, "\"") {
			if err := json.Unmarshal([]byte(raw), &value); err != nil {
				return nil, errors.New("nilai env tidak valid")
			}
		} else if strings.HasPrefix(raw, "'") {
			if len(raw) < 2 || !strings.HasSuffix(raw, "'") {
				return nil, errors.New("nilai env tidak valid")
			}
			value = raw[1 : len(raw)-1]
		} else {
			value = strings.TrimSpace(strings.SplitN(raw, "#", 2)[0])
		}
		values[key] = value
	}
	return values, scanner.Err()
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func mysqlConfig(raw string) (*mysql.Config, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "mysql" || u.Hostname() == "" || u.User == nil || strings.Trim(u.Path, "/") == "" {
		return nil, errors.New("DATABASE_URL harus URL MySQL yang valid; database aplikasi tetap MySQL")
	}
	password, _ := u.User.Password()
	port := u.Port()
	if port == "" {
		port = "3306"
	}
	host := u.Hostname()
	if host == "localhost" {
		host = "127.0.0.1"
	}
	c := mysql.NewConfig()
	c.User, c.Passwd, c.Net, c.Addr, c.DBName = u.User.Username(), password, "tcp", net.JoinHostPort(host, port), strings.TrimPrefix(u.Path, "/")
	c.ParseTime, c.Loc = true, time.UTC
	c.Timeout, c.ReadTimeout, c.WriteTimeout = 5*time.Second, 10*time.Second, 10*time.Second
	c.Params = map[string]string{"charset": "utf8mb4", "time_zone": "'+00:00'"}
	return c, nil
}
