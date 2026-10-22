// Package api exposes the calculator HTTP endpoints and safe error contracts.
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type calculateRequest struct {
	// A pointer distinguishes a missing expression from an explicitly empty one.
	Expression *string `json:"expression"`
}

// apiError is the stable, implementation-independent shape of API failures.
type apiError struct {
	Error struct {
		Code          string `json:"code"`
		CorrelationID string `json:"correlation_id"`
	} `json:"error"`
}

// NewHandler builds the Gin routes, recovery middleware, and method/route errors.
func NewHandler() http.Handler {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.HandleMethodNotAllowed = true
	router.Use(recoverMiddleware())
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.POST("/api/v1/calculate", calculateHandler)
	router.NoRoute(func(c *gin.Context) {
		writeError(c, http.StatusNotFound, "not_found", "")
	})
	router.NoMethod(func(c *gin.Context) {
		writeError(c, http.StatusMethodNotAllowed, "method_not_allowed", "")
	})
	return router
}

// recoverMiddleware converts panics to safe errors and logs a support reference.
func recoverMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				correlationID := newCorrelationID()
				slog.Error("request recovered", "code", "internal_error", "correlation_id", correlationID)
				c.Abort()
				writeError(c, http.StatusInternalServerError, "internal_error", correlationID)
			}
		}()
		c.Next()
	}
}

// calculateHandler validates a bounded JSON request and returns a result or error code.
func calculateHandler(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	var request calculateRequest
	if err := decoder.Decode(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid_request", "")
		return
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeError(c, http.StatusBadRequest, "invalid_request", "")
		return
	}
	if request.Expression == nil || strings.TrimSpace(*request.Expression) == "" {
		writeError(c, http.StatusBadRequest, "invalid_request", "")
		return
	}
	result, err := calculate(*request.Expression)
	if err != nil {
		code := "invalid_expression"
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, errDivisionByZero):
			code = "division_by_zero"
		case errors.Is(err, errResultOutOfRange):
			code = "result_out_of_range"
			status = http.StatusUnprocessableEntity
		}
		writeError(c, status, code, "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": result})
}

// writeError emits the public error envelope and ensures it has a support reference.
func writeError(c *gin.Context, status int, code, correlationID string) {
	if correlationID == "" {
		correlationID = newCorrelationID()
	}
	var response apiError
	response.Error.Code = code
	response.Error.CorrelationID = correlationID
	c.JSON(status, response)
}

// newCorrelationID returns a random opaque identifier for support and log correlation.
func newCorrelationID() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		slog.Error("correlation id generation failed", "error_type", "crypto/rand")
		return "unavailable"
	}
	return hex.EncodeToString(value[:])
}
