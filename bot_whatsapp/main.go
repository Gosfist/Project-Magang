package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"
)

func run() error {
	checkDB := flag.Bool("check-db", false, "Uji koneksi MySQL, template, dan log tanpa menghubungkan WhatsApp")
	flag.Parse()
	c, err := loadConfig()
	if err != nil {
		return err
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	startup, stopStartup := context.WithTimeout(ctx, 15*time.Second)
	db, err := openMySQL(startup, c.DatabaseURL)
	stopStartup()
	if err != nil {
		return err
	}
	defer db.db.Close()
	if *checkDB {
		check, done := context.WithTimeout(ctx, 10*time.Second)
		defer done()
		if _, err := db.Settings(check); err != nil {
			return errors.New("gagal membaca template MySQL")
		}
		if _, err := db.Logs(check, 1, ""); err != nil {
			return errors.New("gagal membaca log MySQL")
		}
		log.Print("[Bot WA] Koneksi MySQL, template, dan log OK; WhatsApp tidak dihubungkan")
		return nil
	}
	wa, err := openWhatsApp(ctx, c.SessionFile)
	if err != nil {
		return err
	}
	defer wa.Close()
	if err := wa.Start(); err != nil {
		return err
	}
	server := &http.Server{Addr: c.Address, Handler: newAPI(c, db, wa), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 45 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 * 1024}
	stopped := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
		case <-stopped:
			return
		}
		shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if server.Shutdown(shutdown) != nil {
			_ = server.Close()
		}
	}()
	log.Printf("[Bot WA] Go + whatsmeow di %s", c.Address)
	err = server.ListenAndServe()
	close(stopped)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func main() {
	if err := run(); err != nil {
		log.Print("[Bot WA] ", err)
		os.Exit(1)
	}
}
