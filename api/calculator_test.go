// The API package tests cover expression evaluation and externally visible HTTP behavior.
package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestCalculate checks arithmetic results, operator precedence, and parser errors.
func TestCalculate(t *testing.T) {
	tests := []struct {
		name      string
		expr      string
		want      float64
		wantError string
	}{
		{name: "addition", expr: "8+3", want: 11},
		{name: "subtraction", expr: "8-3", want: 5},
		{name: "multiplication", expr: "8*3", want: 24},
		{name: "division", expr: "8/4", want: 2},
		{name: "precedence", expr: "2+3*4", want: 14},
		{name: "parentheses", expr: "(2+3)*4", want: 20},
		{name: "unary minus", expr: "-5+8", want: 3},
		{name: "exponentiation", expr: "2^3", want: 8},
		{name: "right associative exponentiation", expr: "2^3^2", want: 512},
		{name: "negative exponent", expr: "2^-2", want: .25},
		{name: "negative square power", expr: "-2^2", want: -4},
		{name: "square root", expr: "sqrt(81)", want: 9},
		{name: "percentage", expr: "25%", want: .25},
		{name: "decimal", expr: "0.1+0.2", want: .30000000000000004},
		{name: "division by zero", expr: "8/0", wantError: "division_by_zero"},
		{name: "negative square root", expr: "sqrt(-1)", wantError: "invalid_expression"},
		{name: "unknown token", expr: "2&3", wantError: "invalid_expression"},
		{name: "unclosed parenthesis", expr: "(2+3", wantError: "invalid_expression"},
		{name: "empty expression", expr: " ", wantError: "invalid_request"},
		{name: "overflow", expr: "1e308*1e308", wantError: "result_out_of_range"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, err := json.Marshal(map[string]string{"expression": tt.expr})
			if err != nil {
				t.Fatal(err)
			}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewReader(body))
			NewHandler().ServeHTTP(recorder, request)

			if tt.wantError != "" {
				if recorder.Code < 400 {
					t.Fatalf("status = %d, want error", recorder.Code)
				}
				var got struct {
					Error struct {
						Code          string `json:"code"`
						CorrelationID string `json:"correlation_id"`
					} `json:"error"`
				}
				if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
					t.Fatalf("response is not error JSON: %v", err)
				}
				if got.Error.Code != tt.wantError {
					t.Errorf("error code = %q, want %q", got.Error.Code, tt.wantError)
				}
				if got.Error.CorrelationID == "" {
					t.Error("correlation_id is empty")
				}
				return
			}

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
			var got struct {
				Result float64 `json:"result"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
				t.Fatalf("response is not result JSON: %v", err)
			}
			if got.Result != tt.want {
				t.Errorf("result = %v, want %v", got.Result, tt.want)
			}
		})
	}
}

// TestCalculateRejectsInvalidRequests rejects malformed JSON and unexpected fields.
func TestCalculateRejectsInvalidRequests(t *testing.T) {
	for _, body := range []string{
		`{"expression":4}`,
		`{"expression":"1+2","admin":true}`,
		`{"expression":"1+2"} {}`,
		`{"expression":"1+2"`,
	} {
		t.Run(body, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body))
			NewHandler().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusBadRequest, recorder.Body.String())
			}
		})
	}
}

// TestHealth verifies the liveness endpoint returns a small healthy response.
func TestHealth(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	NewHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte(`"status":"ok"`)) {
		t.Fatalf("response = %d %s, want healthy JSON", recorder.Code, recorder.Body.String())
	}
}

// TestUnknownRouteReturnsStableError checks the public not-found error contract.
func TestUnknownRouteReturnsStableError(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/does-not-exist", nil)
	NewHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	var got struct {
		Error struct {
			Code          string `json:"code"`
			CorrelationID string `json:"correlation_id"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not error JSON: %v", err)
	}
	if got.Error.Code != "not_found" || got.Error.CorrelationID == "" {
		t.Fatalf("error = %+v, want not_found and correlation id", got.Error)
	}
}

// TestWrongMethodReturnsStableError checks method errors include a support ID.
func TestWrongMethodReturnsStableError(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/calculate", nil)
	NewHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
	var got struct {
		Error struct {
			Code          string `json:"code"`
			CorrelationID string `json:"correlation_id"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not error JSON: %v", err)
	}
	if got.Error.Code != "method_not_allowed" || got.Error.CorrelationID == "" {
		t.Fatalf("error = %+v, want method_not_allowed and correlation id", got.Error)
	}
}

// TestRecoveryReturnsSafeInternalError ensures panic details stay server-side.
func TestRecoveryReturnsSafeInternalError(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(recoverMiddleware())
	router.GET("/panic", func(*gin.Context) { panic("sensitive implementation detail") })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/panic", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
	if strings.Contains(recorder.Body.String(), "sensitive implementation detail") {
		t.Fatalf("response leaked panic detail: %s", recorder.Body.String())
	}
	var got struct {
		Error struct {
			Code          string `json:"code"`
			CorrelationID string `json:"correlation_id"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not error JSON: %v", err)
	}
	if got.Error.Code != "internal_error" || got.Error.CorrelationID == "" {
		t.Fatalf("error = %+v, want internal_error and correlation id", got.Error)
	}
}
