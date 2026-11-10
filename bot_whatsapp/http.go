package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

type api struct {
	config config
	db     repository
	wa     messenger
	http   *http.Client
}

func newAPI(c config, db repository, wa messenger) http.Handler {
	a := &api{config: c, db: db, wa: wa, http: &http.Client{Timeout: 5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/wa/health", a.health)
	mux.Handle("POST /api/wa/send", a.keyAuth(http.HandlerFunc(a.send)))
	mux.Handle("GET /api/wa/status", a.admin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { respond(w, 200, a.wa.Status()) })))
	mux.Handle("GET /api/wa/qr", a.admin(http.HandlerFunc(a.qr)))
	for _, action := range []string{"connect", "restart", "reset", "logout"} {
		mux.Handle("POST /api/wa/"+action, a.admin(http.HandlerFunc(a.lifecycle(action))))
	}
	mux.Handle("POST /api/wa/ping", a.admin(http.HandlerFunc(a.send)))
	mux.Handle("GET /api/wa/templates", a.admin(http.HandlerFunc(a.templates)))
	mux.Handle("PATCH /api/wa/templates", a.admin(http.HandlerFunc(a.templates)))
	mux.Handle("GET /api/wa/logs", a.admin(http.HandlerFunc(a.logs)))
	mux.Handle("DELETE /api/wa/logs", a.admin(http.HandlerFunc(a.logs)))
	mux.Handle("DELETE /api/wa/logs/{id}", a.admin(http.HandlerFunc(a.logs)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(c.FrontendURL, ",") {
			if origin != "" && origin == strings.TrimSpace(allowed) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}

func respond(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
func problem(w http.ResponseWriter, code int, message string) {
	respond(w, code, map[string]string{"message": message})
}

func decode(w http.ResponseWriter, r *http.Request, body any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 128*1024)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(body); err != nil {
		problem(w, 400, "JSON tidak valid atau terlalu besar.")
		return false
	}
	if decoder.Decode(new(any)) != io.EOF {
		problem(w, 400, "Body harus satu objek JSON.")
		return false
	}
	return true
}

func (a *api) keyAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if a.config.APIKey == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-API-Key")), []byte(a.config.APIKey)) != 1 {
			problem(w, 401, "API key tidak valid.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *api) admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") || strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")) == "" {
			problem(w, 401, "Token tidak ditemukan.")
			return
		}
		request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, a.config.BackendURL+"/api/auth/me", nil)
		if err != nil {
			problem(w, 503, "Verifikasi akses tidak tersedia.")
			return
		}
		request.Header.Set("Authorization", header)
		response, err := a.http.Do(request)
		if err != nil {
			problem(w, 503, "Verifikasi akses tidak tersedia.")
			return
		}
		defer response.Body.Close()
		if response.StatusCode == 401 {
			problem(w, 401, "Token tidak valid atau kedaluwarsa.")
			return
		}
		if response.StatusCode != 200 {
			problem(w, 503, "Verifikasi akses tidak tersedia.")
			return
		}
		var result struct {
			User *struct {
				Role string `json:"role"`
			} `json:"user"`
		}
		if json.NewDecoder(io.LimitReader(response.Body, 64*1024)).Decode(&result) != nil || result.User == nil {
			problem(w, 503, "Verifikasi akses tidak tersedia.")
			return
		}
		if result.User.Role != "admin" {
			problem(w, 403, "Fitur ini hanya untuk admin.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *api) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := a.db.Ping(ctx); err != nil {
		respond(w, 503, map[string]string{"status": "error", "service": "bot-whatsapp", "database": "unavailable"})
		return
	}
	respond(w, 200, map[string]string{"status": "ok", "service": "bot-whatsapp", "runtime": "go", "library": "whatsmeow", "database": "ok"})
}

func (a *api) qr(w http.ResponseWriter, r *http.Request) {
	code := a.wa.QR()
	if code == "" {
		problem(w, 404, "QR code belum tersedia.")
		return
	}
	png, err := qrcode.Encode(code, qrcode.Medium, 300)
	if err != nil {
		problem(w, 500, "Gagal membuat QR code.")
		return
	}
	respond(w, 200, map[string]string{"qr": "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)})
}

func (a *api) lifecycle(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var err error
		message := ""
		switch action {
		case "connect":
			err = a.wa.Start()
			message = "Proses koneksi dimulai. Silakan scan QR code."
		case "restart":
			err = a.wa.Restart(r.Context(), false)
			message = "WhatsApp sedang dihubungkan ulang."
		case "reset":
			err = a.wa.Restart(r.Context(), true)
			message = "Sesi WhatsApp direset. QR baru sedang disiapkan."
		case "logout":
			err = a.wa.Logout(r.Context())
			message = "WhatsApp berhasil diputuskan."
		}
		if err != nil {
			problem(w, 500, err.Error())
			return
		}
		problem(w, 200, message)
	}
}

func (a *api) send(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}
	if !decode(w, r, &body) {
		return
	}
	if _, err := normalizePhone(body.Phone); err != nil {
		problem(w, 400, err.Error())
		return
	}
	if r.URL.Path == "/api/wa/ping" {
		if a.wa.Status().Status != "connected" {
			problem(w, 400, "WhatsApp belum terhubung. Silakan hubungkan WhatsApp terlebih dahulu.")
			return
		}
		location, _ := time.LoadLocation("Asia/Jakarta")
		body.Message = "*Ping!*\nKoneksi Bot WhatsApp aktif dan berjalan normal.\nWaktu: " + time.Now().In(location).Format("02 Jan 2006 15:04:05")
	}
	if strings.TrimSpace(body.Message) == "" || len(body.Message) > 60000 {
		problem(w, 400, "Pesan wajib diisi dan maksimal 60000 byte.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	jid, err := a.wa.Send(ctx, body.Phone, body.Message)
	status := "berhasil"
	var errorMessage *string
	if err != nil {
		status = "gagal"
		message := err.Error()
		errorMessage = &message
	}
	// Record the result even when the calling request has timed out/disconnected.
	logCtx, logCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 3*time.Second)
	defer logCancel()
	if logErr := a.db.InsertLog(logCtx, body.Phone, body.Message, status, errorMessage); logErr != nil {
		log.Print("[Bot WA] Gagal menulis log ke MySQL")
	}
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	respond(w, 200, map[string]any{"message": "Pesan berhasil dikirim.", "success": true, "jid": jid})
}

func templateResponse(settings map[string]string) map[string]any {
	result := map[string]any{"enabled": settings["wa_bot_enabled"] == "true"}
	for key, fallback := range templateDefaults {
		value := settings["wa_template_"+key]
		if value == "" {
			value = fallback
		}
		result[key] = value
	}
	return result
}

func (a *api) templates(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPatch {
		var body map[string]any
		if !decode(w, r, &body) {
			return
		}
		values := make(map[string]string)
		if enabled, ok := body["enabled"].(bool); ok {
			values["wa_bot_enabled"] = strconv.FormatBool(enabled)
		}
		for key := range templateDefaults {
			if value, ok := body[key].(string); ok && strings.TrimSpace(value) != "" {
				values["wa_template_"+key] = strings.TrimSpace(value)
			}
		}
		if err := a.db.SaveSettings(r.Context(), values); err != nil {
			problem(w, 500, "Gagal menyimpan template ke MySQL.")
			return
		}
	}
	settings, err := a.db.Settings(r.Context())
	if err != nil {
		problem(w, 503, "Gagal membaca template dari MySQL.")
		return
	}
	result := templateResponse(settings)
	if r.Method == http.MethodPatch {
		respond(w, 200, map[string]any{"message": "Template berhasil disimpan.", "data": result})
		return
	}
	respond(w, 200, result)
}

func (a *api) logs(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		id := int64(0)
		if raw := r.PathValue("id"); raw != "" {
			var err error
			id, err = strconv.ParseInt(raw, 10, 64)
			if err != nil || id <= 0 {
				problem(w, 400, "ID log tidak valid.")
				return
			}
		}
		if err := a.db.DeleteLogs(r.Context(), id); err != nil {
			problem(w, 500, "Gagal menghapus log dari MySQL.")
			return
		}
		problem(w, 200, "Log notifikasi berhasil dihapus.")
		return
	}
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil {
		limit = 100
	}
	limit = max(1, min(500, limit))
	items, err := a.db.Logs(r.Context(), limit, strings.TrimSpace(r.URL.Query().Get("search")))
	if err != nil {
		problem(w, 503, "Gagal membaca log dari MySQL.")
		return
	}
	respond(w, 200, map[string]any{"logs": items, "total": len(items)})
}
