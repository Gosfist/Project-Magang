package main

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type waStatus struct {
	Status      string  `json:"status"`
	QRAvailable bool    `json:"qrAvailable"`
	Message     string  `json:"message"`
	BotNumber   *string `json:"botNumber"`
	ConnectedAt *int64  `json:"connectedAt"`
	Uptime      int64   `json:"uptime"`
}

type messenger interface {
	Status() waStatus
	QR() string
	Start() error
	Restart(context.Context, bool) error
	Logout(context.Context) error
	Send(context.Context, string, string) (string, error)
}

type whatsApp struct {
	op     sync.Mutex // Serialize lifecycle operations; event callbacks use mu only.
	mu     sync.RWMutex
	root   context.Context
	store  *sqlstore.Container
	db     *sql.DB
	client *whatsmeow.Client
	cancel context.CancelFunc
	wg     sync.WaitGroup
	status waStatus
	qr     string
}

func openWhatsApp(ctx context.Context, filename string) (*whatsApp, error) {
	path, err := filepath.Abs(filename)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, errors.New("gagal membuat direktori sesi WA")
	}
	// Create private before SQLite opens it; WAL/SHM inherit directory protection.
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, errors.New("file sesi WA tidak dapat dibuka")
	}
	f.Close()
	uriPath := filepath.ToSlash(path)
	if !strings.HasPrefix(uriPath, "/") {
		uriPath = "/" + uriPath
	}
	u := url.URL{Scheme: "file", Path: uriPath}
	q := u.Query()
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "busy_timeout(5000)")
	u.RawQuery = q.Encode()
	db, err := sql.Open("sqlite", u.String())
	if err != nil {
		return nil, errors.New("gagal membuka penyimpanan sesi WA")
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	container := sqlstore.NewWithDB(db, "sqlite3", nil)
	if err := container.Upgrade(ctx); err != nil {
		db.Close()
		return nil, errors.New("gagal menyiapkan skema sesi WA")
	}
	return &whatsApp{root: ctx, store: container, db: db, status: waStatus{Status: "disconnected"}}, nil
}

func (w *whatsApp) Status() waStatus {
	w.mu.RLock()
	defer w.mu.RUnlock()
	s := w.status
	s.QRAvailable = w.qr != ""
	if s.Status == "connected" && s.ConnectedAt != nil {
		s.Uptime = max(0, (time.Now().UnixMilli()-*s.ConnectedAt)/1000)
	}
	return s
}
func (w *whatsApp) QR() string { w.mu.RLock(); defer w.mu.RUnlock(); return w.qr }

func (w *whatsApp) Start() error {
	w.op.Lock()
	defer w.op.Unlock()
	w.mu.RLock()
	active := w.client != nil && w.status.Status != "disconnected"
	w.mu.RUnlock()
	if active {
		return nil
	}
	w.stop()
	return w.start()
}

// start/stop require op. Invalidating client before cancellation ignores stale events.
func (w *whatsApp) start() error {
	ctx, cancel := context.WithCancel(w.root)
	device, err := w.store.GetFirstDevice(ctx)
	if err != nil {
		cancel()
		return errors.New("gagal membaca sesi WhatsApp")
	}
	client := whatsmeow.NewClient(device, nil)
	client.ManualHistorySyncDownload = true // Notification bot does not download chat history.
	client.InitialAutoReconnect = true
	client.BackgroundEventCtx = ctx
	client.AddEventHandler(func(event any) { w.onEvent(client, event) })
	w.mu.Lock()
	w.client, w.cancel = client, cancel
	w.qr = ""
	w.status = waStatus{Status: "connecting", Message: "Menghubungkan ke WhatsApp..."}
	w.mu.Unlock()
	var qr <-chan whatsmeow.QRChannelItem
	if device.ID == nil {
		qr, err = client.GetQRChannel(ctx)
		if err != nil {
			w.stop()
			return errors.New("gagal menyiapkan QR WhatsApp")
		}
	}
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		if err := client.ConnectContext(ctx); err != nil {
			w.update(client, func() {
				w.status = waStatus{Status: "disconnected", Message: "Koneksi WhatsApp gagal. Klik Hubungkan untuk mencoba lagi."}
				w.qr = ""
			})
			return
		}
		if qr == nil {
			return
		}
		for {
			select {
			case <-ctx.Done():
				return
			case item, ok := <-qr:
				if !ok {
					return
				}
				w.update(client, func() {
					if w.status.Status == "connected" {
						return
					}
					switch item.Event {
					case "code":
						w.qr = item.Code
						w.status.Status, w.status.Message = "qr_ready", ""
					case "success":
						w.qr = ""
						w.status.Status, w.status.Message = "connecting", "Menyelesaikan koneksi WhatsApp..."
					default:
						w.qr = ""
						w.status = waStatus{Status: "disconnected", Message: "QR kedaluwarsa atau pairing gagal. Klik Hubungkan untuk mencoba lagi."}
					}
				})
			}
		}
	}()
	return nil
}

