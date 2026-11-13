package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeRepository struct {
	settings map[string]string
	err      error
	logs     []waLog
	limit    int
	search   string
	deleted  int64
}

func (f *fakeRepository) Ping(context.Context) error { return f.err }
func (f *fakeRepository) Settings(context.Context) (map[string]string, error) {
	return f.settings, f.err
}
func (f *fakeRepository) SaveSettings(_ context.Context, values map[string]string) error {
	if f.err != nil {
		return f.err
	}
	for k, v := range values {
		f.settings[k] = v
	}
	return nil
}
func (f *fakeRepository) InsertLog(_ context.Context, phone, text, status string, message *string) error {
	f.logs = append(f.logs, waLog{Target: phone, Text: text, Status: status, ErrorMessage: message})
	return f.err
}
func (f *fakeRepository) Logs(_ context.Context, limit int, search string) ([]waLog, error) {
	f.limit, f.search = limit, search
	return f.logs, f.err
}
func (f *fakeRepository) DeleteLogs(_ context.Context, id int64) error { f.deleted = id; return f.err }

type fakeMessenger struct {
	action string
	err    error
	code   string
	sends  int
	text   string
}

func (f *fakeMessenger) Status() waStatus { return waStatus{Status: "connected"} }
func (f *fakeMessenger) QR() string       { return f.code }
func (f *fakeMessenger) Start() error     { f.action = "connect"; return f.err }
func (f *fakeMessenger) Restart(_ context.Context, reset bool) error {
	f.action = "restart"
	if reset {
		f.action = "reset"
	}
	return f.err
}
func (f *fakeMessenger) Logout(context.Context) error { f.action = "logout"; return f.err }
func (f *fakeMessenger) Send(_ context.Context, phone, text string) (string, error) {
	f.sends++
	f.text = text
	number, err := normalizePhone(phone)
	if err != nil {
		return "", err
	}
	return number + "@s.whatsapp.net", f.err
}

func request(handler http.Handler, method, path, body, auth string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Authorization", auth)
	r.Header.Set("X-API-Key", auth)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func testAPI(t *testing.T, role string, status int) (http.Handler, *fakeRepository, *fakeMessenger) {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/auth/me" || r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("invalid backend auth request")
		}
		respond(w, status, map[string]any{"user": map[string]string{"role": role}})
	}))
	t.Cleanup(backend.Close)
	db := &fakeRepository{settings: make(map[string]string), logs: []waLog{}, deleted: -1}
	wa := &fakeMessenger{}
	return newAPI(config{BackendURL: backend.URL, APIKey: "test-key", FrontendURL: "http://localhost:3000"}, db, wa), db, wa
}

func TestManagementAuthorization(t *testing.T) {
	for _, role := range []string{"admin", "finance", "sales", "kolektor", "teknisi"} {
		t.Run(role, func(t *testing.T) {
			a, _, wa := testAPI(t, role, 200)
			for _, route := range []struct{ method, path, body string }{
				{"GET", "/status", ""}, {"GET", "/qr", ""}, {"POST", "/connect", ""}, {"POST", "/restart", ""}, {"POST", "/reset", ""}, {"POST", "/logout", ""},
				{"POST", "/ping", `{"phone":"081234567890"}`}, {"GET", "/templates", ""}, {"PATCH", "/templates", `{"enabled":true}`},
				{"GET", "/logs", ""}, {"DELETE", "/logs", ""}, {"DELETE", "/logs/1", ""},
			} {
				result := request(a, route.method, "/api/wa"+route.path, route.body, "Bearer test-token")
				if role != "admin" && result.Code != 403 {
					t.Errorf("%s %s: got %d", route.method, route.path, result.Code)
				}
				if role == "admin" && result.Code != 200 && !(route.path == "/qr" && result.Code == 404) {
					t.Errorf("admin %s: %d %s", route.path, result.Code, result.Body.String())
				}
			}
			if role != "admin" && (wa.action != "" || wa.sends != 0) {
				t.Fatal("unauthorized action executed")
			}
		})
	}
}

func TestAuthorizationFailsClosed(t *testing.T) {
	for _, status := range []int{401, 403, 500, 302} {
		a, _, _ := testAPI(t, "admin", status)
		if got := request(a, "GET", "/api/wa/status", "", "Bearer test-token").Code; got != map[bool]int{true: 401, false: 503}[status == 401] {
			t.Errorf("backend %d returned %d", status, got)
		}
	}
	a, _, _ := testAPI(t, "admin", 200)
	for _, auth := range []string{"", "test-key", "Bearer "} {
		if request(a, "GET", "/api/wa/status", "", auth).Code != 401 {
			t.Fatal("missing token allowed")
		}
	}
}

