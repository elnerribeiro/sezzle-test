package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"testing"
	"time"
)

// TestServerProcessHelper runs the actual server lifecycle in a subprocess so
// signal handling and process exit codes are covered at the process boundary.
func TestServerProcessHelper(t *testing.T) {
	if os.Getenv("SEZZLE_SERVER_HELPER") != "1" {
		return
	}
	os.Exit(run())
}

// TestUnexpectedListenFailureExitsUnsuccessfully protects the process contract
// relied on by container health monitors and orchestration scripts.
func TestUnexpectedListenFailureExitsUnsuccessfully(t *testing.T) {
	command := serverProcess("127.0.0.1:-1")
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatalf("server process exited successfully after bind failure; output=%s", output)
	}
	if !strings.Contains(string(output), "server stopped") {
		t.Fatalf("expected safe startup error log, got %s", output)
	}
}

// TestRunReturnsFailureForInvalidAddress covers the startup failure status in
// process without relying on the child-process assertion alone.
func TestRunReturnsFailureForInvalidAddress(t *testing.T) {
	t.Setenv("API_ADDRESS", "127.0.0.1:-1")
	if status := run(); status != 1 {
		t.Fatalf("run() status = %d, want 1 for invalid listen address", status)
	}
}

// TestRunReturnsSuccessAfterSignal covers the clean lifecycle branch directly.
func TestRunReturnsSuccessAfterSignal(t *testing.T) {
	address := reserveAddress(t)
	t.Setenv("API_ADDRESS", address)
	status := make(chan int, 1)
	go func() { status <- run() }()
	waitForServer(t, "http://"+address+"/healthz")
	if err := syscall.Kill(syscall.Getpid(), syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-status:
		if got != 0 {
			t.Fatalf("run() status = %d, want clean shutdown status 0", got)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("run() did not finish after SIGTERM")
	}
}

// TestShutdownDeadlineClosesServerAndReturnsFailure verifies the timeout path
// does not leave a process reporting a successful but incomplete shutdown.
func TestShutdownDeadlineClosesServerAndReturnsFailure(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	server := &http.Server{
		Addr: reserveAddress(t),
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			close(started)
			<-release
			w.WriteHeader(http.StatusOK)
		}),
	}
	shutdown := make(chan struct{}, 1)
	status := make(chan int, 1)
	go func() { status <- serveWithSignal(server, shutdown, 10*time.Millisecond) }()
	go func() { _, _ = http.Get("http://" + server.Addr) }()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		close(release)
		t.Fatal("request handler did not start")
	}
	shutdown <- struct{}{}
	select {
	case got := <-status:
		if got != 1 {
			t.Fatalf("shutdown status = %d, want 1 after deadline", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("shutdown did not finish after its deadline")
	}
	close(release)
}

// TestSignalWaitsForActiveRequest verifies shutdown drains an in-flight body
// before the process exits after SIGTERM.
func TestSignalWaitsForActiveRequest(t *testing.T) {
	address := reserveAddress(t)
	command := serverProcess(address)
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if command.ProcessState == nil {
			_ = command.Process.Kill()
			_ = command.Wait()
		}
	}()
	waitForServer(t, "http://"+address+"/healthz")

	connection, err := net.DialTimeout("tcp", address, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	body := `{"expression":"2+3"}`
	partial := `{"expression":"2+`
	_, _ = fmt.Fprintf(connection, "POST /api/v1/calculate HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s", address, len(body), partial)
	// Give net/http time to accept the connection and begin reading the partial body.
	time.Sleep(50 * time.Millisecond)
	if err := command.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(connection, strings.TrimPrefix(body, partial)); err != nil {
		t.Fatalf("finish active request body: %v", err)
	}
	_ = connection.SetDeadline(time.Now().Add(5 * time.Second))
	response, err := http.ReadResponse(bufio.NewReader(connection), &http.Request{Method: http.MethodPost})
	if err != nil {
		t.Fatalf("read response for active request: %v", err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read calculation response: %v", err)
	}
	if response.StatusCode != http.StatusOK || !strings.Contains(string(responseBody), `"result":5`) {
		t.Fatalf("response = %d %s, want result 5", response.StatusCode, responseBody)
	}

	if err := command.Wait(); err != nil {
		t.Fatalf("clean signal shutdown returned error: %v", err)
	}
}

func serverProcess(address string) *exec.Cmd {
	command := exec.Command(os.Args[0], "-test.run=^TestServerProcessHelper$")
	command.Env = append(os.Environ(), "SEZZLE_SERVER_HELPER=1", "API_ADDRESS="+address)
	return command
}

func reserveAddress(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	return address
}

func waitForServer(t *testing.T, url string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		response, err := http.Get(url)
		if err == nil {
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("server did not become healthy before timeout")
}