func (w *whatsApp) update(client *whatsmeow.Client, change func()) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.client == client {
		change()
	}
}

func (w *whatsApp) onEvent(client *whatsmeow.Client, event any) {
	w.update(client, func() {
		switch event.(type) {
		case *events.Connected:
			now := time.Now().UnixMilli()
			number := ""
			if client.Store.ID != nil {
				number = client.Store.ID.User
			}
			w.status = waStatus{Status: "connected", BotNumber: &number, ConnectedAt: &now}
			w.qr = ""
		case *events.Disconnected:
			w.qr = ""
			w.status.ConnectedAt = nil
			w.status.Status, w.status.Message = "disconnected", "Koneksi terputus. Sesi tersimpan akan dihubungkan ulang otomatis."
		case events.PermanentDisconnect:
			w.qr = ""
			w.status = waStatus{Status: "disconnected", Message: "Sesi terputus. Periksa perangkat tertaut, lalu hubungkan atau reset sesi."}
		}
	})
}

func (w *whatsApp) stop() *whatsmeow.Client {
	w.mu.Lock()
	client, cancel := w.client, w.cancel
	w.client, w.cancel, w.qr = nil, nil, ""
	w.status = waStatus{Status: "disconnected"}
	w.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if client != nil {
		client.Disconnect()
	}
	w.wg.Wait()
	return client
}

func (w *whatsApp) Restart(ctx context.Context, reset bool) error {
	w.op.Lock()
	defer w.op.Unlock()
	client := w.stop()
	if reset {
		if client != nil && client.Store.ID != nil {
			if err := client.Store.Delete(ctx); err != nil {
				return errors.New("gagal menghapus sesi lokal WhatsApp")
			}
		} else {
			device, err := w.store.GetFirstDevice(ctx)
			if err != nil {
				return errors.New("gagal membaca sesi WhatsApp")
			}
			if device.ID != nil {
				if err := device.Delete(ctx); err != nil {
					return errors.New("gagal menghapus sesi lokal WhatsApp")
				}
			}
		}
	}
	return w.start()
}

func (w *whatsApp) Logout(ctx context.Context) error {
	w.op.Lock()
	defer w.op.Unlock()
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	if client != nil && client.Store.ID != nil {
		if err := client.Logout(ctx); err != nil {
			return errors.New("logout WhatsApp gagal; coba lagi atau putuskan perangkat dari ponsel sebelum Reset Sesi")
		}
	} else {
		device, err := w.store.GetFirstDevice(ctx)
		if err != nil {
			return errors.New("gagal membaca sesi WhatsApp")
		}
		if device.ID != nil {
			return errors.New("hubungkan sesi dahulu untuk logout, atau putuskan perangkat dari ponsel sebelum Reset Sesi")
		}
	}
	w.stop()
	return nil
}

func normalizePhone(phone string) (string, error) {
	var digits strings.Builder
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			digits.WriteRune(c)
		}
	}
	number := digits.String()
	if strings.HasPrefix(number, "0") {
		number = "62" + number[1:]
	} else if !strings.HasPrefix(number, "62") {
		number = "62" + number
	}
	if len(number) < 9 || len(number) > 15 {
		return "", errors.New("Nomor WhatsApp tidak valid")
	}
	return number, nil
}

func (w *whatsApp) Send(ctx context.Context, phone, text string) (string, error) {
	number, err := normalizePhone(phone)
	if err != nil {
		return "", err
	}
	w.mu.RLock()
	client, connected := w.client, w.status.Status == "connected"
	w.mu.RUnlock()
	if client == nil || !connected {
		return "", errors.New("WhatsApp belum terhubung")
	}
	jid := types.NewJID(number, types.DefaultUserServer)
	_, err = client.SendMessage(ctx, jid, &waE2E.Message{Conversation: proto.String(text)})
	if err != nil {
		return "", errors.New("gagal mengirim pesan WhatsApp; periksa koneksi dan nomor tujuan")
	}
	return jid.String(), nil
}

func (w *whatsApp) Close() error { w.op.Lock(); defer w.op.Unlock(); w.stop(); return w.store.Close() }