func TestBackendSendContract(t *testing.T) {
	a, db, wa := testAPI(t, "admin", 200)
	if request(a, "POST", "/api/wa/send", `{"phone":"081234567890","message":"Tagihan"}`, "wrong").Code != 401 || wa.sends != 0 {
		t.Fatal("invalid API key allowed")
	}
	result := request(a, "POST", "/api/wa/send", `{"phone":"081234567890","message":"Tagihan"}`, "test-key")
	if result.Code != 200 || !strings.Contains(result.Body.String(), `"jid":"6281234567890@s.whatsapp.net"`) || !strings.Contains(result.Body.String(), `"success":true`) {
		t.Fatal(result.Code, result.Body.String())
	}
	if len(db.logs) != 1 || db.logs[0].Status != "berhasil" || db.logs[0].Text != "Tagihan" {
		t.Fatal("send log lost")
	}
	wa.err = errors.New("offline")
	if request(a, "POST", "/api/wa/send", `{"phone":"081234567890","message":"Tagihan"}`, "test-key").Code != 500 || db.logs[1].Status != "gagal" {
		t.Fatal("send failure not recorded")
	}
	for _, body := range []string{`{"phone":"","message":"test"}`, `{"phone":123,"message":"test"}`, `{"phone":"081234567890","message":""}`, `{} {}`, `{`} {
		if request(a, "POST", "/api/wa/send", body, "test-key").Code != 400 {
			t.Errorf("invalid body allowed: %s", body)
		}
	}
}

func TestTemplateAndLogsContract(t *testing.T) {
	a, db, _ := testAPI(t, "admin", 200)
	r := request(a, "PATCH", "/api/wa/templates", `{"enabled":true,"sales":"  Halo {nama}  ","unknown":"ignored"}`, "Bearer test-token")
	if r.Code != 200 || db.settings["wa_bot_enabled"] != "true" || db.settings["wa_template_sales"] != "Halo {nama}" || len(db.settings) != 2 {
		t.Fatal(r.Code, r.Body.String(), db.settings)
	}
	r = request(a, "GET", "/api/wa/templates", "", "Bearer test-token")
	if !strings.Contains(r.Body.String(), `"enabled":true`) || !strings.Contains(r.Body.String(), `"deposit_accepted"`) {
		t.Fatal("template response incompatible")
	}
	r = request(a, "GET", "/api/wa/logs?limit=999&search=%20nama%20", "", "Bearer test-token")
	if r.Code != 200 || db.limit != 500 || db.search != "nama" || !strings.Contains(r.Body.String(), `"logs":[]`) {
		t.Fatal(r.Body.String(), db.limit, db.search)
	}
	if request(a, "DELETE", "/api/wa/logs/-1", "", "Bearer test-token").Code != 400 || db.deleted != -1 {
		t.Fatal("invalid ID deletes logs")
	}
	if request(a, "DELETE", "/api/wa/logs/12", "", "Bearer test-token").Code != 200 || db.deleted != 12 {
		t.Fatal("single delete incompatible")
	}
	db.err = errors.New("database failure with secret")
	for _, path := range []string{"/templates", "/logs", "/health"} {
		r = request(a, "GET", "/api/wa"+path, "", "Bearer test-token")
		if r.Code != 503 || strings.Contains(r.Body.String(), "secret") {
			t.Fatal("DB failure hidden or leaked", path, r.Body.String())
		}
	}
}

func TestQRAndCORS(t *testing.T) {
	a, _, wa := testAPI(t, "admin", 200)
	wa.code = "test QR payload"
	r := request(a, "GET", "/api/wa/qr", "", "Bearer test-token")
	if r.Code != 200 || !strings.Contains(r.Body.String(), "data:image/png;base64,iVBOR") || r.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("QR contract incompatible")
	}
	for _, origin := range []string{"http://localhost:3000", "https://evil.test"} {
		req := httptest.NewRequest("OPTIONS", "/api/wa/status", nil)
		req.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		a.ServeHTTP(w, req)
		if (w.Header().Get("Access-Control-Allow-Origin") == origin) != (origin == "http://localhost:3000") {
			t.Fatal("CORS mismatch")
		}
	}
}

func TestTerminationTemplatesCanBeReadAndSaved(t *testing.T) {
	a, db, _ := testAPI(t, "admin", 200)
	r := request(a, "GET", "/api/wa/templates", "", "Bearer test-token")
	if r.Code != 200 || !strings.Contains(r.Body.String(), `"termination_approved"`) || !strings.Contains(r.Body.String(), `"termination_completed"`) || !strings.Contains(r.Body.String(), "{prorata}") {
		t.Fatal("missing termination templates", r.Body.String())
	}
	r = request(a, "PATCH", "/api/wa/templates", `{"termination_approved":"Halo {nama}, total {total_tagihan}","termination_completed":"Diambil {nama_petugas}"}`, "Bearer test-token")
	if r.Code != 200 || db.settings["wa_template_termination_approved"] != "Halo {nama}, total {total_tagihan}" || db.settings["wa_template_termination_completed"] != "Diambil {nama_petugas}" {
		t.Fatal("termination templates not saved", r.Code, r.Body.String())
	}
	r = request(a, "GET", "/api/wa/templates", "", "Bearer test-token")
	if !strings.Contains(r.Body.String(), "Diambil {nama_petugas}") {
		t.Fatal("saved collection template not returned", r.Body.String())
	}
}
