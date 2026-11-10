package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waAdv"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func TestMySQLURLConfiguration(t *testing.T) {
	c, err := mysqlConfig("mysql://test:p%40ss%3Aword@localhost:3307/unzanet?schema=unused")
	if err != nil || c.Passwd != "p@ss:word" || c.Addr != "127.0.0.1:3307" || c.DBName != "unzanet" || c.User != "test" || !c.ParseTime || c.Loc != time.UTC {
		t.Fatal("URL parsing incompatible", err)
	}
	for _, raw := range []string{"", "postgresql://user:secret@host/db", "mysql://host/db", "mysql://u:p@host/"} {
		if _, err := mysqlConfig(raw); err == nil || strings.Contains(err.Error(), "secret") {
			t.Fatal("invalid URL accepted or leaked")
		}
	}
}

func TestNormalizePhone(t *testing.T) {
	for _, input := range []string{"081234567890", "+62 812-3456-7890", "81234567890"} {
		got, err := normalizePhone(input)
		if err != nil || got != "6281234567890" {
			t.Fatal(input, got, err)
		}
	}
	for _, input := range []string{"", "abc", "123", "123456789012345678901"} {
		if _, err := normalizePhone(input); err == nil {
			t.Fatal("invalid number allowed")
		}
	}
}

func TestSQLiteSessionPersistsAcrossRestartAndDeletes(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "private", "whatsmeow.db")
	w, err := openWhatsApp(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close() })
	device, err := w.store.GetFirstDevice(ctx)
	if err != nil {
		t.Fatal(err)
	}
	jid := types.NewADJID("6281234567890", 0, 1)
	device.ID = &jid
	device.Account = &waAdv.ADVSignedDeviceIdentity{Details: []byte{1}, AccountSignature: make([]byte, 64), AccountSignatureKey: make([]byte, 32), DeviceSignature: make([]byte, 64)}
	if err := device.Save(ctx); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	w, err = openWhatsApp(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	device, err = w.store.GetFirstDevice(ctx)
	if err != nil || device.ID == nil || device.ID.String() != jid.String() {
		t.Fatal("paired session lost", err)
	}
	if err := device.Delete(ctx); err != nil {
		t.Fatal(err)
	}
	device, err = w.store.GetFirstDevice(ctx)
	if err != nil || device.ID != nil {
		t.Fatal("session not removed", err)
	}
}

func TestStaleClientCannotOverwriteStatus(t *testing.T) {
	w, err := openWhatsApp(context.Background(), filepath.Join(t.TempDir(), "session.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	first, _ := w.store.GetFirstDevice(context.Background())
	second, _ := w.store.GetFirstDevice(context.Background())
	oldClient := whatsmeow.NewClient(first, nil)
	active := whatsmeow.NewClient(second, nil)
	w.client = active
	w.onEvent(active, &events.Connected{})
	w.onEvent(oldClient, &events.Disconnected{})
	if status := w.Status(); status.Status != "connected" || status.ConnectedAt == nil || status.Uptime < 0 {
		t.Fatal("stale client overwrote current session")
	}
	w.onEvent(active, &events.LoggedOut{})
	if status := w.Status(); status.Status != "disconnected" || status.QRAvailable || status.ConnectedAt != nil || status.BotNumber != nil {
		t.Fatal("logout leaked stale state")
	}
}
