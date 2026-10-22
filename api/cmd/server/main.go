package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/elnerribeiro/sezzle-test/api"
)

// main configures structured logging and runs the HTTP API with graceful shutdown.
func main() {
	os.Exit(run())
}

// run serves HTTP until an unexpected server failure or a signal-driven
// shutdown completes; its status is suitable for container/process monitors.
func run() int {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	address := os.Getenv("API_ADDRESS")
	if address == "" {
		address = ":8080"
	}
	server := &http.Server{Addr: address, Handler: api.NewHandler(), ReadHeaderTimeout: 5 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return serveWithSignal(server, ctx.Done(), 5*time.Second)
}

// serveWithSignal keeps lifecycle decisions testable while coordinating the
// listener result with the signal-triggered graceful shutdown.
func serveWithSignal(server *http.Server, shutdown <-chan struct{}, timeout time.Duration) int {
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.ListenAndServe() }()

	select {
	case <-shutdown:
		shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
		shutdownErr := server.Shutdown(shutdownCtx)
		cancel()
		if shutdownErr != nil {
			slog.Error("server shutdown failed", "error_type", "http_shutdown")
			_ = server.Close()
			<-serveResult
			return 1
		}
		if err := <-serveResult; err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error_type", "http")
			return 1
		}
		return 0
	case err := <-serveResult:
		if err == nil || errors.Is(err, http.ErrServerClosed) {
			return 0
		}
		slog.Error("server stopped", "error_type", "http")
		return 1
	}
}
